from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Child, GameSession, PersonalBaseline, WellnessSignal
from app.schemas import ChildCreate, ChildResponse, DashboardSummary, WellnessSignalResponse
from app.services.baseline import get_baseline_sessions

router = APIRouter(prefix="/children", tags=["children"])


@router.post("", response_model=ChildResponse)
def create_child(payload: ChildCreate, db: Session = Depends(get_db)):
    child = Child(name=payload.name, age=payload.age)
    db.add(child)
    db.commit()
    db.refresh(child)
    return _child_response(child, db)


@router.get("", response_model=list[ChildResponse])
def list_children(db: Session = Depends(get_db)):
    children = db.query(Child).order_by(Child.created_at.desc()).all()
    return [_child_response(c, db) for c in children]


@router.get("/{child_id}", response_model=ChildResponse)
def get_child(child_id: int, db: Session = Depends(get_db)):
    child = db.get(Child, child_id)
    if not child:
        raise HTTPException(404, "Child not found")
    return _child_response(child, db)


@router.get("/{child_id}/dashboard", response_model=DashboardSummary)
def get_dashboard(child_id: int, db: Session = Depends(get_db)):
    child = db.get(Child, child_id)
    if not child:
        raise HTTPException(404, "Child not found")

    baseline = db.query(PersonalBaseline).filter(PersonalBaseline.child_id == child_id).first()
    sessions = get_baseline_sessions(db, child_id)
    signals = (
        db.query(WellnessSignal)
        .filter(WellnessSignal.child_id == child_id)
        .order_by(WellnessSignal.created_at.desc())
        .limit(10)
        .all()
    )

    prs_summary = {}
    if baseline:
        prs_summary = {
            "session_count": baseline.session_count,
            "updated_at": baseline.updated_at.isoformat(),
            "key_metrics": {
                k: round(v, 2)
                for k, v in list(baseline.feature_means.items())[:6]
            },
        }

    trend = [
        {
            "session_id": s.session_id,
            "date": s.created_at.isoformat(),
            "deviation_score": s.deviation_score,
            "risk_level": s.risk_level,
            "flagged": s.flagged,
        }
        for s in reversed(signals)
    ]

    return DashboardSummary(
        child=_child_response(child, db),
        baseline_ready=baseline is not None and baseline.session_count >= 1,
        total_sessions=len(sessions),
        recent_signals=[WellnessSignalResponse.model_validate(s) for s in signals],
        prs_summary=prs_summary,
        trend=trend,
    )


def _child_response(child: Child, db: Session) -> ChildResponse:
    baseline = db.query(PersonalBaseline).filter(PersonalBaseline.child_id == child.id).first()
    session_count = db.query(GameSession).filter(GameSession.child_id == child.id).count()
    return ChildResponse(
        id=child.id,
        name=child.name,
        age=child.age,
        created_at=child.created_at,
        has_baseline=baseline is not None and baseline.session_count >= 1,
        session_count=session_count,
    )
