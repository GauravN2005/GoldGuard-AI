from datetime import datetime, timezone
from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    logo: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="active")
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    branches = relationship("Branch", back_populates="organization", cascade="all, delete-orphan")
    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    customers = relationship("Customer", back_populates="organization", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="organization", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="organization", cascade="all, delete-orphan")
    inspections = relationship("Inspection", back_populates="organization", cascade="all, delete-orphan")
