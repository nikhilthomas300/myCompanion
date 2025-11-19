# AG UI — End-to-end Reference

This document explains how the AG UI protocol is implemented end-to-end in this repository. It focuses on the backend orchestrator and the frontend streaming and rendering layers. If you're integrating or extending the agent UI, this is the authoritative quick reference.

---

## Table of contents

- Architecture overview
- Backend: AG UI endpoint & event stream
  - `RunAgentInput` and AG UI event types
  - Tool selection and orchestration
  - Tool payload format
- Frontend: HttpAgent, event subscription & rendering
  - The `useAGUIChatStore` pattern
  - Message and tool invocation lifecycle
  - Rendering Tool components
- Extending the system (add tools + UI widgets)
- Run & debug tips

---

## Architecture overview

- The backend offers a single AG UI protocol chat surface at `POST /ag-ui/run` which streams Server-Sent Events (SSE) back to the client.
- The backend can use Gemini via `backend/core/gemini_client.py` to decide which tool to run; if unavailable it falls back to rule-based heuristics.
- Tools are implemented in `backend/tools/*` and registered in `backend/registry/tool_registry.py` with JSON schemas.
- The frontend uses `@ag-ui/client`'s `HttpAgent` (`frontend/src/state/aguiChatStore.ts`) to post runs and subscribe to AG UI events. `AGUIChat.tsx` uses this store to render messages and `ToolRenderer.tsx` hydrates UI components returned in tool payloads.

---

## Backend: AG UI endpoint & event stream

Files to scan:
- `backend/routers/ag_ui.py` – SSE endpoint implementing AG UI event streaming
- `backend/core/gemini_client.py` – Gemini decision + fallback heuristics
- `backend/tools/*` – actual tool implementations returning JSON payloads for tool results
- `backend/registry/tool_registry.py` – tool catalog and JSON schema list
- `backend/models/ag_ui_types.py` – Pydantic models for AG UI event types and `RunAgentInput`

### RunAgentInput (what the frontend sends)
`RunAgentInput` is defined in `backend/models/ag_ui_types.py`. At a minimum it contains:
- `threadId` – id for the conversation thread
- `runId` – id for this specific run
- `messages` – list of previous messages (AG UI message format)
- `tools` – the tool catalog the client exposes (optional)
- `context` – additional context key/value pairs (optional)

Example payload (frontend -> backend):

```json
{
  "threadId": "thread_1731951120",
  "runId": "run_1731951120",
  "messages": [
    { "id": "user_1731951120", "role": "user", "content": "Summarize our parental leave policy." }
  ],
  "tools": [],
  "context": [],
  "state": null
}
```

### AG UI events (what the backend streams)
The backend uses a set of event types defined in `ag_ui_types`. Common events are:
- `RUN_STARTED` – emitted immediately when the run begins
- `TOOL_CALL_START` – before tool arguments are streamed
- `TOOL_CALL_ARGS` – streaming arguments for a tool call (sometimes sent in JSON chunks)
- `TOOL_CALL_RESULT` – single message with the result of a tool invocation. The `content` field holds a serialized JSON describing `componentId`, `props`, `summary`, and `artifacts`.
- `TOOL_CALL_END` – signals the completion of the tool invocation
- `TEXT_MESSAGE_START`, `TEXT_MESSAGE_CONTENT`, `TEXT_MESSAGE_END` – streamed assistant textual response chunks (typing effect)
- `RUN_FINISHED` / `RUN_ERROR` – termination signals of a run

`backend/routers/ag_ui.py` constructs these events and serializes them for SSE. It yields `RunStartedEvent`, then tool call events, then a stream of text chunks, and finally `RunFinishedEvent` (or `RunErrorEvent`). SSE formatting is performed by `_format_sse(event)` to ensure the client receives the event lines with correct `event:` and `data:` structure.

### Tool selection & orchestration
Tool selection is performed in `backend/core/gemini_client.py`:
- `register_tools` takes the list of tool schemas (from `tool_registry.schema_list()`).
- `decide` uses `GeminiClient` to pick a best-fit tool by calling the Gemini API when available.
- If Gemini is unavailable, `_rule_based_decision` falls back to keywords and selects a tool by simple heuristics.

Once the backend decides, it gets the tool function from `tool_registry.get_tool(decision.tool_id)` and awaits the tool entry. That tool returns a standard payload (see below). The backend sends `TOOL_CALL_RESULT` with a JSON string in `content`.

### Tool payload format
Tools return a JSON-like dictionary with these commonly used keys:
- `component_id` (string) – frontend component id name for rendering (e.g., `leave.applyForm`, `policy.showCard`)
- `props` (object) – pre-fill parameters to pass to the React component
- `message` / `summary` / `text` (string) – assistant text to be streamed to chat.
- `artifacts` (list) – an array of structured artifacts (IDs and payloads) that the frontend can store.

Example (returned from a tool):
```py
{
  "component_id": "policy.showCard",
  "props": { "title": "Paid Time Off", "summary": "..." },
  "summary": "Short policy summary",
  "message": "Expanded assistant message text",
  "artifacts": [ { "id": "policy-1", "kind": "text", "payload": {...} } ]
}
```

After sending the `TOOL_CALL_RESULT`, `ag_ui.py` typically emits `TOOL_CALL_END` and then emits `TEXT_MESSAGE_START`/content events as the assistant provides readable output.

---

## Frontend: HttpAgent, event subscription & rendering

Key files:
- `frontend/src/state/aguiChatStore.ts` – Zustand store and `HttpAgent` wiring
- `frontend/src/components/AGUIChat.tsx` – chat UI and composer
- `frontend/src/components/ToolRenderer.tsx` – renders tool UI widgets returned by the backend
- `frontend/src/tools/*.tsx` – concrete React components (e.g., `LeaveApplyForm`, `PolicyCard`)
- `frontend/src/registry/componentRegistry.ts` – maps `componentId` to React component
- `frontend/src/types.ts` – local types for messages, tool invocations, and artifacts

### HttpAgent + Zustand store
- The code builds a single `HttpAgent` via `new HttpAgent({ url: `${API_BASE}/ag-ui/run` })` in `aguiChatStore.ts`.
- `HttpAgent` collects messages (user & assistant) and provides run control with `agent.runAgent()` – which opens an SSE connection to the backend.
- `createSubscriber(toolInvocationsMap)` registers handler callbacks that process events from the SSE stream. Common handler callbacks receive structured event payloads and update the store state:
  - `onRunInitialized` – called at the start of a run
  - `onNewMessage` – called when AGUI messages list has changed
  - `onToolCallStartEvent` – creates a `ToolInvocation` record in the state
  - `onToolCallArgsEvent` – updates `ToolInvocation.args`
  - `onToolCallResultEvent` – parses the `content` JSON and sets `ToolInvocation.output` (component & props)
  - `onToolCallEndEvent` – marks invocation as `succeeded`
  - `onTextMessageContentEvent` – updates partial text for a streaming message

The store exposes `send(text)`, `stopStreaming()` and `reset()` helpers. `send` adds a user message to the agent, sets `loading`, and invokes `agent.runAgent(undefined, createSubscriber(...))` to start the SSE. `stopStreaming()` calls `agent.abortRun()`.

### Message and tool invocation lifecycle
- When `send` is executed, the agent posts a `RunAgentInput` to the `ag-ui` endpoint.
- Backend streams tool events; the frontend `createSubscriber` callback updates the in-memory tool invocations and `messages` array.
- `ToolRenderer` (see below) watches `toolInvocations` to display UI components as soon as `TOOL_CALL_RESULT` is parsed and a component id remains present.

### Rendering Tool Components
`ToolRenderer.tsx` takes a list of `ToolInvocation`s. For each invocation with a resolved `output.componentId`:
- It maps the `componentId` through `resolveComponent(componentKey)` (in `componentRegistry.ts`).
- `componentRegistry.ts` is a simple mapping of id-to-component. Example mapping:
```ts
const registry = {
  "leave.applyForm": LeaveApplyForm,
  "policy.showCard": PolicyCard,
}
```
- The `ToolRenderer` renders the React component as `<Component props={invocation.output.props} />`.

Tool components are authored in `frontend/src/tools` — those components can read state, dispatch new messages into the agent (`useAGUIChatStore.getState().send`), or render forms. The `LeaveApplyForm` is a good pattern example: it renders an editable form with a Submit button that pushes a new assistant message to the conversation when the user hits submit.

---

## Extending the system (add tools + UI)

To add a new tool and its UI component:

1. Add implementation to `backend/tools/new_tool.py`.
   - Define an async function (payload -> dict) that returns `{ component_id, props, message?, summary?, artifacts? }`.
   - Compose a JSON schema for the tool (same shape as existing tools) and return it in `schema` function.

2. Register the tool in `backend/registry/tool_registry.py`.
   - Add a mapping for `"mytool.id"` with `func` and `schema`.

3. Implement a React component to render the tool output in `frontend/src/tools/MyToolComponent.tsx`.
   - Accept `props` and implement UI for accept/modify/submit as required.

4. Add the React component mapping in `frontend/src/registry/componentRegistry.ts` with the same `componentId` the backend returns.

5. Update `AGENT_DESCRIPTIONS` in `backend/routers/ag_ui.py` to ensure `GeminiClient` can choose this tool.

6. Optionally, update `frontend/src/state/aguiChatStore.ts` to parse and store any additional fields within `ToolCallResultEvent` (for example, new artifact types).

---

## Run & debug tips
- Backend SSE endpoint: `POST /ag-ui/run` returns a streaming SSE response; make sure the front-end `VITE_API_BASE` matches your backend host.
- Health check: `GET /ag-ui/health` returns status.
- If SSE closes prematurely, check backend logs to see if a `RunErrorEvent` was emitted. `stream_agent_events` emits `RunErrorEvent` when an exception occurs.
- The front-end `HttpAgent` will abort a run if you call `agent.abortRun()`; this is wired to `stopStreaming()` in the UI.
- To test new tools locally without Gemini, rely on `GeminiClient`'s rule-based fallback (keywords such as `leave`, `pto`).

---

If you want, I can now draft a small end-to-end demo where a new tool `hr.something` returns a `component_id` and the front-end renders it automatically — let me know and I’ll implement a patch and small test user flow.