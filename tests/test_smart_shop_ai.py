"""Tests for Smart Shop AI Backend Services: Onboarding, OCR Bills, Market Research, Analytics, Alerts."""

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_onboarding_profile_get_and_post():
    # Initial get
    res = client.get("/api/onboarding/profile?tenant_id=tenant_default&store_id=CA_1")
    assert res.status_code == 200
    data = res.json()
    assert "shop_name" in data
    assert data["category"] == "Grocery Store"

    # Save new profile
    post_payload = {
        "shop_name": "Sunrise Organic Grocers",
        "owner_name": "Priya Sharma",
        "location": "Adyar, Chennai",
        "contact_phone": "+91 98409 87654",
        "contact_email": "priya@sunrisegrocers.in",
        "category": "Fruit & Vegetable",
        "shop_type": "new",
        "opening_date": "2026-11-01",
        "tenant_id": "tenant_default",
        "store_id": "CA_1",
        "initial_products": [
            {"name": "Organic Honey Crisp Apples", "quantity": 15, "purchase_price": 60.0, "shelf_life": 10}
        ],
    }
    save_res = client.post("/api/onboarding/profile", json=post_payload)
    assert save_res.status_code == 200
    res_data = save_res.json()
    assert res_data["status"] == "success"
    assert res_data["profile"]["shop_name"] == "Sunrise Organic Grocers"

    # Restore CA_1 original name to preserve test isolation
    client.post(
        "/api/onboarding/profile",
        json={
            "shop_name": "Downtown Central (CA_1)",
            "owner_name": "Ramesh Kumar",
            "location": "Los Angeles, CA",
            "tenant_id": "tenant_default",
            "store_id": "CA_1",
        },
    )


def test_bills_ocr_extraction_and_confirmation():
    # Purchase bill OCR
    ocr_res = client.post(
        "/api/bills/ocr",
        json={
            "bill_type": "purchase",
            "filename": "supplier_inv_0412.pdf",
            "tenant_id": "tenant_default",
            "store_id": "CA_1",
        },
    )
    assert ocr_res.status_code == 200
    ocr_data = ocr_res.json()
    assert ocr_data["bill_type"] == "purchase"
    assert len(ocr_data["items"]) >= 4
    conf = ocr_data["average_confidence"]
    assert conf > 0.80 if conf <= 1.0 else conf > 80.0

    # Sales bill OCR
    sales_ocr = client.post(
        "/api/bills/ocr",
        json={
            "bill_type": "sales",
            "filename": "counter_receipt_108.jpg",
            "tenant_id": "tenant_default",
            "store_id": "CA_1",
        },
    )
    assert sales_ocr.status_code == 200
    assert sales_ocr.json()["bill_type"] == "sales"

    # Confirm bill ingestion into ledger
    confirm_res = client.post(
        "/api/bills/confirm",
        json={
            "document_id": ocr_data["document_id"],
            "bill_type": "purchase",
            "items": [
                {"product_name": "Sona Masoori Rice (25kg Bag)", "quantity": 2, "unit_price": 46.50}
            ],
            "tenant_id": "tenant_default",
            "store_id": "CA_1",
            "party_name": "Apex Grains",
        },
    )
    assert confirm_res.status_code == 200
    assert confirm_res.json()["status"] == "success"
    assert confirm_res.json()["items_processed"] == 1


def test_market_research_endpoint():
    res = client.get("/api/market-research?tenant_id=tenant_default&store_id=CA_1")
    assert res.status_code == 200
    data = res.json()
    assert data["total_products_monitored"] >= 5
    first_item = data["products"][0]
    assert "wholesale_mandi_price" in first_item
    assert "retail_benchmark_price" in first_item
    assert "price_history_30d" in first_item
    assert "source" in first_item


def test_product_analytics_endpoint():
    res = client.get("/api/products/FOODS_2_043/analytics?tenant_id=tenant_default&store_id=CA_1")
    assert res.status_code == 200
    data = res.json()
    assert data["product_id"] == "FOODS_2_043"
    assert "daily_sales_history" in data
    assert len(data["daily_sales_history"]) == 30
    assert "demand_forecast_7d" in data
    assert "ai_explanation" in data


def test_sales_profit_summary_endpoint():
    res = client.get("/api/analytics/sales-profit?tenant_id=tenant_default&store_id=CA_1")
    assert res.status_code == 200
    data = res.json()
    assert data["total_revenue_month"] > 0
    assert data["gross_profit_month"] > 0
    assert "category_profitability" in data
    assert "top_profitable_products" in data


def test_suppliers_and_alerts_endpoints():
    # Suppliers
    sup_res = client.get("/api/suppliers?tenant_id=tenant_default&store_id=CA_1")
    assert sup_res.status_code == 200
    assert len(sup_res.json()["suppliers"]) >= 4

    # Alerts
    alt_res = client.get("/api/alerts?tenant_id=tenant_default&store_id=CA_1")
    assert alt_res.status_code == 200
    alerts_data = alt_res.json()
    assert alerts_data["total_active_alerts"] >= 5
    assert alerts_data["critical_count"] >= 2
    for a in alerts_data["alerts"]:
        assert "message" in a
        assert "action_label" in a


def test_onboarding_registers_new_store_in_tenant_service():
    """Verify that onboarding a new store dynamically registers it in TenantService."""
    store_id = "STORE_ONBOARD_TEST"
    res = client.post(
        "/api/onboarding/profile",
        json={
            "shop_name": "Test Branch Market",
            "owner_name": "Karthik Raj",
            "location": "Velachery, Chennai",
            "category": "Grocery Store",
            "shop_type": "new",
            "tenant_id": "tenant_default",
            "store_id": store_id,
            "initial_products": [
                {"name": "Organic Atta (5kg)", "quantity": 10, "purchase_price": 210.0, "shelf_life": 90}
            ],
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "store" in data
    assert data["store"]["store_id"] == store_id

    # Verify store is now listed in /api/stores
    stores_res = client.get("/api/stores?tenant_id=tenant_default")
    assert stores_res.status_code == 200
    store_ids = [s["store_id"] for s in stores_res.json()["stores"]]
    assert store_id in store_ids
