from __future__ import annotations

from typing import Any

from models.types import Artifact

POLICIES = [
    {
        "policy_id": "pto-2025",
        "title": "Paid Time Off",
        "summary": "Employees accrue 1.5 days of PTO per month with rollover up to 20 days.",
        "links": [
            {"label": "Policy PDF", "href": "https://example.com/policies/pto"},
        ],
    },
    {
        "policy_id": "remote-first",
        "title": "Remote Work",
        "summary": "We operate remote-first with quarterly in-person collaboration weeks.",
        "links": [
            {"label": "Guidelines", "href": "https://example.com/policies/remote"},
        ],
    },
]


async def policy_show_card_tool(payload: dict[str, Any]) -> dict[str, Any]:
    question = (payload.get("question") or "").lower()
    policy = POLICIES[0]
    for candidate in POLICIES:
        if any(keyword in question for keyword in candidate["title"].lower().split()):
            policy = candidate
            break
    artifact = Artifact(id=policy["policy_id"], kind="text", payload=policy["summary"])
    return {
        "component_id": "policy.showCard",
        "props": policy,
        "text": policy["summary"],
        "message": policy["summary"],
        "artifacts": [artifact.model_dump(by_alias=True)],
        "requires_human": False,
    }


def policy_show_card_schema() -> dict[str, Any]:
    return {
        "name": "policy.showCard",
        "description": "Surface the most relevant HR policy card for the employee question.",
        "parameters": {
            "type": "object",
            "properties": {
                "question": {"type": "string", "description": "Natural language employee question"},
            },
            "required": ["question"],
        },
    }
