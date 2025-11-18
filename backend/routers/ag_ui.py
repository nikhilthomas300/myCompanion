"""AG UI Protocol router with SSE streaming support."""
from __future__ import annotations

import json
import uuid
from typing import AsyncIterator

from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

from core.gemini_client import GeminiClient
from core.interrupt_flag import interrupt_flag
from models.ag_ui_types import (
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


async def stream_agent_events(run_input: RunAgentInput) -> AsyncIterator[dict]:
    """Stream AG UI protocol events for an agent run."""
    thread_id = run_input.thread_id
    run_id = run_input.run_id
    
    try:
        # Emit RUN_STARTED
        yield {
            "event": "message",
            "data": RunStartedEvent(
                threadId=thread_id,
                runId=run_id,
                parentRunId=run_input.parent_run_id
            ).model_dump_json(by_alias=True)
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
            "data": ToolCallStartEvent(
                toolCallId=tool_call_id,
                toolCallName=decision.tool_id
            ).model_dump_json(by_alias=True)
        }

        args_str = json.dumps(tool_args)
        yield {
            "event": "message",
            "data": ToolCallArgsEvent(
                toolCallId=tool_call_id,
                delta=args_str
            ).model_dump_json(by_alias=True)
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
            "data": ToolCallResultEvent(
                messageId=tool_result_message_id,
                toolCallId=tool_call_id,
                content=tool_result_content,
            ).model_dump_json(by_alias=True)
        }

        yield {
            "event": "message",
            "data": ToolCallEndEvent(
                toolCallId=tool_call_id
            ).model_dump_json(by_alias=True)
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
            "data": TextMessageStartEvent(
                messageId=message_id,
                role="assistant"
            ).model_dump_json(by_alias=True)
        }

        chunk_size = 80
        for i in range(0, len(response_text), chunk_size):
            chunk = response_text[i:i + chunk_size]
            yield {
                "event": "message",
                "data": TextMessageContentEvent(
                    messageId=message_id,
                    delta=chunk
                ).model_dump_json(by_alias=True)
            }

        yield {
            "event": "message",
            "data": TextMessageEndEvent(
                messageId=message_id
            ).model_dump_json(by_alias=True)
        }

        yield {
            "event": "message",
            "data": RunFinishedEvent(
                threadId=thread_id,
                runId=run_id,
                result={
                    "toolCallId": tool_call_id,
                    "toolId": decision.tool_id,
                    "requiresHuman": bool(tool_payload.get("requires_human")),
                },
            ).model_dump_json(by_alias=True)
        }
        
    except Exception as e:
        # Emit RUN_ERROR
        yield {
            "event": "message",
            "data": RunErrorEvent(
                message=str(e),
                code="AGENT_ERROR"
            ).model_dump_json(by_alias=True)
        }


@router.post("/run")
async def run_agent(run_input: RunAgentInput):
    """Run an agent with AG UI protocol streaming via SSE."""
    return EventSourceResponse(stream_agent_events(run_input))


@router.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "protocol": "ag-ui"}
