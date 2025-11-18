from __future__ import annotations

from typing import Any, Dict

from core.gemini_client import GeminiClient

_general_client = GeminiClient()


async def answer_general_question(payload: Dict[str, Any]) -> dict[str, Any]:
    """Use Gemini to answer open questions via AG UI."""
    question = (payload.get("question") or "").strip()
    if not question:
        return {
            "message": "I did not receive a question. Could you please share more details?",
            "requires_human": False,
            "component_id": None,
            "props": {},
            "artifacts": [],
        }

    # Gemini SDK is synchronous today, so run it in a thread to avoid blocking the loop.
    answer = await _general_client.generate_text(question)
    return {
        "message": answer,
        "requires_human": False,
        "component_id": None,
        "props": {},
        "artifacts": [],
    }
