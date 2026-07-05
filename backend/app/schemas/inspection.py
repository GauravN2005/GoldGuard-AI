from datetime import datetime
from typing import Dict, List, Any
from pydantic import BaseModel, Field


class AuditEventSchema(BaseModel):
    ts: str
    actor: str
    action: str
    detail: str | None = None


class LoanDetailSchema(BaseModel):
    decision: str  # Approve, Reject, Hold, Pending
    ltv: int
    amount: int
    marketRate: int


class FactorSchema(BaseModel):
    density: int
    surface: int
    reflection: int
    touchstone: int
    visualDefect: int


class ImageSchema(BaseModel):
    front: str | None = None
    back: str | None = None
    left: str | None = None
    right: str | None = None
    top: str | None = None
    reflection: str | None = None
    touchstone: str | None = None


class InspectionBase(BaseModel):
    customer_id: str
    customer_name: str | None = None
    contact: str | None = None
    jewelry_type: str
    purity: str
    description: str | None = None
    weight: float
    length: float
    width: float
    thickness: float


class InspectionCreate(InspectionBase):
    id: str | None = None


class InspectionUpdate(BaseModel):
    jewelry_type: str | None = None
    purity: str | None = None
    description: str | None = None
    weight: float | None = None
    length: float | None = None
    width: float | None = None
    thickness: float | None = None
    status: str | None = None
    authenticity_score: int | None = None
    risk_score: int | None = None
    confidence: int | None = None
    quality_score: int | None = None
    factors: Dict[str, int] | None = None
    images: Dict[str, str] | None = None
    notes: str | None = None
    loan: LoanDetailSchema | None = None
    escalation_stage: str | None = None


class InspectionResponse(BaseModel):
    id: str
    customerId: str = Field(..., validation_alias="customer_id")
    customerName: str
    contact: str
    jewelryType: str = Field(..., validation_alias="jewelry_type")
    purity: str
    description: str | None = None
    weight: float
    length: float
    width: float
    thickness: float
    branch: str
    appraiser: str
    date: str
    status: str
    authenticityScore: int = Field(..., validation_alias="authenticity_score")
    riskScore: int = Field(..., validation_alias="risk_score")
    confidence: int
    qualityScore: int = Field(..., validation_alias="quality_score")
    lighting: int
    focus: int
    angleCoverage: int = Field(..., validation_alias="angle_coverage")
    factors: FactorSchema
    images: ImageSchema
    loan: LoanDetailSchema
    audit: List[AuditEventSchema]
    notes: str | None = None
    escalationStage: str | None = Field(None, validation_alias="escalation_stage")
    escalationId: str | None = Field(None, validation_alias="escalation_id")

    class Config:
        from_attributes = True
        populate_by_name = True
