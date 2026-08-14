"""Wellness signal generation with explainable feature attribution."""

from __future__ import annotations

from typing import Any

from app.config import settings
from app.services.baseline import (
    aggregate_deviation_score,
    compute_deviations,
    flatten_features,
    risk_level_from_score,
)

FEATURE_LABELS = {
    "mean_hr": "Heart Rate",
    "hrv_sdnn": "Heart Rate Variability (SDNN)",
    "hrv_lf": "HRV Low-Frequency Power",
    "hrv_hf": "HRV High-Frequency Power",
    "blink_rate": "Blink Rate",
    "gaze_stability": "Gaze Stability",
    "head_movement": "Head Movement",
    "attention_score": "Attention Score",
    "avg_reaction_time_ms": "Reaction Time",
    "reaction_time_std": "Reaction Time Variability",
    "error_rate": "Game Error Rate",
    "retry_rate": "Retry Rate",
    "hesitation_count": "Hesitation Events",
}


def direction_label(key: str, z: float) -> str:
    """Human-readable direction of deviation."""
    higher_stress_indicators = {
        "mean_hr": True,
        "hrv_lf": True,
        "head_movement": True,
        "avg_reaction_time_ms": True,
        "reaction_time_std": True,
        "error_rate": True,
        "retry_rate": True,
        "hesitation_count": True,
        "blink_rate": True,
    }
    lower_stress_indicators = {
        "hrv_sdnn": True,
        "hrv_hf": True,
        "gaze_stability": True,
        "attention_score": True,
    }
    if key in higher_stress_indicators:
        return "higher than usual" if z > 0 else "lower than usual"
    if key in lower_stress_indicators:
        return "lower than usual" if z > 0 else "higher than usual"
    return "different from usual"


def generate_explanation(
    deviations: dict[str, float],
    score: float,
    risk_level: str,
    flagged: bool,
    child_name: str,
) -> str:
    """Parent-friendly explanation of wellness signal."""
    if not deviations:
        return (
            f"No personal baseline established yet for {child_name}. "
            "Complete a baseline play session to enable Personalized Response Signature (PRS) comparison."
        )

    sorted_devs = sorted(deviations.items(), key=lambda x: abs(x[1]), reverse=True)
    top = [(k, v) for k, v in sorted_devs if abs(v) > 0.5][:3]

    if risk_level == "normal":
        return (
            f"Today's play session for {child_name} looks consistent with their personal baseline. "
            "Physiological and behavioral patterns are within the expected range for this child."
        )

    if not top:
        return (
            f"Mild variation detected for {child_name} (score: {score:.1f}). "
            "Patterns are slightly different but not strongly flagged."
        )

    parts = []
    for key, z in top:
        label = FEATURE_LABELS.get(key, key)
        direction = direction_label(key, z)
        parts.append(f"{label} was {direction} (z={z:+.1f})")

    intro = (
        f"Today's session for {child_name} shows a pattern that differs from their usual play signature. "
        if flagged
        else f"{child_name}'s session shows minor shifts worth monitoring. "
    )
    detail = "Key differences: " + "; ".join(parts) + "."
    disclaimer = (
        " This is an early screening signal only — not a diagnosis. "
        "Consider observing over several sessions or consulting a professional if patterns persist."
    )
    return intro + detail + disclaimer


def compute_shap_like_attribution(deviations: dict[str, float]) -> dict[str, float]:
    """Feature contribution scores (SHAP-inspired attribution from z-scores)."""
    if not deviations:
        return {}
    total = sum(abs(v) for v in deviations.values()) or 1.0
    return {FEATURE_LABELS.get(k, k): round(abs(v) / total, 3) for k, v in deviations.items()}


def analyze_session(
    features: dict,
    baseline_means: dict[str, float] | None,
    baseline_stds: dict[str, float] | None,
    child_name: str,
) -> dict[str, Any]:
    """Full wellness analysis for a session."""
    flat = flatten_features(features)

    if not baseline_means or not baseline_stds:
        return {
            "deviation_score": 0.0,
            "risk_level": "normal",
            "flagged": False,
            "feature_deviations": {},
            "explanation": generate_explanation({}, 0, "normal", False, child_name),
            "shap_values": {},
        }

    deviations = compute_deviations(flat, baseline_means, baseline_stds)
    score = aggregate_deviation_score(deviations)
    risk_level, flagged = risk_level_from_score(score, settings.deviation_threshold)
    explanation = generate_explanation(deviations, score, risk_level, flagged, child_name)
    shap_values = compute_shap_like_attribution(deviations)

    return {
        "deviation_score": round(score, 2),
        "risk_level": risk_level,
        "flagged": flagged,
        "feature_deviations": {k: round(v, 2) for k, v in deviations.items()},
        "explanation": explanation,
        "shap_values": shap_values,
    }
