from sqlalchemy import Integer, String, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Branch(Base):
    __tablename__ = "branches"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    bank_name: Mapped[str | None] = mapped_column(String(100), nullable=True, default="GoldGuard Bank", index=True)
    organization_id: Mapped[str | None] = mapped_column(String(50), ForeignKey("organizations.id"), nullable=True, index=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    region: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    
    # KPIs & metrics
    inspections_today: Mapped[int] = mapped_column(Integer, default=0)
    pending_reviews: Mapped[int] = mapped_column(Integer, default=0)
    fraud_cases: Mapped[int] = mapped_column(Integer, default=0)
    approval_rate: Mapped[float] = mapped_column(Float, default=0.0)
    fraud_rate: Mapped[float] = mapped_column(Float, default=0.0)
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    gold_value_today: Mapped[int] = mapped_column(Integer, default=0)
    gold_processed_kg: Mapped[float] = mapped_column(Float, default=0.0)
    avg_purity: Mapped[str] = mapped_column(String(10), default="22K")
    
    # Coordinate placements on map
    map_x: Mapped[float] = mapped_column(Float, default=0.0)
    map_y: Mapped[float] = mapped_column(Float, default=0.0)

    # Relationships
    organization = relationship("Organization", back_populates="branches")
    employees = relationship("User", back_populates="branch", cascade="all, delete-orphan")
    inspections = relationship("Inspection", back_populates="branch", cascade="all, delete-orphan")
