from datetime import datetime
from pydantic import BaseModel


class CustomerBase(BaseModel):
    name: str
    contact: str


class CustomerCreate(CustomerBase):
    id: str


class CustomerUpdate(BaseModel):
    name: str | None = None
    contact: str | None = None
    status: str | None = None


class CustomerResponse(CustomerBase):
    id: str
    status: str
    created_at: datetime
    organization_id: str | None = None

    class Config:
        from_attributes = True
        populate_by_name = True


# Detailed customer response with calculations
class CustomerDetailResponse(CustomerResponse):
    inspections_count: int
    active_loans_count: int
    total_loan_value: int
    total_gold_weight: float
    highest_risk: str
