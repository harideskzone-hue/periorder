"""Tests for Step 3 — Stage 2: PostgreSQL POS Sales Pipeline.

Validates the 7 mandatory acceptance criteria:
1. New POS sale: Transaction persists in database, stock is deducted in ledger.
2. Duplicate transaction: No second stock deduction, returns duplicate_skipped.
3. Invalid item/product: Entire transaction rolls back.
4. Database failure: No partial sale or inventory update (atomicity).
5. Cross-tenant transaction: Store belonging to Tenant A cannot be modified under Tenant B.
6. Application restart: Transactions and inventory remain available in new pipeline instance.
7. Concurrent duplicate requests: Competing threads submitting identical transaction; exactly one succeeds.
"""

from __future__ import annotations

import concurrent.futures
import os
import uuid

import pytest
from sqlalchemy.orm import sessionmaker

from periorder.db import (
    UnitOfWork,
    create_app_engine,
    init_db,
)
from periorder.inventory.batches import BatchTracker
from periorder.inventory.ledger import InventoryLedger
from periorder.sales.ingestion import SalesIngestionPipeline

TEST_POS_DB = "./test_periorder_pos_stage2.db"


@pytest.fixture(scope="module")
def pos_db_engine():
    """Isolated SQLite engine for POS Sales Pipeline stage 2 tests."""
    if os.path.exists(TEST_POS_DB):
        os.remove(TEST_POS_DB)

    engine = create_app_engine(database_url=f"sqlite:///{TEST_POS_DB}")
    init_db(engine)
    yield engine

    if os.path.exists(TEST_POS_DB):
        try:
            os.remove(TEST_POS_DB)
        except OSError:
            pass


@pytest.fixture
def session_factory(pos_db_engine):
    return sessionmaker(bind=pos_db_engine, autocommit=False, autoflush=False)


@pytest.fixture
def seeded_store(session_factory):
    """Seed a tenant and store in the database."""
    t_id = f"tnt_{uuid.uuid4().hex[:6]}"
    s_id = f"STR_{uuid.uuid4().hex[:6].upper()}"

    with UnitOfWork(session_factory=session_factory, auto_commit=True) as uow:
        uow.tenants.create(tenant_id=t_id, business_name="Organic POS Retail Co")
        uow.stores.create(tenant_id=t_id, store_id=s_id, store_name="Downtown Central", location="Austin, TX")

    return t_id, s_id


def test_new_pos_sale_persists(session_factory, seeded_store):
    """1. New POS sale: Transaction persists in database, and stock is deducted."""
    tenant_id, store_id = seeded_store
    pid = "PROD_MILK_ORGANIC"

    ledger = InventoryLedger()
    tracker = BatchTracker()
    pipeline = SalesIngestionPipeline(ledger=ledger, batch_tracker=tracker, session_factory=session_factory)

    # Receive initial stock: +20
    with UnitOfWork(session_factory=session_factory, auto_commit=True) as uow:
        uow.batches.receive_batch(tenant_id, store_id, pid, quantity=20, shelf_life_days=4, unit_cost=3.0)
        uow.inventory_ledger.record_movement(tenant_id, store_id, pid, "purchase_receipt", 20, "PO_INIT")
    ledger.record_movement(tenant_id, store_id, pid, "purchase_receipt", 20, "PO_INIT")
    tracker.receive_batch(tenant_id, store_id, pid, quantity=20, shelf_life_days=4, unit_cost=3.0)

    tx_id = f"TX_SALE_{uuid.uuid4().hex[:8]}"
    tx_payload = {
        "transaction_id": tx_id,
        "items": [{"product_id": pid, "quantity": 6, "unit_price": 4.50}],
        "total_amount": 27.0,
    }

    result = pipeline.process_transaction(tenant_id, store_id, tx_payload)
    assert result.status == "success"
    assert result.is_duplicate is False
    assert result.reconciled_stock[pid] == 14

    # Verify directly in database via fresh UnitOfWork
    with UnitOfWork(session_factory=session_factory) as check_uow:
        assert check_uow.pos_transactions.is_duplicate(tenant_id, store_id, tx_id) is True
        db_stock = check_uow.inventory_ledger.get_current_stock(tenant_id, store_id, pid)
        assert db_stock == 14

        batches = check_uow.batches.get_active_batches_fifo(tenant_id, store_id, pid)
        assert batches[0].remaining_quantity == 14


def test_duplicate_pos_transaction_no_double_deduction(session_factory, seeded_store):
    """2. Duplicate POS transaction: Safely skipped without second stock deduction."""
    tenant_id, store_id = seeded_store
    pid = "PROD_BREAD_WHEAT"

    ledger = InventoryLedger()
    tracker = BatchTracker()
    pipeline = SalesIngestionPipeline(ledger=ledger, batch_tracker=tracker, session_factory=session_factory)

    # Initial stock: +15
    with UnitOfWork(session_factory=session_factory, auto_commit=True) as uow:
        uow.inventory_ledger.record_movement(tenant_id, store_id, pid, "purchase_receipt", 15, "PO_BREAD")
    ledger.record_movement(tenant_id, store_id, pid, "purchase_receipt", 15, "PO_BREAD")

    tx_id = f"TX_DUP_{uuid.uuid4().hex[:8]}"
    tx_payload = {
        "transaction_id": tx_id,
        "items": [{"product_id": pid, "quantity": 4, "unit_price": 2.50}],
        "total_amount": 10.0,
    }

    # First attempt: succeeds (stock goes 15 -> 11)
    res1 = pipeline.process_transaction(tenant_id, store_id, tx_payload)
    assert res1.status == "success"
    assert res1.is_duplicate is False

    # Second attempt with identical transaction ID: safely skipped
    res2 = pipeline.process_transaction(tenant_id, store_id, tx_payload)
    assert res2.status == "duplicate_skipped"
    assert res2.is_duplicate is True
    assert "already ingested" in res2.message

    # Verify stock remained 11 (NOT 7!)
    with UnitOfWork(session_factory=session_factory) as check_uow:
        stock = check_uow.inventory_ledger.get_current_stock(tenant_id, store_id, pid)
        assert stock == 11


def test_invalid_product_or_payload_rolls_back(session_factory, seeded_store):
    """3. Invalid item/payload: Rejection causes full rollback."""
    tenant_id, store_id = seeded_store
    pid = "PROD_YOGURT_01"

    ledger = InventoryLedger()
    tracker = BatchTracker()
    pipeline = SalesIngestionPipeline(ledger=ledger, batch_tracker=tracker, session_factory=session_factory)

    # Initial stock: +10
    with UnitOfWork(session_factory=session_factory, auto_commit=True) as uow:
        uow.inventory_ledger.record_movement(tenant_id, store_id, pid, "purchase_receipt", 10, "PO_YOGURT")
    ledger.record_movement(tenant_id, store_id, pid, "purchase_receipt", 10, "PO_YOGURT")

    tx_id = f"TX_BAD_{uuid.uuid4().hex[:6]}"
    # Invalid: non-positive quantity
    bad_payload = {
        "transaction_id": tx_id,
        "items": [{"product_id": pid, "quantity": -5, "unit_price": 2.0}],
    }

    with pytest.raises(ValueError, match="must be positive"):
        pipeline.process_transaction(tenant_id, store_id, bad_payload)

    # Database and ledger must have 0 changes
    with UnitOfWork(session_factory=session_factory) as check_uow:
        assert check_uow.pos_transactions.is_duplicate(tenant_id, store_id, tx_id) is False
        assert check_uow.inventory_ledger.get_current_stock(tenant_id, store_id, pid) == 10


def test_database_failure_atomic_rollback(session_factory, seeded_store):
    """4. Database failure midway: Complete rollback, no partial movements."""
    tenant_id, store_id = seeded_store
    pid = "PROD_CHEESE_01"

    ledger = InventoryLedger()
    tracker = BatchTracker()
    pipeline = SalesIngestionPipeline(ledger=ledger, batch_tracker=tracker, session_factory=session_factory)

    # Initial stock: +25
    with UnitOfWork(session_factory=session_factory, auto_commit=True) as uow:
        uow.inventory_ledger.record_movement(tenant_id, store_id, pid, "purchase_receipt", 25, "PO_CH")
    ledger.record_movement(tenant_id, store_id, pid, "purchase_receipt", 25, "PO_CH")

    tx_id = f"TX_CRASH_{uuid.uuid4().hex[:6]}"
    payload = {
        "transaction_id": tx_id,
        "items": [{"product_id": pid, "quantity": 5, "unit_price": 8.0}],
    }

    # Simulate database crash during record_transaction
    original_record = pipeline._session_factory

    def _failing_uow_factory():
        raise RuntimeError("Simulated database connection loss during flush")

    pipeline._session_factory = _failing_uow_factory

    with pytest.raises(RuntimeError, match="Simulated database connection loss"):
        pipeline.process_transaction(tenant_id, store_id, payload)

    # Restore session factory and verify database stock remained 25
    pipeline._session_factory = original_record
    with UnitOfWork(session_factory=session_factory) as check_uow:
        assert check_uow.pos_transactions.is_duplicate(tenant_id, store_id, tx_id) is False
        assert check_uow.inventory_ledger.get_current_stock(tenant_id, store_id, pid) == 25
        assert ledger.get_stock(tenant_id, store_id, pid) == 25


def test_cross_tenant_store_transaction_rejected(session_factory):
    """5. Cross-tenant transaction: Rejects sale if store belongs to another tenant."""
    # Tenant 1 owns Store 1
    t1 = f"tnt1_{uuid.uuid4().hex[:4]}"
    s1 = f"STR1_{uuid.uuid4().hex[:4]}"
    # Tenant 2
    t2 = f"tnt2_{uuid.uuid4().hex[:4]}"

    with UnitOfWork(session_factory=session_factory, auto_commit=True) as uow:
        uow.tenants.create(tenant_id=t1, business_name="Org 1")
        uow.tenants.create(tenant_id=t2, business_name="Org 2")
        uow.stores.create(tenant_id=t1, store_id=s1, store_name="Org 1 Store", location="City")

    pipeline = SalesIngestionPipeline(session_factory=session_factory)
    payload = {
        "transaction_id": f"TX_CROSS_{uuid.uuid4().hex[:6]}",
        "items": [{"product_id": "P1", "quantity": 1, "unit_price": 5.0}],
    }

    # Tenant 2 attempts to write to Tenant 1's store
    with pytest.raises(ValueError, match="Cross-tenant store conflict"):
        pipeline.process_transaction(tenant_id=t2, store_id=s1, transaction_data=payload)


def test_application_restart_persistence(session_factory, seeded_store):
    """6. Application restart: New pipeline instance recovers persisted transactions from database."""
    tenant_id, store_id = seeded_store
    pid = "PROD_APPLES_HONEYCRISP"
    tx_id = f"TX_RESTART_{uuid.uuid4().hex[:6]}"

    # Instance 1 records the transaction
    pipe1 = SalesIngestionPipeline(session_factory=session_factory)
    pipe1.process_transaction(
        tenant_id=tenant_id,
        store_id=store_id,
        transaction_data={
            "transaction_id": tx_id,
            "items": [{"product_id": pid, "quantity": 8, "unit_price": 3.20}],
            "total_amount": 25.60,
        },
    )

    # Simulate application restart: Instance 2 with fresh in-memory structures
    pipe2 = SalesIngestionPipeline(session_factory=session_factory)

    # Must recognize existing transaction as duplicate
    res = pipe2.process_transaction(
        tenant_id=tenant_id,
        store_id=store_id,
        transaction_data={"transaction_id": tx_id, "items": [{"product_id": pid, "quantity": 8}]},
    )
    assert res.is_duplicate is True
    assert res.status == "duplicate_skipped"

    # Query recent transactions from database
    recent = pipe2.get_recent_transactions(tenant_id, store_id)
    assert len(recent) >= 1
    found = [t for t in recent if t.transaction_id == tx_id]
    assert len(found) == 1
    assert found[0].total_amount == 25.60


def test_concurrent_duplicate_requests_handled_safely(session_factory, seeded_store):
    """7. Concurrent duplicate requests: Competing threads submitting identical transaction ID."""
    tenant_id, store_id = seeded_store
    pid = "PROD_EGGS_DOZEN"
    tx_id = f"TX_CONCURRENT_{uuid.uuid4().hex[:6]}"

    with UnitOfWork(session_factory=session_factory, auto_commit=True) as uow:
        uow.inventory_ledger.record_movement(tenant_id, store_id, pid, "purchase_receipt", 50, "INIT_EGGS")

    pipeline = SalesIngestionPipeline(session_factory=session_factory)
    payload = {
        "transaction_id": tx_id,
        "items": [{"product_id": pid, "quantity": 5, "unit_price": 4.0}],
        "total_amount": 20.0,
    }

    # Fire 5 concurrent threads attempting the exact same transaction ID
    def _submit():
        return pipeline.process_transaction(tenant_id, store_id, payload)

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(_submit) for _ in range(5)]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]

    # Exactly one must be success, the others duplicate_skipped
    successes = [r for r in results if r.status == "success"]
    duplicates = [r for r in results if r.status == "duplicate_skipped"]

    assert len(successes) == 1
    assert len(duplicates) == 4

    # Stock must have been deducted exactly ONCE: 50 - 5 = 45 (NOT 25!)
    with UnitOfWork(session_factory=session_factory) as check_uow:
        stock = check_uow.inventory_ledger.get_current_stock(tenant_id, store_id, pid)
        assert stock == 45


def test_pos_pipeline_postgresql_live():
    """Verify Stage 2 POS Sales Pipeline persistence directly against live PostgreSQL."""
    from sqlalchemy import delete
    from sqlalchemy.exc import SQLAlchemyError

    from periorder.db.models import (
        InventoryBatchModel,
        InventoryMovementModel,
        POSTransactionModel,
        StoreModel,
        TenantModel,
    )

    pg_url = "postgresql+psycopg2:///periorder_db"
    try:
        engine = create_app_engine(database_url=pg_url)
        init_db(engine)
    except (SQLAlchemyError, OSError) as e:
        pytest.skip(f"PostgreSQL local instance not reachable: {e}")

    pg_factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    t_id = f"pg_pos_{uuid.uuid4().hex[:6]}"
    s_id = f"PG_STR_{uuid.uuid4().hex[:6]}"
    pid = "PG_WATER_BOTTLE"
    tx_id = f"PG_TX_{uuid.uuid4().hex[:6]}"

    try:
        # Seed tenant and store in PostgreSQL
        with UnitOfWork(session_factory=pg_factory, auto_commit=True) as uow:
            uow.tenants.create(tenant_id=t_id, business_name="Live PG POS Org")
            uow.stores.create(tenant_id=t_id, store_id=s_id, store_name="SF Flagship", location="Market St")
            uow.batches.receive_batch(t_id, s_id, pid, quantity=100, shelf_life_days=30, unit_cost=1.0)
            uow.inventory_ledger.record_movement(t_id, s_id, pid, "purchase_receipt", 100, "INIT_PG")

        pipeline = SalesIngestionPipeline(session_factory=pg_factory)
        payload = {
            "transaction_id": tx_id,
            "items": [{"product_id": pid, "quantity": 12, "unit_price": 2.50}],
            "total_amount": 30.0,
        }

        # 1. Process POS sale in PostgreSQL
        res1 = pipeline.process_transaction(t_id, s_id, payload)
        assert res1.status == "success"
        assert res1.is_duplicate is False

        # 2. Check persistence in PostgreSQL
        with UnitOfWork(session_factory=pg_factory) as check_uow:
            assert check_uow.pos_transactions.is_duplicate(t_id, s_id, tx_id) is True
            stock = check_uow.inventory_ledger.get_current_stock(t_id, s_id, pid)
            assert stock == 88  # 100 - 12
            batches = check_uow.batches.get_active_batches_fifo(t_id, s_id, pid)
            assert batches[0].remaining_quantity == 88

        # 3. Duplicate transaction rejection in PostgreSQL
        res2 = pipeline.process_transaction(t_id, s_id, payload)
        assert res2.status == "duplicate_skipped"
        assert res2.is_duplicate is True

    finally:
        with pg_factory() as cleanup:
            cleanup.execute(delete(InventoryMovementModel).where(InventoryMovementModel.tenant_id == t_id))
            cleanup.execute(delete(InventoryBatchModel).where(InventoryBatchModel.tenant_id == t_id))
            cleanup.execute(delete(POSTransactionModel).where(POSTransactionModel.tenant_id == t_id))
            cleanup.execute(delete(StoreModel).where(StoreModel.tenant_id == t_id))
            cleanup.execute(delete(TenantModel).where(TenantModel.tenant_id == t_id))
            cleanup.commit()

