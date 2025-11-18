from __future__ import annotations

from fastapi import APIRouter

from core.interrupt_flag import interrupt_flag
from models.types import HumanActionRequest

router = APIRouter()


@router.post("/human-action")
async def human_action(request: HumanActionRequest) -> dict[str, str]:
    interrupt_flag.clear()
    return {"status": request.action, "notes": request.notes or ""}
