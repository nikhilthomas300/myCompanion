"""AG UI Protocol router with SSE streaming support."""
from __future__ import annotations

import json
import uuid
from typing import AsyncIterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from core.gemini_client import GeminiClient
from core.interrupt_flag import interrupt_flag
from models.ag_ui_types import (
    BaseEvent,
    RunAgentInput,
    RunErrorEvent,
    RunFinishedEvent,
    RunStartedEvent,
    TextMessageContentEvent,
    TextMessageEndEvent,
    TextMessageStartEvent,
    ToolCallArgsEvent,
    ToolCallEndEvent,
    ToolCallResultEvent,
    ToolCallStartEvent,
)
from registry import tool_registry

router = APIRouter(prefix="/ag-ui", tags=["ag-ui"])
_gemini_client = GeminiClient()

AGENT_DESCRIPTIONS = {
    "general": "Answers open-ended HR questions directly with Gemini responses.",
    "policy": "Surfaces policy cards with structured UI components.",
    "leave": "Drafts leave requests and presents a leave workflow component.",
}


def _event_json(event: BaseEvent) -> str:
    """Serialize an AG UI event, dropping null optional fields."""
    return event.model_dump_json(by_alias=True, exclude_none=True)


async def stream_agent_events(run_input: RunAgentInput) -> AsyncIterator[dict]:
    """Stream AG UI protocol events for an agent run."""
    thread_id = run_input.thread_id
    run_id = run_input.run_id
    
    try:
        # Emit RUN_STARTED
        yield {
            "event": "message",
            "data": _event_json(
                RunStartedEvent(
                threadId=thread_id,
                runId=run_id,
                parentRunId=run_input.parent_run_id
                )
            )
        }
        
        if interrupt_flag.is_triggered():
            raise HTTPException(status_code=409, detail="Conversation interrupted by user.")
        
        # Extract the user message
        user_messages = [msg for msg in run_input.messages if msg.role == "user"]
        if not user_messages:
            raise ValueError("No user message found in input")
        
        latest_user_message = user_messages[-1].content
        
        # Register tools and decide on agent/tool
        _gemini_client.register_tools(tool_registry.schema_list())
        decision = await _gemini_client.decide(latest_user_message, AGENT_DESCRIPTIONS)

        tool_entry = tool_registry.get_tool(decision.tool_id)
        tool_args = {**decision.arguments}
        tool_args.setdefault("question", latest_user_message)

        tool_call_id = f"tool_{uuid.uuid4().hex[:8]}"
        yield {
            "event": "message",
            "data": _event_json(
                ToolCallStartEvent(
                    toolCallId=tool_call_id,
                    toolCallName=decision.tool_id
                )
            )
        }

        args_str = json.dumps(tool_args)
        yield {
            "event": "message",
            "data": _event_json(
                ToolCallArgsEvent(
                    toolCallId=tool_call_id,
                    delta=args_str
                )
            )
        }

        tool_payload = await tool_entry["func"](tool_args)

        tool_result_message_id = f"tool_msg_{uuid.uuid4().hex[:8]}"
        tool_result_content = json.dumps({
            "componentId": tool_payload.get("component_id"),
            "props": tool_payload.get("props", {}),
            "summary": tool_payload.get("message") or tool_payload.get("summary") or tool_payload.get("text"),
            "artifacts": tool_payload.get("artifacts", []),
            "requiresHuman": bool(tool_payload.get("requires_human")),
        })
        yield {
            "event": "message",
            "data": _event_json(
                ToolCallResultEvent(
                    messageId=tool_result_message_id,
                    toolCallId=tool_call_id,
                    content=tool_result_content,
                )
            )
        }

        yield {
            "event": "message",
            "data": _event_json(
                ToolCallEndEvent(
                    toolCallId=tool_call_id
                )
            )
        }

        response_text = (
            tool_payload.get("message")
            or tool_payload.get("summary")
            or tool_payload.get("text")
            or "I was not able to generate a response."
        )

        message_id = f"msg_{uuid.uuid4().hex[:8]}"
        yield {
            "event": "message",
            "data": _event_json(
                TextMessageStartEvent(
                    messageId=message_id,
                    role="assistant"
                )
            )
        }

        chunk_size = 80
        for i in range(0, len(response_text), chunk_size):
            chunk = response_text[i:i + chunk_size]
            yield {
                "event": "message",
                "data": _event_json(
                    TextMessageContentEvent(
                        messageId=message_id,
                        delta=chunk
                    )
                )
            }

        yield {
            "event": "message",
            "data": _event_json(
                TextMessageEndEvent(
                    messageId=message_id
                )
            )
        }

        yield {
            "event": "message",
            "data": _event_json(
                RunFinishedEvent(
                    threadId=thread_id,
                    runId=run_id,
                    result={
                        "toolCallId": tool_call_id,
                        "toolId": decision.tool_id,
                        "requiresHuman": bool(tool_payload.get("requires_human")),
                    },
                )
            )
        }
        
    except Exception as e:
        # Emit RUN_ERROR
        yield {
            "event": "message",
            "data": _event_json(
                RunErrorEvent(
                    message=str(e),
                    code="AGENT_ERROR"
                )
            )
        }


def _format_sse(event: dict) -> bytes:
    """Serialize an SSE event using LF-only delimiters expected by AG UI clients."""
    event_name = event.get("event")
    data_payload = event.get("data", "")
    if not isinstance(data_payload, str):
        data_payload = json.dumps(data_payload)

    lines = []
    if event_name:
        lines.append(f"event: {event_name}")

    data_lines = data_payload.splitlines() or [""]
    for line in data_lines:
        lines.append(f"data: {line}")

    # SSE events end with a blank line; extra newline enforces the \n\n delimiter
    lines.append("")
    payload = "\n".join(lines) + "\n"
    return payload.encode("utf-8")


async def _agui_event_stream(run_input: RunAgentInput):
    async for event in stream_agent_events(run_input):
        yield _format_sse(event)


@router.post("/run")
async def run_agent(run_input: RunAgentInput):
    """Run an agent with AG UI protocol streaming via SSE."""
    return StreamingResponse(_agui_event_stream(run_input), media_type="text/event-stream")


@router.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "protocol": "ag-ui"}
