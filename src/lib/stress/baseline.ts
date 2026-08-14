import type { Beat } from "@/lib/rppg/types";
import { computeHrvFeatures } from "@/lib/hrv/features";
import { BASELINE_CONFIG, DEVIATION_CONFIG } from "./config";

export interface PersonalBaseline {
  rmssdMeanMs: number;
  rmssdStdMs: number;
  hrMeanBpm: number;
  beatsUsed: number;
}

/** Build a personal baseline from beats collected during the calibration screen. */
export function computeBaseline(calibrationBeats: Beat[]): PersonalBaseline | null {
  if (calibrationBeats.length < BASELINE_CONFIG.minBeatsForBaseline) return null;

  // Slide a 5s window across the calibration recording and sample RMSSD repeatedly,
  // so we get a distribution (mean + spread) rather than a single point estimate.
  const samples: number[] = [];
  const hrSamples: number[] = [];
  const stepMs = 2000;
  const t0 = calibrationBeats[0].t;
  const t1 = calibrationBeats[calibrationBeats.length - 1].t;

  for (let wStart = t0; wStart < t1; wStart += stepMs) {
    const wEnd = wStart + DEVIATION_CONFIG.windowMs;
    const windowBeats = calibrationBeats.filter((b) => b.t >= wStart && b.t <= wEnd);
    const features = computeHrvFeatures(windowBeats, 4);
    if (features) {
      samples.push(features.rmssdMs);
      hrSamples.push(features.meanHrBpm);
    }
  }

  if (samples.length === 0) {
    const whole = computeHrvFeatures(calibrationBeats, BASELINE_CONFIG.minBeatsForBaseline);
    if (!whole) return null;
    return {
      rmssdMeanMs: whole.rmssdMs,
      rmssdStdMs: DEVIATION_CONFIG.minBaselineStdMs,
      hrMeanBpm: whole.meanHrBpm,
      beatsUsed: calibrationBeats.length,
    };
  }

  const rmssdMeanMs = mean(samples);
  const rmssdStdMs = Math.max(stdDev(samples), DEVIATION_CONFIG.minBaselineStdMs);
  const hrMeanBpm = mean(hrSamples);

  return { rmssdMeanMs, rmssdStdMs, hrMeanBpm, beatsUsed: calibrationBeats.length };
}

export interface DeviationEvent {
  t: number;
  direction: "elevated" | "lowered";
  rmssdMs: number;
}

/**
 * Tracks rolling HRV windows during gameplay against a personal baseline and
 * flags a "persistent deviation" once several consecutive windows in a row
 * fall outside the child's own baseline range — a single noisy window is
 * ignored on purpose.
 */
export class DeviationTracker {
  private baseline: PersonalBaseline;
  private consecutiveDeviating = 0;
  private lastDirection: "elevated" | "lowered" | null = null;
  private events: DeviationEvent[] = [];

  constructor(baseline: PersonalBaseline) {
    this.baseline = baseline;
  }

  /** Call periodically (e.g. every windowMs) with the beats seen in the most recent window. */
  ingestWindow(t: number, windowBeats: Beat[]): DeviationEvent | null {
    const features = computeHrvFeatures(windowBeats, 4);
    if (!features) {
      this.consecutiveDeviating = 0;
      return null;
    }

    const delta = features.rmssdMs - this.baseline.rmssdMeanMs;
    const threshold = DEVIATION_CONFIG.deviationStdMultiplier * this.baseline.rmssdStdMs;
    const isDeviating = Math.abs(delta) > threshold;
    const direction: "elevated" | "lowered" = delta < 0 ? "elevated" : "lowered";
    // "elevated" stress <-> lower RMSSD than baseline; "lowered" stress <-> higher RMSSD (unusually relaxed)

    if (!isDeviating) {
      this.consecutiveDeviating = 0;
      this.lastDirection = null;
      return null;
    }

    if (direction === this.lastDirection) {
      this.consecutiveDeviating += 1;
    } else {
      this.consecutiveDeviating = 1;
      this.lastDirection = direction;
    }

    if (this.consecutiveDeviating >= DEVIATION_CONFIG.persistenceWindows) {
      const event: DeviationEvent = { t, direction, rmssdMs: features.rmssdMs };
      this.events.push(event);
      this.consecutiveDeviating = 0; // require a fresh run before flagging again
      return event;
    }
    return null;
  }

  getEvents(): DeviationEvent[] {
    return this.events.slice();
  }
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdDev(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}
