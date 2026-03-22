"""
session_store.py
----------------
In-memory session store with per-session asyncio.Lock.

Design goals:
- Concurrent requests for DIFFERENT sessions never block each other.
- Concurrent requests for the SAME session are serialized safely.
- Swappable for Redis without changing graph logic (swap this module only).
"""

import asyncio
import logging
from collections import defaultdict
from typing import Optional

from schemas import ConversationTurn, SessionData, TriageFields

logger = logging.getLogger(__name__)

MAX_CONVERSATION_HISTORY = 20  # Turns stored per session (rolling window)
MAX_QNA_QUESTIONS = 5          # Shared constant — also used in workflow.py


class SessionStore:
    """
    Thread-safe in-memory session store keyed by session_id.

    Each unique session_id gets its own asyncio.Lock so concurrent requests
    for the same session are serialized, while different sessions remain
    fully parallel.
    """

    def __init__(self) -> None:
        self._sessions: dict[str, SessionData] = {}
        # defaultdict creates a new Lock per session_id on first access
        self._locks: defaultdict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    # ── Public API ──────────────────────────────────────────────────────────

    async def get_or_create(self, session_id: str, user_id: str) -> SessionData:
        """
        Returns the existing session or creates a fresh one.

        Args:
            session_id: Unique session identifier.
            user_id:    User who owns the session.

        Returns:
            The SessionData for this session (never None).
        """
        async with self._locks[session_id]:
            if session_id not in self._sessions:
                logger.info("Creating new session: %s", session_id)
                self._sessions[session_id] = SessionData(
                    session_id=session_id,
                    user_id=user_id,
                )
            return self._sessions[session_id]

    async def get(self, session_id: str) -> Optional[SessionData]:
        """
        Returns the session if it exists, or None.

        Args:
            session_id: Unique session identifier.

        Returns:
            SessionData or None if not found.
        """
        async with self._locks[session_id]:
            return self._sessions.get(session_id)

    async def update_from_graph_state(self, session_id: str, final_state: dict) -> None:
        """
        Merges relevant fields from the completed GraphState back into the session store.

        Rules:
        - Triage fields use non-None-wins: existing non-None values are NEVER overwritten.
        - extracted_symptoms uses union: new symptoms are appended, never lost.
        - conversation_history is replaced wholesale (capped at MAX_CONVERSATION_HISTORY).
        - QnA state (asked_questions, pending_question, qna_questions_asked) is always replaced.

        Args:
            session_id:  The session to update.
            final_state: The GraphState dict returned by the completed graph invocation.
        """
        async with self._locks[session_id]:
            if session_id not in self._sessions:
                logger.warning("Attempted to update non-existent session: %s", session_id)
                return

            session = self._sessions[session_id]
            tf = session.triage_fields

            # ── Non-None-wins merge for triage fields ──────────────────────
            def _merge(existing, incoming):
                """Returns existing if not None, otherwise incoming."""
                return existing if existing is not None else incoming

            tf.symptom_severity  = _merge(tf.symptom_severity,  final_state.get("symptom_severity"))
            tf.symptom_count     = _merge(tf.symptom_count,     final_state.get("symptom_count"))
            tf.duration          = _merge(tf.duration,          final_state.get("duration"))
            tf.patient_age_risk  = _merge(tf.patient_age_risk,  final_state.get("patient_age_risk"))
            tf.comorbidity_flag  = _merge(tf.comorbidity_flag,  final_state.get("comorbidity_flag"))
            tf.user_lat         = _merge(tf.user_lat,         final_state.get("user_lat"))
            tf.user_lng         = _merge(tf.user_lng,         final_state.get("user_lng"))

            # ── Symptom union — never lose previously detected symptoms ─────
            new_symptoms = final_state.get("extracted_symptoms") or []
            existing_set = set(tf.extracted_symptoms)
            for symptom in new_symptoms:
                if symptom not in existing_set:
                    tf.extracted_symptoms.append(symptom)
                    existing_set.add(symptom)

            # ── QnA state — always replace with latest graph output ─────────
            if "asked_questions" in final_state:
                session.asked_questions = final_state["asked_questions"]
            if "pending_question" in final_state:
                session.pending_question = final_state["pending_question"]
            if "qna_questions_asked" in final_state:
                session.qna_questions_asked = final_state["qna_questions_asked"]
            if "urgency_label" in final_state and final_state["urgency_label"] is not None:
                session.urgency_label = final_state["urgency_label"]

            # ── Conversation history — rolling window ───────────────────────
            raw_history = final_state.get("conversation_history") or []
            session.conversation_history = [
                ConversationTurn(role=t["role"], content=t["content"])
                for t in raw_history[-MAX_CONVERSATION_HISTORY:]
            ]

            # ── Session completion ──────────────────────────────────────────
            final_response = final_state.get("final_response") or {}
            if final_response.get("session_complete") is True:
                session.session_complete = True

            logger.debug(
                "Session %s updated | complete=%s | questions_asked=%d",
                session_id,
                session.session_complete,
                session.qna_questions_asked,
            )

    async def delete(self, session_id: str) -> bool:
        """
        Permanently deletes a session and its lock.

        Args:
            session_id: The session to delete.

        Returns:
            True if the session existed and was deleted, False otherwise.
        """
        async with self._locks[session_id]:
            if session_id in self._sessions:
                del self._sessions[session_id]
                logger.info("Session deleted: %s", session_id)
                return True
            return False

    def count(self) -> int:
        """Returns the number of active sessions (non-locking, for metrics)."""
        return len(self._sessions)


# ---------------------------------------------------------------------------
# Module-level singleton — imported by chatbot.py and main.py
# ---------------------------------------------------------------------------

session_store = SessionStore()
