import type { InferenceSession } from "onnxruntime-web/wasm";

export const CLIP_FRAMES = 128;
export const CLIP_SECONDS = 20;
export const CROP_SIZE = 112;
/** waveform sample rate: clip_frames / clip_seconds, per the model's training setup */
export const WAVEFORM_FS = CLIP_FRAMES / CLIP_SECONDS;

const MODEL_URL = "/models/vision_cardio_rppg.onnx";

let sessionPromise: Promise<InferenceSession> | null = null;

/**
 * Lazily loads the PhysNet ONNX model (converted from
 * huggingface.co/hyunseop/vision-cardio-rppg, rppg_physnet_ubfc.pt) exactly once.
 * Runs single-threaded WASM on CPU — no COOP/COEP cross-origin-isolation headers
 * required, at the cost of being slower than a threaded/WebGPU build. `wasm.proxy`
 * offloads the actual inference to a Web Worker onnxruntime-web spins up
 * internally, so a several-second forward pass doesn't freeze the game's
 * canvas render loop or the rest of the page.
 */
export async function loadModel(): Promise<InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await import("onnxruntime-web/wasm");
      ort.env.wasm.wasmPaths = "/ort/";
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = true;
      return ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });
    })();
  }
  return sessionPromise;
}

/**
 * Runs one forward pass. `clip` must be a Float32Array of length
 * 3 * CLIP_FRAMES * CROP_SIZE * CROP_SIZE in NCDHW order (channel, time, height, width),
 * RGB values normalized to [0,1]. Returns the predicted pulse waveform (length CLIP_FRAMES).
 */
export async function runInference(clip: Float32Array): Promise<Float32Array> {
  const ort = await import("onnxruntime-web/wasm");
  const session = await loadModel();
  const tensor = new ort.Tensor("float32", clip, [1, 3, CLIP_FRAMES, CROP_SIZE, CROP_SIZE]);
  const outputs = await session.run({ clip: tensor });
  const waveform = outputs.waveform.data as Float32Array;
  return waveform;
}
