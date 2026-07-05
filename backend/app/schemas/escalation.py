from datetime import datetime
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class EscalationBase(BaseModel):
    inspection_id: str
    reason: str | None = None


class EscalationCreate(EscalationBase):
    id: str | None = None
    stage: str = "Escalated"


class EscalationUpdate(BaseModel):
    stage: str | None = None
    assigned_to_id: str | None = None
    reason: str | None = None
    decision: str | None = None


class EscalationResponse(BaseModel):
    id: str
    inspection_id: str
    stage: str
    assigned_to_id: str | None = None
    reason: str | None = None
    decision: str
    created_at: datetime
    resolved_at: datetime | None = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )

