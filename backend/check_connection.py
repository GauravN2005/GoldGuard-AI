import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings
from app.core.database import engine
from sqlalchemy import text

async def main():
    print("----------------------------------------")
    print(f"DATABASE_URL: {settings.DATABASE_URL}")
    print(f"async_database_url: {settings.async_database_url}")
    print("----------------------------------------")
    try:
        async with engine.connect() as conn:
            res = await conn.execute(text("SELECT 1"))
            print(f"Connection SUCCESS: {res.scalar()}")
    except Exception as e:
        print(f"Connection FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(main())
