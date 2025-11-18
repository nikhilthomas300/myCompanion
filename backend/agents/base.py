from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from models.types import Artifact


@dataclass
class AgentResult:
    message: str
    artifacts: list[Artifact]
    requires_human: bool = False


class BaseAgent:
    name: str
    description: str

    def build_response(self, user_message: str, tool_payload: dict[str, Any]) -> AgentResult:
        raise NotImplementedError
