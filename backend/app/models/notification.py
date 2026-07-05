from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(50), ForeignKey("users.id"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # Inspection Completed, High Risk Alert, Report Generated, Review Required
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    message: Mapped[str] = mapped_column(String(255), nullable=False)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    user = relationship("User", back_populates="notifications")
