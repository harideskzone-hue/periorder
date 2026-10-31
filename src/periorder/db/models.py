"""SQLAlchemy 2.0 Relational Database Models for PeriOrder.

Enforces:
- UUID primary keys (using platform-independent GUID)
- Tenant-scoped data isolation & foreign keys
- Unique POS transaction identity per store and tenant
- Non-negative inventory quantities & CheckConstraints
- Immutable movement ledger with audit timestamps
- Comprehensive indexing on tenant, store, product, and transaction lookups
"""

from __future__ import annotations

import datetime
import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from periorder.db.base import GUID, Base, TimestampMixin


class TenantModel(Base, TimestampMixin):
    """Business entity / organization owning multiple retail stores."""

    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    business_name: Mapped[str] = mapped_column(String(255), nullable=False)
    plan_tier: Mapped[str] = mapped_column(String(32), default="standard", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    stores: Mapped[list[StoreModel]] = relationship("StoreModel", back_populates="tenant", cascade="all, delete-orphan")
    users: Mapped[list[UserModel]] = relationship("UserModel", back_populates="tenant", cascade="all, delete-orphan")


class StoreModel(Base, TimestampMixin):
    """Individual retail branch or supermarket outlet within a tenant."""

    __tablename__ = "stores"
    __table_args__ = (
        UniqueConstraint("tenant_id", "store_id", name="uq_tenant_store_id"),
        Index("ix_stores_tenant_store", "tenant_id", "store_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[str] = mapped_column(String(64), ForeignKey("tenants.tenant_id", ondelete="CASCADE"), nullable=False)
    store_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    store_name: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(64), default="Grocery Store", nullable=False)
    pos_connected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    pos_provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    tenant: Mapped[TenantModel] = relationship("TenantModel", back_populates="stores")
    memberships: Mapped[list[StoreMembershipModel]] = relationship("StoreMembershipModel", back_populates="store", cascade="all, delete-orphan")
    profile: Mapped[ShopProfileModel | None] = relationship("ShopProfileModel", back_populates="store", uselist=False, cascade="all, delete-orphan")


class UserModel(Base, TimestampMixin):
    """User account associated with a tenant and authorized for specific roles."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[str] = mapped_column(String(64), ForeignKey("tenants.tenant_id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), default="STORE_MANAGER", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    tenant: Mapped[TenantModel] = relationship("TenantModel", back_populates="users")
    memberships: Mapped[list[StoreMembershipModel]] = relationship("StoreMembershipModel", back_populates="user", cascade="all, delete-orphan")


class StoreMembershipModel(Base):
    """Associates users with specific store permissions."""

    __tablename__ = "store_memberships"
    __table_args__ = (
        UniqueConstraint("user_id", "store_id", name="uq_user_store_membership"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    store_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(32), default="STORE_MANAGER", nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user: Mapped[UserModel] = relationship("UserModel", back_populates="memberships")
    store: Mapped[StoreModel] = relationship("StoreModel", back_populates="memberships")


class ShopProfileModel(Base, TimestampMixin):
    """Detailed shop configuration and onboarding attributes for a store."""

    __tablename__ = "shop_profiles"
    __table_args__ = (
        UniqueConstraint("tenant_id", "store_id", name="uq_profile_tenant_store"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    store_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    store_pk: Mapped[uuid.UUID | None] = mapped_column(GUID, ForeignKey("stores.id", ondelete="CASCADE"), nullable=True)

    shop_name: Mapped[str] = mapped_column(String(255), nullable=False)
    owner_name: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[str] = mapped_column(String(64), default="Grocery Store", nullable=False)
    shop_type: Mapped[str] = mapped_column(String(32), default="new", nullable=False)
    opening_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    onboarding_status: Mapped[str] = mapped_column(String(32), default="completed", nullable=False)
    initial_products_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    uploaded_bills_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    store: Mapped[StoreModel | None] = relationship("StoreModel", back_populates="profile")


class InventoryMovementModel(Base):
    """Immutable ledger of all physical stock movements (receipts, sales, spoilage waste)."""

    __tablename__ = "inventory_movements"
    __table_args__ = (
        CheckConstraint("quantity != 0", name="ck_movement_non_zero_qty"),
        Index("ix_movements_tenant_store_prod", "tenant_id", "store_id", "product_id"),
        Index("ix_movements_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    store_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    product_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    movement_type: Mapped[str] = mapped_column(String(32), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    reference_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        server_default=func.now(),
        nullable=False,
    )


class InventoryBatchModel(Base, TimestampMixin):
    """Discrete inventory batch tracked for First-In First-Out (FIFO) shelf-life depletion."""

    __tablename__ = "inventory_batches"
    __table_args__ = (
        CheckConstraint("initial_quantity > 0", name="ck_batch_initial_qty_pos"),
        CheckConstraint("remaining_quantity >= 0", name="ck_batch_remaining_qty_non_neg"),
        CheckConstraint("unit_cost >= 0.0", name="ck_batch_unit_cost_non_neg"),
        CheckConstraint("shelf_life_days >= 1", name="ck_batch_shelf_life_min_one"),
        Index("ix_batches_fifo_lookup", "tenant_id", "store_id", "product_id", "is_exhausted", "received_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    batch_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    store_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    product_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    initial_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    remaining_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_cost: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    shelf_life_days: Mapped[int] = mapped_column(Integer, default=7, nullable=False)
    received_date: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expiry_date: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_exhausted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class POSTransactionModel(Base, TimestampMixin):
    """Audit log of incoming point-of-sale transactions with idempotent deduplication."""

    __tablename__ = "pos_transactions"
    __table_args__ = (
        UniqueConstraint("tenant_id", "store_id", "transaction_id", name="uq_pos_tenant_store_tx"),
        Index("ix_pos_lookup", "tenant_id", "store_id", "transaction_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    store_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    transaction_id: Mapped[str] = mapped_column(String(128), nullable=False)

    raw_payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    items_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="PROCESSED", nullable=False)
    processed_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class BillDocumentModel(Base, TimestampMixin):
    """Archived bill or supplier invoice with OCR extracted lines and verification status."""

    __tablename__ = "bill_documents"
    __table_args__ = (
        Index("ix_bills_tenant_store", "tenant_id", "store_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    document_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    store_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    bill_type: Mapped[str] = mapped_column(String(32), default="purchase", nullable=False)
    party_name: Mapped[str] = mapped_column(String(255), nullable=False)
    invoice_number: Mapped[str] = mapped_column(String(128), nullable=False)
    invoice_date: Mapped[str] = mapped_column(String(32), nullable=False)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    ocr_engine: Mapped[str] = mapped_column(String(128), nullable=False)
    average_confidence: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    extracted_items_json: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="ready_for_confirmation", nullable=False)
