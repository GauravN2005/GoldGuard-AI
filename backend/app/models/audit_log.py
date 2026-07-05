from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    actor_id: Mapped[str | None] = mapped_column(String(50), ForeignKey("users.id"), nullable=True, index=True)
    actor_name: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "Inspection Created", "Image Uploaded"
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    bank_name: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    organization_id: Mapped[str | None] = mapped_column(String(50), ForeignKey("organizations.id"), nullable=True, index=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

    # Relationships
    actor = relationship("User")
    organization = relationship("Organization", back_populates="audit_logs")
