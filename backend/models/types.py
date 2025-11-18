from __future__ import annotations

from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class Role(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"
    SYSTEM = "system"


class ChatMessage(BaseModel):
    role: Role
    content: str
    tool_id: Optional[str] = Field(None, alias="toolId")
    metadata: dict[str, Any] | None = None

    class Config:
        populate_by_name = True


class ToolInvocation(BaseModel):
    tool_id: str = Field(..., alias="toolId")
    args: dict[str, Any]
    status: Literal["pending", "running", "succeeded", "failed"] = "pending"
    output: dict[str, Any] | None = None

    class Config:
        populate_by_name = True


class Artifact(BaseModel):
    artifact_id: str = Field(..., alias="id")
    kind: Literal["json", "table", "text", "link"]
    payload: dict[str, Any] | list[Any] | str

    class Config:
        populate_by_name = True


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None
    history: list[ChatMessage] | None = None


class ChatResponse(BaseModel):
    messages: list[ChatMessage]
    tool_invocations: list[ToolInvocation] = Field(default_factory=list)
    artifacts: list[Artifact] = Field(default_factory=list)
    requires_human: bool = False


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
