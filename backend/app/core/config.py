import os
from typing import List, Union
from pydantic import AnyHttpUrl, BeforeValidator, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing_extensions import Annotated


def parse_cors(v: Union[str, List[str]]) -> List[str]:
    if isinstance(v, str) and not v.startswith("["):
        return [i.strip() for i in v.split(",")]
    elif isinstance(v, (list, str)):
        return v
    raise ValueError(v)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("backend/.env", ".env"), env_file_encoding="utf-8", extra="ignore"
    )

    PROJECT_NAME: str = "GoldGuard AI Portal API"
    API_V1_STR: str = "/api/v1"
    
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS settings
    BACKEND_CORS_ORIGINS: Annotated[
        List[str], BeforeValidator(parse_cors)
    ] = []

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        return []

    @model_validator(mode="after")
    def set_default_cors(self) -> "Settings":
        if not self.BACKEND_CORS_ORIGINS:
            if self.AUTO_CREATE_TABLES:
                self.BACKEND_CORS_ORIGINS = [
                    "http://localhost:5173",
                    "http://localhost:3000",
                    "http://localhost:8081",
                    "http://localhost:8000"
                ]
        return self

    # Database
    DATABASE_URL: str | None = None
    AUTO_CREATE_TABLES: bool = True

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def validate_database_url(cls, v: str | None) -> str:
        if not v:
            raise ValueError(
                "DATABASE_URL environment variable is missing. It must be configured with a PostgreSQL connection string (e.g. postgresql+psycopg://username:password@localhost:5432/goldguard)"
            )
        # Normalize postgres:// to postgresql:// (Render / Supabase defaults)
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql://", 1)
        elif v.startswith("postgres+"):
            v = v.replace("postgres+", "postgresql+", 1)
            
        if not (v.startswith("postgresql://") or v.startswith("postgresql+asyncpg://") or v.startswith("postgresql+psycopg://") or v.startswith("sqlite://") or v.startswith("sqlite+aiosqlite://")):
            raise ValueError(
                f"DATABASE_URL must be a PostgreSQL connection URL (e.g. postgresql+psycopg://...). Got: {v}"
            )
        return v

    @property
    def async_database_url(self) -> str:
        url = self.DATABASE_URL
        if not url:
            raise ValueError("DATABASE_URL is not configured.")
        if url.startswith("sqlite://"):
            return url.replace("sqlite://", "sqlite+aiosqlite://")
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://")
        return url

    @property
    def sync_database_url(self) -> str:
        url = self.DATABASE_URL
        if not url:
            raise ValueError("DATABASE_URL is not configured.")
        if url.startswith("sqlite+aiosqlite://"):
            return url.replace("sqlite+aiosqlite://", "sqlite://")
        if url.startswith("postgresql+asyncpg://"):
            return url.replace("postgresql+asyncpg://", "postgresql://")
        elif url.startswith("postgresql+psycopg://"):
            return url.replace("postgresql+psycopg://", "postgresql://")
        return url

    # AI Risk Engine Configurable Weights
    AI_WEIGHT_SURFACE: float = 0.20
    AI_WEIGHT_DEFECT: float = 0.20
    AI_WEIGHT_REFLECTION: float = 0.15
    AI_WEIGHT_TOUCHSTONE: float = 0.15
    AI_WEIGHT_DENSITY: float = 0.30

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    @property
    def redis_url(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/0"

    # Supabase Storage Configuration
    SUPABASE_URL: str | None = None
    SUPABASE_KEY: str | None = None
    SUPABASE_BUCKET: str = "goldguard-vault"

    # LLM Settings
    GEMINI_API_KEY: str | None = None
    GEMINI_FLASH_MODEL: str = "gemini-flash-latest"
    GEMINI_VISION_MODEL: str = "gemini-flash-latest"
    OPENROUTER_API_KEY: str | None = None
    OPENROUTER_MODEL: str = "meta-llama/llama-3-8b-instruct:free"
    LLM_ENABLED: bool = True
    LLM_TIMEOUT_SECONDS: int = 15
    LLM_MAX_RETRIES: int = 2
    LLM_CACHE_TTL_SECONDS: int = 3600
    LLM_RATE_LIMIT_RPM: int = 50


settings = Settings()
