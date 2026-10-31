"""Authentication and Tenant API router."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from periorder.auth.dependencies import get_current_tenant, get_current_user
from periorder.auth.schemas import (
    LoginRequest,
    RegisterRequest,
    TenantResponse,
    TokenResponse,
    UserResponse,
)
from periorder.auth.security import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    hash_password,
    verify_password,
)
from periorder.db.models import StoreMembershipModel, TenantModel, UserModel
from periorder.db.repositories import StoreRepository, TenantRepository, UserRepository
from periorder.db.session import get_db

auth_router = APIRouter(prefix="/api/auth", tags=["Authentication & Multi-Tenant"])


@auth_router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(
    request: RegisterRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    """Register a new business organization (tenant) and its primary administrator account."""
    user_repo = UserRepository(db)
    tenant_repo = TenantRepository(db)
    store_repo = StoreRepository(db)

    # Check if email is already in use
    existing_user = user_repo.get_by_email(request.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    # Generate unique tenant ID and user ID
    tenant_id = f"tnt_{uuid.uuid4().hex[:8]}"
    user_id = f"usr_{uuid.uuid4().hex[:8]}"

    # 1. Create Tenant
    tenant = tenant_repo.create(
        tenant_id=tenant_id,
        business_name=request.business_name.strip(),
        plan_tier=request.plan_tier,
    )

    # 2. Hash password and create Owner User
    hashed_pw = hash_password(request.password)
    user = user_repo.create(
        tenant_id=tenant_id,
        user_id=user_id,
        email=request.email,
        hashed_password=hashed_pw,
        full_name=request.full_name.strip(),
        role="OWNER",
    )

    # 3. Create initial store if requested
    if request.initial_store_name:
        store_id = f"str_{uuid.uuid4().hex[:6]}"
        store = store_repo.create(
            tenant_id=tenant_id,
            store_id=store_id,
            store_name=request.initial_store_name.strip(),
            location=request.initial_store_location.strip() if request.initial_store_location else "Main Branch",
        )
        membership = StoreMembershipModel(
            user_id=user.id,
            store_id=store.id,
            role="OWNER",
            is_default=True,
        )
        db.add(membership)

    db.commit()

    # 4. Generate JWT access token
    token = create_access_token(
        data={
            "sub": user.user_id,
            "tenant_id": tenant.tenant_id,
            "email": user.email,
            "role": user.role,
        }
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in_minutes=ACCESS_TOKEN_EXPIRE_MINUTES,
        tenant_id=tenant.tenant_id,
        user_id=user.user_id,
        role=user.role,
        email=user.email,
        full_name=user.full_name,
    )


@auth_router.post("/login", response_model=TokenResponse)
def login(
    request: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    """Authenticate with email and password, issuing a signed JWT access token."""
    user_repo = UserRepository(db)
    user = user_repo.get_by_email(request.email)
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account has been disabled.",
        )

    tenant_repo = TenantRepository(db)
    tenant = tenant_repo.get_by_tenant_id(user.tenant_id)
    if not tenant or not tenant.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant organization has been suspended.",
        )

    token = create_access_token(
        data={
            "sub": user.user_id,
            "tenant_id": user.tenant_id,
            "email": user.email,
            "role": user.role,
        }
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in_minutes=ACCESS_TOKEN_EXPIRE_MINUTES,
        tenant_id=user.tenant_id,
        user_id=user.user_id,
        role=user.role,
        email=user.email,
        full_name=user.full_name,
    )


@auth_router.get("/me", response_model=UserResponse)
def get_me(current_user: Annotated[UserModel, Depends(get_current_user)]) -> UserResponse:
    """Return profile details for the currently authenticated user."""
    return UserResponse(
        user_id=current_user.user_id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        tenant_id=current_user.tenant_id,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
    )


@auth_router.get("/tenant", response_model=TenantResponse)
def get_tenant(current_tenant: Annotated[TenantModel, Depends(get_current_tenant)]) -> TenantResponse:
    """Return organization details for the authenticated user's tenant."""
    return TenantResponse(
        tenant_id=current_tenant.tenant_id,
        business_name=current_tenant.business_name,
        plan_tier=current_tenant.plan_tier,
        is_active=current_tenant.is_active,
    )
