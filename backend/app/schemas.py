from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ChildCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    age: int = Field(ge=3, le=12)


class ChildResponse(BaseModel):
    id: int
    name: str
    age: int
    created_at: datetime
    has_baseline: bool = False
    session_count: int = 0

    model_config = {"from_attributes": True}


class PhysioFeatures(BaseModel):
    mean_hr: float | None = None
    hrv_sdnn: float | None = None
    hrv_lf: float | None = None
    hrv_hf: float | None = None
    signal_quality: float = 0.0


class GazeFeatures(BaseModel):
    blink_rate: float = 0.0
    gaze_stability: float = 0.0
    head_movement: float = 0.0
    attention_score: float = 0.0


class GameFeatures(BaseModel):
    avg_reaction_time_ms: float = 0.0
    reaction_time_std: float = 0.0
    error_rate: float = 0.0
    retry_rate: float = 0.0
    hesitation_count: int = 0
    total_events: int = 0
    score: int = 0


class SessionFeatures(BaseModel):
    physio: PhysioFeatures = Field(default_factory=PhysioFeatures)
    gaze: GazeFeatures = Field(default_factory=GazeFeatures)
    game: GameFeatures = Field(default_factory=GameFeatures)


class RGBSignalPayload(BaseModel):
    """Raw RGB time series from frontend for server-side rPPG if needed."""
    timestamps: list[float] = []
    red: list[float] = []
    green: list[float] = []
    blue: list[float] = []
    fps: float = 30.0


class SessionCreate(BaseModel):
    child_id: int
    session_type: str = "play"
    duration_sec: float
    features: SessionFeatures
    game_events: dict[str, Any] = {}
    rgb_signal: RGBSignalPayload | None = None


class SessionResponse(BaseModel):
    id: int
    child_id: int
    session_type: str
    started_at: datetime
    duration_sec: float
    features: dict
    wellness_signal: "WellnessSignalResponse | None" = None

    model_config = {"from_attributes": True}


class WellnessSignalResponse(BaseModel):
    id: int
    session_id: int
    child_id: int
    deviation_score: float
    risk_level: str
    flagged: bool
    feature_deviations: dict
    explanation: str
    shap_values: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class DashboardSummary(BaseModel):
    child: ChildResponse
    baseline_ready: bool
    total_sessions: int
    recent_signals: list[WellnessSignalResponse]
    prs_summary: dict[str, Any]
    trend: list[dict[str, Any]]
