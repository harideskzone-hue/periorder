"""Database engine, session management, and environment validation.

Supports PostgreSQL for production/local development and SQLite for isolated unit testing,
with strict enforcement preventing production environments from silently using SQLite.
"""

from __future__ import annotations

import os
from collections.abc import Generator
from typing import Any

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from periorder.db.base import Base

DEFAULT_DEV_POSTGRES_URL = "postgresql+psycopg2:///periorder_db"


def get_database_url() -> str:
    """Retrieve and validate the database connection URL from the environment.

    Raises:
        RuntimeError: If a production environment attempts to use SQLite or lacks a DATABASE_URL.
    """
    env_name = os.getenv("PERIORDER_ENV", os.getenv("ENV", "development")).lower()
    db_url = os.getenv("DATABASE_URL")

    # Production safety guard: Never permit SQLite in production
    if env_name in ("production", "prod"):
        if not db_url:
            raise RuntimeError(
                "CRITICAL: DATABASE_URL must be explicitly configured in production environment."
            )
        if db_url.startswith("sqlite"):
            raise RuntimeError(
                "CRITICAL: SQLite is not permitted in production. PostgreSQL connection required."
            )
        return db_url

    # In testing/development, use provided DATABASE_URL or default to local Postgres
    if db_url:
        return db_url

    return DEFAULT_DEV_POSTGRES_URL


def create_app_engine(database_url: str | None = None, echo: bool = False) -> Engine:
    """Create SQLAlchemy 2.0 Engine with dialect-appropriate pooling and PRAGMA settings."""
    url = database_url or get_database_url()
    connect_args: dict[str, Any] = {}

    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        engine = create_engine(url, echo=echo, connect_args=connect_args)

        # Enforce foreign key constraints on SQLite
        @event.listens_for(engine, "connect")
        def set_sqlite_pragma(dbapi_connection: Any, connection_record: Any) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON;")
            cursor.close()

        return engine

    # PostgreSQL configuration
    return create_engine(
        url,
        echo=echo,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
    )


# Global instances initialized on demand
_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def get_engine() -> Engine:
    """Get or create singleton application engine."""
    global _engine
    if _engine is None:
        _engine = create_app_engine()
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    """Get or create singleton session factory."""
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(
            bind=get_engine(),
            autocommit=False,
            autoflush=False,
            expire_on_commit=False,
        )
    return _session_factory


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a database session per request."""
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()


def init_db(engine: Engine | None = None) -> None:
    """Create all registered database tables."""
    target_engine = engine or get_engine()
    Base.metadata.create_all(bind=target_engine)


def drop_db(engine: Engine | None = None) -> None:
    """Drop all registered database tables (used for testing resets)."""
    target_engine = engine or get_engine()
    Base.metadata.drop_all(bind=target_engine)
