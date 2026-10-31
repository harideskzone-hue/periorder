"""Generic / Mock POS Webhook Gateway adapter."""

import hashlib
import hmac
from datetime import UTC, datetime
from typing import Any

from periorder.integrations.base import POSConnector
from periorder.integrations.registry import register_connector


class GenericMockPOSConnector(POSConnector):
    """Generic POS webhook connector supporting standard REST webhooks and HMAC validation."""

    def __init__(self) -> None:
        self.is_authenticated = False
        self.provider_name = "generic_mock"

    def authenticate(self, credentials: dict[str, Any]) -> bool:
        # Generic mock connector authenticates if api_key or webhook_secret is provided
        api_key = credentials.get("api_key") or credentials.get("webhook_secret")
        self.is_authenticated = bool(api_key)
        return self.is_authenticated

    def fetch_products(self) -> list[dict[str, Any]]:
        return [
            {"pos_id": "POS_M_01", "name": "Fresh Whole Milk – 1 Litre", "category": "Dairy", "price": 3.49},
            {"pos_id": "POS_B_02", "name": "Whole Wheat Sandwich Bread", "category": "Bakery", "price": 2.29},
            {"pos_id": "POS_A_03", "name": "Gala Apples (1kg Bag)", "category": "Produce", "price": 4.19},
            {"pos_id": "POS_S_04", "name": "Organic Fresh Strawberries (400g)", "category": "Produce", "price": 4.99},
            {"pos_id": "POS_E_05", "name": "Farm Fresh Large Eggs (12pk)", "category": "Dairy", "price": 3.89},
        ]

    def fetch_sales(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        return []

    def fetch_inventory(self) -> list[dict[str, Any]]:
        return []

    def parse_webhook_event(
        self,
        headers: dict[str, str],
        payload: dict[str, Any],
        secret: str | None = None,
    ) -> dict[str, Any]:
        """Validates payload and signature (if secret provided) and normalizes event."""
        # Optional HMAC-SHA256 signature verification
        signature = headers.get("x-pos-signature") or headers.get("X-POS-Signature")
        if secret and signature:
            computed = hmac.new(
                secret.encode(),
                str(payload).encode(),
                hashlib.sha256,
            ).hexdigest()
            # In mock environment we allow test token or valid sha
            if signature != "test_signature" and not hmac.compare_digest(signature, computed):
                raise ValueError("Invalid webhook HMAC signature.")

        event_type = payload.get("event_type", "pos.transaction.completed")
        tx_id = payload.get("transaction_id") or payload.get("id")
        if not tx_id:
            raise ValueError("Webhook payload missing transaction identifier.")

        items = payload.get("items", [])
        if not items:
            raise ValueError("Webhook transaction must contain at least one purchased item.")

        return {
            "event_id": payload.get("event_id", f"evt_{tx_id}"),
            "event_type": event_type,
            "transaction_id": tx_id,
            "store_id": payload.get("store_id", "CA_1"),
            "timestamp": payload.get("timestamp", datetime.now(UTC).isoformat()),
            "items": [
                {
                    "product_id": item.get("product_id"),
                    "quantity": int(item.get("quantity", 1)),
                    "unit_price": float(item.get("unit_price", 0.0)),
                }
                for item in items
            ],
            "total_amount": float(payload.get("total_amount", 0.0)),
        }


# Automatically register on import
register_connector("generic_mock", GenericMockPOSConnector)
