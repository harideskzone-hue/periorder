"""POS sales transaction ingestion pipeline with idempotency and ledger reconciliation."""

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from periorder.inventory.batches import BatchDeduction, BatchTracker
from periorder.inventory.ledger import InventoryLedger, MovementType


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
    """Ingests POS transactions, enforces idempotency, and reconciles inventory."""

    def __init__(
        self,
        ledger: InventoryLedger,
        batch_tracker: BatchTracker,
    ) -> None:
        self.ledger = ledger
        self.batch_tracker = batch_tracker
        # Idempotency storage: (tenant_id, store_id, transaction_id)
        self._processed_transactions: set[tuple] = set()
        self._transactions: list[SalesTransaction] = []

    def process_transaction(
        self,
        tenant_id: str,
        store_id: str,
        transaction_data: dict[str, Any],
    ) -> IngestionResult:
        """Processes a single POS transaction event with idempotency guarantees."""
        tx_id = transaction_data.get("transaction_id")
        if not tx_id:
            raise ValueError("Transaction missing transaction_id.")

        idempotency_key = (tenant_id, store_id, tx_id)
        if idempotency_key in self._processed_transactions:
            return IngestionResult(
                status="duplicate_skipped",
                transaction_id=tx_id,
                is_duplicate=True,
                deductions=[],
                reconciled_stock={},
                message=f"Transaction {tx_id} was already ingested; duplicate event skipped safely.",
            )

        items_raw = transaction_data.get("items", [])
        if not items_raw:
            raise ValueError("Transaction must contain at least one item.")

        parsed_items: list[SalesItem] = []
        all_deductions: list[BatchDeduction] = []
        updated_stocks: dict[str, int] = {}

        for item in items_raw:
            pid = item.get("product_id")
            qty = int(item.get("quantity", 1))
            price = float(item.get("unit_price", 0.0))

            if qty <= 0:
                raise ValueError(f"Invalid quantity {qty} for item {pid}; must be positive.")

            parsed_items.append(SalesItem(product_id=pid, quantity=qty, unit_price=price))

            # 1. Record negative stock movement in immutable ledger
            self.ledger.record_movement(
                tenant_id=tenant_id,
                store_id=store_id,
                product_id=pid,
                movement_type=MovementType.POS_SALE,
                quantity=-qty,
                reference_id=tx_id,
                notes=f"POS Sale: {qty} units @ ${price:.2f}",
            )

            # 2. FIFO batch stock deduction
            batch_deductions = self.batch_tracker.deduct_fifo(
                tenant_id=tenant_id,
                store_id=store_id,
                product_id=pid,
                quantity_to_deduct=qty,
            )
            all_deductions.extend(batch_deductions)

            # 3. Read back reconciled stock
            updated_stocks[pid] = self.ledger.get_stock(tenant_id, store_id, pid)

        # Store transaction record
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

    def get_recent_transactions(
        self,
        tenant_id: str,
        store_id: str,
        limit: int = 50,
    ) -> list[SalesTransaction]:
        results = [
            tx
            for tx in self._transactions
            if tx.tenant_id == tenant_id and tx.store_id == store_id
        ]
        return sorted(results, key=lambda t: t.created_at, reverse=True)[:limit]
