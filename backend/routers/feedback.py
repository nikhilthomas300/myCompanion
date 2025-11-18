from __future__ import annotations

from fastapi import APIRouter

from models.types import FeedbackRequest

router = APIRouter()
_feedback_store: list[FeedbackRequest] = []


@router.post("/feedback")
async def submit_feedback(request: FeedbackRequest) -> dict[str, str]:
    _feedback_store.append(request)
    return {"status": "received"}
