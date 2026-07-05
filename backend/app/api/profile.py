from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core import security
from app.core.database import get_db
from app.models.user import User
from app.models.audit_log import AuditLog
from app.models.branch import Branch
from app.schemas.employee import EmployeeResponse
from app.api.deps import get_current_user
from pydantic import BaseModel, EmailStr, ConfigDict
from pydantic.alias_generators import to_camel

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas (scoped to this module to avoid circular imports)
# ---------------------------------------------------------------------------

class ProfileUpdate(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    designation: str | None = None
    branch_id: str | None = None
    phone: str | None = None
    address: str | None = None

    model_config = ConfigDict(populate_by_name=True)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str

    model_config = ConfigDict(populate_by_name=True)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/me", response_model=EmployeeResponse)
async def get_my_profile(
    current_user: Any = Depends(get_current_user),
) -> Any:
    """Return the authenticated user's own profile."""
    return current_user


@router.patch("/me", response_model=EmployeeResponse)
async def update_my_profile(
    payload: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Any:
    """Patch the authenticated user's own profile fields."""
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided for update",
        )

    # Reload from DB with preloaded relationships to avoid greenlet lazy loading on response serialization
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(User)
        .options(selectinload(User.branch), selectinload(User.organization))
        .where(User.id == current_user.id)
    )
    user = result.scalar_one()

    for k, v in updates.items():
        if k == "branch_id" and v:
            # Verify branch exists and belongs to organization
            br_res = await db.execute(select(Branch).where(Branch.id == v))
            branch = br_res.scalar_one_or_none()
            if not branch:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Branch not found",
                )
            if current_user.organization_id and branch.organization_id != current_user.organization_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Branch does not belong to your organization",
                )
            user.branch_id = v
        else:
            setattr(user, k, v)

    db.add(user)

    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        action="Profile Updated",
        detail=f"User updated their own profile: {list(updates.keys())}",
        bank_name=current_user.bank_name,
        organization_id=current_user.organization_id,
    )
    db.add(audit)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/me/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    payload: PasswordChange,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> dict:
    """Change the authenticated user's password."""
    if not security.verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one()
    user.hashed_password = security.get_password_hash(payload.new_password)
    db.add(user)

    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        action="Password Changed",
        detail="User changed their own password",
        bank_name=current_user.bank_name,
        organization_id=current_user.organization_id,
    )
    db.add(audit)
    await db.commit()
    return {"message": "Password updated successfully"}
