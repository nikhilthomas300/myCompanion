from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables from .env before importing routers so Gemini sees keys
try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None  # type: ignore

if load_dotenv:
    env_path = Path(__file__).parent / ".env"
    load_dotenv(dotenv_path=env_path)
    print(f"[Main] Loaded .env file. GEMINI_API_KEY present: {bool(os.getenv('GEMINI_API_KEY'))}")
else:
    print("[Main] python-dotenv not installed, using system environment variables")

from routers import ag_ui, feedback, human, interrupt

app = FastAPI(title="Custom Agent Orchestrator")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"]
    ,
    allow_headers=["*"],
)

app.include_router(ag_ui.router)
app.include_router(interrupt.router)
app.include_router(human.router)
app.include_router(feedback.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
