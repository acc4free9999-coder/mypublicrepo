from __future__ import annotations

import base64
import hashlib
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from cryptography.fernet import Fernet, InvalidToken
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_KEY_FILE = os.path.join(os.getcwd(), ".fernet.key")


def _load_or_create_key() -> bytes:
    """Resolve the Fernet key from settings, or persist a dev key on disk.

    A generated key is written to disk so encrypted credentials survive restarts
    during local development; production must supply CREDENTIALS_ENCRYPTION_KEY.
    """
    configured = settings.credentials_encryption_key.strip()
    if configured:
        try:
            Fernet(configured.encode())
            return configured.encode()
        except (ValueError, TypeError):
            # Allow an arbitrary passphrase by deriving a stable 32-byte key.
            digest = hashlib.sha256(configured.encode()).digest()
            return base64.urlsafe_b64encode(digest)

    if os.path.exists(_KEY_FILE):
        with open(_KEY_FILE, "rb") as fh:
            return fh.read().strip()

    key = Fernet.generate_key()
    with open(_KEY_FILE, "wb") as fh:
        fh.write(key)
    os.chmod(_KEY_FILE, 0o600)
    return key


_fernet = Fernet(_load_or_create_key())


def encrypt_secret(plaintext: str) -> str:
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt_secret(ciphertext: str) -> str:
    try:
        return _fernet.decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Stored credential could not be decrypted") from exc


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)


def create_access_token(subject: str, expires_minutes: int | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.access_token_expire_minutes
    )
    payload: dict[str, Any] = {"sub": subject, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
    subject = payload.get("sub")
    return str(subject) if subject else None
