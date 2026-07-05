import asyncio
from sqlalchemy import text
from app.core.database import engine

async def check_db():
    print("Connecting to database...")
    async with engine.connect() as conn:
        tables = [
            "organizations", "branches", "users", "customers", "reports", 
            "notifications", "inspections", "escalations", "audit_logs", 
            "drafts", "employee_performance", "branch_metrics", 
            "customer_loan_history", "ai_jobs", "ai_predictions", "ai_feedback", "ai_models"
        ]
        for table in tables:
            try:
                res = await conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = res.scalar()
                print(f"Table '{table}': {count} rows")
            except Exception as e:
                print(f"Table '{table}' error: {e}")

if __name__ == "__main__":
    asyncio.run(check_db())
