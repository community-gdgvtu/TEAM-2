import type { Beat, RgbSample, RppgSnapshot } from "./types";
import { posWindowPulse } from "./pos";
import { createHeartRateBandpass, type BiquadBandpass } from "./filters";

const WINDOW_SEC = 1.6; // POS analysis window length (paper-recommended ~1.6s)
const ASSUMED_FPS = 30; // nominal camera sampling rate we request via getUserMedia
const WINDOW_LEN = Math.round(WINDOW_SEC * ASSUMED_FPS);
const MIN_IBI_MS = 300; // 200 bpm cap
const MAX_IBI_MS = 1500; // 40 bpm floor
const REFRACTORY_MS = 333; // ~180 bpm max instantaneous, guards against double-counting a peak
const KEEP_SEC = 20; // trim buffers to the last N seconds of history
const HR_SMOOTHING = 0.25; // EMA factor for the displayed heart rate

/**
 * Streaming rPPG pipeline: raw per-frame RGB means in -> heart rate + beat
 * timestamps out. Runs entirely client-side.
 *
 * Stages: POS overlap-add (pos.ts) -> heart-rate bandpass (filters.ts) ->
 * peak picking with a refractory window -> smoothed HR / beat list.
 */
export class RppgPipeline {
  private rgb: RgbSample[] = [];
  private pulse: number[] = [];
  private finalizedIndex = -1; // last pulse index whose overlap-add is complete

  private filter: BiquadBandpass = createHeartRateBandpass(ASSUMED_FPS);
  private filteredRecent: number[] = []; // rolling filtered values, for adaptive threshold
  private lastPeakT: number | null = null;
  private lastValue: number | null = null;
  private prevValue: number | null = null;
  private rising = false;

  private beats: Beat[] = [];
  private smoothedHr: number | null = null;

  reset() {
    this.rgb = [];
    this.pulse = [];
    this.finalizedIndex = -1;
    this.filter = createHeartRateBandpass(ASSUMED_FPS);
    this.filteredRecent = [];
    this.lastPeakT = null;
    this.lastValue = null;
    this.prevValue = null;
    this.rising = false;
    this.beats = [];
    this.smoothedHr = null;
  }

  push(sample: RgbSample) {
    this.rgb.push(sample);
    this.pulse.push(0);
    const n = this.rgb.length - 1;

    if (n >= WINDOW_LEN - 1) {
      const start = n - WINDOW_LEN + 1;
      const window = this.rgb.slice(start, n + 1);
      const h = posWindowPulse(window);
      for (let i = 0; i < WINDOW_LEN; i++) {
        this.pulse[start + i] += h[i];
      }
      const frontier = n - WINDOW_LEN; // indices <= frontier are done being overlap-added
      for (let i = this.finalizedIndex + 1; i <= frontier; i++) {
        this.consumeFinalizedSample(i);
      }
      this.finalizedIndex = Math.max(this.finalizedIndex, frontier);
    }

    this.trim();
  }

  private consumeFinalizedSample(index: number) {
    const t = this.rgb[index].t;
    const raw = this.pulse[index];
    const filtered = this.filter.process(raw);

    this.filteredRecent.push(filtered);
    if (this.filteredRecent.length > ASSUMED_FPS * 5) this.filteredRecent.shift();

    if (this.prevValue !== null && this.lastValue !== null) {
      const wasRising = this.rising;
      this.rising = filtered > this.lastValue;
      const isLocalMax = wasRising && !this.rising;
      if (isLocalMax) {
        this.maybeRegisterPeak(t, this.lastValue);
      }
    }

    this.prevValue = this.lastValue;
    this.lastValue = filtered;
  }

  private maybeRegisterPeak(t: number, value: number) {
    const std = stdDev(this.filteredRecent) || 0.0001;
    const threshold = 0.35 * std; // adaptive: peak must clear a fraction of recent signal spread
    if (value < threshold) return;
    if (this.lastPeakT !== null && t - this.lastPeakT < REFRACTORY_MS) return;

    if (this.lastPeakT !== null) {
      const ibi = t - this.lastPeakT;
      if (ibi >= MIN_IBI_MS && ibi <= MAX_IBI_MS) {
        const beat: Beat = { t, ibiMs: ibi };
        this.beats.push(beat);
        const instantBpm = 60000 / ibi;
        this.smoothedHr =
          this.smoothedHr === null
            ? instantBpm
            : this.smoothedHr + HR_SMOOTHING * (instantBpm - this.smoothedHr);
      }
    }
    this.lastPeakT = t;
  }

  private trim() {
    const cutoff = KEEP_SEC * ASSUMED_FPS;
    if (this.rgb.length > cutoff * 1.5) {
      const drop = this.rgb.length - cutoff;
      this.rgb.splice(0, drop);
      this.pulse.splice(0, drop);
      this.finalizedIndex -= drop;
    }
    const beatCutoff = performance.now() - 120_000;
    while (this.beats.length && this.beats[0].t < beatCutoff) this.beats.shift();
  }

  getRecentBeats(windowMs?: number): Beat[] {
    if (!windowMs) return this.beats.slice();
    const cutoff = performance.now() - windowMs;
    return this.beats.filter((b) => b.t >= cutoff);
  }

  getSnapshot(): RppgSnapshot {
    const recent = this.getRecentBeats(10_000);
    // crude quality heuristic: expect ~6-16 beats in a 10s window for a plausible HR (40-200bpm)
    const quality = clamp(recent.length / 10, 0, 1);
    return {
      heartRateBpm: this.smoothedHr,
      quality,
      recentBeats: recent,
    };
  }
}

function stdDev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
