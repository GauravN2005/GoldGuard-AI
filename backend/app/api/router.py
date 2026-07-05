from fastapi import APIRouter
from app.api import auth, branches, employees, customers, inspections, escalations, reports, analytics, notifications, ai, sync, profile, portfolio, settings, users, superadmin

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(profile.router, prefix="/profile", tags=["profile"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(portfolio.router, prefix="/portfolio", tags=["portfolio"])
api_router.include_router(branches.router, prefix="/branches", tags=["branches"])
api_router.include_router(employees.router, prefix="/employees", tags=["employees"])
api_router.include_router(customers.router, prefix="/customers", tags=["customers"])
api_router.include_router(inspections.router, prefix="/inspections", tags=["inspections"])
api_router.include_router(escalations.router, prefix="/escalations", tags=["escalations"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(sync.router, prefix="/sync", tags=["sync"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(superadmin.router, prefix="/superadmin", tags=["superadmin"])
