"""Inventory movement ledger for auditability and real-time stock reconciliation."""

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum


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
    movement_type: MovementType
    quantity: int  # Positive for receipts/additions, negative for sales/waste/deductions
    reference_id: str | None = None  # e.g., POS transaction ID or PO number
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))
    notes: str | None = None


class InventoryLedger:
    """Immutable transaction ledger tracking all inventory movements."""

    def __init__(self) -> None:
        self._movements: list[InventoryMovement] = []
        # Store-level caches: (tenant_id, store_id, product_id) -> stock count
        self._stock_cache: dict[tuple, int] = {}

    def record_movement(
        self,
        tenant_id: str,
        store_id: str,
        product_id: str,
        movement_type: MovementType,
        quantity: int,
        reference_id: str | None = None,
        notes: str | None = None,
    ) -> InventoryMovement:
        """Records an inventory movement and updates the current stock cache."""
        movement = InventoryMovement(
            movement_id=f"mov_{uuid.uuid4().hex[:10]}",
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

    def get_stock(self, tenant_id: str, store_id: str, product_id: str) -> int:
        """Returns the reconciled stock by querying ledger cache."""
        return self._stock_cache.get((tenant_id, store_id, product_id), 0)

    def get_movements(
        self,
        tenant_id: str,
        store_id: str,
        product_id: str | None = None,
        limit: int = 50,
    ) -> list[InventoryMovement]:
        """Returns isolated movement history filtered by tenant and store."""
        results = [
            m
            for m in self._movements
            if m.tenant_id == tenant_id
            and m.store_id == store_id
            and (product_id is None or m.product_id == product_id)
        ]
        return sorted(results, key=lambda m: m.timestamp, reverse=True)[:limit]
