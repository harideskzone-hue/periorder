"""Authentication and Multi-Tenant Authorization package for PeriOrder."""

from periorder.auth.dependencies import (
    get_current_tenant,
    get_current_user,
    oauth2_scheme,
    verify_store_access,
)
from periorder.auth.router import auth_router
from periorder.auth.schemas import (
    LoginRequest,
    RegisterRequest,
    TenantResponse,
    TokenResponse,
    UserResponse,
)
from periorder.auth.security import (
    create_access_token,
    decode_access_token,
    get_jwt_secret,
    hash_password,
    verify_password,
)

__all__ = [
    "LoginRequest",
    "RegisterRequest",
    "TenantResponse",
    "TokenResponse",
    "UserResponse",
    "auth_router",
    "create_access_token",
    "decode_access_token",
    "get_current_tenant",
    "get_current_user",
    "get_jwt_secret",
    "hash_password",

    "oauth2_scheme",
    "verify_password",
    "verify_store_access",
]
