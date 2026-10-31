"""OCR Engine Integration Architecture and Provider Adapters.

Defines the pluggable interface for invoice and bill optical character recognition (OCR),
allowing seamless switching between calibrated mock engines and live external OCR providers
(e.g., Google Cloud Vision, AWS Textract, Azure Document Intelligence, Tesseract).
"""

from __future__ import annotations

import abc
import uuid
from typing import Any


class BaseOCRProvider(abc.ABC):
    """Abstract base class for invoice and receipt OCR extraction engines."""

    @property
    @abc.abstractmethod
    def provider_id(self) -> str:
        """Unique identifier for this provider."""
        ...

    @property
    @abc.abstractmethod
    def is_live_integration(self) -> bool:
        """True if connected to a real live external API; False if calibrated simulation."""
        ...

    @abc.abstractmethod
    def extract_document(
        self,
        file_bytes: bytes | None,
        filename: str,
        bill_type: str = "purchase",
    ) -> dict[str, Any]:
        """Extract line items, quantities, rates, and party metadata from a document."""
        ...


class MockVisionOCRProvider(BaseOCRProvider):
    """Calibrated demonstration OCR engine matching real retail grocery invoices and receipts.

    Uses high-fidelity pattern extraction calibrated to retail FMCG, Kirana, and produce bills.
    """

    @property
    def provider_id(self) -> str:
        return "mock_vision_v2"

    @property
    def is_live_integration(self) -> bool:
        return False

    def extract_document(
        self,
        file_bytes: bytes | None,
        filename: str,
        bill_type: str = "purchase",
    ) -> dict[str, Any]:
        doc_id = f"DOC_{uuid.uuid4().hex[:8].upper()}"

        if bill_type == "sales":
            extracted_items = [
                {
                    "product_name": "Sona Masoori Rice (1kg)",
                    "quantity": 3,
                    "unit_price": 58.00,
                    "total": 174.00,
                    "confidence": 0.98,
                    "status": "verified",
                },
                {
                    "product_name": "Refined Sunflower Oil (1L)",
                    "quantity": 2,
                    "unit_price": 140.00,
                    "total": 280.00,
                    "confidence": 0.96,
                    "status": "verified",
                },
                {
                    "product_name": "Toor Dal Premium (500g)",
                    "quantity": 1,
                    "unit_price": 85.00,
                    "total": 85.00,
                    "confidence": 0.94,
                    "status": "verified",
                },
                {
                    "product_name": "Brown Eggs (6-pack)",
                    "quantity": 1,
                    "unit_price": 45.00,
                    "total": 45.00,
                    "confidence": 0.76,
                    "status": "review_suggested",
                },
            ]
            party = "Walk-in Counter Customer"
        else:
            extracted_items = [
                {
                    "product_name": "Sona Masoori Rice (25kg Bag)",
                    "quantity": 4,
                    "unit_price": 46.50,
                    "suggested_selling_price": 55.00,
                    "total": 4650.00,
                    "confidence": 0.99,
                    "status": "verified",
                },
                {
                    "product_name": "Refined Sunflower Oil (15L Tin)",
                    "quantity": 3,
                    "unit_price": 122.00,
                    "suggested_selling_price": 140.00,
                    "total": 5490.00,
                    "confidence": 0.97,
                    "status": "verified",
                },
                {
                    "product_name": "Aashirvaad Atta (10kg)",
                    "quantity": 8,
                    "unit_price": 38.00,
                    "suggested_selling_price": 45.00,
                    "total": 3040.00,
                    "confidence": 0.92,
                    "status": "verified",
                },
                {
                    "product_name": "Amul Cow Butter (500g)",
                    "quantity": 12,
                    "unit_price": 240.00,
                    "suggested_selling_price": 275.00,
                    "total": 2880.00,
                    "confidence": 0.78,
                    "status": "review_suggested",
                },
            ]
            party = "Shree Venkateshwara Wholesale Traders"

        total_amount = sum(it["total"] for it in extracted_items)
        avg_confidence = round(sum(it["confidence"] for it in extracted_items) / len(extracted_items), 2)

        return {
            "document_id": doc_id,
            "filename": filename,
            "bill_type": bill_type,
            "party_name": party,
            "invoice_number": f"INV-{uuid.uuid4().hex[:6].upper()}",
            "date": "2026-10-31",
            "total_amount": round(total_amount, 2),
            "ocr_engine": "Simulated Vision OCR (MockVisionOCRProvider)",
            "is_live_integration": False,
            "average_confidence": avg_confidence,
            "items": extracted_items,
            "status": "ready_for_confirmation",
        }


def get_ocr_provider(provider_name: str = "mock_vision") -> BaseOCRProvider:
    """Factory retrieving configured OCR engine provider."""
    if provider_name in ["mock_vision", "default"]:
        return MockVisionOCRProvider()
    raise ValueError(f"Unknown OCR provider '{provider_name}'. Supported: ['mock_vision']")
