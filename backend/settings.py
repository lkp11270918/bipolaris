from __future__ import annotations

import os
from pathlib import Path


def load_local_env() -> None:
    env_path = Path(__file__).with_name(".env")
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_local_env()


def get_env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
DB_PATH = DATA_DIR / "rag.sqlite3"
APP_DB_PATH = DATA_DIR / "app.sqlite3"
DATABASE_URL = os.getenv("DATABASE_URL", "")
ADMIN_METRICS_TOKEN = os.getenv("ADMIN_METRICS_TOKEN", "")
LOG_DIR = DATA_DIR / "logs"
FEEDBACK_PATH = LOG_DIR / "feedback.jsonl"
INTERACTION_LOG_PATH = LOG_DIR / "interactions.jsonl"

OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
OPENAI_EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")

RAG_TOP_K = get_env_int("RAG_TOP_K", 4)
RAG_MAX_HISTORY = get_env_int("RAG_MAX_HISTORY", 8)
RAG_MIN_SCORE = float(os.getenv("RAG_MIN_SCORE", "0.32"))
MAX_ADVICE_ITEMS = get_env_int("MAX_ADVICE_ITEMS", 3)
MAX_QUESTIONS_PER_REPLY = get_env_int("MAX_QUESTIONS_PER_REPLY", 1)
MAX_OUTPUT_TOKENS = get_env_int("MAX_OUTPUT_TOKENS", 850)

ESCONV_MAX_TURNS = get_env_int("ESCONV_MAX_TURNS", 1400)
BIPOLAR_MAX_DOCS = get_env_int("BIPOLAR_MAX_DOCS", 2200)
