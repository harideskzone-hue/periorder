"""Tests for Stage 1 — Transaction Unit of Work.

Validates:
1. Shared database transaction boundary across multiple repositories.
2. All-or-nothing atomicity: successful commit persists all related changes.
3. Automatic rollback on exception: partial operations are completely undone.
4. Auto-commit mode behavior on normal exit vs exception.
5. Live PostgreSQL multi-repository transaction rollback and commit verification.
"""

from __future__ import annotations

import os
import uuid

import pytest
from sqlalchemy.orm import sessionmaker

from periorder.db import (
    UnitOfWork,
    create_app_engine,
    init_db,
)

TEST_UOW_DB = "./test_periorder_uow.db"


@pytest.fixture(scope="module")
def uow_engine():
    """Isolated SQLite engine for UnitOfWork tests."""
    if os.path.exists(TEST_UOW_DB):
        os.remove(TEST_UOW_DB)

    engine = create_app_engine(database_url=f"sqlite:///{TEST_UOW_DB}")
    init_db(engine)
    yield engine

    if os.path.exists(TEST_UOW_DB):
        try:
            os.remove(TEST_UOW_DB)
        except OSError:
            pass


@pytest.fixture
def session_factory(uow_engine):
    return sessionmaker(bind=uow_engine, autocommit=False, autoflush=False)


def test_uow_atomic_commit_across_repositories(session_factory):
    """Verify that multiple repository mutations within a UnitOfWork commit atomically."""
    t_id = f"tnt_{uuid.uuid4().hex[:6]}"
    s_id = "STORE_UOW_01"
    pid = "PROD_MANGO_01"
    tx_id = f"TX_{uuid.uuid4().hex[:8].upper()}"

    # Execute multi-table writes inside UnitOfWork
    with UnitOfWork(session_factory=session_factory) as uow:
        # 1. Tenant & Store
        uow.tenants.create(tenant_id=t_id, business_name="UOW Fresh Grocers")
        uow.stores.create(tenant_id=t_id, store_id=s_id, store_name="Downtown Mango Hub", location="Austin")

        # 2. Inventory Batch (+30 units)
        uow.batches.receive_batch(
            tenant_id=t_id,
            store_id=s_id,
            product_id=pid,
            quantity=30,
            shelf_life_days=5,
            unit_cost=3.50,
        )

        # 3. Inventory Movement (+30 units receipt)
        uow.inventory_ledger.record_movement(
            tenant_id=t_id,
            store_id=s_id,
            product_id=pid,
            movement_type="PURCHASE_RECEIPT",
            quantity=30,
            reference_id="PO_INITIAL",
        )

        # 4. POS Sale (-10 units)
        uow.pos_transactions.record_transaction(
            tenant_id=t_id,
            store_id=s_id,
            transaction_id=tx_id,
            raw_payload={"items": [{"product_id": pid, "quantity": 10}]},
            items_count=1,
            total_amount=50.0,
        )
        uow.batches.deduct_fifo(tenant_id=t_id, store_id=s_id, product_id=pid, quantity_to_deduct=10)
        uow.inventory_ledger.record_movement(
            tenant_id=t_id,
            store_id=s_id,
            product_id=pid,
            movement_type="POS_SALE",
            quantity=-10,
            reference_id=tx_id,
        )

        # Explicit atomic commit
        uow.commit()

    # Verify across a completely fresh session
    with UnitOfWork(session_factory=session_factory) as check_uow:
        # Tenant & Store persisted
        store = check_uow.stores.get_by_store_id(t_id, s_id)
        assert store is not None
        assert store.store_name == "Downtown Mango Hub"

        # POS Transaction persisted
        assert check_uow.pos_transactions.is_duplicate(t_id, s_id, tx_id) is True

        # Inventory Ledger stock reconciled (30 - 10 = 20)
        stock = check_uow.inventory_ledger.get_current_stock(t_id, s_id, pid)
        assert stock == 20

        # FIFO Batch remaining quantity updated
        active_batches = check_uow.batches.get_active_batches_fifo(t_id, s_id, pid)
        assert len(active_batches) == 1
        assert active_batches[0].remaining_quantity == 20


def test_uow_atomic_rollback_on_error(session_factory):
    """Verify that if an error occurs mid-transaction, all partial mutations are rolled back."""
    t_id = f"tnt_{uuid.uuid4().hex[:6]}"
    s_id = "STORE_ROLLBACK_01"
    pid = "PROD_BERRY_01"
    tx_id = f"TX_FAIL_{uuid.uuid4().hex[:6]}"

    # Setup parent tenant & store in advance
    with UnitOfWork(session_factory=session_factory, auto_commit=True) as setup_uow:
        setup_uow.tenants.create(tenant_id=t_id, business_name="Rollback Test Co")
        setup_uow.stores.create(tenant_id=t_id, store_id=s_id, store_name="Rollback Store", location="Dallas")
        setup_uow.batches.receive_batch(tenant_id=t_id, store_id=s_id, product_id=pid, quantity=50, shelf_life_days=3)

    # Attempt an atomic operation that fails halfway through
    with (
        pytest.raises(RuntimeError, match="Simulated crash during sale processing"),
        UnitOfWork(session_factory=session_factory) as uow,
    ):
        # 1. Record POS transaction
        uow.pos_transactions.record_transaction(
            tenant_id=t_id,
            store_id=s_id,
            transaction_id=tx_id,
            raw_payload={"items": [{"product_id": pid, "quantity": 15}]},
            items_count=1,
            total_amount=75.0,
        )

        # 2. Deduct FIFO
        uow.batches.deduct_fifo(tenant_id=t_id, store_id=s_id, product_id=pid, quantity_to_deduct=15)

        # 3. Simulate sudden error before ledger or commit
        raise RuntimeError("Simulated crash during sale processing")

    # Verify that the database rolled back completely
    with UnitOfWork(session_factory=session_factory) as verify_uow:
        # Transaction must NOT exist
        assert verify_uow.pos_transactions.is_duplicate(t_id, s_id, tx_id) is False

        # Batch quantity must NOT have been deducted (must still be 50)
        active_batches = verify_uow.batches.get_active_batches_fifo(t_id, s_id, pid)
        assert active_batches[0].remaining_quantity == 50


def test_uow_auto_commit_mode(session_factory):
    """Verify auto_commit=True commits on clean exit without explicit uow.commit()."""
    t_id = f"tnt_{uuid.uuid4().hex[:6]}"
    s_id = "STORE_AUTO_01"

    with UnitOfWork(session_factory=session_factory, auto_commit=True) as uow:
        uow.tenants.create(tenant_id=t_id, business_name="Auto Commit Co")
        uow.stores.create(tenant_id=t_id, store_id=s_id, store_name="Auto Store", location="Houston")

    with UnitOfWork(session_factory=session_factory) as verify_uow:
        store = verify_uow.stores.get_by_store_id(t_id, s_id)
        assert store is not None
        assert store.store_name == "Auto Store"


def test_uow_postgresql_live_atomic_transaction():
    """Verify UnitOfWork atomic commit and rollback against live PostgreSQL."""
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
    t_id = f"pg_uow_{uuid.uuid4().hex[:6]}"
    s_id = "PG_UOW_BRANCH"
    pid = "PG_ORGANIC_MILK"
    tx_id = f"PG_TX_{uuid.uuid4().hex[:6]}"

    try:
        # 1. Atomic commit on PostgreSQL
        with UnitOfWork(session_factory=pg_factory, auto_commit=True) as uow:
            uow.tenants.create(tenant_id=t_id, business_name="Live PG UOW Org")
            uow.stores.create(tenant_id=t_id, store_id=s_id, store_name="PG Branch", location="SF")
            uow.batches.receive_batch(t_id, s_id, pid, quantity=40, shelf_life_days=4, unit_cost=5.0)
            uow.inventory_ledger.record_movement(t_id, s_id, pid, "PURCHASE_RECEIPT", 40, "PO_PG")
            uow.pos_transactions.record_transaction(t_id, s_id, tx_id, {"raw": 1}, 1, 20.0)
            uow.batches.deduct_fifo(t_id, s_id, pid, 10, for_update=True)
            uow.inventory_ledger.record_movement(t_id, s_id, pid, "POS_SALE", -10, tx_id)

        # 2. Check persistence in fresh PostgreSQL session
        with UnitOfWork(session_factory=pg_factory) as check_uow:
            stock = check_uow.inventory_ledger.get_current_stock(t_id, s_id, pid)
            assert stock == 30
            batches = check_uow.batches.get_active_batches_fifo(t_id, s_id, pid)
            assert batches[0].remaining_quantity == 30

        # 3. Verify rollback on PostgreSQL
        fail_tx_id = f"PG_FAIL_{uuid.uuid4().hex[:6]}"
        with (
            pytest.raises(RuntimeError),
            UnitOfWork(session_factory=pg_factory) as fail_uow,
        ):
            fail_uow.pos_transactions.record_transaction(t_id, s_id, fail_tx_id, {"raw": 2}, 1, 10.0)
            fail_uow.batches.deduct_fifo(t_id, s_id, pid, 15, for_update=True)
            raise RuntimeError("Postgres fail test")

        with UnitOfWork(session_factory=pg_factory) as verify_uow:
            assert verify_uow.pos_transactions.is_duplicate(t_id, s_id, fail_tx_id) is False
            batches = verify_uow.batches.get_active_batches_fifo(t_id, s_id, pid)
            assert batches[0].remaining_quantity == 30  # Still 30, not 15!

    finally:
        # Cleanup test records
        with pg_factory() as cleanup_session:
            cleanup_session.execute(delete(InventoryMovementModel).where(InventoryMovementModel.tenant_id == t_id))
            cleanup_session.execute(delete(InventoryBatchModel).where(InventoryBatchModel.tenant_id == t_id))
            cleanup_session.execute(delete(POSTransactionModel).where(POSTransactionModel.tenant_id == t_id))
            cleanup_session.execute(delete(StoreModel).where(StoreModel.tenant_id == t_id))
            cleanup_session.execute(delete(TenantModel).where(TenantModel.tenant_id == t_id))
            cleanup_session.commit()
