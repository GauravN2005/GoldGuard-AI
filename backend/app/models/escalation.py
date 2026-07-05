from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Escalation(Base):
    __tablename__ = "escalations"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, index=True)
    inspection_id: Mapped[str] = mapped_column(String(50), ForeignKey("inspections.id"), nullable=False, unique=True)
    stage: Mapped[str] = mapped_column(String(50), default="Escalated", index=True)  # Suspicious, Escalated, Manager Review, Final Decision
    assigned_to_id: Mapped[str | None] = mapped_column(String(50), ForeignKey("users.id"), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    decision: Mapped[str | None] = mapped_column(String(50), default="Pending")  # Approve, Reject, Hold, Pending
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    inspection = relationship("Inspection", back_populates="escalation")
    assigned_to = relationship("User")
