import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash

async def main():
    async with AsyncSessionLocal() as session:
        # 1. List existing users
        r = await session.execute(text("SELECT id, email, role, is_active FROM users ORDER BY role"))
        rows = r.fetchall()
        print("=== EXISTING USERS ===")
        for row in rows:
            print(dict(row._mapping))
        
        # 2. Check if we need to add missing role users
        existing_emails = {row[1] for row in rows}
        
        new_users = [
            {
                "id": "u-regional-manager",
                "email": "regional.manager@goldguard.ai",
                "full_name": "Rajan Mehta",
                "designation": "Regional Manager",
                "role": "Regional Manager",
                "branch_id": None,
            },
            {
                "id": "u-auditor",
                "email": "auditor@goldguard.ai",
                "full_name": "Preethi Subramaniam",
                "designation": "Senior Auditor",
                "role": "Auditor",
                "branch_id": "br-mumbai",
            },
        ]
        
        hashed_password = get_password_hash("password123")
        
        for u in new_users:
            if u["email"] not in existing_emails:
                await session.execute(
                    text("""
                        INSERT INTO users (id, email, hashed_password, full_name, designation, role, is_active, branch_id)
                        VALUES (:id, :email, :hashed_password, :full_name, :designation, :role, :is_active, :branch_id)
                        ON CONFLICT (id) DO NOTHING
                    """),
                    {**u, "hashed_password": hashed_password, "is_active": True}
                )
                print(f"Added user: {u['email']}")
            else:
                print(f"User already exists: {u['email']}")
        
        await session.commit()
        
        # 3. Print final list
        r2 = await session.execute(text("SELECT id, email, role, is_active FROM users ORDER BY role"))
        rows2 = r2.fetchall()
        print("\n=== FINAL USER LIST ===")
        for row in rows2:
            print(dict(row._mapping))

asyncio.run(main())
