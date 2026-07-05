from pydantic import BaseModel, EmailStr, field_validator


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: str | None = None
    role: str | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenRefresh(BaseModel):
    refresh_token: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    designation: str
    role: str
    branch_id: str | None = None
    region: str | None = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not any(char.isdigit() for char in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    designation: str
    role: str
    bank_name: str | None = None
    branch_id: str | None = None
    region: str | None = None
    organization_id: str | None = None
    is_active: bool
    phone: str | None = None
    address: str | None = None
    status: str | None = None

    class Config:
        from_attributes = True
        populate_by_name = True


class PasswordChange(BaseModel):
    old_password: str
    new_password: str


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    designation: str
    role: str | None = "Branch Manager"
    bank_name: str
    city: str | None = "Mumbai"
    region: str | None = None
    phone: str | None = None
    address: str | None = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not any(char.isdigit() for char in v):
            raise ValueError("Password must contain at least one digit")
        return v
