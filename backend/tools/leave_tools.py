from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict

from models.types import Artifact


async def leave_apply_tool(payload: Dict[str, Any]) -> dict[str, Any]:
    employee_name = payload.get("employee_name") or payload.get("employeeName") or ""
    today = date.today()
    form = {
        "employeeName": employee_name or "Unknown teammate",
        "startDate": payload.get("start_date") or today.isoformat(),
        "endDate": payload.get("end_date") or (today + timedelta(days=5)).isoformat(),
        "leaveType": payload.get("leave_type") or "Paid Time Off",
        "reason": payload.get("reason") or payload.get("question") or "",
        "status": "Draft",
    }
    summary = (
        f"Drafted leave request for {form['employeeName']} from {form['startDate']} "
        f"to {form['endDate']}."
    )
    artifact = Artifact(id="leave-form", kind="json", payload=form)
    return {
        "component_id": "leave.applyForm",
        "props": form,
        "summary": summary,
        "message": summary,
        "artifacts": [artifact.model_dump(by_alias=True)],
        "requires_human": False,
    }


def leave_apply_schema() -> dict[str, Any]:
    return {
        "name": "leave.applyForm",
        "description": "Prepare a leave application form and surface it to the user.",
        "parameters": {
            "type": "object",
            "properties": {
                "employee_name": {"type": "string", "description": "Name of the employee"},
                "start_date": {"type": "string", "description": "ISO start date"},
                "end_date": {"type": "string", "description": "ISO end date"},
                "leave_type": {"type": "string", "description": "Leave category"},
                "reason": {"type": "string", "description": "Short reason provided by the employee"},
                "question": {"type": "string", "description": "Original employee request"},
            },
            "required": ["question"],
        },
    }
