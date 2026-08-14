import type { RefObject } from "react";

// Shared types for the rPPG pipeline.
// Method credit: classical POS (Plane-Orthogonal-to-Skin) algorithm, the same
// classical technique benchmarked in ebowwa/rppg-vitalsigns (Wang et al. 2017,
// "Algorithmic Principles of Remote-PPG"). Ported here to run client-side in
// the browser so camera frames never leave the device.

export interface RgbSample {
  /** milliseconds, from performance.now() */
  t: number;
  r: number;
  g: number;
  b: number;
}

export interface PulseSample {
  t: number;
  value: number;
}

export interface Beat {
  /** timestamp of the detected peak, ms */
  t: number;
  /** inter-beat interval since the previous beat, ms */
  ibiMs: number;
}

export interface RppgSnapshot {
  /** instantaneous heart rate estimate, bpm (smoothed), null if not enough data yet */
  heartRateBpm: number | null;
  /** signal quality 0..1, rough heuristic */
  quality: number;
  recentBeats: Beat[];
}

export type CameraStatus = "idle" | "requesting" | "ready" | "denied" | "error";

/** Fractional region-of-interest box within the video frame (0..1). */
export interface Roi {
  xFrac: number;
  yFrac: number;
  wFrac: number;
  hFrac: number;
}

export type ModelStatus = "loading" | "ready" | "error";

/**
 * Shared shape both pulse-extraction engines (classical POS signal processing
 * and the ONNX PhysNet model) expose, so the game/calibration/report UI in
 * PlaySession.tsx can drive either one interchangeably.
 */
export interface RppgEngine {
  videoRef: RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  snapshot: RppgSnapshot;
  start: () => Promise<CameraStatus>;
  /** beats with timestamp >= now - windowMs */
  getBeatsSince: (windowMs: number) => Beat[];
  roi: Roi;
  /** only meaningful for engines that lazy-load a model asset (e.g. ONNX) */
  modelStatus?: ModelStatus;
  modelError?: string;
}
