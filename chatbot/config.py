"""
config.py
---------
Central configuration for the chatbot module.
Loads all environment variables and defines model/memory settings.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Always load from the .env file in the same directory as this config file,
# regardless of the working directory uvicorn is launched from.
load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

# ---------------------------------------------------------------------------
# API Keys
# ---------------------------------------------------------------------------

GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
MEM0_API_KEY: str = os.getenv("MEM0_API_KEY", "")  # Leave empty if using local Mem0

# ---------------------------------------------------------------------------
# Groq LLM Settings
# ---------------------------------------------------------------------------

# Multilingual-capable models available on Groq:
#   - "llama-3.3-70b-versatile"   → Best quality, multilingual
#   - "llama-3.1-8b-instant"      → Fastest, good multilingual support
#   - "gemma2-9b-it"              → Solid multilingual alternative
#   - "mixtral-8x7b-32768"        → Long context window
GROQ_MODEL_NAME: str = os.getenv("GROQ_MODEL_NAME", "llama-3.3-70b-versatile")

# Temperature: 0.0 = deterministic, 1.0 = creative
LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.7"))

# Maximum tokens to generate in each response
LLM_MAX_TOKENS: int = int(os.getenv("LLM_MAX_TOKENS", "1024"))

# ---------------------------------------------------------------------------
# Mem0 Memory Settings
# ---------------------------------------------------------------------------

# Number of past memories to retrieve per message (top-k semantic search)
MEMORY_TOP_K: int = int(os.getenv("MEMORY_TOP_K", "5"))

# Whether to use Mem0 Cloud (True) or local Mem0 (False)
# If True, MEM0_API_KEY must be set above.
USE_MEM0_CLOUD: bool = os.getenv("USE_MEM0_CLOUD", "true").lower() == "true"

# ---------------------------------------------------------------------------
# FastAPI Settings
# ---------------------------------------------------------------------------

# Host and port for the FastAPI server
API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
API_PORT: int = int(os.getenv("API_PORT", "8000"))

# Allowed origins for CORS (comma-separated), e.g. "http://localhost:3000"
CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "*").split(",")

# ---------------------------------------------------------------------------
# External Healthcare API URLs
# ---------------------------------------------------------------------------

EMERGENCY_API_URL: str       = os.getenv("EMERGENCY_API_URL",       "http://localhost:9000/api/emergency-check")
CLASSIFICATION_API_URL: str  = os.getenv("CLASSIFICATION_API_URL",  "https://anfis-medical-triage.onrender.com/api/classify-urgency")
HOSPITAL_API_URL: str        = os.getenv("HOSPITAL_API_URL",        "http://localhost:9000/api/find-hospital")

# Per-request timeouts (seconds)
EMERGENCY_API_TIMEOUT: float       = float(os.getenv("EMERGENCY_API_TIMEOUT",       "5"))
CLASSIFICATION_API_TIMEOUT: float  = float(os.getenv("CLASSIFICATION_API_TIMEOUT", "8"))
HOSPITAL_API_TIMEOUT: float        = float(os.getenv("HOSPITAL_API_TIMEOUT",       "10"))
HOSPITAL_RADIUS_KM: float          = float(os.getenv("HOSPITAL_RADIUS_KM",         "15"))

# ---------------------------------------------------------------------------
# Healthcare Triage Settings
# ---------------------------------------------------------------------------

# Maximum number of QnA questions before CONSERVATIVE_DEFAULTS are applied
MAX_QNA_QUESTIONS: int = int(os.getenv("MAX_QNA_QUESTIONS", "5"))

# Number of times to retry an LLM call on JSON parse failure
LLM_JSON_RETRY_ATTEMPTS: int = int(os.getenv("LLM_JSON_RETRY_ATTEMPTS", "3"))

# If LLM classification confidence is below this, force input_type='user_symptom'
MIN_CLASSIFICATION_CONFIDENCE: float = float(os.getenv("MIN_CLASSIFICATION_CONFIDENCE", "0.6"))

# Keywords that ALWAYS trigger emergency routing regardless of LLM output.
# Add new keywords here to expand emergency detection without changing code.
CRITICAL_KEYWORDS: list[str] = [
    "chest pain",
    "chest tightness",
    "chest pressure",
    "can't breathe",
    "cannot breathe",
    "difficulty breathing",
    "short of breath",
    "shortness of breath",
    "heart attack",
    "stroke",
    "slurred speech",
    "face drooping",
    "facial drooping",
    "arm weakness",
    "sudden confusion",
    "loss of consciousness",
    "passed out",
    "unconscious",
    "unresponsive",
    "seizure",
    "convulsion",
    "severe bleeding",
    "won't stop bleeding",
    "wont stop bleeding",
    "suicidal",
    "want to die",
    "kill myself",
    "self-harm",
    "overdose",
    "took too many pills",
    "anaphylaxis",
    "throat swelling",
    "severe allergic reaction",
    "choking",
    "can't swallow",
    "cannot swallow",
    "worst headache",
    "sudden severe headache",
]

# ---------------------------------------------------------------------------
# Validation — raise early if critical keys are missing
# ---------------------------------------------------------------------------

def validate_config() -> None:
    """
    Call this at application startup to catch missing critical secrets early.
    Raises a RuntimeError if any required key is absent.
    """
    missing = []

    if not GROQ_API_KEY:
        missing.append("GROQ_API_KEY")

    if USE_MEM0_CLOUD and not MEM0_API_KEY:
        missing.append("MEM0_API_KEY (required when USE_MEM0_CLOUD=true)")

    if missing:
        raise RuntimeError(
            f"Missing required environment variables: {', '.join(missing)}. "
            "Please set them in your .env file or system environment."
        )
