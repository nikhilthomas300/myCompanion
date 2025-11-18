from __future__ import annotations

from typing import Any

from models.types import Artifact

from .base import AgentResult, BaseAgent


class HRPolicyAgent(BaseAgent):
    name = "policy"
    description = "Answers HR policy questions and surfaces the latest policies."

    def build_response(self, user_message: str, tool_payload: dict[str, Any]) -> AgentResult:
        summary = tool_payload.get("text") or (
            "Here is the policy card that best matches your question."
        )
        artifacts = [
            Artifact(
                id=tool_payload.get("policy_id", "policy-card"),
                kind="text",
                payload=tool_payload.get("text", ""),
            )
        ]
        requires_human = bool(tool_payload.get("requires_human"))
        return AgentResult(message=summary, artifacts=artifacts, requires_human=requires_human)
