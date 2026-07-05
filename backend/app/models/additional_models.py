from datetime import datetime, timezone
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class InspectionImage(Base):
    __tablename__ = "inspection_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    inspection_id: Mapped[str] = mapped_column(String(50), ForeignKey("inspections.id"), nullable=False, index=True)
    image_type: Mapped[str] = mapped_column(String(50), nullable=False)  # front, back, left, right, top, reflection, touchstone
    file_url: Mapped[str] = mapped_column(String(255), nullable=False)
    uploaded_by: Mapped[str] = mapped_column(String(50), ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    inspection = relationship("Inspection")
    uploader = relationship("User")


class InspectionResult(Base):
    __tablename__ = "inspection_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    inspection_id: Mapped[str] = mapped_column(String(50), ForeignKey("inspections.id"), nullable=False, index=True)
    density_score: Mapped[float] = mapped_column(Float, default=0.0)
    surface_score: Mapped[float] = mapped_column(Float, default=0.0)
    reflection_score: Mapped[float] = mapped_column(Float, default=0.0)
    touchstone_score: Mapped[float] = mapped_column(Float, default=0.0)
    visual_score: Mapped[float] = mapped_column(Float, default=0.0)
    overall_score: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    inspection = relationship("Inspection")


class EvidenceVault(Base):
    __tablename__ = "evidence_vault"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    inspection_id: Mapped[str] = mapped_column(String(50), ForeignKey("inspections.id"), nullable=False, index=True)
    file_name: Mapped[str] = mapped_column(String(100), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    file_url: Mapped[str] = mapped_column(String(255), nullable=False)
    uploaded_by: Mapped[str] = mapped_column(String(50), ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    inspection = relationship("Inspection")
    uploader = relationship("User")


class Draft(Base):
    __tablename__ = "drafts"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(50), ForeignKey("users.id"), nullable=False, index=True)
    draft_type: Mapped[str] = mapped_column(String(50), nullable=False)
    payload_json: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(50), default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User")


class EmployeePerformance(Base):
    __tablename__ = "employee_performance"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employee_id: Mapped[str] = mapped_column(String(50), ForeignKey("users.id"), nullable=False, index=True)
    total_inspections: Mapped[int] = mapped_column(Integer, default=0)
    approved_cases: Mapped[int] = mapped_column(Integer, default=0)
    flagged_cases: Mapped[int] = mapped_column(Integer, default=0)
    accuracy_score: Mapped[float] = mapped_column(Float, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    employee = relationship("User")


class BranchMetric(Base):
    __tablename__ = "branch_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    branch_id: Mapped[str] = mapped_column(String(50), ForeignKey("branches.id"), nullable=False, index=True)
    total_inspections: Mapped[int] = mapped_column(Integer, default=0)
    fraud_cases: Mapped[int] = mapped_column(Integer, default=0)
    approval_rate: Mapped[float] = mapped_column(Float, default=0.0)
    portfolio_value: Mapped[float] = mapped_column(Float, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    branch = relationship("Branch")


class CustomerLoanHistory(Base):
    __tablename__ = "customer_loan_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[str] = mapped_column(String(50), ForeignKey("customers.id"), nullable=False, index=True)
    loan_number: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    loan_amount: Mapped[float] = mapped_column(Float, default=0.0)
    loan_status: Mapped[str] = mapped_column(String(50), nullable=False)
    loan_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    customer = relationship("Customer")


# Future AI Tables (Reserved - Schema Only, no business logic)
class AIJob(Base):
    __tablename__ = "ai_jobs"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    inspection_id: Mapped[str] = mapped_column(String(50), ForeignKey("inspections.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    inspection = relationship("Inspection")


class AIPrediction(Base):
    __tablename__ = "ai_predictions"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    inspection_id: Mapped[str] = mapped_column(String(50), ForeignKey("inspections.id"), nullable=False, index=True)
    prediction_data: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    inspection = relationship("Inspection")


class AIModel(Base):
    __tablename__ = "ai_models"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class AIFeedback(Base):
    __tablename__ = "ai_feedback"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    inspection_id: Mapped[str] = mapped_column(String(50), ForeignKey("inspections.id"), nullable=False, index=True)
    feedback_text: Mapped[str] = mapped_column(String(255), nullable=True)
    rating: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    inspection = relationship("Inspection")
