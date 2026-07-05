import asyncio, sys, os
os.chdir('D:/goldguard-ai-portal/backend')
sys.path.insert(0, 'D:/goldguard-ai-portal/backend')
from app.core.database import engine
from sqlalchemy import text

async def t():
    try:
        async with engine.connect() as c:
            r = await c.execute(text('SELECT COUNT(*) FROM users'))
            print('SUCCESS - DB connected. Users:', r.scalar())
    except Exception as e:
        print('FAILED:', type(e).__name__, str(e)[:300])

asyncio.run(t())
