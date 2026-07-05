from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

def _build_engine():
    url = settings.async_database_url
    if "sqlite" in url:
        try:
            import aiosqlite
        except ImportError:
            # Fallback to a dummy postgres URL so module import succeeds without aiosqlite
            url = "postgresql+asyncpg://dummy:dummy@localhost/dummy"

    # Supabase transaction pooler (port 6543) requires SSL and statement_cache_size=0
    # Session pooler (port 5432) works without special SSL args
    connect_args: dict = {"statement_cache_size": 0}
    is_supabase_pooler = (
        "supabase.com" in url or "pooler.supabase" in url or ":6543/" in url
    )
    if is_supabase_pooler and "postgres" in url:
        import ssl as ssl_module
        ssl_ctx = ssl_module.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl_module.CERT_NONE
        connect_args["ssl"] = ssl_ctx

    return create_async_engine(
        url,
        echo=False,
        future=True,
        pool_pre_ping=True,
        # Supabase transaction pooler has limited concurrent connections
        pool_size=5 if is_supabase_pooler else 20,
        max_overflow=5 if is_supabase_pooler else 10,
        pool_timeout=30,
        pool_recycle=1800,
        connect_args=connect_args,
    )

# Create async database engine
engine = _build_engine()

# Async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


# Dependency to get async database session
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
