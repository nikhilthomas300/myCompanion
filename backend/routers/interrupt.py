from __future__ import annotations

from fastapi import APIRouter

from core.interrupt_flag import interrupt_flag
from models.types import InterruptRequest

router = APIRouter()


@router.post("/interrupt")
async def interrupt(request: InterruptRequest) -> dict[str, str]:
    interrupt_flag.trigger()
    return {"status": "interrupted", "reason": request.reason or ""}
