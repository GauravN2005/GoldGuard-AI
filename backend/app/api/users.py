from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.user import User
from app.models.branch import Branch
from app.models.audit_log import AuditLog
from app.schemas.auth import UserResponse
from app.api.deps import get_current_user, RoleChecker

router = APIRouter()
manager_required = RoleChecker(["Bank Administrator", "Regional Manager", "Branch Manager", "Super Admin"])

@router.get("/pending", response_model=List[UserResponse])
async def get_pending_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(manager_required)
) -> Any:
    # Build query for users with status == "pending"
    stmt = select(User).where(User.status == "pending")
    
    # Apply role-based hierarchy and tenant filters
    # Bank Administrator -> Can view pending Regional Managers of their own organization only
    # Regional Manager -> Can view pending Branch Managers of their own region/organization only
    # Branch Manager -> Can view pending Auditors & Appraisers of their own branch only
    # Super Admin -> Can see all pending users
    
    if current_user.role == "Bank Administrator":
        stmt = stmt.where(User.organization_id == current_user.organization_id).where(User.role == "Regional Manager")
    elif current_user.role == "Regional Manager":
        stmt = stmt.outerjoin(Branch, User.branch_id == Branch.id).where(
            User.organization_id == current_user.organization_id
        ).where(
            User.role == "Branch Manager"
        ).where(
            or_(
                User.region == current_user.region,
                Branch.region == current_user.region
            )
        )
    elif current_user.role == "Branch Manager":
        stmt = stmt.where(User.branch_id == current_user.branch_id).where(User.role.in_(["Auditor", "Appraiser"]))
    elif current_user.role == "Super Admin":
        stmt = stmt.where(User.role == "Bank Administrator")
    else:
        # Appraiser / Auditor cannot view pending requests
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view pending users.",
        )
        
    result = await db.execute(stmt)
    pending_users = result.scalars().all()
    return pending_users

@router.post("/{user_id}/approve", response_model=UserResponse)
async def approve_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(manager_required)
) -> Any:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
        
    # Validate approval hierarchy
    # Bank Administrator -> Can approve Regional Managers of their own organization only
    # Regional Manager -> Can approve Branch Managers of their own region/organization only
    # Branch Manager -> Can approve Auditors & Appraisers of their own branch only
    
    allowed = False
    if current_user.role == "Super Admin":
        allowed = (user.role == "Bank Administrator")
    elif current_user.role == "Bank Administrator":
        allowed = (user.organization_id == current_user.organization_id and user.role == "Regional Manager")
    elif current_user.role == "Regional Manager":
        # Check branch region if user region isn't set directly
        branch_region = None
        if user.branch_id:
            br_res = await db.execute(select(Branch).where(Branch.id == user.branch_id))
            br = br_res.scalar_one_or_none()
            if br:
                branch_region = br.region
                
        allowed = (
            user.organization_id == current_user.organization_id 
            and user.role == "Branch Manager" 
            and (user.region == current_user.region or branch_region == current_user.region)
        )
    elif current_user.role == "Branch Manager":
        allowed = (user.branch_id == current_user.branch_id and user.role in ["Auditor", "Appraiser"])
        
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to approve this user request.",
        )
        
    user.status = "active"
    user.is_active = True
    
    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        action="Approve User",
        detail=f"Approved pending registration for {user.full_name} ({user.email}) as {user.role}.",
        bank_name=current_user.bank_name,
        organization_id=current_user.organization_id,
    )
    db.add(audit)
    await db.commit()
    return user

@router.post("/{user_id}/reject", response_model=UserResponse)
async def reject_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(manager_required)
) -> Any:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
        
    # Validate rejection permission (same hierarchy as approval)
    allowed = False
    if current_user.role == "Super Admin":
        allowed = (user.role == "Bank Administrator")
    elif current_user.role == "Bank Administrator":
        allowed = (user.organization_id == current_user.organization_id and user.role == "Regional Manager")
    elif current_user.role == "Regional Manager":
        # Check branch region if user region isn't set directly
        branch_region = None
        if user.branch_id:
            br_res = await db.execute(select(Branch).where(Branch.id == user.branch_id))
            br = br_res.scalar_one_or_none()
            if br:
                branch_region = br.region
                
        allowed = (
            user.organization_id == current_user.organization_id 
            and user.role == "Branch Manager" 
            and (user.region == current_user.region or branch_region == current_user.region)
        )
    elif current_user.role == "Branch Manager":
        allowed = (user.branch_id == current_user.branch_id and user.role in ["Auditor", "Appraiser"])
        
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to reject this user request.",
        )
        
    user.status = "rejected"
    user.is_active = False
    
    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        action="Reject User",
        detail=f"Rejected pending registration for {user.full_name} ({user.email}) as {user.role}.",
        bank_name=current_user.bank_name,
        organization_id=current_user.organization_id,
    )
    db.add(audit)
    await db.commit()
    return user
