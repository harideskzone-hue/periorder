"""Tests for Step 3 — Stage 3: PostgreSQL Inventory Movement Ledger Migration.

Validates the mandatory acceptance criteria:
1. Purchase receipt: Positive movement persisted in database.
2. POS sale: Negative movement persisted within the caller's UnitOfWork without independent commit.
3. Stock adjustment: New adjustment movement created with calculated delta; original rows unchanged.
4. Historical query: Movements survive application restart.
5. Cross-tenant query: Access strictly rejected with PermissionError.
6. Ledger correction: Append-only semantics preserve historical rows.
7. Transaction rollback: New movement disappears if transaction fails.
8. Research simulation: Compatibility with M5 research simulation (in-memory mode).
9. Four Production-Readiness Checks:
   A. Avoid dual sources of truth: Authoritative PostgreSQL inventory and sales.
   B. Verify genuine PostgreSQL concurrency: Two separate sessions submitting the same transaction simultaneously.
   C. Handle transaction ID collisions carefully: Comparing canonical payload returns conflict on reused IDs with different items.
   D. Verify rollback after duplicate conflicts: SQLAlchemy IntegrityError session rolled back cleanly.
"""

from __future__ import annotations

import concurrent.futures
import os
import uuid

import pytest
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import sessionmaker

from periorder.db import (
    UnitOfWork,
    create_app_engine,
    init_db,
)
from periorder.db.models import (
    InventoryBatchModel,
    InventoryMovementModel,
    POSTransactionModel,
    StoreModel,
    TenantModel,
)
from periorder.inventory.batches import BatchTracker
from periorder.inventory.ledger import InventoryLedger, MovementType
from periorder.sales.ingestion import SalesIngestionPipeline

TEST_LEDGER_DB = "./test_periorder_ledger_stage3.db"


@pytest.fixture(scope="module")
def ledger_db_engine():
    """Isolated SQLite engine for Inventory Ledger Stage 3 tests."""
    if os.path.exists(TEST_LEDGER_DB):
        os.remove(TEST_LEDGER_DB)

    engine = create_app_engine(database_url=f"sqlite:///{TEST_LEDGER_DB}")
    init_db(engine)
    yield engine

    if os.path.exists(TEST_LEDGER_DB):
        try:
            os.remove(TEST_LEDGER_DB)
        except OSError:
            pass


@pytest.fixture
def session_factory(ledger_db_engine):
    return sessionmaker(bind=ledger_db_engine, autocommit=False, autoflush=False)


@pytest.fixture
def seeded_store(session_factory):
    """Seed a tenant and store in the database."""
    t_id = f"tnt_{uuid.uuid4().hex[:6]}"
    s_id = f"STR_{uuid.uuid4().hex[:6].upper()}"

    with UnitOfWork(session_factory=session_factory, auto_commit=True) as uow:
        uow.tenants.create(tenant_id=t_id, business_name="Organic Supermarket Co")
        uow.stores.create(
            tenant_id=t_id,
            store_id=s_id,
            store_name="Northside Branch",
            location="Seattle, WA",
        )

    return t_id, s_id


# ---------------------------------------------------------------------------
# Mandatory Stage 3 Tests
# ---------------------------------------------------------------------------


def test_purchase_receipt_positive_movement_persisted(session_factory, seeded_store):
    """1. Purchase receipt: Positive movement persisted in database."""
    tenant_id, store_id = seeded_store
    pid = "PROD_AVOCADO_HASS"

    ledger = InventoryLedger(session_factory=session_factory)
    mov = ledger.record_movement(
        tenant_id=tenant_id,
        store_id=store_id,
        product_id=pid,
        movement_type=MovementType.PURCHASE_RECEIPT,
        quantity=50,
        reference_id="PO_98765",
        notes="Received fresh batch from California",
    )

    assert mov.quantity == 50
    assert mov.movement_type == MovementType.PURCHASE_RECEIPT

    # Check persistence directly in database
    with UnitOfWork(session_factory=session_factory) as uow:
        assert uow.session is not None
        stock = uow.inventory_ledger.get_current_stock(tenant_id, store_id, pid)
        assert stock == 50

        movements = uow.inventory_ledger.list_movements(tenant_id, store_id, product_id=pid)
        assert len(movements) == 1
        assert movements[0].quantity == 50
        assert movements[0].movement_type == "purchase_receipt"
        assert movements[0].reference_id == "PO_98765"


def test_pos_sale_negative_movement_single_uow(session_factory, seeded_store):
    """2. POS sale: Negative movement persisted within the caller's UnitOfWork without independent commit."""
    tenant_id, store_id = seeded_store
    pid = "PROD_STRAWBERRIES"
    tx_id = f"TX_POS_{uuid.uuid4().hex[:6]}"

    ledger = InventoryLedger(session_factory=session_factory)
    tracker = BatchTracker()

    # Initial receipt of 100 units
    ledger.record_movement(
        tenant_id=tenant_id,
        store_id=store_id,
        product_id=pid,
        movement_type=MovementType.PURCHASE_RECEIPT,
        quantity=100,
        reference_id="INIT_RECEIPT",
    )

    pipeline = SalesIngestionPipeline(
        ledger=ledger,
        batch_tracker=tracker,
        session_factory=session_factory,
    )

    result = pipeline.process_transaction(
        tenant_id=tenant_id,
        store_id=store_id,
        transaction_data={
            "transaction_id": tx_id,
            "items": [{"product_id": pid, "quantity": 18, "unit_price": 4.50}],
            "total_amount": 81.0,
        },
    )

    assert result.status == "success"
    assert result.is_duplicate is False

    # Verify atomic persistence in database:
    # Both POSTransactionModel and InventoryMovementModel must exist
    with UnitOfWork(session_factory=session_factory) as uow:
        assert uow.session is not None
        assert uow.pos_transactions.is_duplicate(tenant_id, store_id, tx_id) is True

        stock = uow.inventory_ledger.get_current_stock(tenant_id, store_id, pid)
        assert stock == 82  # 100 - 18

        movements = uow.inventory_ledger.list_movements(tenant_id, store_id, product_id=pid)
        assert len(movements) == 2
        # Most recent movement is the negative POS sale
        assert movements[0].quantity == -18
        assert movements[0].movement_type == "pos_sale"
        assert movements[0].reference_id == tx_id


def test_stock_adjustment_creates_new_movement(session_factory, seeded_store):
    """3. Stock adjustment: New adjustment movement created with calculated delta; original rows unchanged."""
    tenant_id, store_id = seeded_store
    pid = "PROD_MANGOES"

    ledger = InventoryLedger(session_factory=session_factory)

    # Initial stock: 40 units
    ledger.record_movement(
        tenant_id=tenant_id,
        store_id=store_id,
        product_id=pid,
        movement_type=MovementType.PURCHASE_RECEIPT,
        quantity=40,
        reference_id="PO_MANGOS",
    )

    # Stocktake finds 35 units (delta: -5)
    adj_mov1 = ledger.record_correction(
        tenant_id=tenant_id,
        store_id=store_id,
        product_id=pid,
        corrected_quantity=35,
        reason="Physical count audit discrepancy",
    )
    assert adj_mov1 is not None
    assert adj_mov1.quantity == -5
    assert adj_mov1.movement_type == MovementType.STOCK_CORRECTION
    assert ledger.get_stock(tenant_id, store_id, pid) == 35

    # Another stocktake finds 38 units (delta: +3)
    adj_mov2 = ledger.record_correction(
        tenant_id=tenant_id,
        store_id=store_id,
        product_id=pid,
        corrected_quantity=38,
        reason="Found misplaced crate in back room",
    )
    assert adj_mov2 is not None
    assert adj_mov2.quantity == +3
    assert ledger.get_stock(tenant_id, store_id, pid) == 38

    # Calling with current quantity requires no correction
    adj_noop = ledger.record_correction(
        tenant_id=tenant_id,
        store_id=store_id,
        product_id=pid,
        corrected_quantity=38,
    )
    assert adj_noop is None


def test_historical_query_survives_restart(session_factory, seeded_store):
    """4. Historical query: Movements survive application restart in a fresh ledger instance."""
    tenant_id, store_id = seeded_store
    pid = "PROD_BLUEBERRIES"

    # Ledger instance 1 records multiple events
    ledger1 = InventoryLedger(session_factory=session_factory)
    ledger1.record_movement(tenant_id, store_id, pid, MovementType.PURCHASE_RECEIPT, 60, "PO_1")
    ledger1.record_movement(tenant_id, store_id, pid, MovementType.POS_SALE, -12, "TX_1")
    ledger1.record_correction(tenant_id, store_id, pid, 45, reason="Spoilage")

    # Destroy instance 1 and simulate application restart
    del ledger1

    # Instance 2 has clean in-memory state but connected to database
    ledger2 = InventoryLedger(session_factory=session_factory)

    # Reconciled stock must match 45
    assert ledger2.get_stock(tenant_id, store_id, pid) == 45

    # Movement history must return all 3 movements ordered chronologically descending
    movements = ledger2.get_movements(tenant_id, store_id, product_id=pid)
    assert len(movements) == 3
    assert movements[0].movement_type == MovementType.STOCK_CORRECTION
    assert movements[0].quantity == -3  # 48 -> 45
    assert movements[1].movement_type == MovementType.POS_SALE
    assert movements[1].quantity == -12
    assert movements[2].movement_type == MovementType.PURCHASE_RECEIPT
    assert movements[2].quantity == 60


def test_cross_tenant_access_rejected(session_factory, seeded_store):
    """5. Cross-tenant query: Access strictly rejected with PermissionError."""
    tenant_id, store_id = seeded_store
    pid = "PROD_ORGANIC_CHEESE"

    ledger = InventoryLedger(session_factory=session_factory)
    ledger.record_movement(
        tenant_id=tenant_id,
        store_id=store_id,
        product_id=pid,
        movement_type=MovementType.PURCHASE_RECEIPT,
        quantity=30,
        reference_id="PO_CHEESE",
    )

    foreign_tenant = "tnt_foreign_unauthorized"

    # 1. Reject cross-tenant movements query
    with pytest.raises(PermissionError) as exc_info:
        ledger.get_movements(tenant_id=foreign_tenant, store_id=store_id)
    assert "Access rejected" in str(exc_info.value)

    # 2. Reject cross-tenant stock query
    with pytest.raises(PermissionError) as exc_info:
        ledger.get_stock(tenant_id=foreign_tenant, store_id=store_id, product_id=pid)
    assert "Access rejected" in str(exc_info.value)

    # 3. Reject cross-tenant movement insertion
    with pytest.raises(PermissionError) as exc_info:
        ledger.record_movement(
            tenant_id=foreign_tenant,
            store_id=store_id,
            product_id=pid,
            movement_type=MovementType.PURCHASE_RECEIPT,
            quantity=10,
        )
    assert "Access rejected" in str(exc_info.value)


def test_ledger_correction_preserves_historical_movements(session_factory, seeded_store):
    """6. Ledger correction: Original movements remain unchanged (immutable append-only log)."""
    tenant_id, store_id = seeded_store
    pid = "PROD_ROASTED_COFFEE"

    ledger = InventoryLedger(session_factory=session_factory)
    mov1 = ledger.record_movement(tenant_id, store_id, pid, MovementType.PURCHASE_RECEIPT, 50, "PO_COFFEE")
    mov2 = ledger.record_movement(tenant_id, store_id, pid, MovementType.POS_SALE, -10, "TX_COFFEE")

    # Record correction
    corr = ledger.record_correction(tenant_id, store_id, pid, 35, reason="Damaged bags")
    assert corr is not None

    with UnitOfWork(session_factory=session_factory) as uow:
        assert uow.session is not None
        all_movs = uow.inventory_ledger.list_movements(tenant_id, store_id, product_id=pid)
        assert len(all_movs) == 3

        # Assert historical records were NOT edited
        po_mov = next(m for m in all_movs if m.reference_id == "PO_COFFEE")
        assert po_mov.quantity == 50
        assert po_mov.movement_type == "purchase_receipt"
        assert str(po_mov.id) == mov1.movement_id

        tx_mov = next(m for m in all_movs if m.reference_id == "TX_COFFEE")
        assert tx_mov.quantity == -10
        assert tx_mov.movement_type == "pos_sale"
        assert str(tx_mov.id) == mov2.movement_id


def test_transaction_rollback_movement_disappears(session_factory, seeded_store):
    """7. Transaction rollback: New movement disappears if enclosing transaction fails."""
    tenant_id, store_id = seeded_store
    pid = "PROD_HONEY_JAR"

    ledger = InventoryLedger(session_factory=session_factory)
    ledger.record_movement(tenant_id, store_id, pid, MovementType.PURCHASE_RECEIPT, 25, "PO_INIT")
    assert ledger.get_stock(tenant_id, store_id, pid) == 25

    # Attempt a transaction that records a movement then fails before commit
    with pytest.raises(RuntimeError), UnitOfWork(session_factory=session_factory) as uow:
        ledger.record_movement(
            tenant_id=tenant_id,
            store_id=store_id,
            product_id=pid,
            movement_type=MovementType.POS_SALE,
            quantity=-5,
            reference_id="TX_ABORTED",
            uow=uow,
        )
        # Simulate unexpected failure
        raise RuntimeError("Database constraint or service crash simulated.")

    # Stock must remain 25, and aborted movement must not exist
    assert ledger.get_stock(tenant_id, store_id, pid) == 25
    with UnitOfWork(session_factory=session_factory) as check_uow:
        assert check_uow.session is not None
        movs = check_uow.inventory_ledger.list_movements(tenant_id, store_id, product_id=pid)
        assert len(movs) == 1
        assert movs[0].reference_id == "PO_INIT"


def test_research_simulation_compatibility():
    """8. Research simulation: Compatibility with M5 research simulator (pure in-memory execution)."""
    ledger = InventoryLedger()  # No session_factory
    t_id, s_id, pid = "tnt_sim", "STR_SIM", "PROD_M5_ITEM"

    # In-memory receipt
    ledger.record_movement(t_id, s_id, pid, MovementType.PURCHASE_RECEIPT, 100)
    assert ledger.get_stock(t_id, s_id, pid) == 100

    # In-memory sale
    ledger.record_movement(t_id, s_id, pid, MovementType.POS_SALE, -20)
    assert ledger.get_stock(t_id, s_id, pid) == 80

    # In-memory append-only correction
    corr = ledger.record_correction(t_id, s_id, pid, 75, reason="In-memory audit")
    assert corr is not None
    assert corr.quantity == -5
    assert ledger.get_stock(t_id, s_id, pid) == 75

    # Movements list
    movs = ledger.get_movements(t_id, s_id, product_id=pid)
    assert len(movs) == 3

    # In-memory rollback
    ledger.rollback_movement(corr)
    assert ledger.get_stock(t_id, s_id, pid) == 80


# ---------------------------------------------------------------------------
# Four Production-Readiness Checks
# ---------------------------------------------------------------------------


def test_check_a_postgresql_authoritative_source(session_factory, seeded_store):
    """Check A: Avoid dual sources of truth — PostgreSQL is authoritative for inventory and sales."""
    tenant_id, store_id = seeded_store
    pid = "PROD_FRESH_APPLES"

    ledger = InventoryLedger(session_factory=session_factory)
    ledger.record_movement(tenant_id, store_id, pid, MovementType.PURCHASE_RECEIPT, 80, "PO_AUTH")

    # Directly modify database to simulate an external worker updating inventory
    with session_factory() as ext_session:
        ext_mov = InventoryMovementModel(
            tenant_id=tenant_id,
            store_id=store_id,
            product_id=pid,
            movement_type="pos_sale",
            quantity=-10,
            reference_id="TX_WORKER_2",
            notes="Direct external update from worker 2",
        )
        ext_session.add(ext_mov)
        ext_session.commit()

    # Authoritative get_stock must immediately reflect the external database update (70, not in-memory 80)
    assert ledger.get_stock(tenant_id, store_id, pid) == 70

    # Authoritative get_movements must immediately show worker 2's movement
    movs = ledger.get_movements(tenant_id, store_id, product_id=pid)
    assert len(movs) == 2
    assert movs[0].reference_id == "TX_WORKER_2"


def test_check_c_transaction_id_collision_rejected(session_factory, seeded_store):
    """Check C: Reused transaction ID with differing payload returns a conflict error."""
    tenant_id, store_id = seeded_store
    pid_a = "PROD_ITEM_A"
    pid_b = "PROD_ITEM_B"
    tx_id = f"TX_COLLISION_{uuid.uuid4().hex[:6]}"

    pipeline = SalesIngestionPipeline(session_factory=session_factory)

    # 1. First submission: Product A, quantity 2, total $10.00
    res1 = pipeline.process_transaction(
        tenant_id=tenant_id,
        store_id=store_id,
        transaction_data={
            "transaction_id": tx_id,
            "items": [{"product_id": pid_a, "quantity": 2, "unit_price": 5.0}],
            "total_amount": 10.0,
        },
    )
    assert res1.status == "success"

    # 2. Second submission with SAME transaction_id but DIFFERENT items: Product B, quantity 5
    with pytest.raises(ValueError) as exc_info:
        pipeline.process_transaction(
            tenant_id=tenant_id,
            store_id=store_id,
            transaction_data={
                "transaction_id": tx_id,
                "items": [{"product_id": pid_b, "quantity": 5, "unit_price": 4.0}],
                "total_amount": 20.0,
            },
        )
    assert "Payload conflict" in str(exc_info.value)
    assert "different payload content" in str(exc_info.value)

    # 3. Third submission with SAME transaction_id and SAME payload: accepted safely as duplicate
    res3 = pipeline.process_transaction(
        tenant_id=tenant_id,
        store_id=store_id,
        transaction_data={
            "transaction_id": tx_id,
            "items": [{"product_id": pid_a, "quantity": 2, "unit_price": 5.0}],
            "total_amount": 10.0,
        },
    )
    assert res3.status == "duplicate_skipped"
    assert res3.is_duplicate is True


def test_check_d_rollback_after_duplicate_conflicts(session_factory, seeded_store):
    """Check D: Verify rollback after duplicate conflicts — failed session is not left open."""
    tenant_id, store_id = seeded_store
    pid = "PROD_ROLLBACK_TEST"
    tx_id = f"TX_RB_{uuid.uuid4().hex[:6]}"

    # Insert an existing transaction record directly
    with UnitOfWork(session_factory=session_factory, auto_commit=True) as uow:
        uow.pos_transactions.record_transaction(
            tenant_id=tenant_id,
            store_id=store_id,
            transaction_id=tx_id,
            raw_payload={"items": [{"product_id": pid, "quantity": 5}]},
            items_count=1,
            total_amount=15.0,
        )

    # Attempting to insert a duplicate in a UnitOfWork catches IntegrityError and rolls back cleanly
    with pytest.raises(IntegrityError), UnitOfWork(session_factory=session_factory) as uow:
        assert uow.session is not None
        # Directly attempt duplicate insert
        uow.pos_transactions.record_transaction(
            tenant_id=tenant_id,
            store_id=store_id,
            transaction_id=tx_id,
            raw_payload={"duplicate": True},
            items_count=1,
            total_amount=15.0,
        )
        uow.commit()

    # Verify the failed session was closed and a new transaction can immediately execute without error
    with UnitOfWork(session_factory=session_factory, auto_commit=True) as fresh_uow:
        assert fresh_uow.session is not None
        fresh_tx_id = f"TX_FRESH_{uuid.uuid4().hex[:6]}"
        new_tx = fresh_uow.pos_transactions.record_transaction(
            tenant_id=tenant_id,
            store_id=store_id,
            transaction_id=fresh_tx_id,
            raw_payload={"status": "clean"},
            items_count=1,
            total_amount=5.0,
        )
        assert new_tx.transaction_id == fresh_tx_id


def test_check_b_live_postgresql_genuine_concurrency():
    """Check B: Genuine PostgreSQL concurrency with two separate database sessions."""
    pg_url = os.environ.get("DATABASE_URL", "postgresql://localhost:5432/periorder_db")
    try:
        engine = create_app_engine(database_url=pg_url)
        with engine.connect() as conn:
            conn.execute(select(1))
    except (SQLAlchemyError, OSError) as e:
        pytest.skip(f"PostgreSQL local instance not reachable: {e}")

    pg_factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    t_id = f"pg_cc_{uuid.uuid4().hex[:6]}"
    s_id = f"PG_STR_{uuid.uuid4().hex[:6]}"
    pid = "PG_CONCURRENT_MILK"
    tx_id = f"PG_TX_CONC_{uuid.uuid4().hex[:6]}"

    try:
        # Seed tenant and store
        with UnitOfWork(session_factory=pg_factory, auto_commit=True) as uow:
            uow.tenants.create(tenant_id=t_id, business_name="Live PG Concurrency Org")
            uow.stores.create(tenant_id=t_id, store_id=s_id, store_name="Flagship", location="Live Test")
            uow.inventory_ledger.record_movement(t_id, s_id, pid, "purchase_receipt", 100, "INIT_PG")

        payload = {
            "transaction_id": tx_id,
            "items": [{"product_id": pid, "quantity": 10, "unit_price": 3.0}],
            "total_amount": 30.0,
        }

        # Compete two separate pipeline instances backed by independent DB sessions
        def submit_tx():
            pipe = SalesIngestionPipeline(session_factory=pg_factory)
            return pipe.process_transaction(t_id, s_id, payload)

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            f1 = executor.submit(submit_tx)
            f2 = executor.submit(submit_tx)
            r1 = f1.result()
            r2 = f2.result()

        # Exactly one must succeed and one must be duplicate_skipped
        statuses = {r1.status, r2.status}
        assert statuses == {"success", "duplicate_skipped"}

        # Verify in PostgreSQL: Exactly ONE transaction row and ONE deduction movement exist
        with UnitOfWork(session_factory=pg_factory) as check_uow:
            assert check_uow.session is not None
            tx_count = check_uow.pos_transactions.get_transaction_count(t_id, s_id)
            assert tx_count == 1

            stock = check_uow.inventory_ledger.get_current_stock(t_id, s_id, pid)
            assert stock == 90  # 100 - 10 (not double deducted!)

            movs = check_uow.inventory_ledger.list_movements(t_id, s_id, product_id=pid)
            assert len(movs) == 2  # receipt + 1 sale

    finally:
        with pg_factory() as cleanup:
            cleanup.execute(delete(InventoryMovementModel).where(InventoryMovementModel.tenant_id == t_id))
            cleanup.execute(delete(InventoryBatchModel).where(InventoryBatchModel.tenant_id == t_id))
            cleanup.execute(delete(POSTransactionModel).where(POSTransactionModel.tenant_id == t_id))
            cleanup.execute(delete(StoreModel).where(StoreModel.tenant_id == t_id))
            cleanup.execute(delete(TenantModel).where(TenantModel.tenant_id == t_id))
            cleanup.commit()
