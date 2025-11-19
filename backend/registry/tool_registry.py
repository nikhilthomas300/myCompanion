from __future__ import annotations

from typing import Any, Awaitable, Callable

from tools.general_tools import answer_general_question
from tools.leave_tools import leave_apply_schema, leave_apply_tool
from tools.policy_tools import policy_show_card_schema, policy_show_card_tool
from tools.weather_tools import weather_card_schema, weather_card_tool

ToolFunc = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]


tool_registry: dict[str, dict[str, Any]] = {
    "leave.applyForm": {
        "func": leave_apply_tool,
        "schema": leave_apply_schema(),
    },
    "policy.showCard": {
        "func": policy_show_card_tool,
        "schema": policy_show_card_schema(),
    },
    "general.answer": {
        "func": answer_general_question,
        "schema": {
            "name": "general.answer",
            "description": "Answer general questions, provide information, have conversations about any topic",
            "parameters": {
                "type": "object",
                "properties": {
                    "question": {
                        "type": "string",
                        "description": "The user's question or message to respond to",
                    }
                },
                "required": ["question"],
            },
        },
    },
    "weather.showCard": {
        "func": weather_card_tool,
        "schema": weather_card_schema(),
    },
}


def get_tool(tool_id: str) -> dict[str, Any]:
    if tool_id not in tool_registry:
        raise KeyError(f"Unknown tool_id: {tool_id}")
    return tool_registry[tool_id]


def schema_list() -> list[dict[str, Any]]:
    return [entry["schema"] for entry in tool_registry.values()]
