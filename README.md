# Custom Agent UI (AG UI Protocol)

A Gemini-powered HR companion with a React/Vite frontend, FastAPI backend, and a fully streaming **AG UI Protocol** bridge between them. The project now operates in a single, protocol-first mode: every chat round-trip is a POST to `/ag-ui/run` that streams structured events back to the browser via Server-Sent Events (SSE).

## Highlights
- **Real-time streaming** &mdash; SSE events are parsed incrementally in `frontend/src/api/agui.ts`, so text arrives chunk by chunk while Gemini is still thinking.
- **Standard AG UI contract** &mdash; `models/ag_ui_types.py` mirrors the official schema, making it trivial to point the UI at any compliant backend by changing `VITE_API_BASE`.
- **Custom HR components** &mdash; Tool responses can emit `componentId` plus `props`; the frontend resolves them through `registry/componentRegistry.ts` and renders React components such as the leave form or policy card.
- **Single source of truth** &mdash; Legacy REST chat files have been removed. AG UI documentation is folded into this README so there is one place to start.

## Project Layout (key files only)

```
backend/
├── main.py                   # FastAPI app + router wiring
├── routers/ag_ui.py          # SSE endpoint implementing AG UI events
├── core/gemini_client.py     # Gemini orchestration + fallback logic
├── models/ag_ui_types.py     # Typed RunAgentInput/BaseEvent models
└── tools/*.py                # Tool payload builders (general, leave, policy)

frontend/
├── src/api/agui.ts           # Streaming fetch client with resilient SSE parser
├── src/state/aguiChatStore.ts# Zustand store translating AG UI events into UI state
├── src/components/AGUIChat.tsx
├── src/components/MessageBubble.tsx
├── src/components/ToolRenderer.tsx
├── src/registry/componentRegistry.ts
└── src/tools/LeaveApplyForm.tsx, PolicyCard.tsx
```

## How Streaming Works
1. The UI calls `runAGUIAgent` with a `RunAgentInput` packet (threadId, runId, prior messages, tool catalog info).
2. `/ag-ui/run` immediately emits `RUN_STARTED`, `TOOL_CALL_*`, and then `TEXT_MESSAGE_*` events via `EventSourceResponse`.
3. `frontend/src/api/agui.ts` keeps a rolling buffer while parsing `data:` lines so partial chunks never block the UI.
4. `aguiChatStore` converts these events into chat bubbles, tool invocation cards, and loading states in real time.

### Request Payload Example

```json
{
   "threadId": "thread_1731951120",
   "runId": "run_1731951120",
   "messages": [
      {
         "id": "user_1731951120",
         "role": "user",
         "content": "What is the parental leave policy?"
      }
   ],
   "tools": [],
   "context": [],
   "state": null
}
```

### Streamed Event Sample

```
event: message
data: {"type":"RUN_STARTED","threadId":"thread_1731951120","runId":"run_1731951120"}

event: message
data: {"type":"TOOL_CALL_START","toolCallId":"tool_ed31e7c8","toolCallName":"policy.showCard"}

event: message
data: {"type":"TOOL_CALL_RESULT","toolCallId":"tool_ed31e7c8","content":"{\"componentId\":\"policy.showCard\",\"props\":{...}}"}

event: message
data: {"type":"TEXT_MESSAGE_START","messageId":"msg_a2fbc8"}

event: message
data: {"type":"TEXT_MESSAGE_CONTENT","messageId":"msg_a2fbc8","delta":"Our parental leave policy offers..."}

event: message
data: {"type":"TEXT_MESSAGE_END","messageId":"msg_a2fbc8"}

event: message
data: {"type":"RUN_FINISHED","threadId":"thread_1731951120","runId":"run_1731951120"}
```

## Custom Component Triggering

Tools return structured payloads to the router:

```python
return {
   "message": "You qualify for 16 weeks paid leave.",
   "component_id": "policy.showCard",
   "props": {
      "title": "Parental Leave",
      "summary": "16 weeks paid leave for primary caregivers.",
      "links": [{"label": "View policy", "href": "https://hr/policies/parental"}]
   },
   "artifacts": [],
   "requires_human": False
}
```

`ToolRenderer` reads the `componentId`, looks it up in `componentRegistry.ts`, and renders the matching React component. Add new UI by dropping a component under `src/tools/`, registering it, and returning its id from any tool.

## Running Locally

```bash
# 1. Backend (FastAPI + Gemini)
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# create backend/.env and add GEMINI_API_KEY=...
python -m uvicorn main:app --reload --port 8000

# 2. Frontend (Vite dev server)
cd ../frontend
npm install
npm run dev
```

- Default backend URL: `http://localhost:8000`
- Override in the UI by setting `VITE_API_BASE` in `frontend/.env.local`.

## Environment Variables

`backend/.env`
```
GEMINI_API_KEY=your_key
# optional overrides
GEMINI_MODEL=gemini-2.5-pro
```

`frontend/.env.local`
```
VITE_API_BASE=http://localhost:8000
```

## Troubleshooting
- **No streaming or big delay** &mdash; ensure `/ag-ui/run` logs show events; the SSE parser now buffers partial chunks, so any remaining delay usually means Gemini is still generating.
- **CORS errors** &mdash; adjust `allow_origins` inside `backend/main.py` when pointing to remote servers.
- **Tool UI missing** &mdash; confirm the tool emits `component_id` that exists in `componentRegistry.ts`; otherwise `ToolRenderer` renders a fallback card.
- **Stop button stuck** &mdash; call `stopStreaming` in the store, which aborts the fetch and resets `loading`.

## Extending the System
1. **Add a new tool** under `backend/tools/` and register it inside `registry/tool_registry.py`.
2. **Emit UI** by returning `component_id` + `props` to match the registry key.
3. **Stream richer events** by yielding additional AG UI event types (e.g., `MESSAGES_SNAPSHOT`, `MESSAGE_METADATA`) from `stream_agent_events`.

## License
Educational use only.

---

Built with React, Vite, Tailwind, Zustand, FastAPI, and Gemini 2.5.
