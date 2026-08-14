import type { RgbSample } from "./types";

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdDev(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

/**
 * POS (Plane-Orthogonal-to-Skin) pulse extraction for a single window of RGB samples.
 * Returns a mean-centered pulse contribution, one value per input sample, meant to be
 * overlap-added into a running pulse buffer by the caller.
 *
 * Ref: Wang, den Brinker, Stuijk, de Haan (2017), "Algorithmic Principles of
 * Remote-PPG" — the same classical method benchmarked in ebowwa/rppg-vitalsigns.
 */
export function posWindowPulse(window: RgbSample[]): number[] {
  const rMean = mean(window.map((s) => s.r)) || 1;
  const gMean = mean(window.map((s) => s.g)) || 1;
  const bMean = mean(window.map((s) => s.b)) || 1;

  const rn = window.map((s) => s.r / rMean);
  const gn = window.map((s) => s.g / gMean);
  const bn = window.map((s) => s.b / bMean);

  // Projection: S1 = Gn - Bn, S2 = -2Rn + Gn + Bn
  const s1 = gn.map((g, i) => g - bn[i]);
  const s2 = rn.map((r, i) => -2 * r + gn[i] + bn[i]);

  const std1 = stdDev(s1);
  const std2 = stdDev(s2);
  const alpha = std2 === 0 ? 0 : std1 / std2;

  const h = s1.map((v, i) => v + alpha * s2[i]);
  const hMean = mean(h);
  return h.map((v) => v - hMean);
}
