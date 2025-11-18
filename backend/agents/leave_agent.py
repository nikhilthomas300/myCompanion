from __future__ import annotations

from typing import Any

from models.types import Artifact

from .base import AgentResult, BaseAgent


class LeaveAgent(BaseAgent):
    name = "leave"
    description = "Handles employee leave planning and workflow automation."

    def build_response(self, user_message: str, tool_payload: dict[str, Any]) -> AgentResult:
        summary = tool_payload.get("summary") or (
            "I prepared the leave application form based on your input. "
            "Review the details and submit when ready."
        )
        artifacts = [
            Artifact(
                id="leave-summary",
                kind="json",
                payload=tool_payload.get("form", {}),
            )
        ]
        requires_human = bool(tool_payload.get("requires_human"))
        return AgentResult(message=summary, artifacts=artifacts, requires_human=requires_human)
