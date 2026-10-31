"""POS sales transaction ingestion pipeline with database persistence, idempotency, and atomic reconciliation."""

from __future__ import annotations

import json
import threading
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from periorder.db.models import StoreModel
from periorder.db.unit_of_work import UnitOfWork
from periorder.inventory.batches import BatchDeduction, BatchTracker
from periorder.inventory.ledger import InventoryLedger, InventoryMovement, MovementType


@dataclass
class SalesItem:
    product_id: str
    quantity: int
    unit_price: float


@dataclass
class SalesTransaction:
    transaction_id: str
    tenant_id: str
    store_id: str
    timestamp: datetime
    items: list[SalesItem]
    total_amount: float
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    raw_payload: dict[str, Any] | None = None


@dataclass
class IngestionResult:
    status: str
    transaction_id: str
    is_duplicate: bool
    deductions: list[BatchDeduction]
    reconciled_stock: dict[str, int]
    message: str


class SalesIngestionPipeline:
    """Ingests POS transactions, enforces idempotency, and reconciles inventory atomically into PostgreSQL."""

    def __init__(
        self,
        ledger: InventoryLedger | None = None,
        batch_tracker: BatchTracker | None = None,
        session_factory: sessionmaker[Session] | None = None,
    ) -> None:
        self.ledger = ledger
        self.batch_tracker = batch_tracker
        self._session_factory = session_factory
        self._lock = threading.RLock()
        # In-memory idempotency cache: (tenant_id, store_id, transaction_id)
        self._processed_transactions: set[tuple[str, str, str]] = set()
        self._transactions: list[SalesTransaction] = []

    def process_transaction(
        self,
        tenant_id: str,
        store_id: str,
        transaction_data: dict[str, Any],
    ) -> IngestionResult:
        """Processes a single POS transaction event with idempotency, persistence, and atomic guarantees."""
        with self._lock:
            tx_id = transaction_data.get("transaction_id")
            if not tx_id:
                raise ValueError("Transaction missing transaction_id.")

            idempotency_key = (tenant_id, store_id, tx_id)

            items_raw = transaction_data.get("items", [])
            if not items_raw:
                raise ValueError("Transaction must contain at least one item.")

            # Fast in-memory idempotency check
            if idempotency_key in self._processed_transactions:
                existing_tx = next(
                    (
                        t
                        for t in self._transactions
                        if t.tenant_id == tenant_id and t.store_id == store_id and t.transaction_id == tx_id
                    ),
                    None,
                )
                if existing_tx and not self._is_payload_equivalent(existing_tx.raw_payload or {}, transaction_data):
                    raise ValueError(
                        f"Payload conflict: Transaction ID '{tx_id}' was previously recorded with different payload content. "
                        "Cannot reuse an existing transaction ID for different items."
                    )
                return IngestionResult(
                    status="duplicate_skipped",
                    transaction_id=tx_id,
                    is_duplicate=True,
                    deductions=[],
                    reconciled_stock=self._get_stock_snapshot(
                        tenant_id, store_id, [it.get("product_id") for it in items_raw if it.get("product_id")]
                    ),
                    message=f"Transaction {tx_id} was already ingested; duplicate event skipped safely.",
                )

            # Validate items upfront before beginning transaction
            parsed_items: list[SalesItem] = []
            for item in items_raw:
                pid = item.get("product_id")
                if not pid:
                    raise ValueError("Each transaction item must specify a valid product_id.")
                try:
                    qty = int(item.get("quantity", 1))
                except (ValueError, TypeError):
                    raise ValueError(f"Invalid quantity for item {pid}; must be an integer.") from None
                if qty <= 0:
                    raise ValueError(f"Invalid quantity {qty} for item {pid}; must be positive.")
                try:
                    price = float(item.get("unit_price", 0.0))
                except (ValueError, TypeError):
                    raise ValueError(f"Invalid unit_price for item {pid}; must be a number.") from None

                parsed_items.append(SalesItem(product_id=pid, quantity=qty, unit_price=price))

            # Database-backed atomic execution if session_factory is configured
            if self._session_factory is not None:
                return self._process_transaction_db(
                    tenant_id=tenant_id,
                    store_id=store_id,
                    tx_id=tx_id,
                    idempotency_key=idempotency_key,
                    parsed_items=parsed_items,
                    transaction_data=transaction_data,
                )

            # Fallback in-memory processing
            return self._process_transaction_in_memory(
                tenant_id=tenant_id,
                store_id=store_id,
                tx_id=tx_id,
                idempotency_key=idempotency_key,
                parsed_items=parsed_items,
                transaction_data=transaction_data,
            )

    def _process_transaction_db(
        self,
        tenant_id: str,
        store_id: str,
        tx_id: str,
        idempotency_key: tuple[str, str, str],
        parsed_items: list[SalesItem],
        transaction_data: dict[str, Any],
    ) -> IngestionResult:
        """Execute transaction persistence across database models within a UnitOfWork boundary."""
        recorded_movements: list[InventoryMovement] = []
        all_deductions: list[BatchDeduction] = []
        updated_stocks: dict[str, int] = {}

        try:
            with UnitOfWork(session_factory=self._session_factory) as uow:
                assert uow.session is not None

                # 1. Database idempotency check with payload collision detection
                existing_tx = uow.pos_transactions.get_transaction(tenant_id, store_id, tx_id)
                if existing_tx:
                    existing_raw = json.loads(existing_tx.raw_payload_json) if existing_tx.raw_payload_json else {}
                    if not self._is_payload_equivalent(existing_raw, transaction_data):
                        raise ValueError(
                            f"Payload conflict: Transaction ID '{tx_id}' was previously recorded with different payload content. "
                            "Cannot reuse an existing transaction ID for different items."
                        )

                    self._processed_transactions.add(idempotency_key)
                    return IngestionResult(
                        status="duplicate_skipped",
                        transaction_id=tx_id,
                        is_duplicate=True,
                        deductions=[],
                        reconciled_stock=self._get_stock_snapshot(
                            tenant_id, store_id, [it.product_id for it in parsed_items]
                        ),
                        message=f"Transaction {tx_id} was already ingested; duplicate event skipped safely.",
                    )

                # 2. Strict Cross-Tenant store verification
                stmt = select(StoreModel).where(StoreModel.store_id == store_id)
                existing_stores = list(uow.session.scalars(stmt).all())
                if existing_stores:
                    tenant_ids = {s.tenant_id for s in existing_stores}
                    if tenant_id not in tenant_ids:
                        raise ValueError(
                            f"Cross-tenant store conflict: Store '{store_id}' belongs to another tenant organization."
                        )

                # 3. Process each line item
                for item in parsed_items:
                    # Append-only persistent inventory ledger movement
                    if self.ledger is not None:
                        mov = self.ledger.record_movement(
                            tenant_id=tenant_id,
                            store_id=store_id,
                            product_id=item.product_id,
                            movement_type=MovementType.POS_SALE,
                            quantity=-item.quantity,
                            reference_id=tx_id,
                            notes=f"POS Sale: {item.quantity} units @ ${item.unit_price:.2f}",
                            uow=uow,
                        )
                        recorded_movements.append(mov)
                    else:
                        uow.inventory_ledger.record_movement(
                            tenant_id=tenant_id,
                            store_id=store_id,
                            product_id=item.product_id,
                            movement_type="pos_sale",
                            quantity=-item.quantity,
                            reference_id=tx_id,
                            notes=f"POS Sale: {item.quantity} units @ ${item.unit_price:.2f}",
                        )

                    # FIFO batch deduction (in-memory if configured)
                    if self.batch_tracker is not None:
                        deductions = self.batch_tracker.deduct_fifo(
                            tenant_id=tenant_id,
                            store_id=store_id,
                            product_id=item.product_id,
                            quantity_to_deduct=item.quantity,
                        )
                        all_deductions.extend(deductions)

                    # Persistent FIFO batch deduction with row-level locking
                    uow.batches.deduct_fifo(
                        tenant_id=tenant_id,
                        store_id=store_id,
                        product_id=item.product_id,
                        quantity_to_deduct=item.quantity,
                        for_update=True,
                    )

                    # Read stock
                    if self.ledger is not None:
                        updated_stocks[item.product_id] = self.ledger.get_stock(
                            tenant_id, store_id, item.product_id, uow=uow
                        )
                    else:
                        updated_stocks[item.product_id] = uow.inventory_ledger.get_current_stock(
                            tenant_id, store_id, item.product_id
                        )

                # 4. Record POS transaction in database
                uow.pos_transactions.record_transaction(
                    tenant_id=tenant_id,
                    store_id=store_id,
                    transaction_id=tx_id,
                    raw_payload=transaction_data,
                    items_count=len(parsed_items),
                    total_amount=float(transaction_data.get("total_amount", 0.0)),
                    status="PROCESSED",
                )

                # 5. Commit all changes atomically
                uow.commit()

        except IntegrityError:
            # Handle race condition on duplicate POS transaction ID
            if self.ledger is not None:
                for mov in recorded_movements:
                    self.ledger.rollback_movement(mov)
            if self.batch_tracker is not None:
                self.batch_tracker.restore_deductions(all_deductions)

            # Check committed transaction payload in fresh session to detect conflict
            with UnitOfWork(session_factory=self._session_factory) as check_uow:
                committed_tx = check_uow.pos_transactions.get_transaction(tenant_id, store_id, tx_id)
                if committed_tx:
                    raw = json.loads(committed_tx.raw_payload_json) if committed_tx.raw_payload_json else {}
                    if not self._is_payload_equivalent(raw, transaction_data):
                        raise ValueError(
                            f"Payload conflict: Transaction ID '{tx_id}' was previously recorded with different payload content. "
                            "Cannot reuse an existing transaction ID for different items."
                        )

            self._processed_transactions.add(idempotency_key)
            return IngestionResult(
                status="duplicate_skipped",
                transaction_id=tx_id,
                is_duplicate=True,
                deductions=[],
                reconciled_stock=updated_stocks
                or self._get_stock_snapshot(tenant_id, store_id, [it.product_id for it in parsed_items]),
                message=f"Transaction {tx_id} was already ingested; duplicate event skipped safely.",
            )

        except Exception:
            # Roll back in-memory mutations on any failure (DB rolls back via UnitOfWork)
            if self.ledger is not None:
                for mov in recorded_movements:
                    self.ledger.rollback_movement(mov)
            if self.batch_tracker is not None:
                self.batch_tracker.restore_deductions(all_deductions)
            raise

        # Record in in-memory list for backward compatibility
        tx = SalesTransaction(
            transaction_id=tx_id,
            tenant_id=tenant_id,
            store_id=store_id,
            timestamp=datetime.now(UTC),
            items=parsed_items,
            total_amount=float(transaction_data.get("total_amount", 0.0)),
            raw_payload=transaction_data,
        )
        self._transactions.append(tx)
        self._processed_transactions.add(idempotency_key)

        return IngestionResult(
            status="success",
            transaction_id=tx_id,
            is_duplicate=False,
            deductions=all_deductions,
            reconciled_stock=updated_stocks,
            message=f"Successfully ingested transaction {tx_id} with {len(parsed_items)} items.",
        )

    def _process_transaction_in_memory(
        self,
        tenant_id: str,
        store_id: str,
        tx_id: str,
        idempotency_key: tuple[str, str, str],
        parsed_items: list[SalesItem],
        transaction_data: dict[str, Any],
    ) -> IngestionResult:
        """Pure in-memory execution fallback when database session_factory is not provided."""
        recorded_movements: list[InventoryMovement] = []
        all_deductions: list[BatchDeduction] = []
        updated_stocks: dict[str, int] = {}

        try:
            for item in parsed_items:
                if self.ledger is not None:
                    mov = self.ledger.record_movement(
                        tenant_id=tenant_id,
                        store_id=store_id,
                        product_id=item.product_id,
                        movement_type=MovementType.POS_SALE,
                        quantity=-item.quantity,
                        reference_id=tx_id,
                        notes=f"POS Sale: {item.quantity} units @ ${item.unit_price:.2f}",
                    )
                    recorded_movements.append(mov)

                if self.batch_tracker is not None:
                    deductions = self.batch_tracker.deduct_fifo(
                        tenant_id=tenant_id,
                        store_id=store_id,
                        product_id=item.product_id,
                        quantity_to_deduct=item.quantity,
                    )
                    all_deductions.extend(deductions)

                if self.ledger is not None:
                    updated_stocks[item.product_id] = self.ledger.get_stock(tenant_id, store_id, item.product_id)

            tx = SalesTransaction(
                transaction_id=tx_id,
                tenant_id=tenant_id,
                store_id=store_id,
                timestamp=datetime.now(UTC),
                items=parsed_items,
                total_amount=float(transaction_data.get("total_amount", 0.0)),
                raw_payload=transaction_data,
            )
            self._transactions.append(tx)
            self._processed_transactions.add(idempotency_key)

        except Exception:
            if self.ledger is not None:
                for mov in recorded_movements:
                    self.ledger.rollback_movement(mov)
            if self.batch_tracker is not None:
                self.batch_tracker.restore_deductions(all_deductions)
            raise

        return IngestionResult(
            status="success",
            transaction_id=tx_id,
            is_duplicate=False,
            deductions=all_deductions,
            reconciled_stock=updated_stocks,
            message=f"Successfully ingested transaction {tx_id} with {len(parsed_items)} items.",
        )

    def _get_stock_snapshot(self, tenant_id: str, store_id: str, product_ids: list[str]) -> dict[str, int]:
        if self.ledger is not None:
            return {pid: self.ledger.get_stock(tenant_id, store_id, pid) for pid in product_ids}
        if self._session_factory is not None:
            with UnitOfWork(session_factory=self._session_factory) as uow:
                return {pid: uow.inventory_ledger.get_current_stock(tenant_id, store_id, pid) for pid in product_ids}
        return {}

    @staticmethod
    def _is_payload_equivalent(p1: dict[str, Any], p2: dict[str, Any]) -> bool:
        """Compare two transaction payloads canonically to detect payload collisions on duplicate IDs."""
        if not p1 or not p2:
            return p1 == p2

        # 1. Total amount comparison (if both specify positive amounts)
        tot1 = float(p1.get("total_amount") or 0.0)
        tot2 = float(p2.get("total_amount") or 0.0)
        if tot1 > 0 and tot2 > 0 and round(tot1, 2) != round(tot2, 2):
            return False

        # 2. Canonical items comparison by product_id and quantity
        items1 = sorted(
            [
                (
                    str(it.get("product_id")),
                    int(it.get("quantity", 1)),
                    round(float(it.get("unit_price", 0.0)), 2),
                )
                for it in p1.get("items", [])
            ],
            key=lambda x: x[0],
        )
        items2 = sorted(
            [
                (
                    str(it.get("product_id")),
                    int(it.get("quantity", 1)),
                    round(float(it.get("unit_price", 0.0)), 2),
                )
                for it in p2.get("items", [])
            ],
            key=lambda x: x[0],
        )

        if len(items1) != len(items2):
            return False

        for (pid1, q1, price1), (pid2, q2, price2) in zip(items1, items2, strict=False):
            if pid1 != pid2 or q1 != q2:
                return False
            # Check prices only if both specify a price
            if price1 > 0 and price2 > 0 and price1 != price2:
                return False

        return True

    def get_recent_transactions(
        self,
        tenant_id: str,
        store_id: str,
        limit: int = 50,
    ) -> list[SalesTransaction]:
        """Fetch transactions from database if available, falling back to in-memory records."""
        if self._session_factory is not None:
            try:
                with UnitOfWork(session_factory=self._session_factory) as uow:
                    db_txs = uow.pos_transactions.get_recent_transactions(tenant_id, store_id, limit=limit)
                    if db_txs:
                        results: list[SalesTransaction] = []
                        for m in db_txs:
                            raw = json.loads(m.raw_payload_json) if m.raw_payload_json else {}
                            items_raw = raw.get("items", [])
                            items = [
                                SalesItem(
                                    product_id=it.get("product_id", ""),
                                    quantity=int(it.get("quantity", 1)),
                                    unit_price=float(it.get("unit_price", 0.0)),
                                )
                                for it in items_raw
                            ]
                            results.append(
                                SalesTransaction(
                                    transaction_id=m.transaction_id,
                                    tenant_id=m.tenant_id,
                                    store_id=m.store_id,
                                    timestamp=m.processed_at or m.created_at,
                                    items=items,
                                    total_amount=m.total_amount,
                                    created_at=m.created_at,
                                    raw_payload=raw,
                                )
                            )
                        return results
            except (SQLAlchemyError, OSError):
                # Database query failure; fallback to in-memory transaction history
                results = []

        results = [
            tx
            for tx in self._transactions
            if tx.tenant_id == tenant_id and tx.store_id == store_id
        ]
        return sorted(results, key=lambda t: t.created_at, reverse=True)[:limit]
