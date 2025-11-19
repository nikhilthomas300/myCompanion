from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


class Artifact(BaseModel):
    artifact_id: str = Field(..., alias="id")
    kind: Literal["json", "table", "text", "link"]
    payload: dict[str, Any] | list[Any] | str

    class Config:
        populate_by_name = True


class InterruptRequest(BaseModel):
    reason: str | None = None


class HumanActionRequest(BaseModel):
    action: Literal["approve", "reject", "modify"]
    notes: str | None = None


class FeedbackLiteral(str, Enum):
    LIKE = "like"
    DISLIKE = "dislike"
    COPY = "copy"


class FeedbackRequest(BaseModel):
    message_id: str
    feedback: FeedbackLiteral
