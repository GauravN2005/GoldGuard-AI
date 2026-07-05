from typing import List
from pydantic import BaseModel, EmailStr, ConfigDict
from pydantic.alias_generators import to_camel


class EmployeeBase(BaseModel):
    full_name: str
    email: EmailStr
    designation: str
    role: str
    branch_id: str | None = None
    phone: str | None = None
    address: str | None = None
    region: str | None = None
    bank_name: str | None = None
    organization_id: str | None = None
    status: str | None = None


class EmployeeCreate(EmployeeBase):
    password: str


class EmployeeUpdate(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    designation: str | None = None
    role: str | None = None
    branch_id: str | None = None
    is_active: bool | None = None


class EmployeeResponse(EmployeeBase):
    id: str
    is_active: bool

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )


class EmployeeLeaderboardItem(BaseModel):
    id: str
    name: str
    branch: str
    designation: str
    inspections: int
    flagged: int
    accuracy: float
    trend: List[int]
    initials: str

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )

