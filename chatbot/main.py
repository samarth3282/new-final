"""
main.py
-------
FastAPI application for the AETRIX Healthcare Triage Chatbot.

Endpoints:
  POST   /api/chat                 — Main chatbot interaction
  GET    /health                   — Liveness check
  GET    /session/{session_id}     — Inspect session state (debug)
  DELETE /session/{session_id}     — Clear a session

Run with:
  python main.py
  uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from chatbot import run_chatbot
from config import API_HOST, API_PORT, CORS_ORIGINS, validate_config
from schemas import ErrorResponse, InputRequest, OutputResponse
from session_store import session_store

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan — startup / shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Validates critical config at startup. Logs shutdown cleanly."""
    logger.info("Starting AETRIX Chatbot API...")
    validate_config()
    logger.info("✅ Config validated. API is ready.")
    yield
    logger.info("🛑 AETRIX Chatbot API shutting down. Active sessions: %d", session_store.count())


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="AETRIX Healthcare Triage Chatbot API",
    description=(
        "Agentic, multilingual healthcare triage chatbot powered by Groq LLMs, "
        "Mem0 memory, LangChain, and LangGraph. "
        "Classifies symptoms, asks targeted follow-up questions, and routes patients "
        "to self-care, clinic, or emergency based on urgency assessment."
    ),
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


# ---------------------------------------------------------------------------
# CORS Middleware
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response Logging Middleware
# ---------------------------------------------------------------------------

@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    """
    Logs every incoming request and outgoing response with timing.
    Does NOT log raw message content to protect PII.
    """
    request_id = str(uuid.uuid4())[:8]
    start_time = time.perf_counter()

    logger.info(
        "[%s] ➜ %s %s",
        request_id, request.method, request.url.path,
    )

    response = await call_next(request)

    elapsed_ms = (time.perf_counter() - start_time) * 1000
    logger.info(
        "[%s] ◂ %d | %.1f ms",
        request_id, response.status_code, elapsed_ms,
    )
    return response


# ---------------------------------------------------------------------------
# Exception Handlers
# ---------------------------------------------------------------------------

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content=ErrorResponse(
            error="validation_error",
            detail=str(exc),
        ).model_dump(),
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse(
            error="internal_server_error",
            detail="An unexpected error occurred. Please try again.",
        ).model_dump(),
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get(
    "/health",
    tags=["Health"],
    summary="Liveness check",
)
async def health_check():
    """Returns API status and active session count."""
    return {
        "status":          "ok",
        "service":         "AETRIX Healthcare Triage Chatbot API",
        "version":         "2.0.0",
        "active_sessions": session_store.count(),
    }


@app.post(
    "/api/chat",
    response_model=OutputResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request (empty message, etc.)"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
    tags=["Chatbot"],
    summary="Send a message to the healthcare triage chatbot",
)
async def chat(request: InputRequest) -> OutputResponse:
    """
    Main chatbot endpoint. Accepts a user message and returns a triage response.

    The response type depends on the conversation state:
    - **query**: Follow-up question gathering triage information
    - **answer**: Answer to a general health question
    - **suggestions**: Self-care guidance (low urgency)
    - **clinic**: Recommendation to visit a clinic (medium urgency)
    - **emergency**: Emergency alert with immediate action steps (high urgency)

    Session state persists across multiple calls using `session_id`.
    If `session_id` is omitted, a new session is created automatically.
    """
    try:
        response = await run_chatbot(request)
        return response

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except RuntimeError as exc:
        logger.error("Runtime error in chat endpoint: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
    except Exception as exc:
        logger.exception("Unexpected error in chat endpoint: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again.",
        )


@app.get(
    "/session/{session_id}",
    tags=["Session"],
    summary="Inspect current session state",
    responses={
        404: {"model": ErrorResponse, "description": "Session not found"},
    },
)
async def get_session(session_id: str):
    """
    Returns the current triage state for a session. Useful for debugging and frontend state sync.
    PII fields (user messages) are not stored in the session — only extracted triage parameters.
    """
    session = await session_store.get(session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found.",
        )
    return {
        "session_id":          session.session_id,
        "session_complete":    session.session_complete,
        "urgency_label":       session.urgency_label,
        "questions_asked":     session.qna_questions_asked,
        "pending_question":    session.pending_question,
        "triage_fields": {
            "symptom_severity":  session.triage_fields.symptom_severity,
            "symptom_count":     session.triage_fields.symptom_count,
            "duration":          session.triage_fields.duration,
            "patient_age_risk":  session.triage_fields.patient_age_risk,
            "comorbidity_flag":  session.triage_fields.comorbidity_flag,
        },
        "conversation_turns": len(session.conversation_history),
    }


@app.delete(
    "/session/{session_id}",
    tags=["Session"],
    summary="Clear and delete a session",
    responses={
        404: {"model": ErrorResponse, "description": "Session not found"},
    },
)
async def delete_session(session_id: str):
    """
    Permanently deletes a session and all its stored triage data.
    Use for user logout, privacy deletion, or resetting a triage conversation.
    """
    deleted = await session_store.delete(session_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found.",
        )
    return {"message": f"Session '{session_id}' deleted successfully."}


# ---------------------------------------------------------------------------
# Entry Point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=API_HOST,
        port=API_PORT,
        reload=True,
        log_level="info",
    )
