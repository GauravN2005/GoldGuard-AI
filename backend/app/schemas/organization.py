from datetime import datetime
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class OrganizationBase(BaseModel):
    name: str
    code: str
    logo: str | None = None
    status: str = "active"


class OrganizationCreate(OrganizationBase):
    id: str


class OrganizationUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    logo: str | None = None
    status: str | None = None


class OrganizationResponse(OrganizationBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )
