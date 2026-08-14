import type { Beat } from "@/lib/rppg/types";

export interface HrvFeatures {
  /** number of inter-beat intervals used */
  n: number;
  meanHrBpm: number;
  /** SDNN: std dev of NN (inter-beat) intervals, ms */
  sdnnMs: number;
  /** RMSSD: root mean square of successive IBI differences, ms */
  rmssdMs: number;
  /** % of successive IBI differences that exceed 50ms */
  pnn50: number;
}

/**
 * Compute time-domain HRV features from a list of beats (already time-ordered).
 * Returns null when there isn't enough data for a meaningful estimate.
 */
export function computeHrvFeatures(beats: Beat[], minBeats = 6): HrvFeatures | null {
  if (beats.length < minBeats) return null;

  const ibis = beats.map((b) => b.ibiMs);
  const meanIbi = mean(ibis);
  const sdnnMs = stdDev(ibis);
  const meanHrBpm = 60000 / meanIbi;

  const diffs: number[] = [];
  for (let i = 1; i < ibis.length; i++) diffs.push(ibis[i] - ibis[i - 1]);

  const rmssdMs = Math.sqrt(mean(diffs.map((d) => d * d)));
  const pnn50 = diffs.length ? diffs.filter((d) => Math.abs(d) > 50).length / diffs.length : 0;

  return { n: beats.length, meanHrBpm, sdnnMs, rmssdMs, pnn50 };
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdDev(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}
