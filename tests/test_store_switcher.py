"""Tests for Multi-Store Management and Dynamic Store Switcher (Phase 8)."""

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_list_stores_returns_seeded_branches():
    response = client.get("/api/stores?tenant_id=tenant_default")
    assert response.status_code == 200
    data = response.json()
    assert data["tenant_id"] == "tenant_default"
    assert data["total_stores"] >= 3
    store_ids = [s["store_id"] for s in data["stores"]]
    assert "CA_1" in store_ids
    assert "TX_1" in store_ids
    assert "WI_3" in store_ids


def test_get_store_details_success_and_isolation():
    # Success for authorized store
    res_ca1 = client.get("/api/stores/CA_1?tenant_id=tenant_default")
    assert res_ca1.status_code == 200
    assert res_ca1.json()["store_id"] == "CA_1"
    assert "Downtown Central" in res_ca1.json()["store_name"]

    # 404 for invalid store
    res_invalid = client.get("/api/stores/NON_EXISTENT?tenant_id=tenant_default")
    assert res_invalid.status_code == 404

    # 404 for unauthorized tenant
    res_unauth = client.get("/api/stores/CA_1?tenant_id=tenant_other")
    assert res_unauth.status_code == 404


def test_create_and_select_new_store_branch():
    payload = {
        "store_name": "Bay Area Hub",
        "location": "San Francisco, CA",
        "store_id": "CA_2",
        "tenant_id": "tenant_default",
    }
    create_res = client.post("/api/stores", json=payload)
    assert create_res.status_code == 200
    data = create_res.json()
    assert data["status"] == "created"
    assert data["store"]["store_id"] == "CA_2"
    assert data["store"]["location"] == "San Francisco, CA"

    # Select the newly created store
    select_res = client.post("/api/stores/CA_2/select?tenant_id=tenant_default")
    assert select_res.status_code == 200
    sel_data = select_res.json()
    assert sel_data["status"] == "selected"
    assert sel_data["store_id"] == "CA_2"
    assert sel_data["pos_connected"] is False


def test_store_switcher_overview_branch_isolation():
    # Overview for CA_1
    res_ca1 = client.get("/api/store-manager/overview?tenant_id=tenant_default&store_id=CA_1")
    assert res_ca1.status_code == 200
    data_ca1 = res_ca1.json()
    assert data_ca1["store_id"] == "CA_1"
    assert data_ca1["monitored_products"] == 500
    assert data_ca1["orders_to_review"] == 8

    # Overview for TX_1
    res_tx1 = client.get("/api/store-manager/overview?tenant_id=tenant_default&store_id=TX_1")
    assert res_tx1.status_code == 200
    data_tx1 = res_tx1.json()
    assert data_tx1["store_id"] == "TX_1"
    assert data_tx1["monitored_products"] == 410
    assert data_tx1["orders_to_review"] == 6

    # Overview for WI_3
    res_wi3 = client.get("/api/store-manager/overview?tenant_id=tenant_default&store_id=WI_3")
    assert res_wi3.status_code == 200
    data_wi3 = res_wi3.json()
    assert data_wi3["store_id"] == "WI_3"
    assert data_wi3["monitored_products"] == 380
    assert data_wi3["orders_to_review"] == 10

    # Dedicated store overview endpoint
    res_endpoint = client.get("/api/stores/TX_1/overview?tenant_id=tenant_default")
    assert res_endpoint.status_code == 200
    assert res_endpoint.json()["store_id"] == "TX_1"


def test_store_manager_products_filtered_by_store():
    # CA_1 products
    res_ca1 = client.get("/api/store-manager/products?tenant_id=tenant_default&store_id=CA_1")
    assert res_ca1.status_code == 200
    prods_ca1 = res_ca1.json()["products"]
    assert len(prods_ca1) > 0
    for p in prods_ca1:
        assert p.get("store_id") == "CA_1"

    # TX_1 products
    res_tx1 = client.get("/api/store-manager/products?tenant_id=tenant_default&store_id=TX_1")
    assert res_tx1.status_code == 200
    prods_tx1 = res_tx1.json()["products"]
    assert len(prods_tx1) > 0
    for p in prods_tx1:
        assert p.get("store_id") == "TX_1"


def test_suggested_orders_and_approval_store_awareness():
    # WI_3 suggested orders
    res_wi3 = client.get("/api/store-manager/suggested-orders?tenant_id=tenant_default&store_id=WI_3")
    assert res_wi3.status_code == 200
    data_wi3 = res_wi3.json()
    assert data_wi3["store_id"] == "WI_3"
    assert data_wi3["total_orders"] == 6

    # Approval for WI_3
    approve_res = client.post(
        "/api/store-manager/orders/approve",
        json={
            "order_ids": ["ord_wi_001", "ord_wi_002"],
            "quantities": {"ord_wi_001": 18, "ord_wi_002": 18},
            "tenant_id": "tenant_default",
            "store_id": "WI_3",
        },
    )
    assert approve_res.status_code == 200
    app_data = approve_res.json()
    assert app_data["status"] == "demo_approved"
    assert app_data["store_id"] == "WI_3"
    assert app_data["approved_count"] == 2

    # Approval rejected for invalid store
    invalid_app = client.post(
        "/api/store-manager/orders/approve",
        json={
            "order_ids": ["ord_wi_001"],
            "tenant_id": "tenant_default",
            "store_id": "INVALID_STORE",
        },
    )
    assert invalid_app.status_code == 404


def test_demand_outlook_and_reports_store_isolation():
    # Demand outlook for TX_1
    res_outlook = client.get("/api/store-manager/demand-outlook?tenant_id=tenant_default&store_id=TX_1")
    assert res_outlook.status_code == 200
    outlook_data = res_outlook.json()
    assert outlook_data["store_id"] == "TX_1"
    assert "Dallas" in outlook_data["summary"]

    # Reports for WI_3
    res_reports = client.get("/api/store-manager/reports?tenant_id=tenant_default&store_id=WI_3")
    assert res_reports.status_code == 200
    rep_data = res_reports.json()
    assert rep_data["store_id"] == "WI_3"
    assert rep_data["headline_metrics"]["days_without_stockouts_pct"] == 79.8


def test_pos_status_and_ledger_store_isolation():
    # POS status for TX_1
    res_pos = client.get("/api/pos/status?tenant_id=tenant_default&store_id=TX_1")
    assert res_pos.status_code == 200
    assert res_pos.json()["store_id"] == "TX_1"
    assert res_pos.json()["pos_connected"] is False

    # Ledger for CA_1 has initial stock movements
    res_ledger = client.get("/api/inventory/ledger?tenant_id=tenant_default&store_id=CA_1")
    assert res_ledger.status_code == 200
    assert res_ledger.json()["total_returned"] >= 4

    # Ledger for TX_1 has isolated movements
    res_ledger_tx = client.get("/api/inventory/ledger?tenant_id=tenant_default&store_id=TX_1")
    assert res_ledger_tx.status_code == 200
    assert res_ledger_tx.json()["total_returned"] >= 4

    # Batches for WI_3 are isolated
    res_batches = client.get("/api/inventory/batches?tenant_id=tenant_default&store_id=WI_3")
    assert res_batches.status_code == 200
    assert res_batches.json()["total_active_batches"] >= 4
