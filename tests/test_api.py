"""Tests for FastAPI backend endpoints."""

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_api_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_store_manager_overview():
    response = client.get("/api/store-manager/overview")
    assert response.status_code == 200
    data = response.json()
    assert "monitored_products" in data
    assert "urgent_attention_items" in data
    assert "today_recommendation_summary" in data
    assert "business_performance" in data


def test_store_manager_products():
    response = client.get("/api/store-manager/products")
    assert response.status_code == 200
    data = response.json()
    assert "products" in data
    assert len(data["products"]) > 0


def test_store_manager_suggested_orders():
    response = client.get("/api/store-manager/suggested-orders")
    assert response.status_code == 200
    data = response.json()
    assert "orders" in data
    assert len(data["orders"]) > 0


def test_store_manager_approve_orders_valid():
    response = client.post(
        "/api/store-manager/orders/approve",
        json={"order_ids": ["ord_1"], "quantities": {"ord_1": 10}},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "demo_approved"
    assert data["approved_count"] == 1
    assert "No purchase order was sent" in data["message"]
    assert data["transmission"] == "not_connected"
    assert data["confirmation_code"].startswith("DEMO-")


def test_store_manager_approve_orders_invalid_quantity():
    response = client.post(
        "/api/store-manager/orders/approve",
        json={"order_ids": ["ord_1"], "quantities": {"ord_1": 0}},
    )
    assert response.status_code == 422
    assert "at least one unit" in response.json()["detail"]


def test_store_manager_approve_orders_empty_list():
    response = client.post(
        "/api/store-manager/orders/approve",
        json={"order_ids": [], "quantities": {}},
    )
    assert response.status_code == 422
