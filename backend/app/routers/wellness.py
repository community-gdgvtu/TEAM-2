from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import WellnessSignalResponse
from app.models import WellnessSignal

router = APIRouter(prefix="/wellness", tags=["wellness"])


@router.get("/signals/{child_id}", response_model=list[WellnessSignalResponse])
def get_signals(child_id: int, db: Session = Depends(get_db)):
    signals = (
        db.query(WellnessSignal)
        .filter(WellnessSignal.child_id == child_id)
        .order_by(WellnessSignal.created_at.desc())
        .all()
    )
    return [WellnessSignalResponse.model_validate(s) for s in signals]
