"""
schemas.py
----------
All Pydantic v2 models and the LangGraph GraphState TypedDict.
This is the single source of truth for all data structures in the chatbot system.

Every model includes:
  - Field validators
  - Field descriptions
  - Example values
"""

from __future__ import annotations

import uuid
from enum import Enum
from typing import Any, Optional
from typing_extensions import TypedDict

from pydantic import BaseModel, Field, field_validator, model_validator


# ===========================================================================
# FACILITY CATEGORY ENUM
# ===========================================================================

class FacilityCategory(str, Enum):
    """
    All possible healthcare facility categories for the hospital finder.
    Automatically determined from symptom/context in hospital_finding_node.
    """
    HOSPITALS         = "HOSPITALS"
    CLINICS           = "CLINICS / HEALTH CENTRES"
    PHARMACIES        = "PHARMACIES"
    DENTISTS          = "DENTISTS"
    DERMATOLOGISTS    = "DERMATOLOGISTS (Skin)"
    CARDIOLOGISTS     = "CARDIOLOGISTS (Heart)"
    GYNAECOLOGISTS    = "GYNAECOLOGISTS"
    PAEDIATRICIANS    = "PAEDIATRICIANS (Child)"
    ORTHOPAEDICS      = "ORTHOPAEDICS (Bone & Joint)"
    OPHTHALMOLOGISTS  = "OPHTHALMOLOGISTS (Eye)"
    ENT               = "ENT (Ear, Nose, Throat)"
    NEUROLOGISTS      = "NEUROLOGISTS (Brain & Nerve)"
    PHYSIOTHERAPISTS  = "PHYSIOTHERAPISTS"
    DIAGNOSTIC_LAB    = "DIAGNOSTIC / LAB"


# ===========================================================================
# LANGGRAPH STATE
# ===========================================================================

class GraphState(TypedDict, total=False):
    """
    The complete state object that flows through every node of the LangGraph workflow.

    Design rules:
    - total=False: all fields are optional — nodes write only what they own.
    - Every node reads from state using .get() with a sensible default.
    - Never assign None to a field that already holds a value (non-None-wins rule).
    - conversation_history is capped at 20 turns to prevent context overflow.

    Field ownership:
    ┌─────────────────────────────┬────────────────────────────────────────┐
    │ Field                       │ Owner (writes)                         │
    ├─────────────────────────────┼────────────────────────────────────────┤
    │ user_message, user_id,      │ API layer (before invocation)          │
    │ session_id                  │                                        │
    ├─────────────────────────────┼────────────────────────────────────────┤
    │ input_type, extracted_      │ input_node                             │
    │ symptoms, urgency_signals,  │                                        │
    │ classification_confidence   │                                        │
    ├─────────────────────────────┼────────────────────────────────────────┤
    │ symptom_severity,           │ input_node (initial extract),          │
    │ symptom_count, duration,    │ qna_node (merge/fill-in)               │
    │ patient_age_risk,           │                                        │
    │ comorbidity_flag,           │                                        │
    │ user_lat, user_lng          │                                        │
    ├─────────────────────────────┼────────────────────────────────────────┤
    │ asked_questions,            │ qna_node                               │
    │ pending_question,           │                                        │
    │ missing_fields,             │                                        │
    │ qna_questions_asked         │                                        │
    ├─────────────────────────────┼────────────────────────────────────────┤
    │ is_emergency,               │ emergency_node                         │
    │ emergency_confidence,       │                                        │
    │ emergency_reason,           │                                        │
    │ emergency_api_failed        │                                        │
    ├─────────────────────────────┼────────────────────────────────────────┤
    │ urgency_score,              │ classification_node                    │
    │ urgency_label,              │                                        │
    │ classification_api_failed   │                                        │
    ├─────────────────────────────┼────────────────────────────────────────┤
    │ hospital_data,              │ hospital_finding_node                  │
    │ hospital_api_failed         │                                        │
    ├─────────────────────────────┼────────────────────────────────────────┤
    │ output_mode, final_response │ output_node                            │
    ├─────────────────────────────┼────────────────────────────────────────┤
    │ conversation_history        │ API layer (hydrate) + output_node      │
    │                             │ (append after response)                │
    ├─────────────────────────────┼────────────────────────────────────────┤
    │ route_to                    │ input_node, emergency_node,            │
    │                             │ qna_node, classification_node          │
    │                             │ hospital_finding_node (edge hints)     │
    ├─────────────────────────────┼────────────────────────────────────────┤
    │ error_message               │ Any node on fatal error                │
    └─────────────────────────────┴────────────────────────────────────────┘
    """

    # ── IMMUTABLE INPUTS ────────────────────────────────────────────────────
    user_message: str
    user_id: str
    session_id: str

    # ── INPUT CLASSIFICATION ────────────────────────────────────────────────
    input_type: str                        # "user_symptom" | "user_query" | "user_answer"
    extracted_symptoms: list[str]          # Symptoms pulled from the message
    urgency_signals: list[str]             # Critical keyword/LLM signals detected
    classification_confidence: float       # LLM confidence (0.0–1.0)

    # ── TRIAGE FIELDS ───────────────────────────────────────────────────────
    symptom_severity: Optional[float]      # 0.0–1.0 (None until filled)
    symptom_count: Optional[int]           # Number of distinct symptoms
    duration: Optional[str]               # e.g. "3 days", "2 hours"
    patient_age_risk: Optional[str]        # "low" | "medium" | "high"
    comorbidity_flag: Optional[bool]       # Has pre-existing conditions
    user_lat: Optional[float]              # Latitude for hospital API
    user_lng: Optional[float]              # Longitude for hospital API

    # ── QNA STATE ───────────────────────────────────────────────────────────
    asked_questions: list[str]             # Questions already posed this session
    pending_question: Optional[str]        # Current unanswered question
    missing_fields: list[str]             # Fields still None
    qna_questions_asked: int               # Counter — triggers CONSERVATIVE_DEFAULTS at 5

    # ── EMERGENCY STATE ─────────────────────────────────────────────────────
    is_emergency: Optional[bool]           # Result from emergency API or override
    emergency_confidence: Optional[float]  # API confidence score
    emergency_reason: Optional[str]        # API reason string
    emergency_api_failed: bool             # True if API was unreachable

    # ── CLASSIFICATION STATE ─────────────────────────────────────────────────
    urgency_score: Optional[float]         # 0.0–1.0 urgency score
    urgency_label: Optional[str]           # "Self-care" | "Visit clinic" | "Emergency"
    classification_api_failed: bool        # True if fell back to rule-based formula

    # ── HOSPITAL STATE ───────────────────────────────────────────────────────
    facility_category: Optional[str]       # FacilityCategory value auto-selected from context
    hospital_data: Optional[list[dict]]    # List of hospital dicts from API
    hospital_api_failed: bool              # True if hospital API failed

    # ── OUTPUT STATE ─────────────────────────────────────────────────────────
    output_mode: str                       # "query"|"answer"|"suggestions"|"clinic"|"emergency"
    final_response: Optional[dict]         # Complete response payload

    # ── CONVERSATION HISTORY ─────────────────────────────────────────────────
    conversation_history: list[dict]       # [{role, content}] — capped at 20 turns

    # ── ROUTING HINT ─────────────────────────────────────────────────────────
    route_to: str                          # Used by conditional edge functions

    # ── ERROR TRACKING ───────────────────────────────────────────────────────
    error_message: Optional[str]           # Set on fatal error


def default_graph_state() -> GraphState:
    """Returns a GraphState populated with safe defaults for a fresh invocation."""
    return GraphState(
        user_message="",
        user_id="",
        session_id="",
        input_type="",
        extracted_symptoms=[],
        urgency_signals=[],
        classification_confidence=0.0,
        symptom_severity=None,
        symptom_count=None,
        duration=None,
        patient_age_risk=None,
        comorbidity_flag=None,
        user_lat=None,
        user_lng=None,
        asked_questions=[],
        pending_question=None,
        missing_fields=[],
        qna_questions_asked=0,
        is_emergency=None,
        emergency_confidence=None,
        emergency_reason=None,
        emergency_api_failed=False,
        urgency_score=None,
        urgency_label=None,
        classification_api_failed=False,
        facility_category=None,
        hospital_data=None,
        hospital_api_failed=False,
        output_mode="",
        final_response=None,
        conversation_history=[],
        route_to="",
        error_message=None,
    )


# Conservative defaults applied when qna_questions_asked reaches MAX_QNA_QUESTIONS
CONSERVATIVE_DEFAULTS: dict[str, Any] = {
    "symptom_severity": 0.6,
    "symptom_count": 1,
    "duration": "unknown",
    "patient_age_risk": "medium",
    "comorbidity_flag": False,
}


# ===========================================================================
# FASTAPI REQUEST / RESPONSE MODELS
# ===========================================================================

class InputRequest(BaseModel):
    """
    Payload sent by the frontend to POST /api/chat.
    Each field maps directly into the GraphState for graph invocation.
    """

    user_id: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="Unique identifier for the user. Scopes Mem0 memory and session store.",
        examples=["user_abc123"],
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Session ID. If omitted, a new session UUID is auto-generated.",
        examples=["sess_xyz456"],
    )
    message: str = Field(
        ...,
        min_length=1,
        max_length=4096,
        description="Raw user message text.",
        examples=["I have a severe headache and mild fever for 2 days"],
    )
    lat: Optional[float] = Field(
        default=None,
        description="User latitude for hospital finder (decimal degrees).",
        examples=[22.3072],
    )
    lng: Optional[float] = Field(
        default=None,
        description="User longitude for hospital finder (decimal degrees).",
        examples=[73.1812],
    )

    @field_validator("message")
    @classmethod
    def message_not_whitespace(cls, v: str) -> str:
        """Rejects messages that are blank or only whitespace."""
        if not v.strip():
            raise ValueError("message must not be blank or whitespace-only")
        return v.strip()

    model_config = {
        "json_schema_extra": {
            "example": {
                "user_id": "user_abc123",
                "session_id": "sess_xyz456",
                "message": "I have chest pain radiating to my left arm",
                "lat": 22.3072,
                "lng": 73.1812,
            }
        }
    }


class HospitalInfo(BaseModel):
    """A single hospital entry returned by the hospital finder API."""

    name: str = Field(..., description="Hospital or clinic name", examples=["City General Hospital"])
    address: str = Field(..., description="Full street address or postal code", examples=["390001"])
    distance_km: float = Field(..., ge=0.0, description="Distance from user in kilometres", examples=[0.82])
    phone: str = Field(..., description="Contact phone number", examples=["N/A"])
    open_now: Optional[bool] = Field(default=None, description="Whether the facility is currently open (null if unknown)")
    lat: float = Field(..., description="Facility latitude in decimal degrees", examples=[22.3083166])
    lng: float = Field(..., description="Facility longitude in decimal degrees", examples=[73.1798995])

    model_config = {
        "json_schema_extra": {
            "example": {
                "name": "Maa Children Hospital",
                "address": "390001",
                "distance_km": 0.82,
                "phone": "N/A",
                "open_now": None,
                "lat": 22.3083166,
                "lng": 73.1798995,
            }
        }
    }


class OutputResponse(BaseModel):
    """
    Response payload returned by the chatbot from POST /api/chat.
    Matches the output_schema defined in the architecture XML.
    """

    output_type: str = Field(
        ...,
        description="Response mode: query | answer | suggestions | clinic | emergency",
        examples=["suggestions"],
    )
    urgency_label: Optional[str] = Field(
        default=None,
        description="Triage urgency: Self-care | Visit clinic | Emergency | null for query/answer modes",
        examples=["Self-care"],
    )
    message: str = Field(
        ...,
        description="Main chatbot response text. Displayed prominently to the user.",
        examples=["Based on your symptoms, self-care should be sufficient."],
    )
    action_items: list[str] = Field(
        default_factory=list,
        description="Numbered list of actionable steps for the user.",
        examples=[["Take ibuprofen every 6 hours", "Rest and stay hydrated"]],
    )
    hospital_info: Optional[list[HospitalInfo]] = Field(
        default=None,
        description="Nearby hospitals/clinics. Populated for clinic and emergency modes.",
    )
    disclaimer: Optional[str] = Field(
        default=None,
        description="Medical disclaimer appended to all responses.",
        examples=["This is informational guidance, not a substitute for professional medical advice."],
    )
    session_complete: bool = Field(
        default=False,
        description="True when the triage session has concluded and no more turns are needed.",
        examples=[True],
    )
    session_id: str = Field(
        ...,
        description="Session ID echoed from the request (or auto-generated).",
        examples=["sess_xyz456"],
    )
    session_summary: Optional[dict] = Field(
        default=None,
        description=(
            "Structured summary of the current triage session: "
            "symptoms, severity, duration, urgency, questions asked."
        ),
        examples=[{
            "symptoms": ["headache", "fever"],
            "severity": 0.6,
            "duration": "2 days",
            "urgency": "Visit clinic",
            "is_emergency": False,
            "questions_asked": 3,
            "comorbidities": False,
        }],
    )
    total_summary: Optional[dict] = Field(
        default=None,
        description=(
            "All-time summary across the full conversation history in this session: "
            "total turns, triage fields collected across all turns."
        ),
        examples=[{
            "total_turns": 7,
            "triage_sessions_completed": 1,
            "all_symptoms_mentioned": ["headache", "fever", "nausea"],
            "highest_urgency_seen": "Visit clinic",
        }],
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "output_type": "suggestions",
                "urgency_label": "Self-care",
                "message": "Based on your symptoms, self-care should be sufficient.",
                "action_items": ["Rest", "Stay hydrated", "Take paracetamol for fever"],
                "hospital_info": None,
                "disclaimer": "This is informational guidance, not a substitute for professional medical advice.",
                "session_complete": True,
                "session_id": "sess_xyz456",
                "session_summary": {
                    "symptoms": ["headache", "fever"],
                    "severity": 0.6,
                    "duration": "2 days",
                    "urgency": "Self-care",
                    "is_emergency": False,
                    "questions_asked": 3,
                    "comorbidities": False,
                },
                "total_summary": {
                    "total_turns": 7,
                    "triage_sessions_completed": 1,
                    "all_symptoms_mentioned": ["headache", "fever"],
                    "highest_urgency_seen": "Self-care",
                },
            }
        }
    }


class ErrorResponse(BaseModel):
    """Standard error payload returned on any handled exception."""

    error: str = Field(..., description="Short error code", examples=["validation_error"])
    detail: str = Field(..., description="Human-readable error description", examples=["message must not be empty"])
    session_id: Optional[str] = Field(default=None, description="Session ID if available")


# ===========================================================================
# EXTERNAL API MODELS
# ===========================================================================

# ── Emergency Check API ──────────────────────────────────────────────────────

class EmergencyAPIRequest(BaseModel):
    """Request body for POST /api/emergency-check."""

    text: str = Field(
        ...,
        min_length=1,
        max_length=4096,
        description="Raw user input text to evaluate for emergency signals.",
        examples=["I have severe chest pain and I can't breathe"],
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "text": "I have severe chest pain radiating to my left arm and I feel dizzy",
            }
        }
    }


class EmergencyAPIResponse(BaseModel):
    """Response body from POST /api/emergency-check."""

    is_emergency: bool = Field(
        ...,
        description="True if the submitted text indicates a medical emergency, False otherwise.",
        examples=[True],
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "is_emergency": True,
            }
        }
    }


# ── Classification API ───────────────────────────────────────────────────────

class ClassificationAPIRequest(BaseModel):
    """Request body for POST /api/classify-urgency."""

    symptom_severity: float = Field(..., ge=0.0, le=1.0, description="Severity 0.0–1.0")
    symptom_count: int = Field(..., ge=1, description="Number of distinct symptoms")
    duration: str = Field(..., description="Duration string e.g. '3 days' or 'unknown'")
    patient_age_risk: str = Field(..., description="'low' | 'medium' | 'high'")
    comorbidity_flag: bool = Field(..., description="Has pre-existing conditions")

    @field_validator("patient_age_risk")
    @classmethod
    def validate_age_risk(cls, v: str) -> str:
        allowed = {"low", "medium", "high"}
        if v not in allowed:
            raise ValueError(f"patient_age_risk must be one of {allowed}, got '{v}'")
        return v

    model_config = {
        "json_schema_extra": {
            "example": {
                "symptom_severity": 0.6,
                "symptom_count": 2,
                "duration": "3 days",
                "patient_age_risk": "medium",
                "comorbidity_flag": False,
            }
        }
    }


class ClassificationAPIResponse(BaseModel):
    """Response body from POST /api/classify-urgency."""

    urgency_score: float = Field(..., ge=0.0, le=1.0, description="Urgency score 0.0–1.0")
    label: str = Field(..., description="'Self-care' | 'Visit clinic' | 'Emergency'")

    @field_validator("label")
    @classmethod
    def validate_label(cls, v: str) -> str:
        allowed = {"Self-care", "Visit clinic", "Emergency"}
        if v not in allowed:
            raise ValueError(f"label must be one of {allowed}, got '{v}'")
        return v

    model_config = {
        "json_schema_extra": {
            "example": {
                "urgency_score": 0.52,
                "label": "Visit clinic",
            }
        }
    }


# ── Hospital Finder API ───────────────────────────────────────────────────────

class HospitalAPIRequest(BaseModel):
    """Request body for POST /api/find-hospital."""

    lat: float = Field(
        ...,
        description="User latitude in decimal degrees.",
        examples=[22.3072],
    )
    lng: float = Field(
        ...,
        description="User longitude in decimal degrees.",
        examples=[73.1812],
    )
    urgency: str = Field(
        ...,
        description="'Visit clinic' | 'Emergency'",
        examples=["Emergency"],
    )
    facility_category: str = Field(
        default=FacilityCategory.HOSPITALS.value,
        description=(
            "Type of healthcare facility to find. One of the 14 FacilityCategory values. "
            "Auto-determined from symptom context by the workflow."
        ),
        examples=["CARDIOLOGISTS (Heart)"],
    )
    radius_km: float = Field(
        default=15.0,
        ge=1.0,
        le=100.0,
        description="Search radius in kilometres around the user's coordinates.",
        examples=[15],
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "lat": 22.3072,
                "lng": 73.1812,
                "urgency": "Emergency",
                "facility_category": "HOSPITALS",
                "radius_km": 15,
            }
        }
    }


class HospitalAPIResponse(BaseModel):
    """Response body from POST /api/find-hospital."""

    hospitals: list[HospitalInfo] = Field(
        default_factory=list,
        description="List of nearby hospitals sorted by distance",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "hospitals": [
                    {
                        "name": "City General Hospital",
                        "address": "123 MG Road, Ahmedabad",
                        "distance_km": 2.3,
                        "phone": "+91-79-1234-5678",
                        "open_now": True,
                    }
                ]
            }
        }
    }


# ===========================================================================
# SESSION MODELS
# ===========================================================================

class ConversationTurn(BaseModel):
    """A single turn in the conversation history (user or assistant message)."""

    role: str = Field(..., description="'user' | 'assistant'", examples=["user"])
    content: str = Field(..., description="Message content (no raw PII logged)", examples=["I have a headache"])

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in {"user", "assistant"}:
            raise ValueError(f"role must be 'user' or 'assistant', got '{v}'")
        return v


class TriageFields(BaseModel):
    """
    The 5 triage parameters persisted across conversation turns in the session store.
    Populated incrementally as QnA collects answers.
    """

    symptom_severity: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    symptom_count: Optional[int] = Field(default=None, ge=1)
    duration: Optional[str] = Field(default=None)
    patient_age_risk: Optional[str] = Field(default=None)
    comorbidity_flag: Optional[bool] = Field(default=None)
    user_lat: Optional[float] = Field(default=None)
    user_lng: Optional[float] = Field(default=None)
    extracted_symptoms: list[str] = Field(default_factory=list)


class SessionData(BaseModel):
    """
    Full session object stored in the in-memory session store.
    Persists across multiple graph invocations for the same session.
    """

    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = Field(...)
    triage_fields: TriageFields = Field(default_factory=TriageFields)
    conversation_history: list[ConversationTurn] = Field(default_factory=list)
    asked_questions: list[str] = Field(default_factory=list)
    pending_question: Optional[str] = Field(default=None)
    qna_questions_asked: int = Field(default=0)
    session_complete: bool = Field(default=False)
    urgency_label: Optional[str] = Field(default=None)

    def to_graph_state_patch(self) -> dict:
        """
        Returns a dict that can be merged into the GraphState initial state
        before each graph invocation, hydrating it with accumulated session data.
        """
        tf = self.triage_fields
        return {
            "symptom_severity":    tf.symptom_severity,
            "symptom_count":       tf.symptom_count,
            "duration":            tf.duration,
            "patient_age_risk":    tf.patient_age_risk,
            "comorbidity_flag":    tf.comorbidity_flag,
            "user_lat":            tf.user_lat,
            "user_lng":            tf.user_lng,
            "extracted_symptoms":  tf.extracted_symptoms,
            "conversation_history": [{"role": t.role, "content": t.content} for t in self.conversation_history],
            "asked_questions":     self.asked_questions,
            "pending_question":    self.pending_question,
            "qna_questions_asked": self.qna_questions_asked,
        }

    model_config = {
        "json_schema_extra": {
            "example": {
                "session_id": "sess_xyz456",
                "user_id": "user_abc123",
                "triage_fields": {
                    "symptom_severity": 0.4,
                    "symptom_count": None,
                    "duration": "2 days",
                    "patient_age_risk": None,
                    "comorbidity_flag": None,
                    "user_lat": 22.3072,
                    "user_lng": 73.1812,
                    "extracted_symptoms": [],
                },
                "conversation_history": [],
                "asked_questions": ["How severe is your headache on a scale of 1-10?"],
                "pending_question": "How long have you had these symptoms?",
                "qna_questions_asked": 1,
                "session_complete": False,
                "urgency_label": None,
            }
        }
    }
