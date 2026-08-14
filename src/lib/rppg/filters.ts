/**
 * Minimal biquad bandpass filter (RBJ Audio EQ Cookbook formulas).
 * Used to isolate the plausible human heart-rate band (~0.7-4 Hz, 42-240 bpm)
 * from the raw POS pulse signal before peak detection.
 */
export class BiquadBandpass {
  private b0 = 0;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;

  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  constructor(sampleRateHz: number, centerFreqHz: number, q: number) {
    const w0 = (2 * Math.PI * centerFreqHz) / sampleRateHz;
    const alpha = Math.sin(w0) / (2 * q);
    const cosW0 = Math.cos(w0);

    const b0 = alpha;
    const b1 = 0;
    const b2 = -alpha;
    const a0 = 1 + alpha;
    const a1 = -2 * cosW0;
    const a2 = 1 - alpha;

    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
  }

  process(x: number): number {
    const y =
      this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/** Center frequency 2.2 Hz (~132 bpm) with a wide-ish Q so 42-240 bpm passes reasonably. */
export function createHeartRateBandpass(sampleRateHz: number): BiquadBandpass {
  return new BiquadBandpass(sampleRateHz, 2.2, 0.7);
}
