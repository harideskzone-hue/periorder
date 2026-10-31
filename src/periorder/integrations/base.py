"""Abstract base class for all Point of Sale (POS) connector adapters."""

from abc import ABC, abstractmethod
from typing import Any


class POSConnector(ABC):
    """Universal interface for Point of Sale billing systems."""

    @abstractmethod
    def authenticate(self, credentials: dict[str, Any]) -> bool:
        """Validates API credentials or secret token with provider."""

    @abstractmethod
    def fetch_products(self) -> list[dict[str, Any]]:
        """Retrieves product catalog from POS."""

    @abstractmethod
    def fetch_sales(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        """Polls historical sales transactions within date range."""

    @abstractmethod
    def fetch_inventory(self) -> list[dict[str, Any]]:
        """Fetches current on-hand quantities if supported by POS."""

    @abstractmethod
    def parse_webhook_event(
        self,
        headers: dict[str, str],
        payload: dict[str, Any],
        secret: str | None = None,
    ) -> dict[str, Any]:
        """Validates webhook signature and parses payload into standardized PeriOrder event."""
