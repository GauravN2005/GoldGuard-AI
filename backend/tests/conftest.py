import os
# Set TESTING env var before importing app elements to disable rate limiting
os.environ["TESTING"] = "True"

import asyncio
import pytest
from typing import AsyncGenerator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.core.config import settings
from app.core.database import Base, get_db
from app.main import app
from httpx import AsyncClient

# Derive test database url from settings.async_database_url
base_url, db_name = settings.async_database_url.rsplit('/', 1)
TEST_DATABASE_URL = f"{base_url}/{db_name}_test"

async def create_test_db_if_not_exists():
    # Connect to the administrative database (usually 'postgres') to execute CREATE DATABASE
    admin_url = f"{base_url}/postgres"
    admin_engine = create_async_engine(admin_url, isolation_level="AUTOCOMMIT")
    try:
        async with admin_engine.connect() as conn:
            result = await conn.execute(
                text(f"SELECT 1 FROM pg_database WHERE datname='{db_name}_test'")
            )
            if not result.scalar():
                await conn.execute(text(f"CREATE DATABASE {db_name}_test"))
    except Exception as e:
        print(f"Error checking/creating test database: {e}")
    finally:
        await admin_engine.dispose()

# Session-scoped engine setup for tests
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    future=True
)

TestAsyncSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

@pytest.fixture(scope="session", autouse=True)
async def setup_test_database():
    # Ensure test database exists before running any tests
    await create_test_db_if_not_exists()
    yield
    await test_engine.dispose()

@pytest.fixture
async def db_engine():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield test_engine
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.fixture
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    async with TestAsyncSessionLocal() as session:
        yield session
        await session.rollback()

@pytest.fixture
async def client(db_session) -> AsyncGenerator[AsyncClient, None]:
    from httpx import ASGITransport
    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
