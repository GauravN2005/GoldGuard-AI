from datetime import datetime
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class NotificationBase(BaseModel):
    type: str  # Inspection Completed, High Risk Alert, Report Generated, Review Required
    title: str
    message: str


class NotificationCreate(NotificationBase):
    id: str | None = None
    user_id: str


class NotificationResponse(NotificationBase):
    id: str
    read: bool
    created_at: datetime

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )

