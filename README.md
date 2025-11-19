# My Companion — AG UI HR Companion

My Companion is a Gemini-powered HR assistant that speaks the **AG UI protocol** end to end. The repo contains two tightly coupled apps:

- **FastAPI backend** (`backend/`) – accepts AG UI `RunAgentInput` payloads at `/ag-ui/run`, routes requests through Gemini or deterministic heuristics, executes structured HR tools, and streams Server-Sent Events (SSE) back to the caller.
- **Vite/React frontend** (`frontend/`) – wraps `@ag-ui/client`'s `HttpAgent`, sends chat turns, consumes the streaming protocol events, and renders custom React components for each tool payload.

Because the AG UI contract matches GitHub Copilot Agents, you can point the UI at any compliant backend by changing `VITE_API_BASE`.

---

## Tech Stack

- **Backend:** FastAPI, `sse-starlette`, Google Gemini SDK, asyncio
- **Frontend:** React 18, Vite, TypeScript, Tailwind, Zustand, `@ag-ui/client`
- **Protocol:** AG UI (`RunAgentInput`, `Run*`, `ToolCall*`, `TextMessage*` events)

---

## Repository Layout

```
backend/
  main.py                FastAPI entrypoint + CORS
  routers/
    ag_ui.py             SSE endpoint emitting AG UI events
    interrupt.py         Abort long-running runs
    human.py             Human-in-the-loop stub
    feedback.py          Like/dislike endpoint
  core/
    gemini_client.py     Gemini orchestration + fallback routing
    interrupt_flag.py    Shared cancellation primitive
  registry/
    tool_registry.py     Tool metadata + JSON schemas
  tools/
    general_tools.py     Plain-language answers
    leave_tools.py       Leave form payload + schema
    policy_tools.py      Policy card payload + schema
    weather_tools.py     Weather snapshot payload + schema

frontend/
  src/state/aguiChatStore.ts  Zustand store + HttpAgent wiring
  src/components/             Chat shell, message bubbles, tool renderer
  src/tools/                  React widgets rendered for tool payloads
  src/tools/WeatherCard.tsx   Weather snapshot card rendered from Gemini props
  src/registry/componentRegistry.ts  componentId → component map
```

---

## How The Assistant Works

1. **User input** – `AGUIChat` collects text and calls `useAGUIChatStore.getState().send(message)`.
2. **Run creation** – `HttpAgent` builds a `RunAgentInput` (thread id, run id, messages, tool catalog, context) and POSTs it to `${VITE_API_BASE}/ag-ui/run`.
3. **Backend orchestration** – `stream_agent_events` starts by emitting `RUN_STARTED`, asks `GeminiClient.decide` which tool to call, streams `TOOL_CALL_*` events, executes the tool implementation, and streams the serialized result.
4. **Assistant response** – The backend streams `TEXT_MESSAGE_*` chunks for the assistant reply before signaling `RUN_FINISHED` (or `RUN_ERROR`).
5. **UI hydration** – The Zustand subscriber keeps `messages`, `toolInvocations`, and `artifacts` in sync so the React components update immediately. `stopStreaming()` aborts the fetch; the backend reads `interrupt_flag` to exit gracefully.

### Inspecting The Request/Response Flow

- The chat store emits `[AGUI] …` console logs for every request, tool call, SSE chunk, and completion so you can trace the entire lifecycle while the app runs.
- Logging is always enabled during `npm run dev`. Set `VITE_AGUI_DEBUG=true` in `frontend/.env.local` to keep the same traces in preview or production builds.
- Open the browser DevTools console to see entries such as `Sending user message`, `Tool call result`, or `Assistant message completed`, which mirror the payloads sent to and received from the backend.
- These traces make it easy to verify that the Gemini-generated props (for example, the weather snapshot) match what ultimately renders in React.

### Sample `RunAgentInput`

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

### SSE Snapshot

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

## Backend Internals

- `main.py` – loads `.env`, configures permissive CORS, mounts routers.
- `routers/ag_ui.py` – the only chat surface. Serializes Pydantic AG UI events (`RunStartedEvent`, `ToolCall*`, `TextMessage*`, `RunFinishedEvent`) into SSE via `_format_sse`.
- `core/gemini_client.py` – registers tool schemas, asks Gemini (or applies keyword heuristics) for `GeminiDecision`, and exposes a text-generation helper used by `general.answer`.
- `tools/*` – return `{component_id, props, summary/message, artifacts?, requires_human?}` payloads that both the assistant text and frontend UI consume.
- `tools/weather_tools.py` – requests a JSON weather snapshot from Gemini, normalizes it, and emits the `weather.showCard` payload rendered on the frontend.
- `registry/tool_registry.py` – central source of truth for callable tool functions and their JSON schema definitions shared with Gemini.

Interrupt handling: `/interrupt` triggers `interrupt_flag`, `/human-action` clears it so the next run can proceed.

---

## Frontend Internals

- `src/state/aguiChatStore.ts` – single Zustand store that owns the `HttpAgent`, message list, tool invocation list, artifacts, and control helpers (`send`, `stopStreaming`, `reset`). Each AG UI event has a subscriber callback to keep state consistent.
- `src/components/AGUIChat.tsx` – chat surface + composer experience, sample prompts, error banners, and typing indicator.
- `src/components/ToolRenderer.tsx` + `src/tools/*` – resolve `componentId` (e.g., `leave.applyForm`, `policy.showCard`) to React components that render structured artifacts.
- `src/tools/WeatherCard.tsx` – binds Gemini-provided props (location, stats, forecast) into a visual weather snapshot card.
- `src/components/MessageBubble.tsx` – Markdown rendering, thumbs-up/down, copy button.

---

## Weather Snapshot Card

- Trigger it by asking weather-focused prompts such as “What is the weather around our Bangalore campus this afternoon?”; Gemini routes those to the `weather.showCard` tool.
- `weather_tools.py` instructs Gemini to return structured JSON (location, summary, stats, forecast, prep tips). The tool normalizes/parses the JSON and forwards the props untouched to the UI so the card reflects exactly what Gemini produced.
- `WeatherCard.tsx` presents the data as a gradient hero block (current condition + headline), stat tiles (humidity, chance of rain, wind, UV), a short rolling forecast, and a checklist of prep suggestions for commuters.
- Sample payload:

```json
{
  "componentId": "weather.showCard",
  "props": {
    "location": "Bengaluru, India",
    "asOf": "19 Nov 2025 09:00 IST",
    "summary": "Humid start with a 40% chance of brief afternoon showers.",
    "temperature": { "value": 27, "unit": "°C" },
    "stats": [
      { "label": "Feels like", "value": "29°C" },
      { "label": "Humidity", "value": "64%" },
      { "label": "Chance of rain", "value": "40%" },
      { "label": "Wind", "value": "14 kph SW" }
    ],
    "forecast": [
      { "label": "Morning", "temp": "26°C", "condition": "Cloudy", "precipitationChance": "20%" },
      { "label": "Afternoon", "temp": "29°C", "condition": "Showers", "precipitationChance": "45%" }
    ],
    "tips": ["Carry a light rain shell", "Hydrate if commuting"]
  }
}
```

Use this structure when adding policies or automation that depend on situational weather data.

---

## Running Locally

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # then add GEMINI_API_KEY=<your key>
python -m uvicorn main:app --reload --port 8000
```

- Health: `curl http://localhost:8000/health`
- Chat endpoint: `POST http://localhost:8000/ag-ui/run`

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local  # optional helper
echo "VITE_API_BASE=http://localhost:8000" >> .env.local
npm run dev
```

Visit `http://localhost:5173/` to chat. Tool outputs appear instantly as soon as the backend emits `TOOL_CALL_RESULT`.

### Environment Variables

| File | Key | Description |
| --- | --- | --- |
| `backend/.env` | `GEMINI_API_KEY` | Google Generative AI key used by `GeminiClient`. |
| `backend/.env` | `GEMINI_MODEL` (optional) | Override model name (`gemini-2.5-flash` default). |
| `frontend/.env.local` | `VITE_API_BASE` | Backend origin for the AG UI endpoint. |
| `frontend/.env.local` | `VITE_AGUI_DEBUG` (optional) | Force AG UI console tracing outside dev mode (default: logs enabled only in dev). |

---

## Extending The System

1. **Add a backend tool**
   - Create `backend/tools/<name>_tool.py` returning the standard payload.
   - Provide a JSON schema (see `leave_apply_schema`) and register it in `registry/tool_registry.py`.
   - Add a brief description to `AGENT_DESCRIPTIONS` in `routers/ag_ui.py` so Gemini knows when to call it.

2. **Render the tool on the frontend**
   - Build `frontend/src/tools/MyWidget.tsx`.
   - Register it in `frontend/src/registry/componentRegistry.ts` under the same `component_id`.
  - Example: `weather.showCard` maps to `WeatherCard.tsx`, which expects the normalized props emitted by `weather_tools.py`.

3. **Customize chat UX**
   - Extend `AGUIChat.tsx` for new controls, `MessageBubble.tsx` for metadata, or `ToolRenderer.tsx` for richer affordances.

---

## Troubleshooting

- **SSE never resolves** – Inspect backend logs. `stream_agent_events` always emits `RunErrorEvent` before closing; unexpected disconnects usually mean the client aborted early.
- **Tool UI missing** – Ensure the backend returns a `component_id` that exists in `componentRegistry.ts`. Unknown components are ignored.
- **No Gemini key** – The system falls back to keyword routing plus templated text via `_fallback_text`. Add `GEMINI_API_KEY` to regain LLM-powered decisions.
- **Interrupt button stuck** – `stopStreaming()` calls `HttpAgent.abortRun()`. Confirm `/interrupt` is hit (or the server honors `interrupt_flag.is_triggered()`) if streams keep running.
- **CORS issues** – Update `allow_origins` in `backend/main.py` to match your frontend host when deploying.

Happy building! Iterate on new HR workflows, richer tool payloads, or entirely new AG UI-compatible backends while reusing this frontend shell.
