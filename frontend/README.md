# My Companion Frontend

A pared-down Vite + React interface that presents the "My Companion" chat surface. The app mirrors the ChatGPT conversation experience while staying focused on HR workflows.

## Tech Stack
- React 18 with functional components
- TypeScript for data contracts
- Zustand store for chat state
- Tailwind CSS + custom tokens for styling
- Axios for HTTP calls to the FastAPI backend

## How It Works
1. Users enter messages in the single-page chat UI (`src/components/Chat.tsx`).
2. `chatStore` queues the message history and calls `POST /chat` via `sendChat`.
3. The backend returns the full message list; the store replaces the local history to keep the UI stateless.
4. Optional stop requests trigger `POST /interrupt`, mirroring the "Stop generating" button experience.
5. `MessageBubble` renders markdown answers from My Companion with a neutral palette and HR-specific hints.

```
+--------------+                         +----------------+
| Chat.tsx UI  | -- user prompt -------> | FastAPI backend|
| (React/TW)   | <-- AI reply --------- | Gemini Agent    |
+--------------+                         +----------------+
```

### State Shape
```
{
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  loading: boolean,
  error?: string
}
```

### Key Files
| File | Description |
| --- | --- |
| `src/components/Chat.tsx` | Layout, header, empty-state suggestions, and composer |
| `src/components/MessageBubble.tsx` | Markdown renderer with "My Companion" branding |
| `src/state/chatStore.ts` | Zustand store, API calls, stop request handler |
| `src/api/send.ts` | Axios helpers for `/chat` and `/interrupt` |

## Running Locally
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173/ and point `VITE_API_BASE` (in a `.env` file) to the running backend, e.g. `VITE_API_BASE="http://localhost:8000"`.

### Production Build
```bash
cd frontend
npm run build
npm run preview
```

## Sample Responses
```
You: Summarize our parental leave policy.
My Companion: Parental leave provides 16 weeks at full pay. Primary caregivers may request +4 weeks unpaid. Notify HRIS 30 days ahead so approvals route correctly.

You: I want to compare PTO options for contractors vs FTEs.
My Companion: Contractors accrue no PTO in Workday. Offer a 5% rate uplift for engagements beyond 6 months. FTEs accrue 1.5 days/mo and unlock carryover after month 6.
```

## Troubleshooting
- No answers? Verify `VITE_API_BASE` and that the backend `/chat` endpoint is reachable.
- Stop button unresponsive? Ensure `/interrupt` is implemented server-side.
- Styling drift? Run `npm run build` to catch Tailwind/TypeScript errors before deploying.
