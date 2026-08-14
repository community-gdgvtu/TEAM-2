"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RppgPipeline } from "@/lib/rppg/pipeline";
import type { Beat, CameraStatus, RppgEngine, RppgSnapshot } from "@/lib/rppg/types";

// Fixed, centered region-of-interest as a fraction of the video frame.
// No face detector here on purpose (keeps this dependency-free and fast) —
// the UI shows a guide oval and asks the player to line their face up in it.
const ROI = { xFrac: 0.32, yFrac: 0.18, wFrac: 0.36, hFrac: 0.36 };
const SAMPLE_CANVAS_SIZE = 32; // downsample ROI to this many px per side before averaging

export function useRppg(): RppgEngine & { stop: () => void } {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pipelineRef = useRef<RppgPipeline>(new RppgPipeline());
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const rvfcRef = useRef<number | null>(null);

  const [status, setStatus] = useState<CameraStatus>("idle");
  const [snapshot, setSnapshot] = useState<RppgSnapshot>({
    heartRateBpm: null,
    quality: 0,
    recentBeats: [],
  });

  const sampleFrame = useCallback(() => {
    const video = videoRef.current;
    if (!sampleCanvasRef.current) {
      sampleCanvasRef.current = document.createElement("canvas");
      sampleCanvasRef.current.width = SAMPLE_CANVAS_SIZE;
      sampleCanvasRef.current.height = SAMPLE_CANVAS_SIZE;
    }
    const canvas = sampleCanvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!video || !ctx || video.readyState < 2 || video.videoWidth === 0) return;

    const sx = ROI.xFrac * video.videoWidth;
    const sy = ROI.yFrac * video.videoHeight;
    const sw = ROI.wFrac * video.videoWidth;
    const sh = ROI.hFrac * video.videoHeight;

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, SAMPLE_CANVAS_SIZE, SAMPLE_CANVAS_SIZE);
    const { data } = ctx.getImageData(0, 0, SAMPLE_CANVAS_SIZE, SAMPLE_CANVAS_SIZE);

    let r = 0;
    let g = 0;
    let b = 0;
    const pixels = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    r /= pixels;
    g /= pixels;
    b /= pixels;

    pipelineRef.current.push({ t: performance.now(), r, g, b });
  }, []);

  const start = useCallback(async () => {
    // Declared here (not as a hook-level useCallback) so the recursive
    // rVFC/rAF self-scheduling doesn't need a ref indirection.
    function loop() {
      sampleFrame();
      const video = videoRef.current;
      if (video && "requestVideoFrameCallback" in video) {
        rvfcRef.current = (video as HTMLVideoElement & {
          requestVideoFrameCallback: (cb: () => void) => number;
        }).requestVideoFrameCallback(loop);
      } else {
        rafRef.current = requestAnimationFrame(loop);
      }
    }

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
      pipelineRef.current.reset();
      setStatus("ready");
      loop();
      return "ready" as const;
    } catch (err) {
      const name = (err as DOMException)?.name;
      const final = name === "NotAllowedError" || name === "PermissionDeniedError" ? "denied" : "error";
      setStatus(final);
      return final;
    }
  }, [sampleFrame]);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (rvfcRef.current !== null && videoRef.current && "cancelVideoFrameCallback" in videoRef.current) {
      (videoRef.current as HTMLVideoElement & { cancelVideoFrameCallback: (h: number) => void }).cancelVideoFrameCallback(
        rvfcRef.current
      );
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStatus("idle");
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setSnapshot(pipelineRef.current.getSnapshot());
    }, 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => stop, [stop]);

  const getBeatsSince = useCallback((windowMs: number): Beat[] => {
    return pipelineRef.current.getRecentBeats(windowMs);
  }, []);

  return { videoRef, status, snapshot, start, stop, getBeatsSince, roi: ROI };
}
