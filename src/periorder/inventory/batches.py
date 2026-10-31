"""Perishable batch tracking with FIFO expiration handling and PostgreSQL database persistence."""

from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from periorder.db.models import InventoryBatchModel, StoreModel
from periorder.db.unit_of_work import UnitOfWork


@dataclass
class InventoryBatch:
    batch_id: str
    tenant_id: str
    store_id: str
    product_id: str
    quantity: int
    received_date: date | datetime
    expiry_date: date | datetime
    unit_cost: float = 0.0
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    @property
    def is_expired(self) -> bool:
        exp = self.expiry_date.date() if isinstance(self.expiry_date, datetime) else self.expiry_date
        return date.today() > exp

    @property
    def days_until_expiry(self) -> int:
        exp = self.expiry_date.date() if isinstance(self.expiry_date, datetime) else self.expiry_date
        return (exp - date.today()).days

    @classmethod
    def from_model(cls, model: Any) -> InventoryBatch:
        recv = model.received_date.date() if isinstance(model.received_date, datetime) else model.received_date
        exp = model.expiry_date.date() if isinstance(model.expiry_date, datetime) else model.expiry_date
        return cls(
            batch_id=model.batch_id,
            tenant_id=model.tenant_id,
            store_id=model.store_id,
            product_id=model.product_id,
            quantity=model.remaining_quantity,
            received_date=recv,
            expiry_date=exp,
            unit_cost=float(model.unit_cost),
            created_at=model.created_at if model.created_at else datetime.now(UTC),
        )


@dataclass
class BatchDeduction:
    batch_id: str
    product_id: str
    deducted_quantity: int
    remaining_in_batch: int
    expiry_date: date | datetime


class BatchTracker:
    """Tracks physical inventory batches and executes First-In, First-Out (FIFO) consumption.

    Supports database persistence through UnitOfWork while maintaining 100% backward
    compatibility with in-memory execution for testing and research simulations.
    """

    _lock = threading.RLock()

    def __init__(
        self,
        session_factory: sessionmaker[Session] | None = None,
    ) -> None:
        self._session_factory = session_factory
        self._batches: dict[str, InventoryBatch] = {}

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
        other_tenants = {b.tenant_id for b in self._batches.values() if b.store_id == store_id}
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

        # Check against existing batches for this store
        stmt_batches = (
            select(InventoryBatchModel.tenant_id)
            .where(InventoryBatchModel.store_id == store_id)
            .distinct()
        )
        batch_tenants = set(session.scalars(stmt_batches).all())
        if batch_tenants and tenant_id not in batch_tenants:
            raise PermissionError(
                f"Access rejected: Store '{store_id}' contains batches belonging to another tenant."
            )

    def receive_batch(
        self,
        tenant_id: str,
        store_id: str,
        product_id: str,
        quantity: int,
        shelf_life_days: int,
        unit_cost: float = 0.0,
        received_date: date | datetime | None = None,
        uow: UnitOfWork | None = None,
        batch_id: str | None = None,
    ) -> InventoryBatch:
        """Records delivery of a new perishable batch with computed expiry date."""
        if quantity <= 0:
            raise ValueError("Batch received quantity must be greater than zero.")
        if shelf_life_days < 1:
            raise ValueError("Batch shelf life must be at least 1 day.")

        self._verify_tenant_store_scope(tenant_id, store_id, uow=uow)

        now = datetime.now(UTC)
        if received_date is None:
            recv_dt = now
            today_date = date.today()
        elif isinstance(received_date, datetime):
            recv_dt = received_date if received_date.tzinfo else received_date.replace(tzinfo=UTC)
            today_date = recv_dt.date()
        else:
            today_date = received_date
            recv_dt = datetime(today_date.year, today_date.month, today_date.day, tzinfo=UTC)

        exp_date = today_date + timedelta(days=shelf_life_days)

        if uow is not None:
            # Caller's active transaction boundary
            model = uow.batches.receive_batch(
                tenant_id=tenant_id,
                store_id=store_id,
                product_id=product_id,
                quantity=quantity,
                shelf_life_days=shelf_life_days,
                unit_cost=unit_cost,
                received_date=recv_dt,
                batch_id=batch_id,
            )
            return InventoryBatch.from_model(model)
        elif self._session_factory is not None:
            # Standalone auto-committed database transaction
            with UnitOfWork(session_factory=self._session_factory, auto_commit=True) as local_uow:
                model = local_uow.batches.receive_batch(
                    tenant_id=tenant_id,
                    store_id=store_id,
                    product_id=product_id,
                    quantity=quantity,
                    shelf_life_days=shelf_life_days,
                    unit_cost=unit_cost,
                    received_date=recv_dt,
                    batch_id=batch_id,
                )
                return InventoryBatch.from_model(model)
        else:
            # In-memory mode fallback
            b_id = batch_id or f"batch_{uuid.uuid4().hex[:10]}"
            batch = InventoryBatch(
                batch_id=b_id,
                tenant_id=tenant_id,
                store_id=store_id,
                product_id=product_id,
                quantity=quantity,
                received_date=today_date,
                expiry_date=exp_date,
                unit_cost=unit_cost,
                created_at=now,
            )
            self._batches[batch.batch_id] = batch
            return batch

    def deduct_fifo(
        self,
        tenant_id: str,
        store_id: str,
        product_id: str,
        quantity_to_deduct: int,
        uow: UnitOfWork | None = None,
        for_update: bool = True,
    ) -> list[BatchDeduction]:
        """Consumes stock following FIFO (earliest expiry date first) with row-level locking."""
        if quantity_to_deduct <= 0:
            return []

        with self._lock:
            self._verify_tenant_store_scope(tenant_id, store_id, uow=uow)

            if uow is not None:
                # Participate directly in caller's active transaction
                records = uow.batches.deduct_fifo_records(
                    tenant_id=tenant_id,
                    store_id=store_id,
                    product_id=product_id,
                    quantity_to_deduct=quantity_to_deduct,
                    for_update=for_update,
                )
                deductions = self._build_deductions_from_records(records, product_id)
                if self._batches:
                    self._deduct_in_memory(tenant_id, store_id, product_id, quantity_to_deduct)
                return deductions
            elif self._session_factory is not None:
                # Standalone auto-committed database transaction
                with UnitOfWork(session_factory=self._session_factory, auto_commit=True) as local_uow:
                    records = local_uow.batches.deduct_fifo_records(
                        tenant_id=tenant_id,
                        store_id=store_id,
                        product_id=product_id,
                        quantity_to_deduct=quantity_to_deduct,
                        for_update=for_update,
                    )
                    return self._build_deductions_from_records(records, product_id)
            else:
                # In-memory FIFO consumption
                return self._deduct_in_memory(tenant_id, store_id, product_id, quantity_to_deduct)

    def _deduct_in_memory(
        self,
        tenant_id: str,
        store_id: str,
        product_id: str,
        quantity_to_deduct: int,
    ) -> list[BatchDeduction]:
        active_batches = [
            b
            for b in self._batches.values()
            if b.tenant_id == tenant_id
            and b.store_id == store_id
            and b.product_id == product_id
            and b.quantity > 0
        ]
        active_batches.sort(key=lambda b: (b.expiry_date, b.received_date))

        remaining_to_deduct = quantity_to_deduct
        deductions: list[BatchDeduction] = []

        for batch in active_batches:
            if remaining_to_deduct <= 0:
                break
            take = min(batch.quantity, remaining_to_deduct)
            batch.quantity -= take
            remaining_to_deduct -= take
            deductions.append(
                BatchDeduction(
                    batch_id=batch.batch_id,
                    product_id=product_id,
                    deducted_quantity=take,
                    remaining_in_batch=batch.quantity,
                    expiry_date=batch.expiry_date,
                )
            )

        return deductions

    @staticmethod
    def _build_deductions_from_records(
        records: list[tuple[InventoryBatchModel, int]],
        product_id: str,
    ) -> list[BatchDeduction]:
        deductions: list[BatchDeduction] = []
        for model, deducted_qty in records:
            exp = model.expiry_date.date() if isinstance(model.expiry_date, datetime) else model.expiry_date
            deductions.append(
                BatchDeduction(
                    batch_id=model.batch_id,
                    product_id=product_id,
                    deducted_quantity=deducted_qty,
                    remaining_in_batch=model.remaining_quantity,
                    expiry_date=exp,
                )
            )
        return deductions

    def get_batches(
        self,
        tenant_id: str,
        store_id: str,
        product_id: str | None = None,
        uow: UnitOfWork | None = None,
    ) -> list[InventoryBatch]:
        """Returns batches with available stock for a tenant store."""
        self._verify_tenant_store_scope(tenant_id, store_id, uow=uow)

        if uow is not None:
            models = uow.batches.get_active_batches(tenant_id, store_id, product_id)
            return [InventoryBatch.from_model(m) for m in models]
        elif self._session_factory is not None:
            with UnitOfWork(session_factory=self._session_factory) as local_uow:
                models = local_uow.batches.get_active_batches(tenant_id, store_id, product_id)
                return [InventoryBatch.from_model(m) for m in models]
        else:
            return [
                b
                for b in self._batches.values()
                if b.tenant_id == tenant_id
                and b.store_id == store_id
                and (product_id is None or b.product_id == product_id)
                and b.quantity > 0
            ]

    def get_active_batches(
        self,
        tenant_id: str,
        store_id: str,
        product_id: str | None = None,
        uow: UnitOfWork | None = None,
    ) -> list[InventoryBatch]:
        """Alias for get_batches."""
        return self.get_batches(tenant_id, store_id, product_id, uow=uow)

    def get_expiring_soon(
        self,
        tenant_id: str,
        store_id: str,
        within_days: int = 2,
        uow: UnitOfWork | None = None,
    ) -> list[InventoryBatch]:
        """Identifies batches expiring within the specified threshold."""
        self._verify_tenant_store_scope(tenant_id, store_id, uow=uow)

        if uow is not None:
            models = uow.batches.get_expiring_soon(tenant_id, store_id, within_days)
            return [InventoryBatch.from_model(m) for m in models]
        elif self._session_factory is not None:
            with UnitOfWork(session_factory=self._session_factory) as local_uow:
                models = local_uow.batches.get_expiring_soon(tenant_id, store_id, within_days)
                return [InventoryBatch.from_model(m) for m in models]
        else:
            batches = self.get_batches(tenant_id, store_id)
            return [b for b in batches if 0 <= b.days_until_expiry <= within_days]

    def get_expiring_batches(
        self,
        tenant_id: str,
        store_id: str,
        within_days: int = 2,
        uow: UnitOfWork | None = None,
    ) -> list[InventoryBatch]:
        """Alias for get_expiring_soon."""
        return self.get_expiring_soon(tenant_id, store_id, within_days, uow=uow)

    def get_batch_inventory_valuation(
        self,
        tenant_id: str,
        store_id: str,
        product_id: str | None = None,
        uow: UnitOfWork | None = None,
    ) -> float:
        """Calculates total monetary value (remaining_quantity * unit_cost) of active batches."""
        self._verify_tenant_store_scope(tenant_id, store_id, uow=uow)

        if uow is not None:
            return uow.batches.get_batch_inventory_valuation(tenant_id, store_id, product_id)
        elif self._session_factory is not None:
            with UnitOfWork(session_factory=self._session_factory) as local_uow:
                return local_uow.batches.get_batch_inventory_valuation(tenant_id, store_id, product_id)
        else:
            batches = self.get_batches(tenant_id, store_id, product_id)
            return sum(b.quantity * b.unit_cost for b in batches)

    def restore_deductions(
        self,
        deductions: list[BatchDeduction],
        uow: UnitOfWork | None = None,
    ) -> None:
        """Restores deducted batch quantities in case an ingestion transaction fails."""
        if not deductions:
            return

        # Restore in-memory batches if present
        for ded in deductions:
            if ded.batch_id in self._batches:
                self._batches[ded.batch_id].quantity += ded.deducted_quantity

        # Restore DB models if explicit uow provided
        if uow is not None and uow.session is not None:
            for ded in deductions:
                stmt = select(InventoryBatchModel).where(InventoryBatchModel.batch_id == ded.batch_id)
                model = uow.session.scalars(stmt).first()
                if model:
                    model.remaining_quantity += ded.deducted_quantity
                    if model.remaining_quantity > 0:
                        model.is_exhausted = False
            uow.session.flush()

