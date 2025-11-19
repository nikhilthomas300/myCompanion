# My Companion – HR Agent Playground

A Gemini-powered HR companion built as two tightly coupled projects:

- **FastAPI backend** (`backend/`) that accepts AG UI protocol runs at `/ag-ui/run`, orchestrates Gemini or fallback heuristics, calls structured HR tools, and streams Server-Sent Events (SSE) back to the caller.
- **Vite/React frontend** (`frontend/`) that uses `@ag-ui/client`'s `HttpAgent` to post chat turns, consumes the streaming events in real time, and renders custom React components for each tool payload.

The AG UI protocol keeps the request/response contract identical to GitHub Copilot Agents, so you can point this UI at any compliant backend by flipping `VITE_API_BASE`.

---

## Architecture At A Glance

**Backend (FastAPI)**
- `backend/main.py` boots FastAPI, wires routers, and loads `GEMINI_API_KEY` from `.env`.
- `backend/routers/ag_ui.py` is the only chat surface: it reads `RunAgentInput`, streams AG UI events (RUN_*, TOOL_CALL_*, TEXT_MESSAGE_*), and terminates with `RunFinishedEvent` or `RunErrorEvent`.
- `backend/core/gemini_client.py` picks the best tool (`general.answer`, `policy.showCard`, `leave.applyForm`) via Gemini or a rule-based fallback, then optionally drafts copy when tools need extra prose.
- `backend/registry/tool_registry.py` exposes the callable tool set plus their JSON schemas.
- `backend/tools/*` hold implementation logic—for instance, `policy_tools.py` renders policy cards, `leave_tools.py` drafts leave workflows, and `general_tools.py` is a pure text response helper.

**Frontend (React + Zustand)**
- `frontend/src/state/aguiChatStore.ts` wraps a single `HttpAgent`. It records outbound user messages, subscribes to each SSE event, normalizes them into `messages`, `toolInvocations`, and `artifacts`, and exposes `send`, `stopStreaming`, and `reset` helpers.
- `frontend/src/components/AGUIChat.tsx` renders the chat shell, handles composer UX, and streams updates by observing the Zustand store.
- `frontend/src/components/ToolRenderer.tsx` and `frontend/src/registry/componentRegistry.ts` resolve `componentId` values into actual React components (currently `LeaveApplyForm` and `PolicyCard`).
- `frontend/src/tools/*.tsx` contain the bespoke UI widgets that appear whenever a backend tool returns `component_id` + `props`.

---

## Request & Streaming Flow

1. **User input** – `AGUIChat` calls `useAGUIChatStore.getState().send(text)`.
2. **Agent run creation** – `HttpAgent` (`frontend/src/state/aguiChatStore.ts`) generates a `RunAgentInput` payload containing the thread, run, messages, current tool catalog, and optional context, then POSTs it to `${VITE_API_BASE}/ag-ui/run`.
3. **Backend orchestration** – `stream_agent_events` (`backend/routers/ag_ui.py`):
   - Emits `RunStartedEvent` immediately.
   - Asks `GeminiClient.decide(...)` which tool should run, based on `AGENT_DESCRIPTIONS`.
   - Emits `ToolCallStartEvent`, `ToolCallArgsEvent`, then awaits the async tool function.
   - Streams `ToolCallResultEvent` with serialized `componentId`, `props`, summaries, and artifacts.
   - Streams the assistant text response via `TextMessageStartEvent`, multiple `TextMessageContentEvent` chunks, and `TextMessageEndEvent` for a typing effect.
   - Finishes with `RunFinishedEvent` (or `RunErrorEvent` if anything raises), and HTTP closes.
4. **Frontend hydration** – The store subscriber updates `messages`, sets tool state to `running/succeeded`, attaches parsed tool outputs, and toggles `loading` appropriately. `AGUIChat` and `ToolRenderer` react immediately, so the UI animates without manual polling.
5. **Interrupts** – `stopStreaming()` aborts the underlying `fetch`/SSE request. `interrupt_flag` on the backend ensures cancelled conversations exit quickly.

### Sample RunAgentInput (frontend → backend)

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

### SSE Event Fragments (backend → frontend)
```
event: message
data: {"type":"RUN_STARTED","threadId":"thread_1731951120","runId":"run_1731951120"}

event: message
data: {"type":"TOOL_CALL_START","toolCallId":"tool_4e7a5d2a","toolCallName":"policy.showCard"}

event: message
data: {"type":"TOOL_CALL_RESULT","toolCallId":"tool_4e7a5d2a","content":"{\"componentId\":\"policy.showCard\",\"props\":{...}}"}

event: message
data: {"type":"TEXT_MESSAGE_CONTENT","messageId":"msg_6a424917","delta":"Primary caregivers receive 16 weeks paid leave..."}

event: message
data: {"type":"RUN_FINISHED","threadId":"thread_1731951120","runId":"run_1731951120","result":{"toolCallId":"tool_4e7a5d2a","toolId":"policy.showCard"}}
```

---

## Project Map

```
backend/
  main.py                FastAPI entrypoint + CORS
  routers/
    ag_ui.py             SSE endpoint implementing AG UI protocol
    interrupt.py         User-triggered cancellation hooks
    human.py             Optional human-in-the-loop stub
    feedback.py          Thumb/feedback ingestion stub
  core/
    gemini_client.py     Gemini tool selection + response generation
    interrupt_flag.py    Global interrupt state shared across requests
  tools/
    general_tools.py     Plain-language replies
    leave_tools.py       Leave workflow payload and schema
    policy_tools.py      Policy card payload and schema
  registry/
    tool_registry.py     Tool metadata + lookup helpers

frontend/
  src/state/aguiChatStore.ts   Zustand store + HttpAgent wiring
  src/components/*.tsx         Chat surface, message bubbles, tool renderer
  src/tools/*.tsx              React components rendered for tool outputs
  src/registry/componentRegistry.ts  componentId → React component map
```

---

## Getting Started

### 1. Backend (FastAPI + Gemini)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # if you keep a template
# edit .env to include GEMINI_API_KEY=<your key>
python -m uvicorn main:app --reload --port 8000
```

- Health check: `curl http://localhost:8000/health`
- Primary SSE endpoint: `POST http://localhost:8000/ag-ui/run`

### 2. Frontend (Vite + React)

```bash
cd frontend
npm install
cp .env.example .env.local  # optional helper
# ensure VITE_API_BASE=http://localhost:8000
npm run dev
```

- Visit `http://localhost:5173/` and start chatting. The UI streams tool output as soon as the backend emits events.

### Environment Variables

| File | Key | Description |
| --- | --- | --- |
| `backend/.env` | `GEMINI_API_KEY` | Google Generative AI key; required for live Gemini calls. |
| `backend/.env` | `GEMINI_MODEL` (optional) | Overrides the model name (default `gemini-2.5-flash`). |
| `frontend/.env.local` | `VITE_API_BASE` | Base URL for the backend (defaults to `http://localhost:8000`). |

---

## Extending The System

1. **Add a backend tool**
   - Implement async logic in `backend/tools/<new_tool>.py` returning `{ message, component_id, props, artifacts?, requires_human? }`.
   - Provide a JSON schema (see `leave_apply_schema()` for reference).
   - Register it in `backend/registry/tool_registry.py` and describe it in `AGENT_DESCRIPTIONS` inside `ag_ui.py` so `GeminiClient` can pick it.

2. **Expose a new React component**
   - Create a component in `frontend/src/tools/YourComponent.tsx`.
   - Add it to `frontend/src/registry/componentRegistry.ts` with a matching `componentId`.
   - When your backend tool returns that `component_id`, `ToolRenderer` will hydrate it automatically.

3. **Customize the chat surface**
   - `AGUIChat.tsx` controls layout and composer shortcuts.
   - `MessageBubble.tsx` handles streaming markdown rendering; extend it for citations or avatars.

---

## Troubleshooting & Tips

- **SSE never resolves** – Check backend logs for exceptions. `stream_agent_events` always emits `RunErrorEvent` before closing; unhandled errors usually mean the client disconnected early.
- **Tool UI never appears** – Ensure the backend returns a `component_id` that exists in `componentRegistry.ts`. Missing entries are silently ignored today.
- **Gemini unavailable** – Without `GEMINI_API_KEY`, `GeminiClient` falls back to keyword heuristics and templated responses; add the key to regain smart routing.
- **Interrupt button stuck** – The frontend calls `HttpAgent.abortRun()`. Confirm the backend honors `interrupt_flag.is_triggered()` (triggered by `/interrupt` router) if you extend cancellation semantics.
- **CORS errors** – Update `allow_origins` in `backend/main.py` to the actual frontend origin for production.

Happy building! Tinker with new HR workflows, richer tool payloads, or alternative LLM providers while the AG UI protocol keeps your request/response plumbing consistent.
