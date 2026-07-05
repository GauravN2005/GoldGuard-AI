from datetime import datetime
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ReportBase(BaseModel):
    title: str
    type: str  # Daily, Weekly, Monthly, Branch, Fraud, Executive
    branch_id: str | None = None
    description: str | None = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )


class ReportCreate(ReportBase):
    id: str | None = None


class ReportGenerateRequest(BaseModel):
    type: str  # Daily, Weekly, Monthly, Branch, Fraud, Executive
    branch_id: str | None = None
    title: str | None = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )


class ReportResponse(ReportBase):
    id: str
    date: datetime
    size: str
    file_url: str | None
    organization_id: str | None = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )
