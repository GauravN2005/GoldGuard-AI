from datetime import datetime, timezone
from sqlalchemy import DateTime, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    contact: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="Genuine", index=True)  # Genuine, Low Risk, Suspicious, High Risk, Pending
    bank_name: Mapped[str | None] = mapped_column(String(100), nullable=True, default="GoldGuard Bank", index=True)
    organization_id: Mapped[str | None] = mapped_column(String(50), ForeignKey("organizations.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    organization = relationship("Organization", back_populates="customers")
    inspections = relationship("Inspection", back_populates="customer", cascade="all, delete-orphan")
