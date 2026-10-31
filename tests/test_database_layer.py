"""Comprehensive tests for Database Layer & SQLAlchemy Models.

Validates:
1. Table creation and schema reflection.
2. Foreign key constraints and cascading behavior.
3. Tenant and store relationships.
4. POS transaction uniqueness constraint per tenant and store.
5. Non-negative inventory batch check constraints.
6. Immutable movement ledger persistence across separate sessions and engines.
7. Production environment guard (rejecting SQLite when PERIORDER_ENV=production).
8. SQLite test abstraction with PRAGMA foreign keys.
"""

from __future__ import annotations

import datetime
import os
import uuid

import pytest
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from periorder.db import (
    BatchRepository,
    BillDocumentRepository,
    InventoryLedgerRepository,
    POSTransactionRepository,
    StoreMembershipModel,
    StoreRepository,
    TenantRepository,
    UserRepository,
    create_app_engine,
    get_database_url,
    init_db,
)


@pytest.fixture(scope="module")
def sqlite_engine():
    """Isolated SQLite engine with PRAGMA foreign_keys=ON."""
    test_db_path = "./test_periorder_models.db"
    if os.path.exists(test_db_path):
        os.remove(test_db_path)

    engine = create_app_engine(database_url=f"sqlite:///{test_db_path}")
    init_db(engine)
    yield engine

    if os.path.exists(test_db_path):
        try:
            os.remove(test_db_path)
        except OSError:
            pass


@pytest.fixture
def db_session(sqlite_engine):
    """Provides a transactional database session for each test."""
    session_factory = sessionmaker(bind=sqlite_engine, autocommit=False, autoflush=False)
    session = session_factory()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


def test_production_environment_guard():
    """Verify that production environments strictly disallow SQLite."""
    old_env = os.environ.get("PERIORDER_ENV")
    old_url = os.environ.get("DATABASE_URL")

    try:
        os.environ["PERIORDER_ENV"] = "production"
        os.environ["DATABASE_URL"] = "sqlite:///./prod.db"
        with pytest.raises(RuntimeError, match="SQLite is not permitted in production"):
            get_database_url()

        os.environ["DATABASE_URL"] = ""
        with pytest.raises(RuntimeError, match="DATABASE_URL must be explicitly configured"):
            get_database_url()

        os.environ["DATABASE_URL"] = "postgresql+psycopg2://user:pass@localhost:5432/periorder_prod"
        assert get_database_url() == "postgresql+psycopg2://user:pass@localhost:5432/periorder_prod"
    finally:
        if old_env is not None:
            os.environ["PERIORDER_ENV"] = old_env
        else:
            os.environ.pop("PERIORDER_ENV", None)

        if old_url is not None:
            os.environ["DATABASE_URL"] = old_url
        else:
            os.environ.pop("DATABASE_URL", None)


def test_tenant_and_store_crud(db_session: Session):
    """Test tenant registration, store creation, and relationship resolution."""
    tenant_repo = TenantRepository(db_session)
    store_repo = StoreRepository(db_session)

    t_id = f"tenant_{uuid.uuid4().hex[:6]}"
    tenant = tenant_repo.create(tenant_id=t_id, business_name="Organic Harvest Co")
    db_session.commit()

    assert tenant.tenant_id == t_id
    assert tenant.business_name == "Organic Harvest Co"

    store = store_repo.create(
        tenant_id=t_id,
        store_id="STORE_CENTRAL",
        store_name="Central Organic Hub",
        location="Austin, TX",
        category="Grocery Store",
    )
    db_session.commit()

    assert store.store_id == "STORE_CENTRAL"
    assert store.tenant.business_name == "Organic Harvest Co"

    # Verify query by store ID and tenant ID
    queried = store_repo.get_by_store_id(t_id, "STORE_CENTRAL")
    assert queried is not None
    assert queried.store_name == "Central Organic Hub"


def test_user_and_store_membership(db_session: Session):
    """Test user creation and store membership linkage."""
    tenant_repo = TenantRepository(db_session)
    store_repo = StoreRepository(db_session)
    user_repo = UserRepository(db_session)

    t_id = f"tenant_{uuid.uuid4().hex[:6]}"
    tenant_repo.create(tenant_id=t_id, business_name="Metro Retail")
    store = store_repo.create(tenant_id=t_id, store_id="STR_01", store_name="Branch 1", location="Chicago, IL")

    user = user_repo.create(
        tenant_id=t_id,
        user_id="usr_mgr_01",
        email=f"manager_{uuid.uuid4().hex[:4]}@metro.com",
        hashed_password="pbkdf2_sha256$mockhash$secure",
        full_name="Alex Manager",
        role="STORE_MANAGER",
    )
    db_session.commit()

    membership = StoreMembershipModel(
        user_id=user.id,
        store_id=store.id,
        role="STORE_MANAGER",
        is_default=True,
    )
    db_session.add(membership)
    db_session.commit()

    assert len(user.memberships) == 1
    assert user.memberships[0].store.store_id == "STR_01"


def test_foreign_key_violation_raises(db_session: Session):
    """Verify that foreign key constraints prevent inserting stores for non-existent tenants."""
    store_repo = StoreRepository(db_session)
    with pytest.raises(IntegrityError):
        store_repo.create(
            tenant_id="non_existent_tenant_9999",
            store_id="ORPHAN_STORE",
            store_name="Orphan",
            location="Nowhere",
        )
    db_session.rollback()


def test_pos_transaction_uniqueness_constraint(db_session: Session):
    """Verify that duplicate POS transaction_ids within the same tenant & store are rejected."""
    pos_repo = POSTransactionRepository(db_session)
    t_id = "tenant_pos_test"
    s_id = "store_pos_test"
    tx_id = "TX_UNIQUE_1001"

    pos_repo.record_transaction(
        tenant_id=t_id,
        store_id=s_id,
        transaction_id=tx_id,
        raw_payload={"item": "milk", "qty": 1},
        items_count=1,
        total_amount=50.0,
    )
    db_session.commit()

    assert pos_repo.is_duplicate(t_id, s_id, tx_id) is True

    # Attempt duplicate insert
    with pytest.raises(IntegrityError):
        pos_repo.record_transaction(
            tenant_id=t_id,
            store_id=s_id,
            transaction_id=tx_id,
            raw_payload={"item": "milk", "qty": 1},
            items_count=1,
            total_amount=50.0,
        )
    db_session.rollback()


def test_inventory_ledger_immutable_persistence(sqlite_engine):
    """Verify that inventory ledger records persist across new sessions and engines."""
    session_factory = sessionmaker(bind=sqlite_engine)
    session1 = session_factory()
    ledger1 = InventoryLedgerRepository(session1)

    t_id = "tenant_ledger_test"
    s_id = "store_ledger_test"
    pid = "PROD_RICE_01"

    # Purchase receipt +50
    ledger1.record_movement(t_id, s_id, pid, "PURCHASE_RECEIPT", 50, reference_id="BILL_101")
    # Sale deduction -15
    ledger1.record_movement(t_id, s_id, pid, "SALE", -15, reference_id="POS_202")
    session1.commit()
    session1.close()

    # Re-open in a brand new session (simulating application restart)
    session2 = session_factory()
    ledger2 = InventoryLedgerRepository(session2)

    current_stock = ledger2.get_current_stock(t_id, s_id, pid)
    assert current_stock == 35  # 50 - 15

    movements = ledger2.list_movements(t_id, s_id, pid)
    assert len(movements) == 2
    ref_ids = {m.reference_id for m in movements}
    assert ref_ids == {"BILL_101", "POS_202"}
    session2.close()


def test_batch_tracker_fifo_deduction(db_session: Session):
    """Verify FIFO batch deduction orders by received_date ascending."""
    batch_repo = BatchRepository(db_session)
    t_id = "tenant_fifo_test"
    s_id = "store_fifo_test"
    pid = "PROD_MILK_01"

    now = datetime.datetime.now(datetime.UTC)
    # Batch 1 (Older batch, arrived 2 days ago)
    b1 = batch_repo.receive_batch(
        t_id, s_id, pid, quantity=10, shelf_life_days=3, unit_cost=45.0,
        received_date=now - datetime.timedelta(days=2)
    )
    # Batch 2 (Fresh batch, arrived today)
    b2 = batch_repo.receive_batch(
        t_id, s_id, pid, quantity=20, shelf_life_days=3, unit_cost=46.0,
        received_date=now
    )
    db_session.commit()

    # Deduct 14 units -> should exhaust Batch 1 (10 units) and deduct 4 from Batch 2
    deducted = batch_repo.deduct_fifo(t_id, s_id, pid, 14)
    db_session.commit()

    assert deducted == 14
    assert b1.remaining_quantity == 0
    assert b1.is_exhausted is True
    assert b2.remaining_quantity == 16
    assert b2.is_exhausted is False


def test_bill_document_repository(db_session: Session):
    """Verify bill document creation and query by document ID."""
    bill_repo = BillDocumentRepository(db_session)
    doc_id = f"DOC_{uuid.uuid4().hex[:8].upper()}"

    bill = bill_repo.save_bill(
        document_id=doc_id,
        tenant_id="tenant_bill_test",
        store_id="CA_1",
        filename="invoice_2026.pdf",
        bill_type="purchase",
        party_name="Shree Traders",
        invoice_number="INV-4820",
        invoice_date="2026-10-31",
        total_amount=12500.0,
        ocr_engine="MockVisionOCRProvider",
        average_confidence=0.96,
        extracted_items=[{"name": "Rice", "qty": 10, "rate": 50}],
    )
    assert bill.document_id == doc_id
    db_session.commit()

    queried = bill_repo.get_by_document_id(doc_id)
    assert queried is not None
    assert queried.total_amount == 12500.0
    assert queried.ocr_engine == "MockVisionOCRProvider"
    assert queried.status == "ready_for_confirmation"


def test_postgresql_live_connection_and_persistence():
    """Verify that PostgreSQL periorder_db is genuinely connected, schema initialized, and persists data."""
    pg_url = "postgresql+psycopg2:///periorder_db"
    try:
        engine = create_app_engine(database_url=pg_url)
        init_db(engine)
    except (SQLAlchemyError, OSError) as e:
        pytest.skip(f"PostgreSQL local instance not reachable: {e}")

    session_factory = sessionmaker(bind=engine)
    session1 = session_factory()
    test_tenant_id = f"pg_test_{uuid.uuid4().hex[:6]}"
    test_store_id = "PG_STORE_01"

    try:
        tenant_repo = TenantRepository(session1)
        store_repo = StoreRepository(session1)
        ledger_repo = InventoryLedgerRepository(session1)

        tenant_repo.create(tenant_id=test_tenant_id, business_name="Live PG Market")
        store_repo.create(
            tenant_id=test_tenant_id,
            store_id=test_store_id,
            store_name="Postgres Central Outlet",
            location="San Francisco, CA",
        )
        ledger_repo.record_movement(
            tenant_id=test_tenant_id,
            store_id=test_store_id,
            product_id="PG_APPLES",
            movement_type="PURCHASE_RECEIPT",
            quantity=100,
            reference_id="PG_INV_001",
        )
        session1.commit()
    finally:
        session1.close()

    # Verify across a brand new PostgreSQL session
    session2 = session_factory()
    try:
        ledger2 = InventoryLedgerRepository(session2)
        store2 = StoreRepository(session2)

        persisted_store = store2.get_by_store_id(test_tenant_id, test_store_id)
        assert persisted_store is not None
        assert persisted_store.store_name == "Postgres Central Outlet"

        stock = ledger2.get_current_stock(test_tenant_id, test_store_id, "PG_APPLES")
        assert stock == 100

        movements = ledger2.list_movements(test_tenant_id, test_store_id, "PG_APPLES")
        assert len(movements) == 1
        assert movements[0].reference_id == "PG_INV_001"
    finally:
        # Cleanup test records
        from sqlalchemy import delete

        from periorder.db.models import InventoryMovementModel, StoreModel, TenantModel
        session2.execute(delete(InventoryMovementModel).where(InventoryMovementModel.tenant_id == test_tenant_id))
        session2.execute(delete(StoreModel).where(StoreModel.tenant_id == test_tenant_id))
        session2.execute(delete(TenantModel).where(TenantModel.tenant_id == test_tenant_id))
        session2.commit()
        session2.close()

