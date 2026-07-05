from celery.schedules import crontab
from app.tasks.worker import celery_app

# Configure Celery Beat scheduled cron jobs
celery_app.conf.beat_schedule = {
    # Recalculate branch statistics daily at midnight
    "recalculate-branch-kpis-daily": {
        "task": "tasks.async_update_branch_kpis",
        "schedule": crontab(hour=0, minute=0),
    },
    # Weekly report generation automatically every Sunday at midnight
    "generate-weekly-reports-sunday": {
        "task": "tasks.async_generate_weekly_reports",
        "schedule": crontab(hour=0, minute=0, day_of_week="sunday"),
    },
}
