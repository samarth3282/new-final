"""
api_clients.py
--------------
Async wrappers for the three external healthcare APIs.

Every wrapper:
  - Has timeout, retry, and error handling baked in
  - Returns None on failure (callers apply fallback logic)
  - NEVER raises an exception — all errors are caught and logged
  - Logs at WARNING level for retries, ERROR level for total failures

External APIs:
  1. Emergency Check API   — POST /api/emergency-check
  2. Classification API    — POST /api/classify-urgency
  3. Hospital Finder API   — POST /api/find-hospital
"""

import asyncio
import logging
from typing import Optional

import httpx

from config import (
    CLASSIFICATION_API_TIMEOUT,
    CLASSIFICATION_API_URL,
    EMERGENCY_API_TIMEOUT,
    EMERGENCY_API_URL,
    HOSPITAL_API_TIMEOUT,
    HOSPITAL_API_URL,
)
from schemas import (
    ClassificationAPIRequest,
    ClassificationAPIResponse,
    EmergencyAPIRequest,
    EmergencyAPIResponse,
    HospitalAPIRequest,
    HospitalAPIResponse,
)

logger = logging.getLogger(__name__)


# ===========================================================================
# Internal HTTP utility
# ===========================================================================

async def _post_with_retry(
    url: str,
    payload: dict,
    timeout: float,
    max_attempts: int,
    retry_delay: float = 1.0,
) -> Optional[dict]:
    """
    Makes an async POST request with retry logic.

    Args:
        url:          Full URL to POST to.
        payload:      JSON-serializable request body.
        timeout:      Per-request timeout in seconds.
        max_attempts: Total number of attempts (1 = no retry).
        retry_delay:  Seconds to wait between retries.

    Returns:
        Parsed JSON response dict on success, None on complete failure.
    """
    for attempt in range(1, max_attempts + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                return response.json()

        except httpx.TimeoutException:
            logger.warning(
                "API timeout at %s (attempt %d/%d)", url, attempt, max_attempts
            )
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            logger.warning(
                "API HTTP %d at %s (attempt %d/%d)", status, url, attempt, max_attempts
            )
            if status < 500:
                # 4xx — client error, retrying won't help
                logger.error("Non-retryable client error %d at %s", status, url)
                return None
        except httpx.RequestError as exc:
            logger.warning(
                "API request error at %s (attempt %d/%d): %s",
                url, attempt, max_attempts, type(exc).__name__,
            )
        except Exception as exc:
            logger.error(
                "Unexpected error calling %s (attempt %d/%d): %s",
                url, attempt, max_attempts, exc,
            )

        if attempt < max_attempts:
            await asyncio.sleep(retry_delay)

    logger.error("API at %s failed after %d attempts", url, max_attempts)
    return None


# ===========================================================================
# 1. Emergency Check API
# ===========================================================================

async def call_emergency_api(
    text: str,
) -> Optional[EmergencyAPIResponse]:
    """
    Calls the emergency classification API with raw user text.

    Args:
        text: Raw user message text to evaluate for emergency signals.

    Returns:
        EmergencyAPIResponse(is_emergency=bool) on success,
        None if the API failed completely (caller applies conservative fallback).
    """
    request = EmergencyAPIRequest(text=text)

    logger.debug("Calling emergency API (text len=%d)", len(text))

    raw = await _post_with_retry(
        url=EMERGENCY_API_URL,
        payload=request.model_dump(),
        timeout=EMERGENCY_API_TIMEOUT,
        max_attempts=3,
        retry_delay=1.0,
    )

    if raw is None:
        return None

    try:
        # Accept both full response and minimal {"is_emergency": bool}
        is_emergency = raw.get("is_emergency")
        if is_emergency is None:
            logger.error("Emergency API response missing 'is_emergency' field: %s", raw)
            return None
        return EmergencyAPIResponse(is_emergency=bool(is_emergency))
    except Exception as exc:
        logger.error("Emergency API response parsing failed: %s", exc)
        return None


# ===========================================================================
# 2. Classification API (with rule-based fallback — ALWAYS returns a result)
# ===========================================================================

def _rule_based_urgency(
    symptom_severity: float,
    comorbidity_flag: bool,
    patient_age_risk: str,
) -> ClassificationAPIResponse:
    """
    Rule-based urgency score computation used when the classification API fails.

    Formula: score = (severity × 0.4) + (comorbidity × 0.3) + (age_risk_score × 0.3)
    Age risk scores: low=0.2, medium=0.5, high=0.9

    Threshold (conservative — upper label at exact boundary):
      score < 0.40        → Self-care
      0.40 ≤ score < 0.75 → Visit clinic
      score ≥ 0.75        → Emergency

    Args:
        symptom_severity: Severity 0.0–1.0.
        comorbidity_flag: Pre-existing conditions present.
        patient_age_risk: "low" | "medium" | "high".

    Returns:
        ClassificationAPIResponse with rule-based score and label.
    """
    age_risk_map = {"low": 0.2, "medium": 0.5, "high": 0.9}
    age_score = age_risk_map.get(patient_age_risk, 0.5)
    comorbidity_score = 1.0 if comorbidity_flag else 0.0

    score = round(
        (symptom_severity * 0.4)
        + (comorbidity_score * 0.3)
        + (age_score * 0.3),
        3,
    )

    # Conservative threshold — exact boundary uses upper (more urgent) label
    if score < 0.40:
        label = "Self-care"
    elif score < 0.75:
        label = "Visit clinic"
    else:
        label = "Emergency"

    logger.info("Rule-based fallback: score=%.3f → %s", score, label)
    return ClassificationAPIResponse(urgency_score=score, label=label)


async def call_classification_api(
    request: ClassificationAPIRequest,
) -> tuple[ClassificationAPIResponse, bool]:
    """
    Calls the urgency classification API. ALWAYS returns a result via fallback.

    Args:
        request: ClassificationAPIRequest with all 5 triage parameters.

    Returns:
        Tuple of (ClassificationAPIResponse, api_failed_flag).
        api_failed_flag is True if the rule-based fallback was used.
    """
    logger.debug("Calling classification API")

    raw = await _post_with_retry(
        url=CLASSIFICATION_API_URL,
        payload=request.model_dump(),
        timeout=CLASSIFICATION_API_TIMEOUT,
        max_attempts=3,
        retry_delay=1.0,
    )

    if raw is not None:
        try:
            result = ClassificationAPIResponse(**raw)
            logger.info(
                "Classification API result: score=%.3f → %s", result.urgency_score, result.label
            )
            return result, False
        except Exception as exc:
            logger.error("Classification API response validation failed: %s. Using fallback.", exc)

    # Fallback: rule-based formula
    logger.warning("Classification API unavailable — using rule-based fallback")
    result = _rule_based_urgency(
        symptom_severity=request.symptom_severity,
        comorbidity_flag=request.comorbidity_flag,
        patient_age_risk=request.patient_age_risk,
    )
    return result, True


# ===========================================================================
# 3. Hospital Finder API
# ===========================================================================

async def call_hospital_api(
    lat: float,
    lng: float,
    urgency: str,
    facility_category: str = "HOSPITALS",
    radius_km: float = 15.0,
) -> Optional[HospitalAPIResponse]:
    """
    Calls the hospital finder API.

    Args:
        lat:               User latitude (decimal degrees).
        lng:               User longitude (decimal degrees).
        urgency:           "Visit clinic" or "Emergency".
        facility_category: FacilityCategory value auto-determined from context.
        radius_km:         Search radius in km (default 15).

    Returns:
        HospitalAPIResponse on success, None if API failed.
    """
    request = HospitalAPIRequest(
        lat=lat,
        lng=lng,
        urgency=urgency,
        facility_category=facility_category,
        radius_km=radius_km,
    )

    logger.debug(
        "Calling hospital API lat=%.4f lng=%.4f urgency=%s category=%s radius=%.1f km",
        lat, lng, urgency, facility_category, radius_km,
    )

    raw = await _post_with_retry(
        url=HOSPITAL_API_URL,
        payload=request.model_dump(),
        timeout=HOSPITAL_API_TIMEOUT,
        max_attempts=2,   # 1 retry = 2 total attempts as per spec
        retry_delay=1.0,
    )

    if raw is None:
        return None

    try:
        # Normalise each facility dict: map road_km → distance_km if present
        facilities = raw.get("hospitals", raw) if isinstance(raw, dict) else raw
        if isinstance(facilities, list):
            normalised = []
            for f in facilities:
                item = dict(f)
                if "distance_km" not in item and "road_km" in item:
                    item["distance_km"] = round(float(item.pop("road_km")), 2)
                normalised.append(item)
            raw = {"hospitals": normalised}

        result = HospitalAPIResponse(**raw)
        logger.info("Hospital API returned %d facilities", len(result.hospitals))
        return result
    except Exception as exc:
        logger.error("Hospital API response validation failed: %s", exc)
        return None
