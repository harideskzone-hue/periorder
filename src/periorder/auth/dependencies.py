"""FastAPI authentication and tenant authorization dependencies."""

from __future__ import annotations

from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from periorder.auth.security import decode_access_token
from periorder.db.models import StoreModel, TenantModel, UserModel
from periorder.db.repositories import StoreRepository, TenantRepository, UserRepository
from periorder.db.session import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_current_user(
    token: Annotated[str | None, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> UserModel:
    """Validate JWT token from Authorization header and return authenticated UserModel."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(token)
        user_id: str | None = payload.get("sub")
        tenant_id: str | None = payload.get("tenant_id")
        if not user_id or not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token claims: missing user or tenant identity.",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token signature or format.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    user_repo = UserRepository(db)
    user = user_repo.get_by_user_id(user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive or not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Cross-check token tenant claim against current database user tenant
    if user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cross-tenant mismatch detected between token and user profile.",
        )

    return user


def get_current_tenant(
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> TenantModel:
    """Resolve and verify the active TenantModel for the logged-in user."""
    tenant_repo = TenantRepository(db)
    tenant = tenant_repo.get_by_tenant_id(current_user.tenant_id)
    if not tenant or not tenant.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant organization account is inactive or suspended.",
        )
    return tenant


def verify_store_access(
    store_id: str,
    current_user: UserModel,
    db: Session,
) -> StoreModel:
    """Core verification ensuring store belongs strictly to user's tenant and user has access."""
    store_repo = StoreRepository(db)
    # Query strictly scoped by current_user.tenant_id
    store = store_repo.get_by_store_id(current_user.tenant_id, store_id)
    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Store '{store_id}' not found in active tenant organization.",
        )

    if not store.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Store '{store_id}' is inactive.",
        )

    # TENANT_ADMIN and OWNER have organization-wide access to all stores
    if current_user.role in ("OWNER", "TENANT_ADMIN"):
        return store

    # Other roles (e.g. STORE_MANAGER) require explicit membership
    authorized_store_ids = {m.store.store_id for m in current_user.memberships if m.store}
    if store.store_id not in authorized_store_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User is not authorized to manage store '{store_id}'.",
        )

    return store
