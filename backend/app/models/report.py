from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # Daily, Weekly, Monthly, Branch, Fraud, Executive
    date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    branch_id: Mapped[str | None] = mapped_column(String(50), ForeignKey("branches.id"), nullable=True)
    size: Mapped[str] = mapped_column(String(20), default="0 KB")
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    bank_name: Mapped[str | None] = mapped_column(String(100), nullable=True, default="GoldGuard Bank", index=True)
    organization_id: Mapped[str | None] = mapped_column(String(50), ForeignKey("organizations.id"), nullable=True, index=True)

    # Relationships
    branch = relationship("Branch")
    organization = relationship("Organization", back_populates="reports")
