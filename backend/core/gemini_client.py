from __future__ import annotations

import json
import os
import asyncio
from dataclasses import dataclass
from typing import Any, Iterable

from . import interrupt_flag


@dataclass
class GeminiDecision:
    agent_id: str
    tool_id: str
    arguments: dict[str, Any]
    rationale: str


class GeminiUnavailableError(RuntimeError):
    """Raised when Gemini cannot be reached and no fallback is configured."""


class GeminiClient:
    def __init__(self, model_name: str | None = None) -> None:
        self.model_name = model_name or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        self._client = None
        self._tools: list[dict[str, Any]] = []
        self._load_client()

    def _load_client(self) -> None:
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            return
        try:
            import google.generativeai as genai  # type: ignore

            genai.configure(api_key=api_key)
            self._client = genai.GenerativeModel(model_name=self.model_name)
        except Exception as exc:  # pragma: no cover - best effort guard
            print(f"[Gemini] Failed to initialize client: {exc}")
            self._client = None

    def register_tools(self, tool_schemas: Iterable[dict[str, Any]]) -> None:
        self._tools = list(tool_schemas)

    async def generate_text(self, prompt: str) -> str:
        prompt = prompt.strip()
        if not prompt:
            return "I did not receive a question. Could you share more context?"

        if self._client:
            loop = asyncio.get_running_loop()
            try:
                response = await loop.run_in_executor(None, lambda: self._client.generate_content(prompt))
                text = getattr(response, "text", None)
                if text:
                    return text.strip()
            except Exception as exc:  # pragma: no cover - best effort guard
                print(f"[Gemini] text generation failed: {exc}")

        return self._fallback_text(prompt)

    async def decide(self, user_prompt: str, agent_options: dict[str, str]) -> GeminiDecision:
        if interrupt_flag.interrupt_flag.is_triggered():
            raise InterruptedError("Conversation interrupted")
        if self._client and self._tools:
            decision = await self._call_gemini(user_prompt, agent_options)
            if decision:
                return decision
        # fallback heuristics if Gemini is unavailable
        return self._rule_based_decision(user_prompt, agent_options)

    async def _call_gemini(self, user_prompt: str, agent_options: dict[str, str]) -> GeminiDecision | None:
        try:
            import google.generativeai as genai  # type: ignore

            sys_prompt = (
                "You orchestrate company HR assistants. "
                "Choose the best agent and tool. Always respond with a single JSON object "
                "containing agent_id, tool_id, arguments, and rationale."
            )
            tools_payload = [{"function_declarations": self._tools}]
            convo = self._client.start_chat(
                history=[
                    {
                        "role": "system",
                        "parts": [sys_prompt],
                    },
                ]
            )
            agent_context = json.dumps(agent_options, indent=2)
            result = convo.send_message(
                [
                    {
                        "role": "user",
                        "parts": [
                            {
                                "text": (
                                    "Available agents (id -> description):\n"
                                    f"{agent_context}\n\n"
                                    "Decide on one agent and one tool to respond "
                                    "to this user: \n" + user_prompt
                                )
                            }
                        ],
                    }
                ],
                tools=tools_payload,
                tool_config={
                    "function_calling_config": {
                        "mode": "ANY",
                    }
                },
            )
            for candidate in result.candidates:
                for part in candidate.content.parts:
                    if getattr(part, "function_call", None):
                        call = part.function_call
                        return GeminiDecision(
                            agent_id=call.name.split(".")[0],
                            tool_id=call.name,
                            arguments=dict(call.args or {}),
                            rationale="Chosen by Gemini",
                        )
                # fallback to JSON text part
                if getattr(candidate, "content", None):
                    for part in candidate.content.parts:
                        if text := getattr(part, "text", None):
                            try:
                                data = json.loads(text)
                                return GeminiDecision(
                                    agent_id=data["agent_id"],
                                    tool_id=data["tool_id"],
                                    arguments=data.get("arguments", {}),
                                    rationale=data.get("rationale", "Chosen by Gemini"),
                                )
                            except Exception:
                                continue
        except Exception as exc:  # pragma: no cover - best effort guard
            print(f"[Gemini] call failed: {exc}")
        return None

    def _rule_based_decision(self, user_prompt: str, agent_options: dict[str, str]) -> GeminiDecision:
        normalized = user_prompt.lower()
        if any(keyword in normalized for keyword in ["leave", "vacation", "pto", "time off", "absence"]):
            tool = "leave.applyForm"
        elif any(keyword in normalized for keyword in ["policy", "benefit", "rule", "handbook", "guideline"]):
            tool = "policy.showCard"
        else:
            # Default to general agent for all other questions
            tool = "general.answer"
        agent_id = tool.split(".")[0]
        return GeminiDecision(
            agent_id=agent_id,
            tool_id=tool,
            arguments={"question": user_prompt},
            rationale="Fallback rule-based decision",
        )

    def _fallback_text(self, prompt: str) -> str:
        truncated = prompt[:200]
        return (
            "I do not have live model access right now, but here is a draft response based on your "
            "question:\n"
            f"{truncated}\n"
            "Please verify this information with the HR team for accuracy."
        )
