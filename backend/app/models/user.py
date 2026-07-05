from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    designation: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)  # Super Admin, Bank Administrator, Regional Manager, Branch Manager, Appraiser, Auditor
    bank_name: Mapped[str | None] = mapped_column(String(100), nullable=True, default="GoldGuard Bank")
    organization_id: Mapped[str | None] = mapped_column(String(50), ForeignKey("organizations.id"), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    branch_id: Mapped[str | None] = mapped_column(String(50), ForeignKey("branches.id"), nullable=True)
    region: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", server_default="active")

    # Relationships
    organization = relationship("Organization", back_populates="users")
    branch = relationship("Branch", back_populates="employees")
    inspections = relationship("Inspection", back_populates="appraiser")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
