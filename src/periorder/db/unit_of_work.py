"""Database Transaction Unit of Work.

Provides an atomic transaction boundary across all repository operations:
- All operations within the block succeed and commit together, or roll back cleanly on exception.
- Provides unified access to all tenant-scoped repositories bound to the active transaction.
- Supports standalone sessions or dependency-injected sessions with configurable auto-commit.
"""

from __future__ import annotations

from types import TracebackType
from typing import Self

from sqlalchemy.orm import Session, sessionmaker

from periorder.db.repositories import (
    BatchRepository,
    BillDocumentRepository,
    InventoryLedgerRepository,
    POSTransactionRepository,
    StoreRepository,
    TenantRepository,
    UserRepository,
)
from periorder.db.session import get_session_factory


class UnitOfWork:
    """Atomic Unit of Work managing database transaction boundaries and repository access.

    Usage:
        with UnitOfWork() as uow:
            uow.pos_transactions.record_transaction(...)
            uow.inventory_ledger.record_movement(...)
            uow.batches.deduct_fifo(...)
            uow.commit()  # Atomically commits all changes
    """

    def __init__(
        self,
        session: Session | None = None,
        session_factory: sessionmaker[Session] | None = None,
        auto_commit: bool = False,
    ) -> None:
        self._session_factory = session_factory
        self._owns_session = session is None
        self.session: Session | None = session
        self.auto_commit = auto_commit

        self._tenants: TenantRepository | None = None
        self._stores: StoreRepository | None = None
        self._users: UserRepository | None = None
        self._inventory_ledger: InventoryLedgerRepository | None = None
        self._batches: BatchRepository | None = None
        self._pos_transactions: POSTransactionRepository | None = None
        self._bill_documents: BillDocumentRepository | None = None

        if session is not None:
            self._init_repositories(session)

    def __enter__(self) -> Self:
        if self.session is None:
            factory = self._session_factory or get_session_factory()
            self.session = factory()
        self._init_repositories(self.session)
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        try:
            if exc_type is not None:
                self.rollback()
            elif self.auto_commit:
                self.commit()
        finally:
            if self._owns_session and self.session is not None:
                self.session.close()

    def commit(self) -> None:
        """Commit all pending operations in the current transaction."""
        if self.session is not None:
            self.session.commit()

    def rollback(self) -> None:
        """Roll back all operations in the current transaction."""
        if self.session is not None:
            self.session.rollback()

    def flush(self) -> None:
        """Flush changes to verify constraints without ending transaction."""
        if self.session is not None:
            self.session.flush()

    def _init_repositories(self, session: Session) -> None:
        self._tenants = TenantRepository(session)
        self._stores = StoreRepository(session)
        self._users = UserRepository(session)
        self._inventory_ledger = InventoryLedgerRepository(session)
        self._batches = BatchRepository(session)
        self._pos_transactions = POSTransactionRepository(session)
        self._bill_documents = BillDocumentRepository(session)

    @property
    def tenants(self) -> TenantRepository:
        assert self._tenants is not None, "UnitOfWork session is not active."
        return self._tenants

    @property
    def stores(self) -> StoreRepository:
        assert self._stores is not None, "UnitOfWork session is not active."
        return self._stores

    @property
    def users(self) -> UserRepository:
        assert self._users is not None, "UnitOfWork session is not active."
        return self._users

    @property
    def inventory_ledger(self) -> InventoryLedgerRepository:
        assert self._inventory_ledger is not None, "UnitOfWork session is not active."
        return self._inventory_ledger

    @property
    def batches(self) -> BatchRepository:
        assert self._batches is not None, "UnitOfWork session is not active."
        return self._batches

    @property
    def pos_transactions(self) -> POSTransactionRepository:
        assert self._pos_transactions is not None, "UnitOfWork session is not active."
        return self._pos_transactions

    @property
    def bill_documents(self) -> BillDocumentRepository:
        assert self._bill_documents is not None, "UnitOfWork session is not active."
        return self._bill_documents
