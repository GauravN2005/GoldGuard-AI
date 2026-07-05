from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.branch import Branch
from app.models.audit_log import AuditLog
from app.schemas.branch import BranchResponse, BranchCreate, BranchUpdate
from app.api.deps import RoleChecker, get_current_user
from app.models.user import User

router = APIRouter()
manager_required = RoleChecker(["Super Admin", "Regional Manager"])


@router.get("", response_model=List[BranchResponse])
async def read_branches(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    stmt = select(Branch)
    if current_user.organization_id:
        stmt = stmt.where(Branch.organization_id == current_user.organization_id)
        
    # Role-based filtering
    if current_user.role in ("Appraiser", "Branch Manager", "Auditor"):
        stmt = stmt.where(Branch.id == current_user.branch_id)
    elif current_user.role == "Regional Manager":
        if current_user.region:
            stmt = stmt.where(Branch.region == current_user.region)
        else:
            stmt = stmt.where(Branch.id == "none")

    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{id}", response_model=BranchResponse)
async def read_branch(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    result = await db.execute(select(Branch).where(Branch.id == id))
    branch = result.scalar_one_or_none()
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branch not found",
        )
    # Tenant check
    if current_user.organization_id and branch.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this branch.",
        )
        
    # Role check
    if current_user.role in ("Appraiser", "Branch Manager", "Auditor"):
        if branch.id != current_user.branch_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this branch.",
            )
    elif current_user.role == "Regional Manager":
        if branch.region != current_user.region:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this branch.",
            )
            
    return branch


@router.post("", response_model=BranchResponse, status_code=status.HTTP_201_CREATED)
async def create_branch(
    branch_in: BranchCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(manager_required),
) -> Any:
    # Check if branch ID or name already exists
    result = await db.execute(select(Branch).where((Branch.id == branch_in.id) | (Branch.name == branch_in.name)))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Branch with this ID or Name already exists",
        )
        
    branch = Branch(**branch_in.model_dump())
    branch.bank_name = current_user.bank_name
    branch.organization_id = current_user.organization_id
    db.add(branch)
    
    # Audit log creation
    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        action="Branch Created",
        detail=f"Created branch {branch.name} ({branch.id})",
        bank_name=current_user.bank_name,
        organization_id=current_user.organization_id,
    )
    db.add(audit)
    
    return branch


@router.patch("/{id}", response_model=BranchResponse)
async def update_branch(
    id: str,
    branch_in: BranchUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(manager_required),
) -> Any:
    result = await db.execute(select(Branch).where(Branch.id == id))
    branch = result.scalar_one_or_none()
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branch not found",
        )
        
    # Tenant check
    if current_user.organization_id and branch.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this branch.",
        )
        
    # Role check
    if current_user.role == "Regional Manager":
        if branch.region != current_user.region:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this branch.",
            )
        
    for k, v in branch_in.model_dump(exclude_unset=True).items():
        setattr(branch, k, v)
        
    db.add(branch)
    
    # Audit log update
    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        action="Branch Updated",
        detail=f"Updated details for branch {branch.name} ({branch.id})",
        bank_name=current_user.bank_name,
        organization_id=current_user.organization_id,
    )
    db.add(audit)
    
    return branch


@router.delete("/{id}")
async def delete_branch(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(manager_required),
) -> Any:
    result = await db.execute(select(Branch).where(Branch.id == id))
    branch = result.scalar_one_or_none()
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branch not found",
        )
        
    # Tenant check
    if current_user.organization_id and branch.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this branch.",
        )
        
    # Role check
    if current_user.role == "Regional Manager":
        if branch.region != current_user.region:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this branch.",
            )
        
    await db.delete(branch)
    
    # Audit log deletion
    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        action="Branch Deleted",
        detail=f"Deleted branch {branch.name} ({branch.id})",
        bank_name=current_user.bank_name,
        organization_id=current_user.organization_id,
    )
    db.add(audit)
    
    return {"message": "Branch deleted successfully"}
