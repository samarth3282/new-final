"""
chatbot.py
----------
Session-aware orchestrator that bridges the FastAPI layer with the LangGraph workflow.

Responsibilities:
  1. Load or create the session from the session store.
  2. Hydrate the GraphState from persisted session data (fixes Bug #1 — infinite QnA loop).
  3. Invoke the compiled LangGraph workflow asynchronously.
  4. Persist updated state back to the session store.
  5. Return a validated OutputResponse to the API layer.
"""

import logging
import uuid
from typing import Optional

from schemas import (
    GraphState,
    InputRequest,
    OutputResponse,
    HospitalInfo,
    default_graph_state,
)
from session_store import session_store
from workflow import chatbot_graph

logger = logging.getLogger(__name__)


async def run_chatbot(request: InputRequest) -> OutputResponse:
    """
    Executes the full healthcare triage workflow for one conversation turn.

    Flow:
      1. Resolve session_id (use provided or generate new UUID).
      2. Load session from store (or create fresh if not found).
      3. Build initial GraphState by merging default + persisted session data.
      4. Inject this turn's user_message and user_location.
      5. Invoke chatbot_graph.ainvoke(initial_state).
      6. Persist final_state back to the session store.
      7. Map final_response dict → OutputResponse Pydantic model.

    Args:
        request: Validated InputRequest from the FastAPI endpoint.

    Returns:
        OutputResponse with the chatbot's reply and session metadata.

    Raises:
        RuntimeError: If the graph invocation fails to produce a final_response.
    """
    # ── Step 1: Resolve session ───────────────────────────────────────────
    session_id = request.session_id or str(uuid.uuid4())
    user_id    = request.user_id

    logger.info("run_chatbot: session=%s", session_id)

    # ── Step 2: Load/create session ───────────────────────────────────────
    session = await session_store.get_or_create(session_id=session_id, user_id=user_id)

    # ── Step 3: Build initial GraphState from defaults + session data ──────
    # Start with safe defaults so no field is ever missing
    initial_state: GraphState = default_graph_state()

    # Overlay persisted session data (non-None-wins already applied in session store)
    session_patch = session.to_graph_state_patch()
    for key, value in session_patch.items():
        if value is not None:
            initial_state[key] = value  # type: ignore[literal-required]
        elif key in ("asked_questions", "extracted_symptoms", "conversation_history", "missing_fields"):
            # These are lists — use the persisted value even if empty
            initial_state[key] = value  # type: ignore[literal-required]

    # ── Step 4: Inject this turn's inputs ─────────────────────────────────
    initial_state["user_message"] = request.message
    initial_state["user_id"]      = user_id
    initial_state["session_id"]   = session_id
    initial_state["user_language"] = request.language or "en"

    # lat/lng: use request values if provided, otherwise keep from session
    if request.lat is not None:
        initial_state["user_lat"] = request.lat
    if request.lng is not None:
        initial_state["user_lng"] = request.lng

    logger.debug(
        "run_chatbot: initial state — severity=%s, duration=%s, questions_asked=%d",
        initial_state.get("symptom_severity"),
        initial_state.get("duration"),
        initial_state.get("qna_questions_asked", 0),
    )

    # ── Step 5: Invoke the graph ──────────────────────────────────────────
    try:
        final_state: GraphState = await chatbot_graph.ainvoke(initial_state)
    except Exception as exc:
        logger.exception("chatbot_graph.ainvoke failed: %s", exc)
        raise RuntimeError(f"Graph invocation failed: {exc}") from exc

    # ── Step 6: Validate we got a response ───────────────────────────────
    final_response = final_state.get("final_response")
    if not final_response:
        logger.error("Graph completed without producing final_response — state: %s", {
            k: final_state.get(k) for k in ("route_to", "output_mode", "error_message")
        })
        raise RuntimeError(
            "Graph completed but produced no final_response. "
            "Check workflow node logs for routing errors."
        )

    # ── Step 7: Persist session ───────────────────────────────────────────
    await session_store.update_from_graph_state(
        session_id=session_id,
        final_state=final_state,
    )

    # ── Step 8: Map to OutputResponse ─────────────────────────────────────
    hospital_info_raw = final_response.get("hospital_info")
    hospital_info: Optional[list[HospitalInfo]] = None

    if isinstance(hospital_info_raw, list) and hospital_info_raw:
        try:
            hospital_info = [HospitalInfo(**h) if isinstance(h, dict) else h for h in hospital_info_raw]
        except Exception as exc:
            logger.warning("Failed to parse hospital_info: %s", exc)
            hospital_info = None

    output = OutputResponse(
        output_type      = final_response.get("output_type", "answer"),
        urgency_label    = final_response.get("urgency_label"),
        message          = final_response.get("message", "I was unable to generate a response. Please try again."),
        action_items     = final_response.get("action_items", []),
        hospital_info    = hospital_info,
        disclaimer       = final_response.get("disclaimer"),
        session_complete = bool(final_response.get("session_complete", False)),
        session_id       = session_id,
        session_summary  = final_response.get("session_summary"),
        total_summary    = final_response.get("total_summary"),
    )

    logger.info(
        "run_chatbot: session=%s output_type=%s session_complete=%s",
        session_id, output.output_type, output.session_complete,
    )

    return output
