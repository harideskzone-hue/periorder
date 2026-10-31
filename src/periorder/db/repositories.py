"""Repository Layer for Database Persistence and Transaction Isolation.

Provides repository abstractions for tenants, stores, users, ledger movements,
FIFO batch tracking, POS transaction audit logs, and bill documents.
"""

from __future__ import annotations

import datetime
import json
import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from periorder.db.models import (
    BillDocumentModel,
    InventoryBatchModel,
    InventoryMovementModel,
    POSTransactionModel,
    StoreModel,
    TenantModel,
    UserModel,
)


class TenantRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def create(self, tenant_id: str, business_name: str, plan_tier: str = "standard") -> TenantModel:
        tenant = TenantModel(tenant_id=tenant_id, business_name=business_name, plan_tier=plan_tier)
        self.session.add(tenant)
        self.session.flush()
        return tenant

    def get_by_tenant_id(self, tenant_id: str) -> TenantModel | None:
        stmt = select(TenantModel).where(TenantModel.tenant_id == tenant_id)
        return self.session.scalars(stmt).first()

    def list_all(self) -> list[TenantModel]:
        return list(self.session.scalars(select(TenantModel)).all())


class StoreRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def create(
        self,
        tenant_id: str,
        store_id: str,
        store_name: str,
        location: str,
        category: str = "Grocery Store",
    ) -> StoreModel:
        store = StoreModel(
            tenant_id=tenant_id,
            store_id=store_id,
            store_name=store_name,
            location=location,
            category=category,
        )
        self.session.add(store)
        self.session.flush()
        return store

    def get_by_store_id(self, tenant_id: str, store_id: str) -> StoreModel | None:
        stmt = select(StoreModel).where(
            StoreModel.tenant_id == tenant_id,
            StoreModel.store_id == store_id,
        )
        return self.session.scalars(stmt).first()

    def list_for_tenant(self, tenant_id: str) -> list[StoreModel]:
        stmt = select(StoreModel).where(StoreModel.tenant_id == tenant_id)
        return list(self.session.scalars(stmt).all())


class UserRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def create(
        self,
        tenant_id: str,
        user_id: str,
        email: str,
        hashed_password: str,
        full_name: str,
        role: str = "STORE_MANAGER",
    ) -> UserModel:
        user = UserModel(
            tenant_id=tenant_id,
            user_id=user_id,
            email=email.lower().strip(),
            hashed_password=hashed_password,
            full_name=full_name,
            role=role,
        )
        self.session.add(user)
        self.session.flush()
        return user

    def get_by_email(self, email: str) -> UserModel | None:
        stmt = select(UserModel).where(UserModel.email == email.lower().strip())
        return self.session.scalars(stmt).first()

    def get_by_user_id(self, user_id: str) -> UserModel | None:
        stmt = select(UserModel).where(UserModel.user_id == user_id)
        return self.session.scalars(stmt).first()


class InventoryLedgerRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def record_movement(
        self,
        tenant_id: str,
        store_id: str,
        product_id: str,
        movement_type: str,
        quantity: int,
        reference_id: str | None = None,
        notes: str | None = None,
        created_at: datetime.datetime | None = None,
    ) -> InventoryMovementModel:
        movement = InventoryMovementModel(
            tenant_id=tenant_id,
            store_id=store_id,
            product_id=product_id,
            movement_type=movement_type,
            quantity=quantity,
            reference_id=reference_id,
            notes=notes,
            created_at=created_at or datetime.datetime.now(datetime.UTC),
        )
        self.session.add(movement)
        self.session.flush()
        return movement

    def get_current_stock(self, tenant_id: str, store_id: str, product_id: str) -> int:
        stmt = select(func.coalesce(func.sum(InventoryMovementModel.quantity), 0)).where(
            InventoryMovementModel.tenant_id == tenant_id,
            InventoryMovementModel.store_id == store_id,
            InventoryMovementModel.product_id == product_id,
        )
        return int(self.session.scalar(stmt) or 0)

    def list_movements(
        self, tenant_id: str, store_id: str, product_id: str | None = None, limit: int = 100
    ) -> list[InventoryMovementModel]:
        stmt = select(InventoryMovementModel).where(
            InventoryMovementModel.tenant_id == tenant_id,
            InventoryMovementModel.store_id == store_id,
        )
        if product_id:
            stmt = stmt.where(InventoryMovementModel.product_id == product_id)
        stmt = stmt.order_by(
            InventoryMovementModel.created_at.desc(),
            InventoryMovementModel.id.desc(),
        ).limit(limit)
        return list(self.session.scalars(stmt).all())


class BatchRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def receive_batch(
        self,
        tenant_id: str,
        store_id: str,
        product_id: str,
        quantity: int,
        shelf_life_days: int,
        unit_cost: float = 0.0,
        received_date: datetime.datetime | None = None,
    ) -> InventoryBatchModel:
        batch_id = f"BAT_{uuid.uuid4().hex[:8].upper()}"
        recv_dt = received_date or datetime.datetime.now(datetime.UTC)
        exp_dt = recv_dt + datetime.timedelta(days=shelf_life_days)

        batch = InventoryBatchModel(
            batch_id=batch_id,
            tenant_id=tenant_id,
            store_id=store_id,
            product_id=product_id,
            initial_quantity=quantity,
            remaining_quantity=quantity,
            unit_cost=unit_cost,
            shelf_life_days=shelf_life_days,
            received_date=recv_dt,
            expiry_date=exp_dt,
            is_exhausted=False,
        )
        self.session.add(batch)
        self.session.flush()
        return batch

    def get_active_batches_fifo(
        self, tenant_id: str, store_id: str, product_id: str, for_update: bool = False
    ) -> list[InventoryBatchModel]:
        """Fetch unexhausted batches ordered by received_date ascending (FIFO)."""
        stmt = (
            select(InventoryBatchModel)
            .where(
                InventoryBatchModel.tenant_id == tenant_id,
                InventoryBatchModel.store_id == store_id,
                InventoryBatchModel.product_id == product_id,
                InventoryBatchModel.is_exhausted == False,
                InventoryBatchModel.remaining_quantity > 0,
            )
            .order_by(InventoryBatchModel.received_date.asc())
        )
        if for_update:
            stmt = stmt.with_for_update()
        return list(self.session.scalars(stmt).all())

    def deduct_fifo(
        self,
        tenant_id: str,
        store_id: str,
        product_id: str,
        quantity_to_deduct: int,
        for_update: bool = False,
    ) -> int:
        """Deducts units across active FIFO batches. Returns actual quantity deducted."""
        remaining = quantity_to_deduct
        batches = self.get_active_batches_fifo(tenant_id, store_id, product_id, for_update=for_update)

        for b in batches:
            if remaining <= 0:
                break
            available = b.remaining_quantity
            deduct = min(available, remaining)
            b.remaining_quantity -= deduct
            if b.remaining_quantity == 0:
                b.is_exhausted = True
            remaining -= deduct

        self.session.flush()
        return quantity_to_deduct - remaining



class POSTransactionRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def is_duplicate(self, tenant_id: str, store_id: str, transaction_id: str) -> bool:
        stmt = select(func.count(POSTransactionModel.id)).where(
            POSTransactionModel.tenant_id == tenant_id,
            POSTransactionModel.store_id == store_id,
            POSTransactionModel.transaction_id == transaction_id,
        )
        return (self.session.scalar(stmt) or 0) > 0

    def get_transaction(
        self, tenant_id: str, store_id: str, transaction_id: str
    ) -> POSTransactionModel | None:
        stmt = select(POSTransactionModel).where(
            POSTransactionModel.tenant_id == tenant_id,
            POSTransactionModel.store_id == store_id,
            POSTransactionModel.transaction_id == transaction_id,
        )
        return self.session.scalars(stmt).first()

    def record_transaction(
        self,
        tenant_id: str,
        store_id: str,
        transaction_id: str,
        raw_payload: dict[str, Any],
        items_count: int,
        total_amount: float,
        status: str = "PROCESSED",
    ) -> POSTransactionModel:
        tx = POSTransactionModel(
            tenant_id=tenant_id,
            store_id=store_id,
            transaction_id=transaction_id,
            raw_payload_json=json.dumps(raw_payload),
            items_count=items_count,
            total_amount=total_amount,
            status=status,
        )
        self.session.add(tx)
        self.session.flush()
        return tx

    def get_recent_transactions(
        self, tenant_id: str, store_id: str, limit: int = 50
    ) -> list[POSTransactionModel]:
        stmt = (
            select(POSTransactionModel)
            .where(
                POSTransactionModel.tenant_id == tenant_id,
                POSTransactionModel.store_id == store_id,
            )
            .order_by(POSTransactionModel.created_at.desc())
            .limit(limit)
        )
        return list(self.session.scalars(stmt).all())

    def get_transaction_count(self, tenant_id: str, store_id: str) -> int:
        stmt = select(func.count(POSTransactionModel.id)).where(
            POSTransactionModel.tenant_id == tenant_id,
            POSTransactionModel.store_id == store_id,
        )
        return int(self.session.scalar(stmt) or 0)



class BillDocumentRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def save_bill(
        self,
        document_id: str,
        tenant_id: str,
        store_id: str,
        filename: str,
        bill_type: str,
        party_name: str,
        invoice_number: str,
        invoice_date: str,
        total_amount: float,
        ocr_engine: str,
        average_confidence: float,
        extracted_items: list[dict[str, Any]],
        status: str = "ready_for_confirmation",
    ) -> BillDocumentModel:
        bill = BillDocumentModel(
            document_id=document_id,
            tenant_id=tenant_id,
            store_id=store_id,
            filename=filename,
            bill_type=bill_type,
            party_name=party_name,
            invoice_number=invoice_number,
            invoice_date=invoice_date,
            total_amount=total_amount,
            ocr_engine=ocr_engine,
            average_confidence=average_confidence,
            extracted_items_json=json.dumps(extracted_items),
            status=status,
        )
        self.session.add(bill)
        self.session.flush()
        return bill

    def get_by_document_id(self, document_id: str) -> BillDocumentModel | None:
        stmt = select(BillDocumentModel).where(BillDocumentModel.document_id == document_id)
        return self.session.scalars(stmt).first()
