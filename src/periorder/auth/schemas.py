"""Pydantic schemas for authentication and authorization."""

from __future__ import annotations

import datetime

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=255, description="Tenant organization name")
    email: str = Field(..., min_length=5, max_length=255, description="Owner/Admin email address")
    password: str = Field(..., min_length=6, max_length=128, description="Account password")
    full_name: str = Field(..., min_length=2, max_length=255, description="User full name")
    plan_tier: str = Field(default="standard", description="Subscription tier (standard, enterprise, pilot)")
    initial_store_name: str | None = Field(default=None, description="Optional default branch name")
    initial_store_location: str | None = Field(default=None, description="Optional default branch location")


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    tenant_id: str
    user_id: str
    role: str
    email: str
    full_name: str


class UserResponse(BaseModel):
    user_id: str
    email: str
    full_name: str
    role: str
    tenant_id: str
    is_active: bool
    created_at: datetime.datetime


class TenantResponse(BaseModel):
    tenant_id: str
    business_name: str
    plan_tier: str
    is_active: bool
