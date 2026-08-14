from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Child, GameSession, PersonalBaseline, WellnessSignal
from app.schemas import SessionCreate, SessionResponse, WellnessSignalResponse
from app.services.baseline import update_baseline
from app.services.explainer import analyze_session
from app.services.rppg import process_rgb_signal

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse)
def create_session(payload: SessionCreate, db: Session = Depends(get_db)):
    child = db.get(Child, payload.child_id)
    if not child:
        raise HTTPException(404, "Child not found")

    features = payload.features.model_dump()

    # Server-side rPPG if RGB signal provided
    if payload.rgb_signal and len(payload.rgb_signal.green) > 0:
        rppg_result = process_rgb_signal(
            payload.rgb_signal.red,
            payload.rgb_signal.green,
            payload.rgb_signal.blue,
            payload.rgb_signal.fps,
        )
        for key, val in rppg_result.items():
            if val is not None:
                features["physio"][key] = val

    session = GameSession(
        child_id=payload.child_id,
        session_type=payload.session_type,
        duration_sec=payload.duration_sec,
        features=features,
        game_events=payload.game_events,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Update personal baseline
    update_baseline(db, payload.child_id, features, payload.session_type)

    # Analyze deviation if baseline exists (after this session's update)
    baseline = db.query(PersonalBaseline).filter(PersonalBaseline.child_id == payload.child_id).first()
    wellness = None
    if baseline and baseline.session_count >= 1:
        analysis = analyze_session(
            features,
            baseline.feature_means,
            baseline.feature_stds,
            child.name,
        )
        wellness = WellnessSignal(
            session_id=session.id,
            child_id=payload.child_id,
            deviation_score=analysis["deviation_score"],
            risk_level=analysis["risk_level"],
            flagged=analysis["flagged"],
            feature_deviations=analysis["feature_deviations"],
            explanation=analysis["explanation"],
            shap_values=analysis["shap_values"],
        )
        db.add(wellness)
        db.commit()
        db.refresh(wellness)

    response = SessionResponse(
        id=session.id,
        child_id=session.child_id,
        session_type=session.session_type,
        started_at=session.started_at,
        duration_sec=session.duration_sec,
        features=session.features,
        wellness_signal=WellnessSignalResponse.model_validate(wellness) if wellness else None,
    )
    return response


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(session_id: int, db: Session = Depends(get_db)):
    session = db.get(GameSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    wellness = db.query(WellnessSignal).filter(WellnessSignal.session_id == session_id).first()
    return SessionResponse(
        id=session.id,
        child_id=session.child_id,
        session_type=session.session_type,
        started_at=session.started_at,
        duration_sec=session.duration_sec,
        features=session.features,
        wellness_signal=WellnessSignalResponse.model_validate(wellness) if wellness else None,
    )


@router.get("/child/{child_id}", response_model=list[SessionResponse])
def list_child_sessions(child_id: int, db: Session = Depends(get_db)):
    sessions = (
        db.query(GameSession)
        .filter(GameSession.child_id == child_id)
        .order_by(GameSession.started_at.desc())
        .all()
    )
    results = []
    for s in sessions:
        wellness = db.query(WellnessSignal).filter(WellnessSignal.session_id == s.id).first()
        results.append(
            SessionResponse(
                id=s.id,
                child_id=s.child_id,
                session_type=s.session_type,
                started_at=s.started_at,
                duration_sec=s.duration_sec,
                features=s.features,
                wellness_signal=WellnessSignalResponse.model_validate(wellness) if wellness else None,
            )
        )
    return results
