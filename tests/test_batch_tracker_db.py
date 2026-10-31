"""Tests for Step 3 — Stage 4: FIFO Batch Tracker Migration (BatchTracker to PostgreSQL inventory_batches).

Validates the Stage 4 requirements:
1. Batch receipt: Discrete batch persisted in database with received_date, shelf_life_days, expiry_date.
2. FIFO / FEFO consumption: Earliest expiry date / received date deducted first.
3. Partial batch deduction and exhaustion: Remaining quantity decremented; is_exhausted set to True when 0.
4. Multi-batch split: Deducting across multiple batches in single transaction.
5. Insufficient stock: Deducts up to available stock without going negative.
6. Row-level locking & Concurrency: with_for_update() serializes concurrent sales.
7. Multi-tenant isolation: Cross-tenant batch query or deduction raises PermissionError.
8. Expiry filtering: get_expiring_soon() correctly filters batches within time window.
9. Inventory valuation: Total remaining monetary value calculated accurately.
10. Atomic UnitOfWork rollback: Uncommitted deductions roll back cleanly on exception.
11. Dual-mode backward compatibility: Pure in-memory mode works identically for simulations without DB.
12. SalesIngestionPipeline integration: Pipeline atomically persists POS transaction, ledger, and batch deductions.
"""

from __future__ import annotations

import concurrent.futures
import datetime
import os
import uuid

import pytest
from sqlalchemy import delete, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker

from periorder.db import (
    UnitOfWork,
    create_app_engine,
    init_db,
)
from periorder.db.models import (
    InventoryBatchModel,
    StoreModel,
    TenantModel,
)
from periorder.inventory.batches import BatchTracker
from periorder.inventory.ledger import InventoryLedger, MovementType
from periorder.sales.ingestion import SalesIngestionPipeline

TEST_BATCH_DB = "./test_periorder_batch_stage4.db"


@pytest.fixture(scope="module")
def batch_db_engine():
    """Isolated SQLite engine for BatchTracker Stage 4 tests."""
    if os.path.exists(TEST_BATCH_DB):
        try:
            os.remove(TEST_BATCH_DB)
        except OSError:
            pass

    engine = create_app_engine(database_url=f"sqlite:///{TEST_BATCH_DB}")
    init_db(engine)
    yield engine

    if os.path.exists(TEST_BATCH_DB):
        try:
            os.remove(TEST_BATCH_DB)
        except OSError:
            pass


@pytest.fixture
def session_factory(batch_db_engine):
    return sessionmaker(bind=batch_db_engine, autocommit=False, autoflush=False)


@pytest.fixture
def seeded_store(session_factory):
    """Seed a tenant and store in the database."""
    t_id = f"tnt_{uuid.uuid4().hex[:6]}"
    s_id = f"STR_{uuid.uuid4().hex[:6].upper()}"

    with UnitOfWork(session_factory=session_factory, auto_commit=True) as uow:
        uow.tenants.create(tenant_id=t_id, business_name="Batch Test Tenant")
        uow.stores.create(
            tenant_id=t_id,
            store_id=s_id,
            store_name="Batch Test Store",
            location="Sector 4",
        )

    return t_id, s_id


def test_batch_receipt_persists_in_db(session_factory, seeded_store):
    """1. Batch receipt: Discrete batch persisted in database with accurate dates."""
    tenant_id, store_id = seeded_store
    pid = "PROD_STRAWBERRY_01"

    tracker = BatchTracker(session_factory=session_factory)
    batch = tracker.receive_batch(
        tenant_id=tenant_id,
        store_id=store_id,
        product_id=pid,
        quantity=30,
        shelf_life_days=5,
        unit_cost=3.50,
    )

    assert batch.batch_id.startswith("BAT_")
    assert batch.quantity == 30
    assert batch.unit_cost == 3.50
    assert batch.days_until_expiry >= 4  # today + 5 days
    assert batch.is_expired is False

    # Verify directly in database via fresh UnitOfWork
    with UnitOfWork(session_factory=session_factory) as uow:
        assert uow.session is not None
        model = uow.batches.get_batch_by_id(tenant_id, store_id, batch.batch_id)
        assert model is not None
        assert model.initial_quantity == 30
        assert model.remaining_quantity == 30
        assert model.is_exhausted is False
        assert model.shelf_life_days == 5
        assert model.unit_cost == 3.50


def test_fifo_ordering_earliest_expiry_first(session_factory, seeded_store):
    """2. FIFO / FEFO consumption: Earlier expiry date is consumed before newer batch."""
    tenant_id, store_id = seeded_store
    pid = "PROD_YOGURT_GREEK"
    tracker = BatchTracker(session_factory=session_factory)

    now = datetime.datetime.now(datetime.UTC)
    # Batch A: Expires in 3 days (10 units)
    b_a = tracker.receive_batch(
        tenant_id=tenant_id,
        store_id=store_id,
        product_id=pid,
        quantity=10,
        shelf_life_days=3,
        unit_cost=2.00,
        received_date=now - datetime.timedelta(days=1),
    )
    # Batch B: Expires in 7 days (20 units)
    b_b = tracker.receive_batch(
        tenant_id=tenant_id,
        store_id=store_id,
        product_id=pid,
        quantity=20,
        shelf_life_days=7,
        unit_cost=2.20,
        received_date=now,
    )

    # Deduct 14 units -> exhausts Batch A (10 units) and takes 4 from Batch B
    deductions = tracker.deduct_fifo(
        tenant_id=tenant_id,
        store_id=store_id,
        product_id=pid,
        quantity_to_deduct=14,
    )

    assert len(deductions) == 2
    assert deductions[0].batch_id == b_a.batch_id
    assert deductions[0].deducted_quantity == 10
    assert deductions[0].remaining_in_batch == 0

    assert deductions[1].batch_id == b_b.batch_id
    assert deductions[1].deducted_quantity == 4
    assert deductions[1].remaining_in_batch == 16

    # Verify database state
    with UnitOfWork(session_factory=session_factory) as uow:
        model_a = uow.batches.get_batch_by_id(tenant_id, store_id, b_a.batch_id)
        model_b = uow.batches.get_batch_by_id(tenant_id, store_id, b_b.batch_id)
        assert model_a.remaining_quantity == 0
        assert model_a.is_exhausted is True
        assert model_b.remaining_quantity == 16
        assert model_b.is_exhausted is False


def test_multi_batch_split_and_exhaustion(session_factory, seeded_store):
    """3. Multi-batch split: Deducting across 3 batches in a single operation."""
    tenant_id, store_id = seeded_store
    pid = "PROD_CHEESE_BRIE"
    tracker = BatchTracker(session_factory=session_factory)

    b1 = tracker.receive_batch(tenant_id, store_id, pid, quantity=10, shelf_life_days=5, unit_cost=5.0)
    b2 = tracker.receive_batch(tenant_id, store_id, pid, quantity=10, shelf_life_days=7, unit_cost=5.2)
    b3 = tracker.receive_batch(tenant_id, store_id, pid, quantity=10, shelf_life_days=10, unit_cost=5.5)

    # Deduct 25 units
    deductions = tracker.deduct_fifo(tenant_id, store_id, pid, 25)

    assert len(deductions) == 3
    assert [d.deducted_quantity for d in deductions] == [10, 10, 5]
    assert deductions[0].batch_id == b1.batch_id
    assert deductions[1].batch_id == b2.batch_id
    assert deductions[2].batch_id == b3.batch_id

    # Active batches query should only return b3 with 5 remaining
    active = tracker.get_batches(tenant_id, store_id, pid)
    assert len(active) == 1
    assert active[0].batch_id == b3.batch_id
    assert active[0].quantity == 5


def test_insufficient_stock_behavior(session_factory, seeded_store):
    """4. Insufficient stock: Deducts all available stock without becoming negative."""
    tenant_id, store_id = seeded_store
    pid = "PROD_SOUR_CREAM"
    tracker = BatchTracker(session_factory=session_factory)

    tracker.receive_batch(tenant_id, store_id, pid, quantity=12, shelf_life_days=6)

    # Request 20 units when only 12 are available
    deductions = tracker.deduct_fifo(tenant_id, store_id, pid, 20)

    assert len(deductions) == 1
    assert deductions[0].deducted_quantity == 12
    assert deductions[0].remaining_in_batch == 0

    # All active batches should now be empty
    assert len(tracker.get_batches(tenant_id, store_id, pid)) == 0


def test_input_validation(session_factory, seeded_store):
    """5. Input validation: Invalid quantities or shelf-lives raise appropriate errors."""
    tenant_id, store_id = seeded_store
    tracker = BatchTracker(session_factory=session_factory)

    with pytest.raises(ValueError, match="quantity must be greater than zero"):
        tracker.receive_batch(tenant_id, store_id, "PROD_TEST", quantity=0, shelf_life_days=5)

    with pytest.raises(ValueError, match="shelf life must be at least 1 day"):
        tracker.receive_batch(tenant_id, store_id, "PROD_TEST", quantity=10, shelf_life_days=0)

    # Negative deduction returns empty list safely
    assert tracker.deduct_fifo(tenant_id, store_id, "PROD_TEST", -5) == []
    assert tracker.deduct_fifo(tenant_id, store_id, "PROD_TEST", 0) == []


def test_cross_tenant_isolation_rejected(session_factory, seeded_store):
    """6. Multi-tenant isolation: Tenant B cannot access or deduct Tenant A's batches."""
    tenant_id_a, store_id_a = seeded_store
    tenant_id_b = f"tnt_{uuid.uuid4().hex[:6]}"
    store_id_b = f"STR_{uuid.uuid4().hex[:6].upper()}"

    # Register Tenant B and Store B
    with UnitOfWork(session_factory=session_factory, auto_commit=True) as uow:
        uow.tenants.create(tenant_id=tenant_id_b, business_name="Tenant B")
        uow.stores.create(tenant_id=tenant_id_b, store_id=store_id_b, store_name="Store B", location="West")

    tracker = BatchTracker(session_factory=session_factory)
    tracker.receive_batch(tenant_id_a, store_id_a, "PROD_APPLES", quantity=50, shelf_life_days=7)

    # Tenant B tries to access Store A's batches -> rejected
    with pytest.raises(PermissionError, match="belongs to tenant"):
        tracker.get_batches(tenant_id_b, store_id_a)

    with pytest.raises(PermissionError, match="belongs to tenant"):
        tracker.deduct_fifo(tenant_id_b, store_id_a, "PROD_APPLES", 5)

    with pytest.raises(PermissionError, match="belongs to tenant"):
        tracker.receive_batch(tenant_id_b, store_id_a, "PROD_APPLES", 10, shelf_life_days=7)


def test_expiring_batches_detection(session_factory, seeded_store):
    """7. Expiry filtering: get_expiring_soon accurately identifies batches within window."""
    tenant_id, store_id = seeded_store
    tracker = BatchTracker(session_factory=session_factory)

    now = datetime.datetime.now(datetime.UTC)
    # Batch 1: arrived 5 days ago, shelf life 6 days -> expires in 1 day
    tracker.receive_batch(
        tenant_id, store_id, "PROD_BERRIES", 10, shelf_life_days=6,
        received_date=now - datetime.timedelta(days=5),
    )
    # Batch 2: arrived today, shelf life 2 days -> expires in 2 days
    tracker.receive_batch(
        tenant_id, store_id, "PROD_PEACHES", 15, shelf_life_days=2,
        received_date=now,
    )
    # Batch 3: arrived today, shelf life 14 days -> expires in 14 days
    tracker.receive_batch(
        tenant_id, store_id, "PROD_JAM", 20, shelf_life_days=14,
        received_date=now,
    )

    # Within 2 days threshold: should return Batch 1 and Batch 2, but not Batch 3
    expiring = tracker.get_expiring_soon(tenant_id, store_id, within_days=2)
    expiring_pids = {b.product_id for b in expiring}
    assert "PROD_BERRIES" in expiring_pids
    assert "PROD_PEACHES" in expiring_pids
    assert "PROD_JAM" not in expiring_pids


def test_inventory_valuation_calculation(session_factory, seeded_store):
    """8. Valuation: Calculates total monetary value of active inventory batches."""
    tenant_id, store_id = seeded_store
    tracker = BatchTracker(session_factory=session_factory)

    pid1 = "PROD_WINE_RED"
    pid2 = "PROD_WINE_WHITE"

    tracker.receive_batch(tenant_id, store_id, pid1, quantity=10, shelf_life_days=30, unit_cost=15.00)
    tracker.receive_batch(tenant_id, store_id, pid2, quantity=20, shelf_life_days=30, unit_cost=12.00)

    # Total valuation = (10 * 15.00) + (20 * 12.00) = 150 + 240 = 390.00
    val_total = tracker.get_batch_inventory_valuation(tenant_id, store_id)
    assert val_total == 390.00

    # Specific product valuation
    val_pid1 = tracker.get_batch_inventory_valuation(tenant_id, store_id, pid1)
    assert val_pid1 == 150.00

    # Deduct 4 units of pid1
    tracker.deduct_fifo(tenant_id, store_id, pid1, 4)
    assert tracker.get_batch_inventory_valuation(tenant_id, store_id, pid1) == 90.00
    assert tracker.get_batch_inventory_valuation(tenant_id, store_id) == 330.00


def test_atomic_unit_of_work_rollback(session_factory, seeded_store):
    """9. Atomic rollback: Uncommitted deductions roll back cleanly on exception."""
    tenant_id, store_id = seeded_store
    pid = "PROD_BUTTER"
    tracker = BatchTracker(session_factory=session_factory)

    batch = tracker.receive_batch(tenant_id, store_id, pid, quantity=25, shelf_life_days=10, unit_cost=4.00)

    # Simulate an error inside a UnitOfWork transaction
    try:
        with UnitOfWork(session_factory=session_factory) as uow:
            tracker.deduct_fifo(tenant_id, store_id, pid, 15, uow=uow)
            # Raise exception before uow.commit()
            raise RuntimeError("Simulated transaction failure!")
    except RuntimeError:
        pass

    # In fresh session, batch remaining quantity must still be 25
    with UnitOfWork(session_factory=session_factory) as check_uow:
        model = check_uow.batches.get_batch_by_id(tenant_id, store_id, batch.batch_id)
        assert model.remaining_quantity == 25
        assert model.is_exhausted is False


def test_sales_pipeline_atomic_integration(session_factory, seeded_store):
    """10. SalesIngestionPipeline: End-to-end atomic coordination across POS, ledger, and batches."""
    tenant_id, store_id = seeded_store
    pid = "PROD_PASTA_FRESH"

    ledger = InventoryLedger(session_factory=session_factory)
    tracker = BatchTracker(session_factory=session_factory)
    pipeline = SalesIngestionPipeline(ledger=ledger, batch_tracker=tracker, session_factory=session_factory)

    # Initial receipt: +30 units
    ledger.record_movement(tenant_id, store_id, pid, MovementType.PURCHASE_RECEIPT, 30, "PO_PASTA_01")
    tracker.receive_batch(tenant_id, store_id, pid, 30, shelf_life_days=5, unit_cost=2.50)

    tx_id = f"TX_{uuid.uuid4().hex[:8]}"
    payload = {
        "transaction_id": tx_id,
        "items": [{"product_id": pid, "quantity": 12, "unit_price": 5.00}],
        "total_amount": 60.00,
    }

    result = pipeline.process_transaction(tenant_id, store_id, payload)
    assert result.status == "success"
    assert result.is_duplicate is False
    assert len(result.deductions) == 1
    assert result.deductions[0].deducted_quantity == 12
    assert result.deductions[0].remaining_in_batch == 18

    # Verify reconciliation across all database models
    with UnitOfWork(session_factory=session_factory) as uow:
        # 1. POS transaction recorded
        assert uow.pos_transactions.is_duplicate(tenant_id, store_id, tx_id) is True
        # 2. Ledger movement recorded (-12, net stock 18)
        assert uow.inventory_ledger.get_current_stock(tenant_id, store_id, pid) == 18
        # 3. Batch remaining quantity is 18
        active = uow.batches.get_active_batches(tenant_id, store_id, pid)
        assert len(active) == 1
        assert active[0].remaining_quantity == 18

    # Duplicate call is safely idempotent
    dup_result = pipeline.process_transaction(tenant_id, store_id, payload)
    assert dup_result.is_duplicate is True
    assert dup_result.status == "duplicate_skipped"


def test_dual_mode_pure_in_memory_compatibility():
    """11. Dual-mode compatibility: BatchTracker functions 100% in-memory without session_factory."""
    tracker = BatchTracker()  # No database configuration

    t_id = "tenant_research"
    s_id = "store_sim_01"
    pid = "FOODS_2_043_CA_1"

    b1 = tracker.receive_batch(t_id, s_id, pid, quantity=20, shelf_life_days=3, unit_cost=2.50)
    b2 = tracker.receive_batch(t_id, s_id, pid, quantity=30, shelf_life_days=6, unit_cost=2.60)

    assert b1.quantity == 20
    assert b2.quantity == 30
    assert len(tracker.get_batches(t_id, s_id, pid)) == 2
    assert tracker.get_batch_inventory_valuation(t_id, s_id, pid) == (20 * 2.50) + (30 * 2.60)

    deductions = tracker.deduct_fifo(t_id, s_id, pid, 25)
    assert len(deductions) == 2
    assert deductions[0].deducted_quantity == 20
    assert deductions[0].remaining_in_batch == 0
    assert deductions[1].deducted_quantity == 5
    assert deductions[1].remaining_in_batch == 25

    active = tracker.get_batches(t_id, s_id, pid)
    assert len(active) == 1
    assert active[0].quantity == 25


def test_concurrent_deduction_serialization(session_factory, seeded_store):
    """12. Concurrency serialization: Multi-threaded deductions serialize cleanly."""
    tenant_id, store_id = seeded_store
    pid = "PROD_CONCURRENT_MILK"
    tracker = BatchTracker(session_factory=session_factory)

    # Seed 50 units
    tracker.receive_batch(tenant_id, store_id, pid, quantity=50, shelf_life_days=10, unit_cost=3.0)

    # Launch 5 concurrent deduction workers, each deducting 8 units (total 40 units)
    def worker_deduct():
        local_tracker = BatchTracker(session_factory=session_factory)
        return local_tracker.deduct_fifo(tenant_id, store_id, pid, 8)

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(worker_deduct) for _ in range(5)]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]

    total_deducted = sum(sum(d.deducted_quantity for d in res) for res in results)
    assert total_deducted == 40

    # Remaining in database must be exactly 10
    with UnitOfWork(session_factory=session_factory) as check_uow:
        active = check_uow.batches.get_active_batches(tenant_id, store_id, pid)
        assert len(active) == 1
        assert active[0].remaining_quantity == 10


def test_live_postgresql_batch_concurrency():
    """13. Genuine PostgreSQL row-level locking (with_for_update) across independent sessions."""
    pg_url = os.environ.get("DATABASE_URL", "postgresql+psycopg2://periorder_user:periorder_pass@localhost:5432/periorder_db")
    try:
        engine = create_app_engine(database_url=pg_url)
        with engine.connect() as conn:
            conn.execute(select(1))
    except (SQLAlchemyError, OSError) as e:
        pytest.skip(f"Live PostgreSQL instance not reachable or configured: {e}")

    pg_factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    t_id = f"pg_bt_{uuid.uuid4().hex[:6]}"
    s_id = f"PG_STR_{uuid.uuid4().hex[:6]}"
    pid = "PG_FIFO_MILK"

    try:
        # Seed tenant, store, and batch
        with UnitOfWork(session_factory=pg_factory, auto_commit=True) as uow:
            uow.tenants.create(tenant_id=t_id, business_name="PG Batch Concurrency Tenant")
            uow.stores.create(tenant_id=t_id, store_id=s_id, store_name="PG Branch", location="Downtown")
            uow.batches.receive_batch(t_id, s_id, pid, quantity=100, shelf_life_days=7, unit_cost=3.50)

        # Compete two independent database sessions deducting 30 units each
        def deduct_worker():
            tracker = BatchTracker(session_factory=pg_factory)
            return tracker.deduct_fifo(t_id, s_id, pid, 30, for_update=True)

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            f1 = executor.submit(deduct_worker)
            f2 = executor.submit(deduct_worker)
            res1 = f1.result()
            res2 = f2.result()

        total_deducted = sum(d.deducted_quantity for d in res1) + sum(d.deducted_quantity for d in res2)
        assert total_deducted == 60

        with UnitOfWork(session_factory=pg_factory) as check_uow:
            batches = check_uow.batches.get_active_batches(t_id, s_id, pid)
            assert len(batches) == 1
            assert batches[0].remaining_quantity == 40

    finally:
        with pg_factory() as cleanup:
            cleanup.execute(delete(InventoryBatchModel).where(InventoryBatchModel.tenant_id == t_id))
            cleanup.execute(delete(StoreModel).where(StoreModel.tenant_id == t_id))
            cleanup.execute(delete(TenantModel).where(TenantModel.tenant_id == t_id))
            cleanup.commit()
