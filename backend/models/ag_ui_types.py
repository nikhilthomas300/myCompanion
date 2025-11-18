"""AG UI Protocol types matching @ag-ui/core specification."""
from __future__ import annotations

from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class EventType(str, Enum):
    """AG UI protocol event types."""
    TEXT_MESSAGE_START = "TEXT_MESSAGE_START"
    TEXT_MESSAGE_CONTENT = "TEXT_MESSAGE_CONTENT"
    TEXT_MESSAGE_END = "TEXT_MESSAGE_END"
    TOOL_CALL_START = "TOOL_CALL_START"
    TOOL_CALL_ARGS = "TOOL_CALL_ARGS"
    TOOL_CALL_END = "TOOL_CALL_END"
    TOOL_CALL_RESULT = "TOOL_CALL_RESULT"
    STATE_SNAPSHOT = "STATE_SNAPSHOT"
    STATE_DELTA = "STATE_DELTA"
    MESSAGES_SNAPSHOT = "MESSAGES_SNAPSHOT"
    ACTIVITY_SNAPSHOT = "ACTIVITY_SNAPSHOT"
    ACTIVITY_DELTA = "ACTIVITY_DELTA"
    RAW = "RAW"
    CUSTOM = "CUSTOM"
    RUN_STARTED = "RUN_STARTED"
    RUN_FINISHED = "RUN_FINISHED"
    RUN_ERROR = "RUN_ERROR"
    STEP_STARTED = "STEP_STARTED"
    STEP_FINISHED = "STEP_FINISHED"


class BaseEvent(BaseModel):
    """Base event type for all AG UI events."""
    type: EventType
    timestamp: Optional[int] = None
    raw_event: Optional[Any] = Field(None, alias="rawEvent")

    class Config:
        populate_by_name = True
        use_enum_values = True


class RunStartedEvent(BaseEvent):
    """Signals the start of an agent run."""
    type: Literal[EventType.RUN_STARTED] = EventType.RUN_STARTED
    thread_id: str = Field(..., alias="threadId")
    run_id: str = Field(..., alias="runId")
    parent_run_id: Optional[str] = Field(None, alias="parentRunId")


class RunFinishedEvent(BaseEvent):
    """Signals the successful completion of an agent run."""
    type: Literal[EventType.RUN_FINISHED] = EventType.RUN_FINISHED
    thread_id: str = Field(..., alias="threadId")
    run_id: str = Field(..., alias="runId")
    result: Optional[Any] = None


class RunErrorEvent(BaseEvent):
    """Signals an error during an agent run."""
    type: Literal[EventType.RUN_ERROR] = EventType.RUN_ERROR
    message: str
    code: Optional[str] = None


class TextMessageStartEvent(BaseEvent):
    """Signals the start of a text message."""
    type: Literal[EventType.TEXT_MESSAGE_START] = EventType.TEXT_MESSAGE_START
    message_id: str = Field(..., alias="messageId")
    role: Literal["assistant"] = "assistant"


class TextMessageContentEvent(BaseEvent):
    """Represents a chunk of content in a streaming text message."""
    type: Literal[EventType.TEXT_MESSAGE_CONTENT] = EventType.TEXT_MESSAGE_CONTENT
    message_id: str = Field(..., alias="messageId")
    delta: str


class TextMessageEndEvent(BaseEvent):
    """Signals the end of a text message."""
    type: Literal[EventType.TEXT_MESSAGE_END] = EventType.TEXT_MESSAGE_END
    message_id: str = Field(..., alias="messageId")


class ToolCallStartEvent(BaseEvent):
    """Signals the start of a tool call."""
    type: Literal[EventType.TOOL_CALL_START] = EventType.TOOL_CALL_START
    tool_call_id: str = Field(..., alias="toolCallId")
    tool_call_name: str = Field(..., alias="toolCallName")
    parent_message_id: Optional[str] = Field(None, alias="parentMessageId")


class ToolCallArgsEvent(BaseEvent):
    """Represents a chunk of argument data for a tool call."""
    type: Literal[EventType.TOOL_CALL_ARGS] = EventType.TOOL_CALL_ARGS
    tool_call_id: str = Field(..., alias="toolCallId")
    delta: str


class ToolCallEndEvent(BaseEvent):
    """Signals the end of a tool call."""
    type: Literal[EventType.TOOL_CALL_END] = EventType.TOOL_CALL_END
    tool_call_id: str = Field(..., alias="toolCallId")


class ToolCallResultEvent(BaseEvent):
    """Provides the result of a tool call execution."""
    type: Literal[EventType.TOOL_CALL_RESULT] = EventType.TOOL_CALL_RESULT
    message_id: str = Field(..., alias="messageId")
    tool_call_id: str = Field(..., alias="toolCallId")
    content: str
    role: Optional[Literal["tool"]] = "tool"


class AGUIMessage(BaseModel):
    """AG UI message format."""
    id: str
    role: Literal["developer", "system", "assistant", "user", "tool", "activity"]
    content: str
    name: Optional[str] = None
    tool_call_id: Optional[str] = Field(None, alias="toolCallId")
    tool_calls: Optional[list[dict[str, Any]]] = Field(None, alias="toolCalls")

    class Config:
        populate_by_name = True


class MessagesSnapshotEvent(BaseEvent):
    """Provides a snapshot of all messages in a conversation."""
    type: Literal[EventType.MESSAGES_SNAPSHOT] = EventType.MESSAGES_SNAPSHOT
    messages: list[AGUIMessage]


class AGUITool(BaseModel):
    """AG UI tool definition format."""
    name: str
    description: str
    parameters: dict[str, Any]


class AGUIContext(BaseModel):
    """AG UI context format."""
    description: str
    value: str


class RunAgentInput(BaseModel):
    """AG UI RunAgentInput format."""
    thread_id: str = Field(..., alias="threadId")
    run_id: str = Field(..., alias="runId")
    parent_run_id: Optional[str] = Field(None, alias="parentRunId")
    state: Any = None
    messages: list[AGUIMessage]
    tools: list[AGUITool] = Field(default_factory=list)
    context: list[AGUIContext] = Field(default_factory=list)
    forwarded_props: Optional[Any] = Field(None, alias="forwardedProps")

    class Config:
        populate_by_name = True
