"""Tests for multi-tenant isolation, inventory movement ledger, FIFO batches, and POS webhooks."""

from datetime import date

from fastapi.testclient import TestClient

from api.main import app
from periorder.inventory.batches import BatchTracker
from periorder.inventory.ledger import InventoryLedger, MovementType
from periorder.sales.ingestion import SalesIngestionPipeline
from periorder.tenants.service import TenantService

client = TestClient(app)


def test_tenant_service_isolation():
    svc = TenantService()
    t1 = svc.register_tenant("Shop A")
    t2 = svc.register_tenant("Shop B")

    s1 = svc.add_store(t1.tenant_id, "Shop A Downtown", "Location 1")
    s2 = svc.add_store(t2.tenant_id, "Shop B Uptown", "Location 2")

    # Tenant 1 should only see its store
    stores_t1 = svc.list_stores_for_tenant(t1.tenant_id)
    assert len(stores_t1) == 1
    assert stores_t1[0].store_id == s1.store_id

    # Security check: Shop A cannot get Shop B's store
    assert svc.get_store(t1.tenant_id, s2.store_id) is None


def test_inventory_ledger_reconciliation():
    ledger = InventoryLedger()
    pid = "PROD_MILK"
    t_id = "tenant_1"
    s_id = "store_1"

    # Initial receipt +100
    ledger.record_movement(t_id, s_id, pid, MovementType.PURCHASE_RECEIPT, 100)
    assert ledger.get_stock(t_id, s_id, pid) == 100

    # POS Sale -12
    ledger.record_movement(t_id, s_id, pid, MovementType.POS_SALE, -12)
    assert ledger.get_stock(t_id, s_id, pid) == 88

    # Damage -2
    ledger.record_movement(t_id, s_id, pid, MovementType.DAMAGE, -2)
    assert ledger.get_stock(t_id, s_id, pid) == 86

    # Stock correction +3
    ledger.record_movement(t_id, s_id, pid, MovementType.STOCK_CORRECTION, 3)
    assert ledger.get_stock(t_id, s_id, pid) == 89


def test_batch_tracker_fifo_deduction():
    tracker = BatchTracker()
    pid = "PROD_YOGURT"
    t_id = "tenant_1"
    s_id = "store_1"

    # Batch 1: expires in 2 days (10 units)
    b1 = tracker.receive_batch(t_id, s_id, pid, 10, shelf_life_days=2)
    # Batch 2: expires in 5 days (20 units)
    b2 = tracker.receive_batch(t_id, s_id, pid, 20, shelf_life_days=5)

    # Consume 15 units -> should completely exhaust Batch 1 (10 units) and take 5 from Batch 2
    deductions = tracker.deduct_fifo(t_id, s_id, pid, 15)
    assert len(deductions) == 2
    assert deductions[0].batch_id == b1.batch_id
    assert deductions[0].deducted_quantity == 10
    assert deductions[0].remaining_in_batch == 0

    assert deductions[1].batch_id == b2.batch_id
    assert deductions[1].deducted_quantity == 5
    assert deductions[1].remaining_in_batch == 15


def test_sales_ingestion_and_idempotency():
    ledger = InventoryLedger()
    tracker = BatchTracker()
    pipeline = SalesIngestionPipeline(ledger=ledger, batch_tracker=tracker)

    t_id = "tenant_1"
    s_id = "store_1"
    pid = "FOODS_2_043"

    # Seed initial inventory batch
    tracker.receive_batch(t_id, s_id, pid, 50, shelf_life_days=5)
    ledger.record_movement(t_id, s_id, pid, MovementType.PURCHASE_RECEIPT, 50)

    tx_payload = {
        "transaction_id": "POS_TX_1001",
        "items": [{"product_id": pid, "quantity": 3, "unit_price": 2.50}],
        "total_amount": 7.50,
    }

    # First ingestion -> success
    res1 = pipeline.process_transaction(t_id, s_id, tx_payload)
    assert res1.status == "success"
    assert not res1.is_duplicate
    assert res1.reconciled_stock[pid] == 47

    # Duplicate ingestion -> skipped idempotently
    res2 = pipeline.process_transaction(t_id, s_id, tx_payload)
    assert res2.status == "duplicate_skipped"
    assert res2.is_duplicate
    # Stock should remain 47 (not decremented again)
    assert ledger.get_stock(t_id, s_id, pid) == 47


def test_api_tenants_and_stores():
    res = client.get("/api/tenants")
    assert res.status_code == 200
    assert "tenants" in res.json()

    res_stores = client.get("/api/stores?tenant_id=tenant_default")
    assert res_stores.status_code == 200
    assert res_stores.json()["total_stores"] >= 1


def test_api_pos_connect_and_status():
    connect_payload = {
        "tenant_id": "tenant_default",
        "store_id": "CA_1",
        "provider": "generic_mock",
        "credentials": {"api_key": "test_sandbox_key"},
    }
    res = client.post("/api/pos/connect", json=connect_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "connected"
    assert data["provider"] == "generic_mock"

    res_status = client.get("/api/pos/status?tenant_id=tenant_default&store_id=CA_1")
    assert res_status.status_code == 200
    status_data = res_status.json()
    assert status_data["pos_connected"] is True
    assert status_data["pos_provider"] == "generic_mock"


def test_api_pos_webhook_transaction_flow():
    tx_id = f"TX_API_{int(date.today().strftime('%Y%m%d'))}_9999"
    webhook_payload = {
        "event_id": f"evt_{tx_id}",
        "event_type": "pos.transaction.completed",
        "transaction_id": tx_id,
        "tenant_id": "tenant_default",
        "store_id": "CA_1",
        "items": [
            {"product_id": "FOODS_2_043_CA_1", "quantity": 2, "unit_price": 2.40},
            {"product_id": "FOODS_2_021_TX_1", "quantity": 1, "unit_price": 1.60},
        ],
        "total_amount": 6.40,
    }

    # First event submission -> processed
    res = client.post("/api/pos/webhooks/transactions", json=webhook_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert not data["is_duplicate"]
    assert data["transaction_id"] == tx_id

    # Duplicate submission -> idempotently skipped
    res_dup = client.post("/api/pos/webhooks/transactions", json=webhook_payload)
    assert res_dup.status_code == 200
    assert res_dup.json()["is_duplicate"] is True

    # Check inventory ledger endpoint
    res_ledger = client.get("/api/inventory/ledger?tenant_id=tenant_default&store_id=CA_1")
    assert res_ledger.status_code == 200
    assert len(res_ledger.json()["movements"]) > 0

    # Check inventory batches endpoint
    res_batches = client.get("/api/inventory/batches?tenant_id=tenant_default&store_id=CA_1")
    assert res_batches.status_code == 200
    assert res_batches.json()["total_active_batches"] > 0
