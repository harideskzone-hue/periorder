"""Multi-tenant data models for PeriOrder platform."""

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum


class UserRole(str, Enum):
    OWNER = "owner"
    STORE_MANAGER = "store_manager"
    INVENTORY_OPERATOR = "inventory_operator"
    VIEWER = "viewer"


@dataclass
class Tenant:
    tenant_id: str
    business_name: str
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    is_active: bool = True


@dataclass
class Store:
    store_id: str
    tenant_id: str
    store_name: str
    location: str
    currency: str = "USD"
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    pos_connected: bool = False
    pos_provider: str | None = None


@dataclass
class User:
    user_id: str
    tenant_id: str
    email: str
    name: str
    role: UserRole
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
