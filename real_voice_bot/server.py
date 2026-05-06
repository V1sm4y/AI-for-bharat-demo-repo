"""
server.py — FastAPI backend for AI SkillFit.

Endpoints:
  POST /start-interview  → creates room, dispatches agent, returns token
  POST /save-result       → persists interview scores to SQLite
  GET  /results           → fetches all results (optionally filtered by trade)
"""

import os
import logging
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from livekit import api

from database import save_result, get_results

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("skillfit.server")

# ── Environment ─────────────────────────────────────────────────────────────
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "wss://voice-bot-szlvcdo4.livekit.cloud")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")

if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
    logger.warning("[Server] LIVEKIT_API_KEY or LIVEKIT_API_SECRET not set — token/dispatch endpoints will fail.")

# ── FastAPI app ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="AI SkillFit Backend",
    description="Backend API for AI SkillFit — government skill assessment platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response schemas ──────────────────────────────────────────────
class StartInterviewRequest(BaseModel):
    candidate_name: str
    trade: str
    phone_number: str


class StartInterviewResponse(BaseModel):
    token: str
    room: str
    url: str


class SaveResultRequest(BaseModel):
    candidate_name: str
    phone_number: str
    trade: str
    scores: list
    weak_topics: list
    fitment: str
    average_score: float


class SaveResultResponse(BaseModel):
    status: str
    id: int


# ── Endpoints ───────────────────────────────────────────────────────────────

@app.post("/start-interview", response_model=StartInterviewResponse)
async def start_interview(req: StartInterviewRequest):
    """
    Creates a LiveKit room, dispatches the SkillFit agent to it,
    and returns a join token for the candidate.
    """
    # Generate unique room name
    short_id = uuid4().hex[:8]
    room_name = f"interview-{req.phone_number}-{short_id}"

    logger.info(f"[Server] Starting interview — room={room_name}, candidate={req.candidate_name}, trade={req.trade}")

    try:
        # Check if we have keys. If not, return mock data for local review.
        if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET or "your-project" in LIVEKIT_URL:
            logger.info("[Server] Missing LiveKit keys — returning mock credentials for UI review.")
            return StartInterviewResponse(
                token="mock-token-for-review-purposes",
                room=room_name,
                url="ws://localhost:8080", # Dummy URL
            )

        # Initialize LiveKit API client
        lkapi = api.LiveKitAPI(
            url=LIVEKIT_URL,
            api_key=LIVEKIT_API_KEY,
            api_secret=LIVEKIT_API_SECRET,
        )

        # 1. Create the room on LiveKit Cloud
        await lkapi.room.create_room(
            api.CreateRoomRequest(
                name=room_name,
                empty_timeout=600,       # 10 min timeout if empty
                max_participants=2,      # candidate + agent
                metadata=f'{{"candidate_name": "{req.candidate_name}", "trade": "{req.trade}", "phone_number": "{req.phone_number}"}}',
            )
        )
        logger.info(f"[Server] Room created: {room_name}")

        # 2. Dispatch the agent to the room
        await lkapi.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(
                agent_name="skillfit-agent",
                room=room_name,
                metadata=f'{{"candidate_name": "{req.candidate_name}", "trade": "{req.trade}", "phone_number": "{req.phone_number}"}}',
            )
        )
        logger.info(f"[Server] Agent dispatched to room: {room_name}")

        # 3. Generate access token for the candidate
        token = (
            api.AccessToken(
                api_key=LIVEKIT_API_KEY,
                api_secret=LIVEKIT_API_SECRET,
            )
            .with_identity(f"candidate-{req.phone_number}")
            .with_name(req.candidate_name)
            .with_grants(
                api.VideoGrants(
                    room_join=True,
                    room=room_name,
                )
            )
            .to_jwt()
        )
        logger.info(f"[Server] Token generated for candidate: {req.candidate_name}")

        # Clean up API client
        await lkapi.aclose()

        return StartInterviewResponse(
            token=token,
            room=room_name,
            url=LIVEKIT_URL,
        )

    except Exception as e:
        logger.error(f"[Server] Failed to start interview: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start interview: {str(e)}")


@app.post("/save-result", response_model=SaveResultResponse)
async def save_result_endpoint(req: SaveResultRequest):
    """
    Persists interview results to SQLite.
    Called internally by the agent at the end of the interview.
    """
    try:
        record_id = save_result(
            candidate_name=req.candidate_name,
            phone_number=req.phone_number,
            trade=req.trade,
            scores=req.scores,
            weak_topics=req.weak_topics,
            fitment=req.fitment,
            average_score=req.average_score,
        )
        logger.info(f"[Server] Result saved — ID={record_id}, candidate={req.candidate_name}")
        return SaveResultResponse(status="saved", id=record_id)

    except Exception as e:
        logger.error(f"[Server] Failed to save result: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save result: {str(e)}")


@app.get("/results")
async def get_results_endpoint(trade: str | None = Query(default=None, description="Filter results by trade")):
    """
    Fetches all interview results, optionally filtered by trade.
    Sorted by interview date descending (newest first).
    """
    try:
        results = get_results(trade=trade)
        return results
    except Exception as e:
        logger.error(f"[Server] Failed to fetch results: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch results: {str(e)}")


@app.get("/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "healthy", "service": "AI SkillFit Backend"}


# ── Run with uvicorn ────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
