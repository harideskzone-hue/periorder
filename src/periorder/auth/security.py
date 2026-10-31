"""Security utilities for password hashing and JWT token management."""

from __future__ import annotations

import datetime
import os
from typing import Any

import bcrypt
import jwt

# Secret key and algorithm configuration
# PERIORDER_JWT_SECRET environment variable overrides default dev key
DEFAULT_JWT_SECRET = "periorder_super_secure_jwt_secret_dev_key_2026_xyz"
JWT_SECRET_KEY = os.environ.get("PERIORDER_JWT_SECRET", DEFAULT_JWT_SECRET)
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt with salt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a stored bcrypt hash."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(
    data: dict[str, Any],
    expires_delta: datetime.timedelta | None = None,
) -> str:
    """Create a signed JWT access token containing tenant, user identity, and expiration."""
    to_encode = data.copy()
    now = datetime.datetime.now(datetime.UTC)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire, "iat": now})
    secret = os.environ.get("PERIORDER_JWT_SECRET", JWT_SECRET_KEY)
    return jwt.encode(to_encode, secret, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT access token."""
    secret = os.environ.get("PERIORDER_JWT_SECRET", JWT_SECRET_KEY)
    return jwt.decode(token, secret, algorithms=[JWT_ALGORITHM])
