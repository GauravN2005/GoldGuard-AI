from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.core.config import settings
from app.core.logger import setup_logging, logger
from app.core.database import Base, engine, get_db
from app.core.limiter import limiter
from app.api.router import api_router
from fastapi.staticfiles import StaticFiles
import os

# Setup structured logger with updated model configuration
setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    logger.info("Initializing GoldGuard API backend service")
    if settings.AUTO_CREATE_TABLES:
        try:
            # Create database tables automatically for immediate local database plug-and-play
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Database schemas initialized successfully")
            from app.database_seeder import seed_db
            await seed_db()
            logger.info("Database migration & seeding completed successfully")
        except Exception as e:
            logger.error("Failed to initialize database tables on startup", error=str(e))
    else:
        logger.info("Skipping automatic database table creation and seeding (AUTO_CREATE_TABLES is False)")
        
    # Check/generate automatic weekly reports on startup recovery
    try:
        from app.core.database import AsyncSessionLocal
        from app.services.report_scheduler import generate_automatic_weekly_reports
        async with AsyncSessionLocal() as session:
            await generate_automatic_weekly_reports(session)
            await session.commit()
    except Exception as e:
        logger.error("Failed to run startup weekly report check", error=str(e))
        
    yield
    
    # Shutdown actions
    logger.info("Shutting down GoldGuard API backend service")
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# Rate limiter setup
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# CORS configuration (secure by default, no wildcard allow-all fallback)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static folder for uploads and local fallbacks
static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
os.makedirs(os.path.join(static_dir, "uploads"), exist_ok=True)

from fastapi.responses import FileResponse, Response
@app.get("/static/uploads/inspections/{rest_of_path:path}")
async def serve_inspection_uploads(rest_of_path: str):
    file_path = os.path.join(static_dir, "uploads", "inspections", rest_of_path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
    # If the local file is missing, return the fallback image!
    fallback_path = os.path.join(static_dir, "fallback.jpg")
    if os.path.exists(fallback_path):
        return FileResponse(fallback_path)
    return Response(status_code=404)

app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Include main router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["health"])
async def health_check(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
        
    return {
        "status": "healthy" if db_status == "connected" else "unhealthy",
        "database": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# Reload trigger comment to re-run database seeder cascade cleanup 2.
