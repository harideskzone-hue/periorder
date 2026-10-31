"""Perishable batch tracking with FIFO expiration handling."""

import uuid
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta


@dataclass
class InventoryBatch:
    batch_id: str
    tenant_id: str
    store_id: str
    product_id: str
    quantity: int
    received_date: date
    expiry_date: date
    unit_cost: float = 0.0
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    @property
    def is_expired(self) -> bool:
        return date.today() > self.expiry_date

    @property
    def days_until_expiry(self) -> int:
        return (self.expiry_date - date.today()).days


@dataclass
class BatchDeduction:
    batch_id: str
    product_id: str
    deducted_quantity: int
    remaining_in_batch: int
    expiry_date: date


class BatchTracker:
    """Tracks physical inventory batches and executes First-In, First-Out (FIFO) consumption."""

    def __init__(self) -> None:
        self._batches: dict[str, InventoryBatch] = {}

    def receive_batch(
        self,
        tenant_id: str,
        store_id: str,
        product_id: str,
        quantity: int,
        shelf_life_days: int,
        unit_cost: float = 0.0,
        received_date: date | None = None,
    ) -> InventoryBatch:
        """Records delivery of a new perishable batch with computed expiry date."""
        if quantity <= 0:
            raise ValueError("Batch received quantity must be greater than zero.")
        today = received_date or date.today()
        expiry = today + timedelta(days=shelf_life_days)
        batch = InventoryBatch(
            batch_id=f"batch_{uuid.uuid4().hex[:10]}",
            tenant_id=tenant_id,
            store_id=store_id,
            product_id=product_id,
            quantity=quantity,
            received_date=today,
            expiry_date=expiry,
            unit_cost=unit_cost,
        )
        self._batches[batch.batch_id] = batch
        return batch

    def deduct_fifo(
        self,
        tenant_id: str,
        store_id: str,
        product_id: str,
        quantity_to_deduct: int,
    ) -> list[BatchDeduction]:
        """Consumes stock following FIFO (earliest expiry date first)."""
        if quantity_to_deduct <= 0:
            return []

        # Find active batches sorted by earliest expiry date (FIFO)
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

    def get_batches(
        self,
        tenant_id: str,
        store_id: str,
        product_id: str | None = None,
    ) -> list[InventoryBatch]:
        """Returns batches with available stock for a tenant store."""
        return [
            b
            for b in self._batches.values()
            if b.tenant_id == tenant_id
            and b.store_id == store_id
            and (product_id is None or b.product_id == product_id)
            and b.quantity > 0
        ]

    def get_expiring_soon(
        self,
        tenant_id: str,
        store_id: str,
        within_days: int = 2,
    ) -> list[InventoryBatch]:
        """Identifies batches expiring within the specified threshold."""
        batches = self.get_batches(tenant_id, store_id)
        return [b for b in batches if 0 <= b.days_until_expiry <= within_days]

    def restore_deductions(self, deductions: list[BatchDeduction]) -> None:
        """Restores deducted batch quantities in case an ingestion transaction fails."""
        for ded in deductions:
            if ded.batch_id in self._batches:
                self._batches[ded.batch_id].quantity += ded.deducted_quantity

