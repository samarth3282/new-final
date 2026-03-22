"""
workflow.py
-----------
Complete LangGraph StateGraph implementation for the healthcare triage chatbot.

Graph topology:
  START
    └─► input_node
          ├─► emergency_node ──► hospital_finding_node ──► output_node ──► END
          │         └───────────────────────────────────► qna_node ──┐
          ├─► qna_node ◄─────────────────────────────────────────────┘
          │     ├─► output_node (mode=query) ──► END
          │     └─► classification_node
          │               ├─► output_node (mode=suggestions) ──► END
          │               └─► hospital_finding_node ──► output_node ──► END
          └─► output_node (mode=answer | error) ──► END

Safety invariants (enforced in code, not just docs):
  1. CRITICAL_KEYWORDS in user_message → route_to=emergency_node regardless of LLM output
  2. Emergency API failure + urgency_signals present → is_emergency=True (conservative)
  3. user_answer ALWAYS passes through input_node (never bypassed)
  4. qna_questions_asked >= MAX_QNA_QUESTIONS → apply CONSERVATIVE_DEFAULTS, proceed to classification
  5. Non-None-wins rule on all triage field merges
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from langgraph.graph import END, StateGraph

from api_clients import (
    call_classification_api,
    call_emergency_api,
    call_hospital_api,
)
from config import (
    CRITICAL_KEYWORDS,
    GROQ_API_KEY,
    GROQ_MODEL_NAME,
    LLM_MAX_TOKENS,
    LLM_JSON_RETRY_ATTEMPTS,
    LLM_TEMPERATURE,
    MAX_QNA_QUESTIONS,
    MIN_CLASSIFICATION_CONFIDENCE,
    HOSPITAL_RADIUS_KM,
)
from schemas import (
    ClassificationAPIRequest,
    CONSERVATIVE_DEFAULTS,
    FacilityCategory,
    GraphState,
)
from system_prompt import (
    INPUT_CLASSIFIER_PROMPT,
    QNA_ANSWER_PROCESSOR_PROMPT,
    QNA_QUESTION_GENERATOR_PROMPT,
    get_output_prompt,
)

logger = logging.getLogger(__name__)

# Language code to language name mapping
LANGUAGE_NAMES = {
    "en": "English",
    "hi": "Hindi",
    "gu": "Gujarati",
    "mr": "Marathi",
    "ta": "Tamil",
}

# Required triage fields in priority order (also the QnA question priority)
REQUIRED_TRIAGE_FIELDS = [
    "duration",
    "symptom_severity",
    "symptom_count",
    "patient_age_risk",
    "comorbidity_flag",
]

# Body-related keywords — if LLM confidence is low AND one of these is present,
# force input_type to "user_symptom" for safety
BODY_RELATED_WORDS = [
    "pain", "ache", "hurt", "sore", "fever", "nausea", "vomit",
    "dizzy", "tired", "fatigue", "sick", "bleed", "rash", "swollen",
    "swelling", "weak", "headache", "cough", "breathe", "chest",
    "stomach", "back", "throat", "eye", "ear", "feel", "symptom",
]


# ===========================================================================
# LLM Client (singleton — created once at module load)
# ===========================================================================

_llm = ChatGroq(
    api_key=GROQ_API_KEY,
    model=GROQ_MODEL_NAME,
    temperature=LLM_TEMPERATURE,
    max_tokens=LLM_MAX_TOKENS,
)

logger.info(
    "LLM client initialised: model=%s temperature=%s max_tokens=%s",
    GROQ_MODEL_NAME, LLM_TEMPERATURE, LLM_MAX_TOKENS,
)


# ===========================================================================
# Logging Helpers
# ===========================================================================

_SEP = "-" * 60

def _log_enter(node: str, **kwargs) -> None:
    """Logs node entry with key state values."""
    kv = "  ".join(f"{k}={v!r}" for k, v in kwargs.items())
    logger.info("%s", _SEP)
    logger.info("►► ENTER [%s]  %s", node.upper(), kv)


def _log_exit(node: str, **kwargs) -> None:
    """Logs node exit with what was written to state."""
    kv = "  ".join(f"{k}={v!r}" for k, v in kwargs.items())
    logger.info("◄◄ EXIT  [%s]  %s", node.upper(), kv)
    logger.info("%s", _SEP)


def _log_decision(label: str, **kwargs) -> None:
    """Logs a routing or branching decision."""
    kv = "  ".join(f"{k}={v!r}" for k, v in kwargs.items())
    logger.info("   └─ DECISION [%s]  %s", label, kv)


# ===========================================================================
# LLM Utility
# ===========================================================================

def _extract_json_from_text(text: str) -> str:
    """
    Extracts a JSON object from LLM output that may contain markdown
    code fences, preamble, or other non-JSON text.

    Args:
        text: Raw LLM response string.

    Returns:
        A string that should be valid JSON.

    Raises:
        ValueError: If no JSON object can be found in the text.
    """
    # Strip markdown code blocks: ```json ... ``` or ``` ... ```
    cleaned = re.sub(r"```(?:json)?\s*", "", text).strip()
    cleaned = re.sub(r"```\s*$", "", cleaned).strip()

    # If it already starts with { try directly
    stripped = cleaned.strip()
    if stripped.startswith("{"):
        return stripped

    # Find the first { and last } to extract the JSON object
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start : end + 1]

    raise ValueError(f"No JSON object found in LLM response: {text[:200]!r}")


async def _call_llm_with_retry(
    system_prompt: str,
    user_content: str,
    max_retries: int = LLM_JSON_RETRY_ATTEMPTS,
) -> dict:
    """
    Calls the Groq LLM and parses the response as JSON.
    Retries up to max_retries times on JSON parse failure.

    Args:
        system_prompt: The system prompt string for this call.
        user_content:  The user message to send.
        max_retries:   Maximum number of attempts (default from config).

    Returns:
        Parsed JSON response as a dict.

    Raises:
        RuntimeError: If all retries are exhausted without a valid JSON response.
    """
    current_user_content = user_content
    prompt_name = system_prompt[:40].replace("\n", " ").strip()

    for attempt in range(1, max_retries + 1):
        logger.info("   │ LLM call attempt %d/%d  prompt='%s...'", attempt, max_retries, prompt_name)
        try:
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=current_user_content),
            ]
            response = await _llm.ainvoke(messages)
            raw_text = response.content

            json_str = _extract_json_from_text(raw_text)
            result = json.loads(json_str)
            logger.info("   │ LLM call ✓ (attempt %d) keys=%s", attempt, list(result.keys()))
            return result

        except json.JSONDecodeError as exc:
            logger.warning(
                "   │ LLM invalid JSON on attempt %d/%d: %s",
                attempt, max_retries, exc,
            )
            if attempt < max_retries:
                current_user_content = (
                    f"{user_content}\n\n"
                    f"[CORRECTION REQUIRED] Your previous response was not valid JSON. "
                    f"Error: {exc}. "
                    f"Respond ONLY with a valid JSON object. No preamble, no markdown, no explanation."
                )
        except Exception as exc:
            logger.error("   │ LLM unexpected error on attempt %d: %s", attempt, exc)
            if attempt >= max_retries:
                raise RuntimeError(f"LLM call failed after {max_retries} attempts: {exc}") from exc

    raise RuntimeError(f"LLM failed to return valid JSON after {max_retries} attempts")


# ===========================================================================
# Keyword Pre-filter
# ===========================================================================

def check_critical_keywords(message: str) -> list[str]:
    """
    Checks the user message for critical emergency keywords.
    This runs BEFORE any LLM call and its result OVERRIDES LLM routing.

    Args:
        message: Raw user message (case-insensitive check).

    Returns:
        List of matched critical keyword strings. Empty list if none found.
    """
    message_lower = message.lower()
    return [kw for kw in CRITICAL_KEYWORDS if kw in message_lower]


# ===========================================================================
# Triage field helpers
# ===========================================================================

def _get_missing_fields(state: GraphState) -> list[str]:
    """Returns list of required triage fields that are still None in state."""
    return [
        field for field in REQUIRED_TRIAGE_FIELDS
        if state.get(field) is None
    ]


def _merge_triage_fields(state: GraphState, new_fields: dict) -> dict:
    """
    Merges newly extracted triage fields into state using non-None-wins rule.
    Existing non-None values are NEVER overwritten.

    Args:
        state:      Current GraphState.
        new_fields: Dict of {field_name: value} from LLM extraction.

    Returns:
        Dict of only the fields that should be updated in state (non-None new values
        that don't conflict with existing non-None state values).
    """
    updates: dict[str, Any] = {}
    triage_keys = set(REQUIRED_TRIAGE_FIELDS) | {"user_lat", "user_lng", "extracted_symptoms"}

    for field, new_val in new_fields.items():
        if field not in triage_keys:
            continue
        if new_val is None:
            continue  # Never write None
        existing = state.get(field)
        if existing is None:
            updates[field] = new_val  # Fill in missing field
        # If existing is not None, keep it — non-None-wins
    return updates


def _format_history_for_prompt(history: list[dict], max_turns: int = 3) -> str:
    """Formats the last N conversation turns for injection into LLM prompts."""
    recent = history[-max_turns:] if len(history) > max_turns else history
    if not recent:
        return "No prior conversation."
    return "\n".join(f"{t['role'].upper()}: {t['content']}" for t in recent)


# ===========================================================================
# NODE 1: input_node
# ===========================================================================

async def input_node(state: GraphState) -> dict:
    """
    Gateway node. Classifies user intent, extracts triage fields, and determines routing.

    Safety rule:
      - Keyword pre-filter runs FIRST. If any CRITICAL_KEYWORDS match, routing is forced
        to emergency_node regardless of LLM output.
      - If LLM confidence < MIN_CLASSIFICATION_CONFIDENCE and body words present,
        forces classification to user_symptom.

    Args:
        state: GraphState with user_message set.

    Returns:
        Partial GraphState with input classification results and route_to set.
    """
    message = state.get("user_message", "").strip()

    _log_enter(
        "input_node",
        msg_len=len(message),
        session=state.get("session_id", "?"),
        input_type_hint=state.get("input_type", "(none)"),
        pending_q=state.get("pending_question"),
    )

    # ── Guard: empty message ──────────────────────────────────────────────
    if not message:
        logger.warning("input_node: empty message received")
        _log_exit("input_node", route="output_node", reason="empty message")
        return {
            "input_type": "error",
            "extracted_symptoms": [],
            "urgency_signals": [],
            "classification_confidence": 0.0,
            "output_mode": "error",
            "route_to": "output_node",
            "error_message": "Message cannot be empty. Please describe your symptoms or question.",
        }

    # ── Step 1: Keyword pre-filter (runs BEFORE LLM) ──────────────────────
    logger.info("   ├─ [1/6] Keyword pre-filter ...")
    matched_keywords = check_critical_keywords(message)
    keyword_emergency = len(matched_keywords) > 0
    if keyword_emergency:
        logger.warning("   ├─ ⚠️  CRITICAL KEYWORDS matched: %s", matched_keywords)
    else:
        logger.info("   ├─ No critical keywords found")

    # ── Step 2: LLM classification ─────────────────────────────────────────
    logger.info("   ├─ [2/6] LLM classification ...")
    conversation_history = state.get("conversation_history", [])
    pending_question = state.get("pending_question")

    user_content = (
        f"Classify this message:\n\n\"{message}\"\n\n"
        f"Recent conversation:\n{_format_history_for_prompt(conversation_history)}\n"
        f"Pending bot question: \"{pending_question or 'None'}\""
    )

    try:
        llm_result = await _call_llm_with_retry(INPUT_CLASSIFIER_PROMPT, user_content)
    except RuntimeError as exc:
        logger.error("   ├─ ❌ LLM failed: %s. Defaulting to user_symptom.", exc)
        llm_result = {
            "input_type": "user_symptom",
            "extracted_symptoms": [],
            "extracted_answer_fields": {},
            "urgency_signals": matched_keywords,
            "confidence": 0.0,
        }

    # ── Step 3: Extract LLM output ────────────────────────────────────────
    raw_input_type     = llm_result.get("input_type", "user_symptom")
    extracted_symptoms = llm_result.get("extracted_symptoms", [])
    answer_fields      = llm_result.get("extracted_answer_fields", {}) or {}
    llm_urgency_signals = llm_result.get("urgency_signals", [])
    confidence         = float(llm_result.get("confidence", 0.0))
    all_urgency_signals = list(set(matched_keywords + llm_urgency_signals))
    logger.info(
        "   ├─ [3/6] LLM result: type=%r  confidence=%.2f  symptoms=%s  urgency=%s",
        raw_input_type, confidence, extracted_symptoms, llm_urgency_signals,
    )

    # ── Step 4: Confidence safety override ────────────────────────────────
    logger.info("   ├─ [4/6] Confidence check: %.2f (min=%.2f)", confidence, MIN_CLASSIFICATION_CONFIDENCE)
    if confidence < MIN_CLASSIFICATION_CONFIDENCE:
        message_lower = message.lower()
        if any(bw in message_lower for bw in BODY_RELATED_WORDS):
            logger.warning(
                "   ├─ ⚠️  Low confidence (%.2f) + body words → forcing user_symptom", confidence
            )
            raw_input_type = "user_symptom"

    # ── Step 5: Safety routing decision ───────────────────────────────────
    logger.info("   ├─ [5/6] Routing (raw_type=%r, kw_emergency=%s) ...", raw_input_type, keyword_emergency)
    if keyword_emergency:
        determined_route = "emergency_node"
        determined_input_type = raw_input_type
        logger.warning("   ├─ ⚠️  keyword override → emergency_node")
    elif raw_input_type == "user_symptom" and all_urgency_signals:
        determined_route = "emergency_node"
        determined_input_type = "user_symptom"
        logger.info("   ├─ LLM urgency signals → emergency_node")
    elif raw_input_type in ("user_symptom", "user_answer") and pending_question:
        # If the bot had asked a question, ANY substantive reply is an answer to it —
        # even if the reply describes new symptoms. This prevents the repeat-question loop.
        determined_route = "qna_node"
        determined_input_type = "user_answer"
        logger.info("   ├─ pending_question present → treating as user_answer → qna_node")
    elif raw_input_type == "user_query" and pending_question:
        # Even if classified as a general query, if there's a pending question the user
        # is most likely trying to answer it (especially for short/ambiguous messages).
        determined_route = "qna_node"
        determined_input_type = "user_answer"
        logger.info("   ├─ pending_question present + user_query → treating as user_answer → qna_node")
    elif raw_input_type == "user_symptom":
        determined_route = "qna_node"
        determined_input_type = "user_symptom"
        logger.info("   ├─ user_symptom (no urgency) → qna_node")
    elif raw_input_type == "user_answer":
        determined_route = "qna_node"
        determined_input_type = "user_answer"
        logger.info("   ├─ user_answer → qna_node")
    elif raw_input_type == "user_query":
        determined_route = "output_node"
        determined_input_type = "user_query"
        logger.info("   ├─ user_query → output_node (answer mode)")
    else:
        logger.warning("   ├─ unknown input_type %r → qna_node (safe default)", raw_input_type)
        determined_route = "qna_node"
        determined_input_type = "user_symptom"

    # ── Step 6: Merge extracted triage fields ─────────────────────────────
    logger.info("   ├─ [6/6] Merging triage fields from LLM answer_fields ...")
    triage_updates = _merge_triage_fields(state, answer_fields)
    if triage_updates:
        logger.info("   ├─ Triage fields updated: %s", triage_updates)

    output_mode = "answer" if determined_input_type == "user_query" else ""

    _log_exit(
        "input_node",
        type=determined_input_type,
        route=determined_route,
        symptoms=extracted_symptoms,
        confidence=round(confidence, 2),
    )

    return {
        "input_type": determined_input_type,
        "extracted_symptoms": extracted_symptoms,
        "urgency_signals": all_urgency_signals,
        "classification_confidence": confidence,
        "route_to": determined_route,
        "output_mode": output_mode,
        **triage_updates,
    }


# ===========================================================================
# NODE 2: emergency_node
# ===========================================================================

async def emergency_node(state: GraphState) -> dict:
    """
    Fast-path check for life-threatening situations via external emergency API.

    API contract (simplified):
      Input:  text — raw user message
      Output: is_emergency — bool only

    Safety rule:
      - If API fails AND urgency_signals are present → is_emergency=True (conservative)
      - If API fails AND no urgency_signals → is_emergency=False (fallback to QnA)

    Args:
        state: GraphState with user_message and urgency_signals.

    Returns:
        Partial GraphState with emergency determination and route_to set.
    """
    user_message    = state.get("user_message", "")
    urgency_signals = state.get("urgency_signals", [])

    _log_enter(
        "emergency_node",
        msg_len=len(user_message),
        urgency_signals=urgency_signals,
    )
    logger.info("   ├─ Calling Emergency API ...")

    api_result = await call_emergency_api(text=user_message)

    # ── Conservative fallback logic ───────────────────────────────────────
    if api_result is None:
        api_failed = True
        if urgency_signals:
            # Keyword or LLM flagged urgency — treat as emergency (conservative)
            logger.warning(
                "emergency_node: API failed + urgency_signals present → is_emergency=True (conservative)"
            )
            is_emergency = True
        else:
            logger.warning("emergency_node: API failed, no urgency signals → is_emergency=False")
            is_emergency = False
    else:
        api_failed   = False
        is_emergency = api_result.is_emergency
        logger.info("emergency_node: API result is_emergency=%s", is_emergency)

    # ── Safety override: CRITICAL_KEYWORDS always win ─────────────────────
    # If the routing into this node was keyword-triggered (urgency_signals present),
    # never let the External API's False result send the user to QnA triage.
    if urgency_signals and not is_emergency:
        logger.warning(
            "emergency_node: API returned is_emergency=False but urgency_signals %s present "
            "→ overriding to True (CRITICAL_KEYWORD safety rule)",
            urgency_signals,
        )
        is_emergency = True

    # ── Routing ───────────────────────────────────────────────────────────
    if is_emergency:
        route_to      = "hospital_finding_node"
        urgency_label = "Emergency"
    else:
        route_to      = "qna_node"
        urgency_label = None

    return {
        "is_emergency":         is_emergency,
        "emergency_confidence": None,
        "emergency_reason":     None,
        "emergency_api_failed": api_failed,
        "urgency_label":        urgency_label,
        "route_to":             route_to,
    }



# ===========================================================================
# NODE 3: qna_node
# ===========================================================================

async def qna_node(state: GraphState) -> dict:
    """
    Intelligent medical interviewer. Processes answers and generates targeted questions.

    Behaviour:
      - If input_type == "user_answer": extract field values from answer, merge into state.
      - Check which required triage fields are still missing.
      - If qna_questions_asked >= MAX_QNA_QUESTIONS: apply CONSERVATIVE_DEFAULTS, proceed to classification.
      - If all fields complete: proceed to classification.
      - If fields missing: generate the next targeted question.

    Args:
        state: GraphState with current triage field state.

    Returns:
        Partial GraphState with updated triage fields, QnA state, and route_to.
    """
    input_type       = state.get("input_type", "")
    questions_asked  = state.get("qna_questions_asked", 0)
    asked_questions  = list(state.get("asked_questions", []))
    user_message     = state.get("user_message", "")
    pending_question = state.get("pending_question", "")

    _log_enter(
        "qna_node",
        input_type=input_type,
        questions_asked=questions_asked,
        missing=_get_missing_fields(state),
        pending_q=pending_question or None,
    )

    updates: dict[str, Any] = {}

    # ── Step 1: Process user answer (if applicable) ───────────────────────
    extracted_something = False
    if input_type == "user_answer" and pending_question and user_message:
        logger.info("   ├─ [1] Processing user answer to: %r", pending_question[:60])
        missing_fields_context = _get_missing_fields(state)

        triage_summary = (
            f"severity={state.get('symptom_severity')}, "
            f"count={state.get('symptom_count')}, "
            f"duration={state.get('duration')}, "
            f"age_risk={state.get('patient_age_risk')}, "
            f"comorbidity={state.get('comorbidity_flag')}"
        )

        user_content = (
            f"The patient was asked: \"{pending_question}\"\n"
            f"They replied: \"{user_message}\"\n\n"
            f"Currently missing fields: {missing_fields_context}\n"
            f"Already known: {triage_summary}"
        )

        try:
            answer_result = await _call_llm_with_retry(QNA_ANSWER_PROCESSOR_PROMPT, user_content)
            extracted_fields = answer_result.get("extracted_fields", {}) or {}
            triage_updates = _merge_triage_fields(state, extracted_fields)
            updates.update(triage_updates)
            extracted_something = bool(triage_updates)
            logger.info("   ├─ Extracted from answer: %s", triage_updates or "(nothing new)")
        except RuntimeError as exc:
            logger.error("   ├─ ❌ QnA answer processor failed: %s", exc)

    # When user_symptom arrives while a question is pending, also run answer processor
    # to extract triage fields from the symptom description (e.g. "rigorous cough and cold")
    elif input_type == "user_symptom" and pending_question and user_message:
        logger.info("   ├─ [1] Processing symptom reply as answer to: %r", pending_question[:60])
        missing_fields_context = _get_missing_fields(state)
        triage_summary = (
            f"severity={state.get('symptom_severity')}, "
            f"count={state.get('symptom_count')}, "
            f"duration={state.get('duration')}, "
            f"age_risk={state.get('patient_age_risk')}, "
            f"comorbidity={state.get('comorbidity_flag')}"
        )
        user_content = (
            f"The patient was asked: \"{pending_question}\"\n"
            f"They replied: \"{user_message}\"\n\n"
            f"Currently missing fields: {missing_fields_context}\n"
            f"Already known: {triage_summary}"
        )
        try:
            answer_result = await _call_llm_with_retry(QNA_ANSWER_PROCESSOR_PROMPT, user_content)
            extracted_fields = answer_result.get("extracted_fields", {}) or {}
            triage_updates = _merge_triage_fields(state, extracted_fields)
            updates.update(triage_updates)
            extracted_something = bool(triage_updates)
            logger.info("   ├─ Extracted from symptom reply: %s", triage_updates or "(nothing new)")
        except RuntimeError as exc:
            logger.error("   ├─ ❌ QnA answer processor (symptom path) failed: %s", exc)
    else:
        # First symptom message — extracted_answer_fields already merged via input_node
        pass

    # ── Step 1b: If answer processor extracted nothing and we had a pending
    # question, apply the conservative default for the top missing field so
    # we never loop on the same question forever. ──────────────────────────
    if pending_question and not extracted_something:
        current_missing = _get_missing_fields({**state, **updates})
        if current_missing:
            skip_field = current_missing[0]
            default_val = CONSERVATIVE_DEFAULTS.get(skip_field)
            if default_val is not None and state.get(skip_field) is None:
                updates[skip_field] = default_val
                logger.warning(
                    "   ├─ ⚠️  No new fields extracted — applying default for '%s': %s",
                    skip_field, default_val,
                )

    # ── Step 2: Build updated state snapshot for field-check ─────────────
    # Merge updates into a temporary view for checking missing fields
    merged_state: dict = {**state, **updates}
    missing_fields = _get_missing_fields(merged_state)
    logger.info("   ├─ [2] Missing triage fields: %s", missing_fields or "NONE (all complete)")

    if not missing_fields:
        logger.info("   ├─ All fields complete → classification_node")
        _log_exit("qna_node", route="classification_node", reason="all fields complete")
        return {
            **updates,
            "missing_fields": [],
            "route_to": "classification_node",
        }

    if questions_asked >= MAX_QNA_QUESTIONS:
        logger.warning(
            "   ├─ ⚠️  MAX questions (%d) reached — applying CONSERVATIVE_DEFAULTS for: %s",
            MAX_QNA_QUESTIONS, missing_fields,
        )
        defaults_applied = {
            field: CONSERVATIVE_DEFAULTS[field]
            for field in missing_fields
            if field in CONSERVATIVE_DEFAULTS and merged_state.get(field) is None
        }
        logger.info("   ├─ Defaults applied: %s", defaults_applied)
        _log_exit("qna_node", route="classification_node", reason="max questions reached")
        return {
            **updates,
            **defaults_applied,
            "missing_fields": [],
            "route_to": "classification_node",
        }

    # ── Step 5: Generate the next targeted question ───────────────────────
    symptoms_str = ", ".join(state.get("extracted_symptoms", [])) or "described symptoms"
    asked_str = "; ".join(asked_questions) if asked_questions else "None yet"

    user_content = (
        f"Patient symptoms: {symptoms_str}\n"
        f"Missing triage fields (in priority order): {missing_fields}\n"
        f"Already asked questions: {asked_str}\n"
        f"Generate the next triage question for the highest priority missing field."
    )

    try:
        question_result = await _call_llm_with_retry(QNA_QUESTION_GENERATOR_PROMPT, user_content)
        question_text = question_result.get("question", "")
        target_field  = question_result.get("target_field", missing_fields[0])
    except RuntimeError as exc:
        logger.error("qna_node question generator LLM failed: %s. Using fallback question.", exc)
        question_text = _fallback_question(missing_fields[0])
        target_field  = missing_fields[0]

    if not question_text:
        question_text = _fallback_question(missing_fields[0])

    asked_questions.append(question_text)

    logger.info(
        "qna_node: asking about '%s' (question %d/%d)",
        target_field, questions_asked + 1, MAX_QNA_QUESTIONS,
    )

    return {
        **updates,
        "missing_fields":       missing_fields,
        "pending_question":     question_text,
        "asked_questions":      asked_questions,
        "qna_questions_asked":  questions_asked + 1,
        "output_mode":          "query",
        "route_to":             "output_node",
    }


def _fallback_question(field: str) -> str:
    """Hard-coded fallback questions when the LLM question generator fails."""
    fallback_map = {
        "duration":          "How long have you been experiencing these symptoms? For example, a few hours, a couple of days, or longer?",
        "symptom_severity":  "On a scale of 1 to 10, how would you rate the severity of your symptoms right now?",
        "symptom_count":     "Are you experiencing any other symptoms besides what you've mentioned, even mild ones?",
        "patient_age_risk":  "Could you share your approximate age group — are you in your 20s–30s, 40s–50s, or 60s and above?",
        "comorbidity_flag":  "Do you have any pre-existing medical conditions such as diabetes, heart disease, or asthma?",
    }
    return fallback_map.get(field, f"Could you tell me more about your {field.replace('_', ' ')}?")


# ===========================================================================
# SMART FACILITY CATEGORY SELECTOR
# ===========================================================================

# Keyword → FacilityCategory mapping (checked in priority order).
# Longer / more-specific patterns are listed first to avoid false-matches.
_FACILITY_KEYWORD_MAP: list[tuple[list[str], FacilityCategory]] = [
    # ── Must stay first: emergency / general urgent care ──────────────────
    (["chest pain", "heart attack", "cardiac arrest", "severe bleeding",
      "loss of consciousness", "unconscious", "unresponsive", "seizure",
      "stroke", "overdose", "anaphylaxis", "choking", "can't breathe",
      "cannot breathe", "shortness of breath", "suicidal"],
     FacilityCategory.HOSPITALS),

    # ── Specialist keywords ────────────────────────────────────────────────
    (["heart", "cardiac", "cardiolog", "palpitation", "arrhythmia",
      "chest tightness", "angina", "cholesterol"],
     FacilityCategory.CARDIOLOGISTS),

    (["skin", "rash", "acne", "eczema", "psoriasis", "dermatit",
      "hives", "itching", "itchy skin", "fungal infection"],
     FacilityCategory.DERMATOLOGISTS),

    (["eye", "vision", "blurry", "ophthalm", "conjunctivit",
      "cataracts", "glaucoma", "red eye"],
     FacilityCategory.OPHTHALMOLOGISTS),

    (["ear", "nose", "throat", "ent ", "sinus", "tonsil", "hearing",
      "runny nose", "nasal", "snoring", "ear pain", "tinnitus"],
     FacilityCategory.ENT),

    (["brain", "neurolog", "nerve", "migraine", "epilepsy",
      "tremor", "parkinson", "numbness", "tingling", "vertigo",
      "memory loss", "alzheimer", "multiple sclerosis"],
     FacilityCategory.NEUROLOGISTS),

    (["bone", "joint", "orthopaed", "fracture", "sprain",
      "knee pain", "shoulder pain", "back pain", "osteoporosis",
      "arthritis", "muscle pain", "ligament"],
     FacilityCategory.ORTHOPAEDICS),

    (["child", "baby", "infant", "paediatr", "pediatr",
      "toddler", "kid", "my son", "my daughter"],
     FacilityCategory.PAEDIATRICIANS),

    (["gynaecol", "gynecol", "pregnant", "pregnancy", "period",
      "menstrual", "uterus", "ovarian", "vaginal", "cervical",
      "pcos", "pap smear", "breast lump"],
     FacilityCategory.GYNAECOLOGISTS),

    (["teeth", "tooth", "gum", "dental", "dentist", "jaw pain",
      "toothache", "cavity", "wisdom tooth", "oral"],
     FacilityCategory.DENTISTS),

    (["physiother", "rehabilitat", "physio", "mobility",
      "post-surgery", "post surgery", "recovery exercise"],
     FacilityCategory.PHYSIOTHERAPISTS),

    (["blood test", "lab test", "diagnostic", "urine test",
      "x-ray", "xray", "mri", "ct scan", "ultrasound", "ecg", "eeg"],
     FacilityCategory.DIAGNOSTIC_LAB),

    (["medicine", "prescription", "medication", "pharmacy",
      "drug", "tablet", "capsule", "syrup", "refill"],
     FacilityCategory.PHARMACIES),
]


def determine_facility_category(
    symptoms: list[str],
    urgency_signals: list[str],
    urgency_label: Optional[str],
    user_message: str,
) -> FacilityCategory:
    """
    Intelligently selects the most appropriate FacilityCategory from context.

    Selection logic (in priority order):
    1. Emergency-level urgency → always HOSPITALS (liveliest ER support)
    2. Match extracted symptoms + urgency_signals + user_message against
       the _FACILITY_KEYWORD_MAP (first match wins, listed priority-first).
    3. Default to CLINICS for non-emergency Visit clinic, HOSPITALS for Emergency.

    Args:
        symptoms:       List of extracted symptoms from the message.
        urgency_signals: Critical signals from keyword filter / LLM.
        urgency_label:  "Self-care" | "Visit clinic" | "Emergency" | None.
        user_message:   Raw user message (lowercased for matching).

    Returns:
        The best-matched FacilityCategory enum value.
    """
    # Emergency always routes to full Hospital (ER)
    if urgency_label == "Emergency":
        return FacilityCategory.HOSPITALS

    # Build a single combined lowercase text to match against
    search_text = " ".join(
        [user_message.lower()]
        + [s.lower() for s in symptoms]
        + [s.lower() for s in urgency_signals]
    )

    # Walk keyword map in priority order — first match wins
    for keywords, category in _FACILITY_KEYWORD_MAP:
        if any(kw in search_text for kw in keywords):
            logger.debug("determine_facility_category: matched '%s'", category.value)
            return category

    # Default: clinic for non-emergency
    return FacilityCategory.CLINICS


# ===========================================================================
# NODE 4: classification_node
# ===========================================================================

async def classification_node(state: GraphState) -> dict:
    """
    Final medical urgency classification using external ML API with rule-based fallback.

    Args:
        state: GraphState with all 5 required triage fields populated.

    Returns:
        Partial GraphState with urgency_score, urgency_label, and route_to.
    """
    symptom_severity  = state.get("symptom_severity") or CONSERVATIVE_DEFAULTS["symptom_severity"]
    symptom_count     = state.get("symptom_count")    or CONSERVATIVE_DEFAULTS["symptom_count"]
    duration          = state.get("duration")          or CONSERVATIVE_DEFAULTS["duration"]
    patient_age_risk  = state.get("patient_age_risk")  or CONSERVATIVE_DEFAULTS["patient_age_risk"]
    comorbidity_flag  = state.get("comorbidity_flag")
    if comorbidity_flag is None:
        comorbidity_flag = CONSERVATIVE_DEFAULTS["comorbidity_flag"]

    _log_enter(
        "classification_node",
        severity=symptom_severity,
        count=symptom_count,
        duration=duration,
        age_risk=patient_age_risk,
        comorbidity=comorbidity_flag,
    )
    logger.info("   ├─ Calling Classification API ...") 

    request = ClassificationAPIRequest(
        symptom_severity=symptom_severity,
        symptom_count=symptom_count,
        duration=duration,
        patient_age_risk=patient_age_risk,
        comorbidity_flag=comorbidity_flag,
    )

    result, api_failed = await call_classification_api(request)

    urgency_score = result.urgency_score
    urgency_label = result.label

    logger.info(
        "classification_node: score=%.3f → %s (fallback=%s)",
        urgency_score, urgency_label, api_failed,
    )

    # ── Routing ───────────────────────────────────────────────────────────
    if urgency_label == "Self-care":
        route_to   = "output_node"
        output_mode = "suggestions"
    else:
        # "Visit clinic" or "Emergency" — need hospital lookup first
        route_to   = "hospital_finding_node"
        output_mode = ""

    return {
        "urgency_score":           urgency_score,
        "urgency_label":           urgency_label,
        "classification_api_failed": api_failed,
        "output_mode":             output_mode,
        "route_to":                route_to,
    }


# ===========================================================================
# NODE 5: hospital_finding_node
# ===========================================================================

async def hospital_finding_node(state: GraphState) -> dict:
    """
    Finds nearest medical facility using lat/lng coordinates.

    Coordinate resolution:
      - Uses state.user_lat + state.user_lng set directly from the API request.
      - If missing, skips the API call and logs a warning.

    Category selection:
      - Emergency urgency → HOSPITALS (ER support needed)
      - Specialist keywords in symptoms → matched specialist
      - General clinic → CLINICS / HEALTH CENTRES

    Args:
        state: GraphState with urgency_label, user_lat/lng, extracted_symptoms.

    Returns:
        Partial GraphState with facility_category, hospital_data, route_to=output_node.
    """
    urgency_label = state.get("urgency_label", "Emergency")
    symptoms      = state.get("extracted_symptoms", [])
    urgency_sigs  = state.get("urgency_signals", [])
    user_message  = state.get("user_message", "")

    lat: Optional[float] = state.get("user_lat")
    lng: Optional[float] = state.get("user_lng")

    _log_enter(
        "hospital_finding_node",
        urgency=urgency_label,
        lat=lat,
        lng=lng,
        symptoms_count=len(symptoms),
    )

    if lat is None or lng is None:
        logger.warning("   ├─ ⚠️  No lat/lng in state — skipping hospital API call")
        hospital_data = None
        api_failed    = True
    else:
        facility_category = determine_facility_category(
            symptoms=symptoms,
            urgency_signals=urgency_sigs,
            urgency_label=urgency_label,
            user_message=user_message,
        )
        logger.info(
            "   ├─ Facility category selected: %r",
            facility_category.value,
        )
        logger.info("   ├─ Calling Hospital API (radius=%s km) ...", HOSPITAL_RADIUS_KM)

        hospital_api_result = await call_hospital_api(
            lat=lat,
            lng=lng,
            urgency=urgency_label,
            facility_category=facility_category.value,
            radius_km=HOSPITAL_RADIUS_KM,
        )

        if hospital_api_result is not None:
            hospital_data = [h.model_dump() for h in hospital_api_result.hospitals]
            api_failed    = False
            logger.info("   ├─ Found %d facilities", len(hospital_data))
        else:
            hospital_data = None
            api_failed    = True
            logger.warning("   ├─ ❌ Hospital API failed — no results")

        state_category = facility_category.value

    output_mode = "emergency" if urgency_label == "Emergency" else "clinic"
    _log_exit("hospital_finding_node", mode=output_mode, api_failed=api_failed, results=len(hospital_data or []))

    return {
        "facility_category": locals().get("state_category"),
        "hospital_data":      hospital_data,
        "hospital_api_failed": api_failed,
        "output_mode":        output_mode,
        "route_to":           "output_node",
    }





# ===========================================================================
# SUMMARY BUILDERS
# ===========================================================================

_URGENCY_RANK = {"Self-care": 1, "Visit clinic": 2, "Emergency": 3}


def _build_session_summary(state: GraphState) -> dict:
    """
    Builds a structured summary of the current triage session from GraphState.
    Returned in every output_node final_response.
    """
    return {
        "symptoms":        state.get("extracted_symptoms") or [],
        "severity":        state.get("symptom_severity"),
        "duration":        state.get("duration"),
        "urgency":         state.get("urgency_label"),
        "is_emergency":    bool(state.get("is_emergency")),
        "questions_asked": state.get("qna_questions_asked", 0),
        "comorbidities":   state.get("comorbidity_flag"),
        "age_risk":        state.get("patient_age_risk"),
        "urgency_score":   state.get("urgency_score"),
    }


def _build_total_summary(state: GraphState) -> dict:
    """
    Builds an all-time summary from the full conversation_history in state.
    Covers every symptom mentioned and the highest urgency seen this session.
    """
    history = state.get("conversation_history") or []
    total_turns = len(history) // 2  # Each turn = 1 user + 1 assistant message

    # Collect all unique symptoms mentioned across all turns
    all_symptoms = list(state.get("extracted_symptoms") or [])

    # Determine highest urgency seen in session
    current_urgency = state.get("urgency_label")
    highest_urgency = current_urgency  # For now single-session; extend if multi-session added

    # Count how many triage sessions completed (session_complete turns)
    triage_completions = sum(
        1 for msg in history
        if msg.get("role") == "assistant" and msg.get("session_complete") is True
    )

    return {
        "total_turns":               total_turns,
        "triage_sessions_completed": triage_completions,
        "all_symptoms_mentioned":    all_symptoms,
        "highest_urgency_seen":      highest_urgency,
        "questions_asked_total":     state.get("qna_questions_asked", 0),
    }


# ===========================================================================
# NODE 6: output_node
# ===========================================================================

async def output_node(state: GraphState) -> dict:
    """
    The ONLY node that produces user-visible output.
    Uses an LLM to generate empathetic, medically appropriate responses.

    Modes:
      - "query":       Warm follow-up question for the patient
      - "answer":      Answer to a general health query
      - "suggestions": Self-care instructions (urgency=Self-care)
      - "clinic":      Clinic visit guidance (urgency=Visit clinic)
      - "emergency":   Emergency alert with immediate actions

    Args:
        state: GraphState with output_mode, all relevant triage/urgency/hospital data.

    Returns:
        Partial GraphState with final_response dict and updated conversation_history.
    """
    output_mode = state.get("output_mode", "")

    # ── Handle error mode (empty message, etc.) ───────────────────────────
    if output_mode == "error":
        error_msg = state.get("error_message", "An unexpected error occurred.")
        final_response = {
            "output_type":     "error",
            "urgency_label":   None,
            "message":         error_msg,
            "action_items":    [],
            "hospital_info":   None,
            "disclaimer":      None,
            "session_complete": False,
        }
        return {"final_response": final_response, "output_mode": "error"}

    # ── Query mode: skip LLM — relay the pending question directly ────────
    # The question was already generated by QNA_QUESTION_GENERATOR.
    # Running it through another LLM adds latency, preamble, and failure risk.
    if output_mode == "query":
        pending_q = state.get("pending_question", "")
        user_message = state.get("user_message", "")
        user_language = state.get("user_language", "en")
        if not pending_q:
            pending_q = "Could you describe your symptoms in more detail?"

        # Translate the question to user's language if not English
        message_text = pending_q
        if user_language != "en":
            lang_name = LANGUAGE_NAMES.get(user_language, user_language)
            try:
                translate_prompt = (
                    f"Translate the following medical question to {lang_name}. "
                    f"Return ONLY the translated text, nothing else. No quotes, no explanation.\n\n"
                    f"{pending_q}"
                )
                messages = [
                    SystemMessage(content="You are a medical translator. Translate accurately and naturally."),
                    HumanMessage(content=translate_prompt),
                ]
                response = await _llm.ainvoke(messages)
                translated = response.content.strip().strip('"').strip("'")
                if translated:
                    message_text = translated
            except Exception as exc:
                logger.warning("output_node: translation failed for query mode: %s", exc)

        final_response = {
            "output_type":     "query",
            "urgency_label":   None,
            "message":         message_text,
            "action_items":    [],
            "hospital_info":   None,
            "disclaimer":      None,
            "session_complete": False,
        }

        conversation_history = list(state.get("conversation_history", []))
        conversation_history.append({"role": "user",      "content": user_message})
        conversation_history.append({"role": "assistant", "content": pending_q})
        if len(conversation_history) > 40:
            conversation_history = conversation_history[-40:]

        logger.info("output_node: query mode — relaying pending_question directly")
        return {
            "final_response":       final_response,
            "output_mode":          "query",
            "conversation_history": conversation_history,
        }

    # ── Select system prompt ──────────────────────────────────────────────
    try:
        system_prompt = get_output_prompt(output_mode)
    except ValueError:
        logger.error("output_node: unknown mode '%s' — defaulting to answer", output_mode)
        output_mode = "answer"
        system_prompt = get_output_prompt("answer")

    # ── Append language instruction if user's language is not English ─────
    user_language = state.get("user_language", "en")
    if user_language != "en":
        lang_name = LANGUAGE_NAMES.get(user_language, user_language)
        system_prompt += (
            f"\n\nCRITICAL LANGUAGE INSTRUCTION: The patient speaks {lang_name}. "
            f"You MUST write your ENTIRE response (message, action_items, disclaimer) in {lang_name}. "
            f"Do NOT use English. The JSON keys must remain in English, but all values/text must be in {lang_name}."
        )

    # ── Build mode-specific user content ─────────────────────────────────
    user_message  = state.get("user_message", "")
    symptoms_str  = ", ".join(state.get("extracted_symptoms", [])) or "unspecified symptoms"
    urgency_label = state.get("urgency_label")
    hospital_data = state.get("hospital_data")
    pending_q     = state.get("pending_question", "")

    hospital_section = ""
    if hospital_data:
        hospitals_formatted = []
        for i, h in enumerate(hospital_data[:3], 1):  # Show top 3
            open_status = "Open now" if h.get("open_now") else "Check hours"
            hospitals_formatted.append(
                f"{i}. {h.get('name', 'Unknown')} — {h.get('address', '')} "
                f"({h.get('distance_km', '?')} km away) | Tel: {h.get('phone', 'N/A')} | {open_status}"
            )
        hospital_section = "\n\nNearest facilities:\n" + "\n".join(hospitals_formatted)
    elif output_mode in ("clinic", "emergency"):
        hospital_section = "\n\nNote: No nearby facility data available. Instruct user to call emergency services or search for nearest hospital."

    user_content_map = {
        "query": (
            f"Pending triage question to present warmly: \"{pending_q}\"\n"
            f"Patient context: {symptoms_str}"
        ),
        "answer": (
            f"Patient's health question: \"{user_message}\"\n"
            f"Patient context: {symptoms_str}"
        ),
        "suggestions": (
            f"Patient symptoms: {symptoms_str}\n"
            f"Severity: {state.get('symptom_severity')}\n"
            f"Duration: {state.get('duration')}\n"
            f"Comorbidities: {state.get('comorbidity_flag')}\n"
            f"Urgency assessment: Self-care"
        ),
        "clinic": (
            f"Patient symptoms: {symptoms_str}\n"
            f"Severity: {state.get('symptom_severity')}\n"
            f"Duration: {state.get('duration')}\n"
            f"Age risk: {state.get('patient_age_risk')}\n"
            f"Comorbidities: {state.get('comorbidity_flag')}\n"
            f"Urgency assessment: Visit clinic"
            f"{hospital_section}"
        ),
        "emergency": (
            f"Patient symptoms: {symptoms_str}\n"
            f"Urgency signals: {', '.join(state.get('urgency_signals', []))}\n"
            f"Urgency assessment: EMERGENCY — immediate action required"
            f"{hospital_section}"
        ),
    }

    user_content = user_content_map.get(output_mode, f"Patient message: \"{user_message}\"")

    # ── Call LLM ──────────────────────────────────────────────────────────
    try:
        llm_result = await _call_llm_with_retry(system_prompt, user_content)
    except RuntimeError as exc:
        logger.error("output_node LLM failed for mode '%s': %s", output_mode, exc)
        llm_result = _fallback_output_response(output_mode, urgency_label, hospital_data)

    # ── Inject hospital_info from state if LLM omitted it ─────────────────
    if hospital_data and not llm_result.get("hospital_info"):
        llm_result["hospital_info"] = hospital_data

    # ── Ensure required fields present ────────────────────────────────────
    llm_result.setdefault("output_type", output_mode)
    llm_result.setdefault("urgency_label", urgency_label)
    llm_result.setdefault("action_items", [])
    llm_result.setdefault("disclaimer",
        "This information is for guidance only and does not constitute professional medical advice. "
        "Always consult a qualified healthcare provider for personal medical decisions."
    )
    llm_result.setdefault("session_complete", output_mode != "query")

    # ── Build session & total summaries ───────────────────────────────────
    llm_result["session_summary"] = _build_session_summary(state)
    llm_result["total_summary"]   = _build_total_summary(state)

    # ── Update conversation history ───────────────────────────────────────
    conversation_history = list(state.get("conversation_history", []))
    conversation_history.append({"role": "user",      "content": user_message})
    conversation_history.append({"role": "assistant", "content": llm_result.get("message", "")})
    # Cap at 20 turns (40 entries)
    if len(conversation_history) > 40:
        conversation_history = conversation_history[-40:]

    logger.info(
        "output_node: mode='%s' session_complete=%s symptoms=%s urgency=%s",
        output_mode, llm_result.get("session_complete"),
        llm_result["session_summary"]["symptoms"],
        llm_result["session_summary"]["urgency"],
    )

    return {
        "final_response":       llm_result,
        "output_mode":          output_mode,
        "conversation_history": conversation_history,
    }


def _fallback_output_response(
    output_mode: str,
    urgency_label: Optional[str],
    hospital_data: Optional[list],
) -> dict:
    """Hard-coded fallback response when the output LLM fails completely."""
    if output_mode == "emergency":
        return {
            "output_type":     "emergency",
            "urgency_label":   "Emergency",
            "message":         "⚠️ MEDICAL EMERGENCY DETECTED. Please call emergency services (108 / 112) IMMEDIATELY. Do not delay. If in India, call 108 for ambulance.",
            "action_items":    ["CALL 108 (ambulance) or 112 (emergency) IMMEDIATELY", "Do not drive yourself", "Stay calm and stay on the phone with emergency services"],
            "hospital_info":   hospital_data,
            "disclaimer":      "This is a medical emergency. Call emergency services now.",
            "session_complete": True,
        }
    if output_mode == "query":
        return {
            "output_type":     "query",
            "urgency_label":   None,
            "message":         "I need a little more information to help you better. Could you describe your symptoms in more detail?",
            "action_items":    [],
            "hospital_info":   None,
            "disclaimer":      None,
            "session_complete": False,
        }
    return {
        "output_type":     output_mode or "answer",
        "urgency_label":   urgency_label,
        "message":         "I'm having trouble generating a detailed response right now. Please consult a healthcare professional for proper guidance.",
        "action_items":    ["Consult a doctor or visit a clinic", "If symptoms are severe, call emergency services (108 / 112)"],
        "hospital_info":   hospital_data,
        "disclaimer":      "This is informational only. Seek professional medical advice.",
        "session_complete": True,
    }


# ===========================================================================
# CONDITIONAL EDGE ROUTING FUNCTIONS
# ===========================================================================

def route_from_input(state: GraphState) -> str:
    """Routes from input_node based on route_to field."""
    route = state.get("route_to", "output_node")
    valid = {"emergency_node", "qna_node", "output_node"}
    if route not in valid:
        logger.error("route_from_input: invalid route '%s' — defaulting to qna_node", route)
        return "qna_node"
    return route


def route_from_emergency(state: GraphState) -> str:
    """Routes from emergency_node based on route_to field."""
    route = state.get("route_to", "qna_node")
    valid = {"hospital_finding_node", "qna_node"}
    if route not in valid:
        logger.error("route_from_emergency: invalid route '%s' — defaulting to qna_node", route)
        return "qna_node"
    return route


def route_from_qna(state: GraphState) -> str:
    """Routes from qna_node based on route_to field."""
    route = state.get("route_to", "output_node")
    valid = {"classification_node", "output_node"}
    if route not in valid:
        logger.error("route_from_qna: invalid route '%s' — defaulting to output_node", route)
        return "output_node"
    return route


def route_from_classification(state: GraphState) -> str:
    """Routes from classification_node based on route_to field."""
    route = state.get("route_to", "output_node")
    valid = {"output_node", "hospital_finding_node"}
    if route not in valid:
        logger.error("route_from_classification: invalid route '%s' — defaulting to output_node", route)
        return "output_node"
    return route


# ===========================================================================
# GRAPH ASSEMBLY
# ===========================================================================

def build_graph() -> StateGraph:
    """
    Assembles and compiles the LangGraph StateGraph.

    Returns:
        A compiled LangGraph runnable. Invoke with:
          result = await chatbot_graph.ainvoke(initial_state)
    """
    graph = StateGraph(GraphState)

    # ── Register nodes ────────────────────────────────────────────────────
    graph.add_node("input_node",            input_node)
    graph.add_node("emergency_node",        emergency_node)
    graph.add_node("qna_node",              qna_node)
    graph.add_node("classification_node",   classification_node)
    graph.add_node("hospital_finding_node", hospital_finding_node)
    graph.add_node("output_node",           output_node)

    # ── Entry point ───────────────────────────────────────────────────────
    graph.set_entry_point("input_node")

    # ── Conditional edges ─────────────────────────────────────────────────
    graph.add_conditional_edges(
        "input_node",
        route_from_input,
        {
            "emergency_node": "emergency_node",
            "qna_node":       "qna_node",
            "output_node":    "output_node",
        },
    )
    graph.add_conditional_edges(
        "emergency_node",
        route_from_emergency,
        {
            "hospital_finding_node": "hospital_finding_node",
            "qna_node":              "qna_node",
        },
    )
    graph.add_conditional_edges(
        "qna_node",
        route_from_qna,
        {
            "classification_node": "classification_node",
            "output_node":         "output_node",
        },
    )
    graph.add_conditional_edges(
        "classification_node",
        route_from_classification,
        {
            "output_node":           "output_node",
            "hospital_finding_node": "hospital_finding_node",
        },
    )

    # ── Fixed edges ───────────────────────────────────────────────────────
    graph.add_edge("hospital_finding_node", "output_node")
    graph.add_edge("output_node",           END)

    return graph.compile()


# ---------------------------------------------------------------------------
# Module-level compiled graph — imported by chatbot.py
# ---------------------------------------------------------------------------

chatbot_graph = build_graph()
logger.info("LangGraph healthcare triage workflow compiled successfully")
