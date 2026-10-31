"""Persistent Inventory Movement Ledger for auditability and real-time stock reconciliation."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from periorder.db.models import InventoryMovementModel, StoreModel
from periorder.db.unit_of_work import UnitOfWork


class MovementType(str, Enum):
    PURCHASE_RECEIPT = "purchase_receipt"
    POS_SALE = "pos_sale"
    WASTE_EXPIRED = "waste_expired"
    DAMAGE = "damage"
    STOCK_CORRECTION = "stock_correction"


@dataclass
class InventoryMovement:
    movement_id: str
    tenant_id: str
    store_id: str
    product_id: str
    movement_type: MovementType | str
    quantity: int  # Positive for receipts/additions, negative for sales/waste/deductions
    reference_id: str | None = None  # e.g., POS transaction ID or PO number
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))
    notes: str | None = None


class InventoryLedger:
    """Immutable, append-only transaction ledger tracking all physical inventory movements.

    Supports database persistence through UnitOfWork while maintaining 100% backward
    compatibility with in-memory execution for testing and research simulations.
    """

    def __init__(
        self,
        session_factory: sessionmaker[Session] | None = None,
    ) -> None:
        self._session_factory = session_factory
        self._movements: list[InventoryMovement] = []
        # In-memory fast cache: (tenant_id, store_id, product_id) -> stock count
        self._stock_cache: dict[tuple[str, str, str], int] = {}

    def _verify_tenant_store_scope(
        self,
        tenant_id: str,
        store_id: str,
        uow: UnitOfWork | None = None,
    ) -> None:
        """Enforce strict tenant scoping: reject access if store belongs to another tenant."""
        if uow is not None and uow.session is not None:
            self._check_scope_in_session(uow.session, tenant_id, store_id)
            return

        if self._session_factory is not None:
            with UnitOfWork(session_factory=self._session_factory) as check_uow:
                assert check_uow.session is not None
                self._check_scope_in_session(check_uow.session, tenant_id, store_id)
            return

        # In-memory fallback verification
        other_tenants = {m.tenant_id for m in self._movements if m.store_id == store_id}
        if other_tenants and tenant_id not in other_tenants:
            raise PermissionError(
                f"Access rejected: Store '{store_id}' belongs to another tenant organization ({other_tenants})."
            )

    @staticmethod
    def _check_scope_in_session(session: Session, tenant_id: str, store_id: str) -> None:
        # Check against registered StoreModel
        stmt_stores = select(StoreModel).where(StoreModel.store_id == store_id)
        stores = list(session.scalars(stmt_stores).all())
        if stores:
            store_tenants = {s.tenant_id for s in stores}
            if tenant_id not in store_tenants:
                raise PermissionError(
                    f"Access rejected: Store '{store_id}' belongs to tenant(s) {store_tenants}, not '{tenant_id}'."
                )

        # Check against existing ledger movements for this store
        stmt_movements = (
            select(InventoryMovementModel.tenant_id)
            .where(InventoryMovementModel.store_id == store_id)
            .distinct()
        )
        movement_tenants = set(session.scalars(stmt_movements).all())
        if movement_tenants and tenant_id not in movement_tenants:
            raise PermissionError(
                f"Access rejected: Store '{store_id}' contains ledger movements belonging to another tenant."
            )

    def record_movement(
        self,
        tenant_id: str,
        store_id: str,
        product_id: str,
        movement_type: MovementType | str,
        quantity: int,
        reference_id: str | None = None,
        notes: str | None = None,
        uow: UnitOfWork | None = None,
    ) -> InventoryMovement:
        """Record an immutable inventory movement.

        If a UnitOfWork is provided, the movement participates in the caller's active
        transaction without committing independently. If no UnitOfWork is provided but
        session_factory is configured, the movement is committed in its own transaction.
        """
        if quantity == 0:
            raise ValueError("Movement quantity cannot be zero; must be positive or negative.")

        self._verify_tenant_store_scope(tenant_id, store_id, uow=uow)

        m_type_str = movement_type.value if isinstance(movement_type, MovementType) else str(movement_type)

        # 1. Database-backed write
        db_id = f"mov_{uuid.uuid4().hex[:10]}"
        if uow is not None:
            # Participate in caller's active UnitOfWork transaction (no independent commit)
            model = uow.inventory_ledger.record_movement(
                tenant_id=tenant_id,
                store_id=store_id,
                product_id=product_id,
                movement_type=m_type_str,
                quantity=quantity,
                reference_id=reference_id,
                notes=notes,
            )
            db_id = str(model.id)
        elif self._session_factory is not None:
            # Standalone database transaction with auto-commit
            with UnitOfWork(session_factory=self._session_factory, auto_commit=True) as local_uow:
                model = local_uow.inventory_ledger.record_movement(
                    tenant_id=tenant_id,
                    store_id=store_id,
                    product_id=product_id,
                    movement_type=m_type_str,
                    quantity=quantity,
                    reference_id=reference_id,
                    notes=notes,
                )
                db_id = str(model.id)

        # 2. Maintain in-memory movement and cache
        movement = InventoryMovement(
            movement_id=db_id,
            tenant_id=tenant_id,
            store_id=store_id,
            product_id=product_id,
            movement_type=movement_type,
            quantity=quantity,
            reference_id=reference_id,
            notes=notes,
        )
        self._movements.append(movement)

        key = (tenant_id, store_id, product_id)
        current = self._stock_cache.get(key, 0)
        self._stock_cache[key] = current + quantity

        return movement

    def record_correction(
        self,
        tenant_id: str,
        store_id: str,
        product_id: str,
        corrected_quantity: int,
        reference_id: str | None = None,
        reason: str | None = None,
        uow: UnitOfWork | None = None,
    ) -> InventoryMovement | None:
        """Append-only physical stock correction.

        Calculates the delta between current reconciled stock and target physical count,
        then appends a new STOCK_CORRECTION movement. Never modifies historical rows.
        """
        current_stock = self.get_stock(tenant_id, store_id, product_id, uow=uow)
        delta = corrected_quantity - current_stock
        if delta == 0:
            return None

        note = f"Stock correction: adjusted from {current_stock} to {corrected_quantity} (delta: {delta:+d})."
        if reason:
            note += f" Reason: {reason}"

        return self.record_movement(
            tenant_id=tenant_id,
            store_id=store_id,
            product_id=product_id,
            movement_type=MovementType.STOCK_CORRECTION,
            quantity=delta,
            reference_id=reference_id,
            notes=note,
            uow=uow,
        )

    def get_stock(
        self,
        tenant_id: str,
        store_id: str,
        product_id: str,
        uow: UnitOfWork | None = None,
    ) -> int:
        """Return authoritative stock reconciled from the database or in-memory cache."""
        self._verify_tenant_store_scope(tenant_id, store_id, uow=uow)

        if uow is not None:
            return uow.inventory_ledger.get_current_stock(tenant_id, store_id, product_id)

        if self._session_factory is not None:
            with UnitOfWork(session_factory=self._session_factory) as local_uow:
                return local_uow.inventory_ledger.get_current_stock(tenant_id, store_id, product_id)

        return self._stock_cache.get((tenant_id, store_id, product_id), 0)

    def get_movements(
        self,
        tenant_id: str,
        store_id: str,
        product_id: str | None = None,
        limit: int = 50,
        uow: UnitOfWork | None = None,
    ) -> list[InventoryMovement]:
        """Return movement history strictly scoped to tenant and store, ordered chronologically descending."""
        self._verify_tenant_store_scope(tenant_id, store_id, uow=uow)

        if uow is not None:
            models = uow.inventory_ledger.list_movements(tenant_id, store_id, product_id=product_id, limit=limit)
            return [self._map_model_to_movement(m) for m in models]

        if self._session_factory is not None:
            with UnitOfWork(session_factory=self._session_factory) as local_uow:
                models = local_uow.inventory_ledger.list_movements(
                    tenant_id, store_id, product_id=product_id, limit=limit
                )
                return [self._map_model_to_movement(m) for m in models]

        results = [
            m
            for m in self._movements
            if m.tenant_id == tenant_id
            and m.store_id == store_id
            and (product_id is None or m.product_id == product_id)
        ]
        return sorted(results, key=lambda m: m.timestamp, reverse=True)[:limit]

    def rollback_movement(self, movement: InventoryMovement) -> None:
        """Roll back in-memory tracking in case an ingestion transaction fails."""
        if movement in self._movements:
            self._movements.remove(movement)
            key = (movement.tenant_id, movement.store_id, movement.product_id)
            if key in self._stock_cache:
                self._stock_cache[key] -= movement.quantity

    @staticmethod
    def _map_model_to_movement(model: InventoryMovementModel) -> InventoryMovement:
        m_type: MovementType | str = model.movement_type
        for val in MovementType:
            if val.value == model.movement_type:
                m_type = val
                break

        return InventoryMovement(
            movement_id=str(model.id),
            tenant_id=model.tenant_id,
            store_id=model.store_id,
            product_id=model.product_id,
            movement_type=m_type,
            quantity=model.quantity,
            reference_id=model.reference_id,
            timestamp=model.created_at,
            notes=model.notes,
        )
