import type { Beat } from "@/lib/rppg/types";

const MIN_IBI_MS = 300; // 200 bpm cap, same physiological guard as the POS pipeline
const MAX_IBI_MS = 1500; // 40 bpm floor

/**
 * HR estimate from the predicted waveform: FFT peak in the physiological band.
 * Direct DFT restricted to the [loHz, hiHz] band — N=128 so this is cheap even
 * computed naively (no need for a full FFT implementation).
 * Mirrors physnet.py's hr_from_wave().
 */
export function hrFromWaveform(waveform: Float32Array, fs: number, loHz = 0.7, hiHz = 3.0): number | null {
  const n = waveform.length;
  if (n < 4) return null;

  let mean = 0;
  for (let i = 0; i < n; i++) mean += waveform[i];
  mean /= n;

  const windowed = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    windowed[i] = (waveform[i] - mean) * hann;
  }

  const freqStep = fs / n;
  let bestFreq = 0;
  let bestPower = -Infinity;
  const maxBin = Math.floor(n / 2);
  for (let k = 0; k <= maxBin; k++) {
    const freq = k * freqStep;
    if (freq < loHz || freq > hiHz) continue;
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      const angle = (-2 * Math.PI * k * i) / n;
      re += windowed[i] * Math.cos(angle);
      im += windowed[i] * Math.sin(angle);
    }
    const power = re * re + im * im;
    if (power > bestPower) {
      bestPower = power;
      bestFreq = freq;
    }
  }

  return bestFreq > 0 ? bestFreq * 60 : null;
}

/**
 * Picks local-maxima peaks in the predicted waveform and pairs them into beats
 * using the real capture timestamps of each of the 128 sampled frames. Coarser
 * than the POS pipeline's peak detector (the model's effective sample rate is
 * only ~6.4 Hz vs POS's ~30 Hz), so beat timing here is approximate.
 */
export function waveformToBeats(waveform: Float32Array, timestamps: number[]): Beat[] {
  const n = waveform.length;
  if (n !== timestamps.length || n < 3) return [];

  let meanAbs = 0;
  for (let i = 0; i < n; i++) meanAbs += Math.abs(waveform[i]);
  meanAbs /= n;
  const threshold = 0.3 * meanAbs;

  const beats: Beat[] = [];
  let lastPeakT: number | null = null;

  for (let i = 1; i < n - 1; i++) {
    const isPeak = waveform[i] > waveform[i - 1] && waveform[i] >= waveform[i + 1] && waveform[i] > threshold;
    if (!isPeak) continue;

    const t = timestamps[i];
    if (lastPeakT !== null) {
      const ibi = t - lastPeakT;
      if (ibi >= MIN_IBI_MS && ibi <= MAX_IBI_MS) {
        beats.push({ t, ibiMs: ibi });
      }
    }
    lastPeakT = t;
  }

  return beats;
}
