"""Personal Response Signature (PRS) — personal baseline management."""

from __future__ import annotations

import math
from datetime import datetime
from typing import Any

import numpy as np
from sqlalchemy.orm import Session

from app.models import GameSession, PersonalBaseline

FEATURE_KEYS = [
    "mean_hr",
    "hrv_sdnn",
    "hrv_lf",
    "hrv_hf",
    "blink_rate",
    "gaze_stability",
    "head_movement",
    "attention_score",
    "avg_reaction_time_ms",
    "reaction_time_std",
    "error_rate",
    "retry_rate",
    "hesitation_count",
]


def flatten_features(features: dict) -> dict[str, float]:
    """Extract flat feature dict from nested session features."""
    flat: dict[str, float] = {}
    physio = features.get("physio", {})
    gaze = features.get("gaze", {})
    game = features.get("game", {})

    for key in ["mean_hr", "hrv_sdnn", "hrv_lf", "hrv_hf", "signal_quality"]:
        val = physio.get(key)
        if val is not None and not (isinstance(val, float) and math.isnan(val)):
            flat[key] = float(val)

    for key in ["blink_rate", "gaze_stability", "head_movement", "attention_score"]:
        flat[key] = float(gaze.get(key, 0))

    for key in ["avg_reaction_time_ms", "reaction_time_std", "error_rate", "retry_rate"]:
        flat[key] = float(game.get(key, 0))
    flat["hesitation_count"] = float(game.get("hesitation_count", 0))

    return flat


def compute_deviations(
    current: dict[str, float],
    means: dict[str, float],
    stds: dict[str, float],
) -> dict[str, float]:
    """Z-score deviations from personal baseline."""
    deviations: dict[str, float] = {}
    for key, value in current.items():
        if key not in means or key == "signal_quality":
            continue
        mean = means[key]
        std = stds.get(key, 0)
        if std < 1e-6:
            std = max(abs(mean) * 0.1, 1.0)
        deviations[key] = (value - mean) / std
    return deviations


def aggregate_deviation_score(deviations: dict[str, float]) -> float:
    """Combined deviation magnitude (RMS of absolute z-scores)."""
    if not deviations:
        return 0.0
    weights = {
        "mean_hr": 1.2,
        "hrv_sdnn": 1.5,
        "hrv_lf": 1.0,
        "hrv_hf": 1.0,
        "blink_rate": 0.8,
        "gaze_stability": 1.0,
        "head_movement": 0.7,
        "attention_score": 1.3,
        "avg_reaction_time_ms": 1.2,
        "reaction_time_std": 1.0,
        "error_rate": 1.1,
        "retry_rate": 0.9,
        "hesitation_count": 1.0,
    }
    weighted_sq = []
    for key, z in deviations.items():
        w = weights.get(key, 1.0)
        weighted_sq.append((w * abs(z)) ** 2)
    return float(math.sqrt(sum(weighted_sq) / len(weighted_sq)))


def risk_level_from_score(score: float, threshold: float = 1.5) -> tuple[str, bool]:
    if score < threshold * 0.6:
        return "normal", False
    if score < threshold:
        return "watch", False
    if score < threshold * 1.5:
        return "watch", True
    return "elevated", True


def update_baseline(db: Session, child_id: int, features: dict, session_type: str) -> PersonalBaseline:
    """Update or create personal baseline from session features."""
    flat = flatten_features(features)
    baseline = db.query(PersonalBaseline).filter(PersonalBaseline.child_id == child_id).first()

    if baseline is None:
        baseline = PersonalBaseline(
            child_id=child_id,
            feature_means={k: flat.get(k, 0) for k in FEATURE_KEYS if k in flat},
            feature_stds={k: 1.0 for k in FEATURE_KEYS if k in flat},
            session_count=1,
        )
        db.add(baseline)
    else:
        n = baseline.session_count
        means = dict(baseline.feature_means)
        stds = dict(baseline.feature_stds)
        for key, value in flat.items():
            if key not in means:
                means[key] = value
                stds[key] = 1.0
                continue
            old_mean = means[key]
            new_mean = old_mean + (value - old_mean) / (n + 1)
            if n > 0:
                old_var = stds.get(key, 1.0) ** 2
                new_var = old_var + ((value - old_mean) * (value - new_mean) - old_var) / (n + 1)
                stds[key] = max(math.sqrt(max(new_var, 0)), 0.01)
            means[key] = new_mean
        baseline.feature_means = means
        baseline.feature_stds = stds
        baseline.session_count = n + 1
        baseline.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(baseline)
    return baseline


def get_baseline_sessions(db: Session, child_id: int) -> list[GameSession]:
    return (
        db.query(GameSession)
        .filter(GameSession.child_id == child_id)
        .order_by(GameSession.started_at.desc())
        .all()
    )
