from celery import Celery
from app.core.config import settings
from app.core.logger import logger

# Initialize Celery app pointing to Redis
celery_app = Celery(
    "goldguard_tasks",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

# Configuration overrides
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
)


@celery_app.task(name="tasks.async_generate_report")
def async_generate_report(report_id: str, report_type: str, branch_id: str | None = None) -> bool:
    logger.info("Executing async Celery task to compile report", report_id=report_id, type=report_type)
    # 1. Simulates complex database calculations for branch inspections
    # 2. Generates the PDF document
    # 3. Uploads to local storage
    return True


@celery_app.task(name="tasks.async_update_branch_kpis")
def async_update_branch_kpis() -> bool:
    logger.info("Running beat scheduled Celery task to recalculate branch performance KPIs")
    # Query database and update branch KPI columns (inspections_today, fraud_rate) based on inspection aggregates
    return True


@celery_app.task(name="tasks.async_generate_weekly_reports")
def async_generate_weekly_reports() -> bool:
    logger.info("Running beat scheduled Celery task to generate weekly operations reports")
    from app.core.database import AsyncSessionLocal
    from app.services.report_scheduler import generate_automatic_weekly_reports
    import asyncio
    
    async def run():
        async with AsyncSessionLocal() as session:
            await generate_automatic_weekly_reports(session)
            await session.commit()
            
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
    if loop.is_running():
        # Schedule it as a task in the running loop
        asyncio.ensure_future(run())
    else:
        loop.run_until_complete(run())
    return True


# Import scheduled jobs to register beat tasks
from app.tasks import jobs

