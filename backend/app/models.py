from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Child(Base):
    __tablename__ = "children"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    age: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    sessions: Mapped[list["GameSession"]] = relationship(back_populates="child")
    baseline: Mapped["PersonalBaseline | None"] = relationship(back_populates="child", uselist=False)


class GameSession(Base):
    __tablename__ = "game_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id"))
    session_type: Mapped[str] = mapped_column(String(20), default="play")  # baseline | play
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    duration_sec: Mapped[float] = mapped_column(Float, default=0)
    features: Mapped[dict] = mapped_column(JSON, default=dict)
    game_events: Mapped[dict] = mapped_column(JSON, default=dict)

    child: Mapped["Child"] = relationship(back_populates="sessions")
    wellness_signal: Mapped["WellnessSignal | None"] = relationship(back_populates="session", uselist=False)


class PersonalBaseline(Base):
    __tablename__ = "personal_baselines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id"), unique=True)
    feature_means: Mapped[dict] = mapped_column(JSON, default=dict)
    feature_stds: Mapped[dict] = mapped_column(JSON, default=dict)
    session_count: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    child: Mapped["Child"] = relationship(back_populates="baseline")


class WellnessSignal(Base):
    __tablename__ = "wellness_signals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("game_sessions.id"), unique=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id"))
    deviation_score: Mapped[float] = mapped_column(Float, default=0)
    risk_level: Mapped[str] = mapped_column(String(20), default="normal")  # normal | watch | elevated
    flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    feature_deviations: Mapped[dict] = mapped_column(JSON, default=dict)
    explanation: Mapped[str] = mapped_column(Text, default="")
    shap_values: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["GameSession"] = relationship(back_populates="wellness_signal")
