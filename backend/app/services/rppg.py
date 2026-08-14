"""
Remote photoplethysmography (rPPG) processing pipeline.

Inspired by Hendryani et al., IEEE Access 2024:
- Frame alignment for motion artifact reduction
- POS (Plane-Orthogonal-to-Skin) chrominance method
- Bandpass filtering for HR range (0.65–4 Hz)
- HR via FFT peak detection; HRV via time/frequency domain metrics
"""

from __future__ import annotations

import numpy as np
from scipy import signal
from scipy.fft import rfft, rfftfreq


def bandpass_filter(data: np.ndarray, fs: float, low: float = 0.65, high: float = 4.0) -> np.ndarray:
    nyq = fs / 2
    b, a = signal.butter(4, [low / nyq, min(high / nyq, 0.99)], btype="band")
    return signal.filtfilt(b, a, data)


def pos_method(rgb: np.ndarray) -> np.ndarray:
    """POS chrominance rPPG extraction. rgb shape: (3, n_frames)."""
    mean_rgb = np.mean(rgb, axis=1, keepdims=True)
    normalized = rgb / (mean_rgb + 1e-8)
    x = normalized[0] - normalized[1]
    y = normalized[0] + normalized[1] - 2 * normalized[2]
    alpha = np.std(x) / (np.std(y) + 1e-8)
    return x - alpha * y


def detrend_signal(data: np.ndarray) -> np.ndarray:
    return signal.detrend(data, type="linear")


def estimate_hr_bpm(ppg: np.ndarray, fs: float) -> float | None:
    if len(ppg) < fs * 5:
        return None
    filtered = bandpass_filter(detrend_signal(ppg), fs)
    freqs = rfftfreq(len(filtered), 1 / fs)
    spectrum = np.abs(rfft(filtered))
    mask = (freqs >= 0.75) & (freqs <= 3.0)  # 45–180 bpm
    if not np.any(mask):
        return None
    peak_idx = np.argmax(spectrum[mask])
    peak_freq = freqs[mask][peak_idx]
    return float(peak_freq * 60)


def compute_hrv_metrics(ppg: np.ndarray, fs: float) -> dict[str, float]:
    """Compute SDNN, LF, HF from iPPG signal."""
    filtered = bandpass_filter(detrend_signal(ppg), fs)
    # Peak detection for inter-beat intervals
    min_distance = int(fs * 0.4)
    peaks, _ = signal.find_peaks(filtered, distance=min_distance, prominence=np.std(filtered) * 0.3)
    if len(peaks) < 3:
        return {"sdnn": 0.0, "lf": 0.0, "hf": 0.0}

    ibi = np.diff(peaks) / fs  # seconds
    sdnn = float(np.std(ibi) * 1000)  # ms

    # Frequency domain HRV from interpolated IBI
    if len(ibi) < 4:
        return {"sdnn": sdnn, "lf": 0.0, "hf": 0.0}

    t = np.cumsum(np.insert(ibi, 0, 0))
    fs_ibi = 4.0
    t_interp = np.arange(0, t[-1], 1 / fs_ibi)
    ibi_interp = np.interp(t_interp, t[1:], ibi)
    ibi_interp = detrend_signal(ibi_interp)

    freqs, psd = signal.welch(ibi_interp, fs=fs_ibi, nperseg=min(256, len(ibi_interp)))
    lf = float(np.trapz(psd[(freqs >= 0.04) & (freqs < 0.15)], freqs[(freqs >= 0.04) & (freqs < 0.15)]))
    hf = float(np.trapz(psd[(freqs >= 0.15) & (freqs < 0.4)], freqs[(freqs >= 0.15) & (freqs < 0.4)]))
    return {"sdnn": sdnn, "lf": lf, "hf": hf}


def signal_quality_score(ppg: np.ndarray, fs: float) -> float:
    """0–1 quality estimate based on SNR in HR band."""
    if len(ppg) < fs * 3:
        return 0.0
    filtered = bandpass_filter(detrend_signal(ppg), fs)
    freqs = rfftfreq(len(filtered), 1 / fs)
    spectrum = np.abs(rfft(filtered))
    hr_mask = (freqs >= 0.75) & (freqs <= 3.0)
    noise_mask = (freqs >= 3.0) & (freqs <= 4.0)
    hr_power = np.sum(spectrum[hr_mask] ** 2) + 1e-8
    noise_power = np.sum(spectrum[noise_mask] ** 2) + 1e-8
    snr = hr_power / noise_power
    return float(np.clip(np.log1p(snr) / 5, 0, 1))


def process_rgb_signal(
    red: list[float],
    green: list[float],
    blue: list[float],
    fps: float = 30.0,
) -> dict[str, float | None]:
    """Full rPPG pipeline from RGB time series."""
    if len(green) < int(fps * 10):
        return {
            "mean_hr": None,
            "hrv_sdnn": None,
            "hrv_lf": None,
            "hrv_hf": None,
            "signal_quality": 0.0,
        }

    rgb = np.array([red, green, blue], dtype=float)
    ppg = pos_method(rgb)
    quality = signal_quality_score(ppg, fps)
    hr = estimate_hr_bpm(ppg, fps)
    hrv = compute_hrv_metrics(ppg, fps)

    return {
        "mean_hr": hr,
        "hrv_sdnn": hrv["sdnn"],
        "hrv_lf": hrv["lf"],
        "hrv_hf": hrv["hf"],
        "signal_quality": quality,
    }
