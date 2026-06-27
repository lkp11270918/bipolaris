from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Any, Iterator

from .settings import APP_DB_PATH, DATABASE_URL

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # pragma: no cover - optional production dependency.
    psycopg = None  # type: ignore[assignment]
    dict_row = None  # type: ignore[assignment]


MOOD_LOG_COLUMNS = [
    "id",
    "user_id",
    "created_at",
    "mood",
    "sleep",
    "energy",
    "impulse",
    "medication",
    "state",
    "notes",
]

USER_SETTINGS_COLUMNS = [
    "user_id",
    "display_name",
    "age_range",
    "diagnosis_status",
    "emergency_contact_name",
    "emergency_contact_phone",
    "emergency_contact_relation",
    "allow_emergency_contact_prompt",
    "daily_checkin_enabled",
    "daily_checkin_time",
    "medication_enabled",
    "medication_time",
    "appointment_enabled",
    "long_term_memory_enabled",
    "updated_at",
]

EVENT_LOG_COLUMNS = [
    "id",
    "user_id",
    "session_id",
    "event_name",
    "event_time",
    "properties_json",
    "app_version",
    "platform",
]


def use_postgres() -> bool:
    return DATABASE_URL.startswith(("postgres://", "postgresql://")) and psycopg is not None


@contextmanager
def sqlite_connection() -> Iterator[sqlite3.Connection]:
    APP_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(APP_DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def ensure_app_schema() -> None:
    if use_postgres():
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:  # type: ignore[union-attr]
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS mood_logs (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    mood INTEGER NOT NULL,
                    sleep INTEGER NOT NULL,
                    energy INTEGER NOT NULL,
                    impulse INTEGER NOT NULL,
                    medication TEXT NOT NULL,
                    state TEXT NOT NULL,
                    notes TEXT NOT NULL DEFAULT ''
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_mood_logs_user_id ON mood_logs(user_id)")
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS user_settings (
                    user_id TEXT PRIMARY KEY,
                    display_name TEXT NOT NULL DEFAULT '',
                    age_range TEXT NOT NULL DEFAULT '',
                    diagnosis_status TEXT NOT NULL DEFAULT '',
                    emergency_contact_name TEXT NOT NULL DEFAULT '',
                    emergency_contact_phone TEXT NOT NULL DEFAULT '',
                    emergency_contact_relation TEXT NOT NULL DEFAULT '',
                    allow_emergency_contact_prompt BOOLEAN NOT NULL DEFAULT TRUE,
                    daily_checkin_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                    daily_checkin_time TEXT NOT NULL DEFAULT '08:30',
                    medication_enabled BOOLEAN NOT NULL DEFAULT FALSE,
                    medication_time TEXT NOT NULL DEFAULT '21:00',
                    appointment_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                    long_term_memory_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS event_logs (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    session_id TEXT NOT NULL DEFAULT '',
                    event_name TEXT NOT NULL,
                    event_time TEXT NOT NULL,
                    properties_json TEXT NOT NULL DEFAULT '{}',
                    app_version TEXT NOT NULL DEFAULT '',
                    platform TEXT NOT NULL DEFAULT 'web'
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_event_logs_user_id ON event_logs(user_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_event_logs_event_name ON event_logs(event_name)")
        return

    with sqlite_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS mood_logs (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                mood INTEGER NOT NULL,
                sleep INTEGER NOT NULL,
                energy INTEGER NOT NULL,
                impulse INTEGER NOT NULL,
                medication TEXT NOT NULL,
                state TEXT NOT NULL,
                notes TEXT NOT NULL DEFAULT ''
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_mood_logs_user_id ON mood_logs(user_id)")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_settings (
                user_id TEXT PRIMARY KEY,
                display_name TEXT NOT NULL DEFAULT '',
                age_range TEXT NOT NULL DEFAULT '',
                diagnosis_status TEXT NOT NULL DEFAULT '',
                emergency_contact_name TEXT NOT NULL DEFAULT '',
                emergency_contact_phone TEXT NOT NULL DEFAULT '',
                emergency_contact_relation TEXT NOT NULL DEFAULT '',
                allow_emergency_contact_prompt INTEGER NOT NULL DEFAULT 1,
                daily_checkin_enabled INTEGER NOT NULL DEFAULT 1,
                daily_checkin_time TEXT NOT NULL DEFAULT '08:30',
                medication_enabled INTEGER NOT NULL DEFAULT 0,
                medication_time TEXT NOT NULL DEFAULT '21:00',
                appointment_enabled INTEGER NOT NULL DEFAULT 1,
                long_term_memory_enabled INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS event_logs (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                session_id TEXT NOT NULL DEFAULT '',
                event_name TEXT NOT NULL,
                event_time TEXT NOT NULL,
                properties_json TEXT NOT NULL DEFAULT '{}',
                app_version TEXT NOT NULL DEFAULT '',
                platform TEXT NOT NULL DEFAULT 'web'
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_event_logs_user_id ON event_logs(user_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_event_logs_event_name ON event_logs(event_name)")


def save_mood_log(row: dict[str, Any]) -> dict[str, Any]:
    ensure_app_schema()
    values = {key: row.get(key) for key in MOOD_LOG_COLUMNS}
    if use_postgres():
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:  # type: ignore[union-attr]
            conn.execute(
                """
                INSERT INTO mood_logs (
                    id, user_id, created_at, mood, sleep, energy, impulse, medication, state, notes
                ) VALUES (
                    %(id)s, %(user_id)s, %(created_at)s, %(mood)s, %(sleep)s, %(energy)s,
                    %(impulse)s, %(medication)s, %(state)s, %(notes)s
                )
                ON CONFLICT (id) DO UPDATE SET
                    user_id = EXCLUDED.user_id,
                    created_at = EXCLUDED.created_at,
                    mood = EXCLUDED.mood,
                    sleep = EXCLUDED.sleep,
                    energy = EXCLUDED.energy,
                    impulse = EXCLUDED.impulse,
                    medication = EXCLUDED.medication,
                    state = EXCLUDED.state,
                    notes = EXCLUDED.notes
                """,
                values,
            )
        return values

    with sqlite_connection() as conn:
        conn.execute(
            """
            INSERT INTO mood_logs (
                id, user_id, created_at, mood, sleep, energy, impulse, medication, state, notes
            ) VALUES (
                :id, :user_id, :created_at, :mood, :sleep, :energy, :impulse, :medication, :state, :notes
            )
            ON CONFLICT(id) DO UPDATE SET
                user_id = excluded.user_id,
                created_at = excluded.created_at,
                mood = excluded.mood,
                sleep = excluded.sleep,
                energy = excluded.energy,
                impulse = excluded.impulse,
                medication = excluded.medication,
                state = excluded.state,
                notes = excluded.notes
            """,
            values,
        )
    return values


def list_mood_logs(user_id: str, limit: int = 30) -> list[dict[str, Any]]:
    ensure_app_schema()
    if use_postgres():
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:  # type: ignore[union-attr]
            rows = conn.execute(
                """
                SELECT id, user_id, created_at, mood, sleep, energy, impulse, medication, state, notes
                FROM mood_logs
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (user_id, limit),
            ).fetchall()
        return [dict(row) for row in rows]

    with sqlite_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, user_id, created_at, mood, sleep, energy, impulse, medication, state, notes
            FROM mood_logs
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (user_id, limit),
        ).fetchall()
    return [dict(row) for row in rows]


def save_user_settings(row: dict[str, Any]) -> dict[str, Any]:
    ensure_app_schema()
    values = {key: row.get(key) for key in USER_SETTINGS_COLUMNS}
    if use_postgres():
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:  # type: ignore[union-attr]
            conn.execute(
                """
                INSERT INTO user_settings (
                    user_id, display_name, age_range, diagnosis_status,
                    emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
                    allow_emergency_contact_prompt, daily_checkin_enabled, daily_checkin_time,
                    medication_enabled, medication_time, appointment_enabled, long_term_memory_enabled, updated_at
                ) VALUES (
                    %(user_id)s, %(display_name)s, %(age_range)s, %(diagnosis_status)s,
                    %(emergency_contact_name)s, %(emergency_contact_phone)s, %(emergency_contact_relation)s,
                    %(allow_emergency_contact_prompt)s, %(daily_checkin_enabled)s, %(daily_checkin_time)s,
                    %(medication_enabled)s, %(medication_time)s, %(appointment_enabled)s, %(long_term_memory_enabled)s,
                    %(updated_at)s
                )
                ON CONFLICT (user_id) DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    age_range = EXCLUDED.age_range,
                    diagnosis_status = EXCLUDED.diagnosis_status,
                    emergency_contact_name = EXCLUDED.emergency_contact_name,
                    emergency_contact_phone = EXCLUDED.emergency_contact_phone,
                    emergency_contact_relation = EXCLUDED.emergency_contact_relation,
                    allow_emergency_contact_prompt = EXCLUDED.allow_emergency_contact_prompt,
                    daily_checkin_enabled = EXCLUDED.daily_checkin_enabled,
                    daily_checkin_time = EXCLUDED.daily_checkin_time,
                    medication_enabled = EXCLUDED.medication_enabled,
                    medication_time = EXCLUDED.medication_time,
                    appointment_enabled = EXCLUDED.appointment_enabled,
                    long_term_memory_enabled = EXCLUDED.long_term_memory_enabled,
                    updated_at = EXCLUDED.updated_at
                """
                ,
                values,
            )
        return values

    with sqlite_connection() as conn:
        conn.execute(
            """
            INSERT INTO user_settings (
                user_id, display_name, age_range, diagnosis_status,
                emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
                allow_emergency_contact_prompt, daily_checkin_enabled, daily_checkin_time,
                medication_enabled, medication_time, appointment_enabled, long_term_memory_enabled, updated_at
            ) VALUES (
                :user_id, :display_name, :age_range, :diagnosis_status,
                :emergency_contact_name, :emergency_contact_phone, :emergency_contact_relation,
                :allow_emergency_contact_prompt, :daily_checkin_enabled, :daily_checkin_time,
                :medication_enabled, :medication_time, :appointment_enabled, :long_term_memory_enabled, :updated_at
            )
            ON CONFLICT(user_id) DO UPDATE SET
                display_name = excluded.display_name,
                age_range = excluded.age_range,
                diagnosis_status = excluded.diagnosis_status,
                emergency_contact_name = excluded.emergency_contact_name,
                emergency_contact_phone = excluded.emergency_contact_phone,
                emergency_contact_relation = excluded.emergency_contact_relation,
                allow_emergency_contact_prompt = excluded.allow_emergency_contact_prompt,
                daily_checkin_enabled = excluded.daily_checkin_enabled,
                daily_checkin_time = excluded.daily_checkin_time,
                medication_enabled = excluded.medication_enabled,
                medication_time = excluded.medication_time,
                appointment_enabled = excluded.appointment_enabled,
                long_term_memory_enabled = excluded.long_term_memory_enabled,
                updated_at = excluded.updated_at
            """,
            values,
        )
    return values


def get_user_settings(user_id: str) -> dict[str, Any] | None:
    ensure_app_schema()
    if use_postgres():
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:  # type: ignore[union-attr]
            row = conn.execute(
                "SELECT * FROM user_settings WHERE user_id = %s",
                (user_id,),
            ).fetchone()
        return dict(row) if row else None

    with sqlite_connection() as conn:
        row = conn.execute("SELECT * FROM user_settings WHERE user_id = ?", (user_id,)).fetchone()
    return dict(row) if row else None


def delete_user_data(user_id: str) -> None:
    ensure_app_schema()
    if use_postgres():
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:  # type: ignore[union-attr]
            conn.execute("DELETE FROM mood_logs WHERE user_id = %s", (user_id,))
            conn.execute("DELETE FROM user_settings WHERE user_id = %s", (user_id,))
            conn.execute("DELETE FROM event_logs WHERE user_id = %s", (user_id,))
        return

    with sqlite_connection() as conn:
        conn.execute("DELETE FROM mood_logs WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM user_settings WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM event_logs WHERE user_id = ?", (user_id,))


def save_event_log(row: dict[str, Any]) -> dict[str, Any]:
    ensure_app_schema()
    values = {key: row.get(key) for key in EVENT_LOG_COLUMNS}
    if use_postgres():
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:  # type: ignore[union-attr]
            conn.execute(
                """
                INSERT INTO event_logs (
                    id, user_id, session_id, event_name, event_time, properties_json, app_version, platform
                ) VALUES (
                    %(id)s, %(user_id)s, %(session_id)s, %(event_name)s, %(event_time)s,
                    %(properties_json)s, %(app_version)s, %(platform)s
                )
                ON CONFLICT (id) DO NOTHING
                """,
                values,
            )
        return values

    with sqlite_connection() as conn:
        conn.execute(
            """
            INSERT OR IGNORE INTO event_logs (
                id, user_id, session_id, event_name, event_time, properties_json, app_version, platform
            ) VALUES (
                :id, :user_id, :session_id, :event_name, :event_time, :properties_json, :app_version, :platform
            )
            """,
            values,
        )
    return values
