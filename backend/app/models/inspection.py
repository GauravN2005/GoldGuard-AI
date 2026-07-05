from datetime import datetime, timezone
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Inspection(Base):
    __tablename__ = "inspections"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, index=True)
    customer_id: Mapped[str] = mapped_column(String(50), ForeignKey("customers.id"), nullable=False, index=True)
    appraiser_id: Mapped[str] = mapped_column(String(50), ForeignKey("users.id"), nullable=False, index=True)
    branch_id: Mapped[str] = mapped_column(String(50), ForeignKey("branches.id"), nullable=False, index=True)

    jewelry_type: Mapped[str] = mapped_column(String(50), nullable=False)
    purity: Mapped[str] = mapped_column(String(10), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=True)
    
    # Measurements
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    length: Mapped[float] = mapped_column(Float, nullable=False)
    width: Mapped[float] = mapped_column(Float, nullable=False)
    thickness: Mapped[float] = mapped_column(Float, nullable=False)
    
    # Audit & Date
    date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    
    # Status & Scores
    status: Mapped[str] = mapped_column(String(50), default="Pending", index=True)  # Genuine, Low Risk, Suspicious, High Risk, Pending
    authenticity_score: Mapped[int] = mapped_column(Integer, default=100)
    risk_score: Mapped[int] = mapped_column(Integer, default=0)
    confidence: Mapped[int] = mapped_column(Integer, default=100)
    quality_score: Mapped[int] = mapped_column(Integer, default=100)
    
    # Image Quality Checks
    lighting: Mapped[int] = mapped_column(Integer, default=100)
    focus: Mapped[int] = mapped_column(Integer, default=100)
    angle_coverage: Mapped[int] = mapped_column(Integer, default=100)
    
    # Structured JSON Fields
    factors: Mapped[dict] = mapped_column(JSON, default=dict)  # density, surface, reflection, touchstone, visualDefect
    images: Mapped[dict] = mapped_column(JSON, default=dict)    # front, back, left, right, top, reflection, touchstone
    loan: Mapped[dict] = mapped_column(JSON, default=dict)      # decision, ltv, amount, marketRate
    audit: Mapped[list] = mapped_column(JSON, default=list)     # list of audit event objects: [{ts, actor, action, detail}]
    
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    escalation_stage: Mapped[str | None] = mapped_column(String(50), nullable=True)
    organization_id: Mapped[str | None] = mapped_column(String(50), ForeignKey("organizations.id"), nullable=True, index=True)

    # Relationships
    organization = relationship("Organization", back_populates="inspections")
    customer = relationship("Customer", back_populates="inspections")
    appraiser = relationship("User", back_populates="inspections")
    branch = relationship("Branch", back_populates="inspections")
    escalation = relationship("Escalation", back_populates="inspection", uselist=False, cascade="all, delete-orphan")
