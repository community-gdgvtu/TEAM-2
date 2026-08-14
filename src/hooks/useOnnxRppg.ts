"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClipBuffer } from "@/lib/onnx/clipBuffer";
import { CLIP_SECONDS, CLIP_FRAMES, CROP_SIZE, WAVEFORM_FS, loadModel, runInference } from "@/lib/onnx/model";
import { hrFromWaveform, waveformToBeats } from "@/lib/onnx/waveform";
import type { Beat, CameraStatus, ModelStatus, Roi, RppgEngine, RppgSnapshot } from "@/lib/rppg/types";

// Wider, more face-shaped box than the POS engine's small skin patch — the
// model was trained on face crops, not a single cheek/forehead region.
const ROI: Roi = { xFrac: 0.22, yFrac: 0.08, wFrac: 0.56, hFrac: 0.68 };
const SAMPLE_INTERVAL_MS = (CLIP_SECONDS * 1000) / CLIP_FRAMES; // ~156ms, matches the model's ~6.4Hz training rate
// Re-running a 3D-CNN is far heavier than the POS engine's per-frame math, so
// inference is throttled well below the sampling rate (sliding 20s window,
// re-analyzed on this cadence rather than continuously).
const INFERENCE_INTERVAL_MS = 10_000;

export function useOnnxRppg(): RppgEngine & { stop: () => void } {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const clipBufferRef = useRef(new ClipBuffer());
  const beatsRef = useRef<Beat[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const sampleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inferenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inferenceInFlightRef = useRef(false);
  const hasTriggeredFirstInferenceRef = useRef(false);

  const [status, setStatus] = useState<CameraStatus>("idle");
  const [modelStatus, setModelStatus] = useState<ModelStatus>("loading");
  const [modelError, setModelError] = useState<string | undefined>();
  const [snapshot, setSnapshot] = useState<RppgSnapshot>({
    heartRateBpm: null,
    quality: 0,
    recentBeats: [],
  });

  // start loading the (multi-MB) model as soon as this engine is mounted, in
  // parallel with the user granting camera permission, so it's warm by the
  // time the first 20s clip is ready.
  useEffect(() => {
    let cancelled = false;
    loadModel()
      .then(() => {
        if (!cancelled) setModelStatus("ready");
      })
      .catch((err) => {
        if (!cancelled) {
          setModelStatus("error");
          setModelError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const runInferenceIfReady = useCallback(async () => {
    if (inferenceInFlightRef.current) return;
    if (!clipBufferRef.current.isFull()) return;
    inferenceInFlightRef.current = true;
    try {
      const tensor = clipBufferRef.current.buildTensor();
      const timestamps = clipBufferRef.current.getTimestamps();
      const waveform = await runInference(tensor);
      const heartRateBpm = hrFromWaveform(waveform, WAVEFORM_FS);
      const beats = waveformToBeats(waveform, timestamps);
      beatsRef.current = beats;
      setSnapshot({
        heartRateBpm,
        quality: Math.max(0, Math.min(1, beats.length / 8)),
        recentBeats: beats,
      });
    } catch (err) {
      setModelStatus("error");
      setModelError(err instanceof Error ? err.message : String(err));
    } finally {
      inferenceInFlightRef.current = false;
    }
  }, []);

  const sampleFrame = useCallback(() => {
    const video = videoRef.current;
    if (!sampleCanvasRef.current) {
      sampleCanvasRef.current = document.createElement("canvas");
      sampleCanvasRef.current.width = CROP_SIZE;
      sampleCanvasRef.current.height = CROP_SIZE;
    }
    const canvas = sampleCanvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!video || !ctx || video.readyState < 2 || video.videoWidth === 0) return;

    const sx = ROI.xFrac * video.videoWidth;
    const sy = ROI.yFrac * video.videoHeight;
    const sw = ROI.wFrac * video.videoWidth;
    const sh = ROI.hFrac * video.videoHeight;

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, CROP_SIZE, CROP_SIZE);
    const { data } = ctx.getImageData(0, 0, CROP_SIZE, CROP_SIZE);

    const hwc = new Float32Array(CROP_SIZE * CROP_SIZE * 3);
    for (let p = 0; p < CROP_SIZE * CROP_SIZE; p++) {
      hwc[p * 3] = data[p * 4] / 255;
      hwc[p * 3 + 1] = data[p * 4 + 1] / 255;
      hwc[p * 3 + 2] = data[p * 4 + 2] / 255;
    }
    clipBufferRef.current.push(hwc, performance.now());

    // The periodic inference timer runs on a fixed schedule from start(), which
    // can land up to INFERENCE_INTERVAL_MS after the clip buffer first fills
    // (~20s in). Fire the first inference the moment enough frames exist so a
    // reading is ready as close to the 20s calibration mark as possible.
    if (!hasTriggeredFirstInferenceRef.current && clipBufferRef.current.isFull()) {
      hasTriggeredFirstInferenceRef.current = true;
      void runInferenceIfReady();
    }
  }, [runInferenceIfReady]);

  const start = useCallback(async (): Promise<CameraStatus> => {
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      clipBufferRef.current = new ClipBuffer();
      beatsRef.current = [];
      hasTriggeredFirstInferenceRef.current = false;
      setStatus("ready");

      sampleTimerRef.current = setInterval(sampleFrame, SAMPLE_INTERVAL_MS);
      inferenceTimerRef.current = setInterval(runInferenceIfReady, INFERENCE_INTERVAL_MS);
      return "ready";
    } catch (err) {
      const name = (err as DOMException)?.name;
      const final = name === "NotAllowedError" || name === "PermissionDeniedError" ? "denied" : "error";
      setStatus(final);
      return final;
    }
  }, [sampleFrame, runInferenceIfReady]);

  const stop = useCallback(() => {
    if (sampleTimerRef.current !== null) clearInterval(sampleTimerRef.current);
    if (inferenceTimerRef.current !== null) clearInterval(inferenceTimerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStatus("idle");
  }, []);

  useEffect(() => stop, [stop]);

  const getBeatsSince = useCallback((windowMs: number): Beat[] => {
    const cutoff = performance.now() - windowMs;
    return beatsRef.current.filter((b) => b.t >= cutoff);
  }, []);

  return { videoRef, status, snapshot, start, stop, getBeatsSince, roi: ROI, modelStatus, modelError };
}
