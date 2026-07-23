from __future__ import annotations

import base64
import hashlib

from .settings import DATA_ENCRYPTION_KEY

try:
    from cryptography.fernet import Fernet, InvalidToken
except ImportError:  # pragma: no cover - local dev can run without optional crypto.
    Fernet = None  # type: ignore[assignment]
    InvalidToken = Exception  # type: ignore[assignment]


ENCRYPTED_PREFIX = "enc:v1:"


def _derive_fernet_key(secret: str) -> bytes:
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _fernet() -> Fernet | None:
    if not DATA_ENCRYPTION_KEY or Fernet is None:
        return None
    return Fernet(_derive_fernet_key(DATA_ENCRYPTION_KEY))


def encrypt_text(value: str | None) -> str:
    if not value:
        return ""
    if value.startswith(ENCRYPTED_PREFIX):
        return value
    fernet = _fernet()
    if fernet is None:
        return value
    token = fernet.encrypt(value.encode("utf-8")).decode("utf-8")
    return f"{ENCRYPTED_PREFIX}{token}"


def decrypt_text(value: str | None) -> str:
    if not value:
        return ""
    if not value.startswith(ENCRYPTED_PREFIX):
        return value
    fernet = _fernet()
    if fernet is None:
        return ""
    token = value.removeprefix(ENCRYPTED_PREFIX)
    try:
        return fernet.decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return ""
