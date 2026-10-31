"""Tests for Authentication, Password Security, JWT Tokens, and Cross-Tenant Authorization."""

from __future__ import annotations

import datetime
import os
import uuid

import jwt
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from api.main import app
from periorder.auth import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
    verify_store_access,
)
from periorder.db import (
    StoreMembershipModel,
    StoreRepository,
    TenantRepository,
    UserRepository,
    create_app_engine,
    init_db,
)
from periorder.db.session import get_db

TEST_AUTH_DB = "./test_periorder_auth.db"


@pytest.fixture(scope="module")
def auth_engine():
    """Isolated SQLite engine for authentication tests."""
    if os.path.exists(TEST_AUTH_DB):
        os.remove(TEST_AUTH_DB)

    engine = create_app_engine(database_url=f"sqlite:///{TEST_AUTH_DB}")
    init_db(engine)
    yield engine

    if os.path.exists(TEST_AUTH_DB):
        try:
            os.remove(TEST_AUTH_DB)
        except OSError:
            pass


@pytest.fixture
def auth_session(auth_engine):
    """Provides an isolated database session per test."""
    session_factory = sessionmaker(bind=auth_engine, autocommit=False, autoflush=False)
    session = session_factory()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def client(auth_session: Session):
    """TestClient overriding get_db dependency to point to the test session."""
    def _override_get_db():
        try:
            yield auth_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.clear()


# ---------------------------------------------------------
# Stage 1: Password Hashing & JWT Utilities Tests
# ---------------------------------------------------------


def test_password_hashing_and_verification():
    """Verify that bcrypt hashes are salted, irreversible, and correctly verified."""
    raw_pw = "SuperSecretPassword123!"
    hashed = hash_password(raw_pw)

    assert hashed != raw_pw
    assert hashed.startswith(("$2b$", "$2a$"))

    # Correct password succeeds
    assert verify_password(raw_pw, hashed) is True

    # Incorrect password fails
    assert verify_password("WrongPassword123!", hashed) is False
    assert verify_password("", hashed) is False


def test_jwt_token_creation_and_claims():
    """Verify JWT access token issuance, expiration, and payload decoding."""
    payload = {
        "sub": "usr_test_123",
        "tenant_id": "tnt_alpha_456",
        "email": "user@alpha.com",
        "role": "OWNER",
    }
    token = create_access_token(payload, expires_delta=datetime.timedelta(hours=2))
    assert isinstance(token, str)

    decoded = decode_access_token(token)
    assert decoded["sub"] == "usr_test_123"
    assert decoded["tenant_id"] == "tnt_alpha_456"
    assert decoded["role"] == "OWNER"
    assert "exp" in decoded
    assert "iat" in decoded


def test_jwt_expired_token_rejected():
    """Verify that expired JWT tokens raise an expired exception."""
    payload = {"sub": "usr_expired", "tenant_id": "tnt_expired"}
    expired_token = create_access_token(payload, expires_delta=datetime.timedelta(seconds=-10))

    with pytest.raises(jwt.ExpiredSignatureError):
        decode_access_token(expired_token)


# ---------------------------------------------------------
# Stage 2 & 3: Registration, Login & Profile Endpoints
# ---------------------------------------------------------


def test_register_and_login_flow(client: TestClient):
    """Test full registration, login, and profile inspection flow."""
    unique_suffix = uuid.uuid4().hex[:6]
    email = f"owner_{unique_suffix}@harvestco.com"
    reg_payload = {
        "business_name": "Harvest Organic Co",
        "email": email,
        "password": "StrongPassword2026!",
        "full_name": "Eleanor Harvest",
        "plan_tier": "standard",
        "initial_store_name": "Austin Flagship",
        "initial_store_location": "Austin, TX",
    }

    # 1. Register new tenant and owner
    reg_res = client.post("/api/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    data = reg_res.json()
    assert "access_token" in data
    assert data["email"] == email
    assert data["role"] == "OWNER"
    tenant_id = data["tenant_id"]
    token = data["access_token"]

    # 2. Reject duplicate email registration
    dup_res = client.post("/api/auth/register", json=reg_payload)
    assert dup_res.status_code == 400
    assert "already exists" in dup_res.json()["detail"]

    # 3. Login with correct credentials
    login_res = client.post(
        "/api/auth/login",
        json={"email": email, "password": "StrongPassword2026!"},
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert login_data["tenant_id"] == tenant_id
    assert "access_token" in login_data

    # 4. Login with invalid password
    bad_login = client.post(
        "/api/auth/login",
        json={"email": email, "password": "WrongPassword!"},
    )
    assert bad_login.status_code == 401

    # 5. Get current user profile (/api/auth/me)
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["email"] == email
    assert me_data["tenant_id"] == tenant_id
    assert me_data["full_name"] == "Eleanor Harvest"

    # 6. Unauthenticated request to /api/auth/me is rejected
    unauth_res = client.get("/api/auth/me")
    assert unauth_res.status_code == 401

    # 7. Get tenant details (/api/auth/tenant)
    tnt_res = client.get("/api/auth/tenant", headers={"Authorization": f"Bearer {token}"})
    assert tnt_res.status_code == 200
    assert tnt_res.json()["business_name"] == "Harvest Organic Co"


# ---------------------------------------------------------
# Stage 4: Strict Cross-Tenant Isolation Tests
# ---------------------------------------------------------


def test_cross_tenant_store_access_strictly_prevented(auth_session: Session):
    """Verify that a user from Tenant A cannot access, query, or mutate stores belonging to Tenant B."""
    tenant_repo = TenantRepository(auth_session)
    store_repo = StoreRepository(auth_session)
    user_repo = UserRepository(auth_session)

    # Tenant Alpha
    tenant_repo.create(tenant_id="tenant_alpha", business_name="Alpha Foods")
    store_alpha = store_repo.create(
        tenant_id="tenant_alpha", store_id="STORE_ALPHA_1", store_name="Alpha Store", location="City A"
    )
    user_alpha = user_repo.create(
        tenant_id="tenant_alpha",
        user_id="usr_alpha_owner",
        email="owner@alpha.com",
        hashed_password="hashed_pw",
        full_name="Alpha Owner",
        role="OWNER",
    )

    # Tenant Beta
    tenant_repo.create(tenant_id="tenant_beta", business_name="Beta Groceries")
    store_repo.create(
        tenant_id="tenant_beta", store_id="STORE_BETA_1", store_name="Beta Store", location="City B"
    )
    user_beta = user_repo.create(
        tenant_id="tenant_beta",
        user_id="usr_beta_owner",
        email="owner@beta.com",
        hashed_password="hashed_pw",
        full_name="Beta Owner",
        role="OWNER",
    )
    auth_session.commit()

    # User Alpha can access their own store
    verified = verify_store_access("STORE_ALPHA_1", user_alpha, auth_session)
    assert verified.id == store_alpha.id

    # User Alpha attempts to access Tenant Beta's store -> HTTP 404 (store not in tenant)
    with pytest.raises(HTTPException) as exc_info:
        verify_store_access("STORE_BETA_1", user_alpha, auth_session)
    assert exc_info.value.status_code == 404

    # User Beta attempts to access Tenant Alpha's store -> HTTP 404
    with pytest.raises(HTTPException) as exc_info:
        verify_store_access("STORE_ALPHA_1", user_beta, auth_session)
    assert exc_info.value.status_code == 404


def test_store_manager_role_membership_enforcement(auth_session: Session):
    """Verify that a STORE_MANAGER is restricted only to assigned store branches within the same tenant."""
    tenant_repo = TenantRepository(auth_session)
    store_repo = StoreRepository(auth_session)
    user_repo = UserRepository(auth_session)

    tenant_repo.create(tenant_id="tenant_gamma", business_name="Gamma Supermarkets")
    store_g1 = store_repo.create(
        tenant_id="tenant_gamma", store_id="GAMMA_NORTH", store_name="North Branch", location="North"
    )
    store_repo.create(
        tenant_id="tenant_gamma", store_id="GAMMA_SOUTH", store_name="South Branch", location="South"
    )

    # Manager assigned ONLY to North Branch
    mgr_north = user_repo.create(
        tenant_id="tenant_gamma",
        user_id="usr_mgr_north",
        email="mgr_north@gamma.com",
        hashed_password="hashed_pw",
        full_name="North Manager",
        role="STORE_MANAGER",
    )
    auth_session.commit()

    # Assign membership to GAMMA_NORTH only
    membership = StoreMembershipModel(
        user_id=mgr_north.id,
        store_id=store_g1.id,
        role="STORE_MANAGER",
        is_default=True,
    )
    auth_session.add(membership)
    auth_session.commit()

    # Access to GAMMA_NORTH succeeds
    assert verify_store_access("GAMMA_NORTH", mgr_north, auth_session).store_id == "GAMMA_NORTH"

    # Access to GAMMA_SOUTH is forbidden (403 Forbidden)
    with pytest.raises(HTTPException) as exc_info:
        verify_store_access("GAMMA_SOUTH", mgr_north, auth_session)
    assert exc_info.value.status_code == 403
    assert "not authorized to manage store" in exc_info.value.detail
