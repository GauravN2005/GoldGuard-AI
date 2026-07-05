from datetime import datetime, timezone, timedelta
from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload, joinedload

from app.core import security
from app.core.database import get_db
from app.models.user import User
from app.models.branch import Branch
from app.models.inspection import Inspection
from app.models.audit_log import AuditLog
from app.schemas.employee import EmployeeResponse, EmployeeCreate, EmployeeUpdate, EmployeeLeaderboardItem
from app.api.deps import RoleChecker, get_current_user

router = APIRouter()
manager_required = RoleChecker(["Super Admin", "Regional Manager", "Branch Manager"])


@router.get("", response_model=List[EmployeeLeaderboardItem])
async def read_employees(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    return await _get_leaderboard_data(db, current_user, skip, limit)


@router.get("/leaderboard", response_model=List[EmployeeLeaderboardItem])
async def get_leaderboard(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    return await _get_leaderboard_data(db, current_user, skip, limit)


async def _get_leaderboard_data(db: AsyncSession, current_user: User, skip: int = 0, limit: int = 100) -> list:
    """Internal helper: build appraisers leaderboard filtered by current user's organization."""
    stmt = (
        select(User)
        .options(
            selectinload(User.inspections),
            joinedload(User.branch)
        )
        .where(User.role == "Appraiser")
        .offset(skip)
        .limit(limit)
    )
    # Apply organization tenant filter
    if current_user.organization_id:
        stmt = stmt.where(User.organization_id == current_user.organization_id)
        
    # Role-based filter
    if current_user.role in ("Appraiser", "Auditor"):
        stmt = stmt.where(User.id == current_user.id)
    elif current_user.role == "Branch Manager" and current_user.branch_id:
        stmt = stmt.where(User.branch_id == current_user.branch_id)
    elif current_user.role == "Regional Manager":
        if current_user.region:
            stmt = stmt.join(Branch, User.branch_id == Branch.id).where(Branch.region == current_user.region)
        else:
            stmt = stmt.where(User.id == "none")

    result = await db.execute(stmt)
    users = result.scalars().all()
    
    leaderboard = []
    now = datetime.now(timezone.utc)
    
    for u in users:
        inspections = u.inspections
        inspections_count = len(inspections)
        flagged_count = sum(1 for i in inspections if i.status in ("Suspicious", "High Risk"))
        
        # Calculate accuracy score
        if inspections_count > 0:
            accuracy = round(((inspections_count - flagged_count) / inspections_count) * 100, 1)
        else:
            accuracy = 98.0 # Default high accuracy for new appraisers
            
        # Calculate 7-day trend
        trend = []
        for d in range(6, -1, -1):
            day_start = (now - timedelta(days=d)).replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            day_count = sum(1 for i in inspections if day_start <= i.date < day_end)
            trend.append(day_count)
            
        initials = "".join([n[0] for n in u.full_name.split() if n])[:2].upper()
        
        # Find branch name
        branch_name = u.branch.name if u.branch else "Mumbai Fort"
                
        leaderboard.append({
            "id": u.id,
            "name": u.full_name,
            "branch": branch_name,
            "designation": u.designation,
            "inspections": inspections_count,
            "flagged": flagged_count,
            "accuracy": accuracy,
            "trend": trend,
            "initials": initials
        })
        
    # Sort by accuracy descending
    leaderboard.sort(key=lambda x: x["accuracy"], reverse=True)
    return leaderboard


@router.get("/{id}", response_model=EmployeeResponse)
async def read_employee(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    result = await db.execute(
        select(User)
        .options(joinedload(User.branch))
        .where(User.id == id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
    # Tenant check
    if current_user.organization_id and user.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this employee record.",
        )
        
    # Role-based check
    if current_user.role in ("Branch Manager", "Auditor", "Appraiser"):
        if user.id != current_user.id and (not current_user.branch_id or user.branch_id != current_user.branch_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this employee record.",
            )
    elif current_user.role == "Regional Manager":
        if user.role in ("Super Admin", "Regional Manager") and user.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this employee record.",
            )
        if user.id != current_user.id and user.branch:
            if user.branch.region != current_user.region:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to this employee record.",
                )
    return user


@router.post("", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    emp_in: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(manager_required),
) -> Any:
    # Check email uniqueness
    result = await db.execute(select(User).where(User.email == emp_in.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address already registered",
        )
        
    emp_data = emp_in.model_dump()
    
    # Scope check before creation
    if current_user.role in ("Branch Manager", "Auditor", "Appraiser"):
        emp_data["branch_id"] = current_user.branch_id
    elif current_user.role == "Regional Manager":
        if emp_data.get("branch_id"):
            # Verify branch is in their region
            br_res = await db.execute(select(Branch).where(Branch.id == emp_data["branch_id"]))
            branch = br_res.scalar_one_or_none()
            if not branch or branch.region != current_user.region:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot assign employee to a branch outside your region.",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Branch assignment is required.",
            )
            
    password = emp_data.pop("password")
    
    # Role ceiling guard: no manager can create a user at or above their own level
    ROLE_HIERARCHY = {
        "Super Admin": 6,
        "Bank Administrator": 5,
        "Regional Manager": 4,
        "Branch Manager": 3,
        "Auditor": 2,
        "Appraiser": 1,
    }
    creator_level = ROLE_HIERARCHY.get(current_user.role, 0)
    target_level = ROLE_HIERARCHY.get(emp_data.get("role", ""), 0)
    if target_level >= creator_level:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You cannot create a user with role '{emp_data.get('role')}'. You may only create roles below your own level.",
        )
    
    import uuid
    emp_id = "emp-" + uuid.uuid4().hex[:12]
    employee = User(
        id=emp_id,
        hashed_password=security.get_password_hash(password),
        bank_name=current_user.bank_name,
        organization_id=current_user.organization_id,
        **emp_data
    )
    db.add(employee)
    
    # Audit log creation
    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        action="Employee Created",
        detail=f"Created employee profile for {employee.full_name} ({employee.email})",
        bank_name=current_user.bank_name,
        organization_id=current_user.organization_id,
    )
    db.add(audit)
    
    return employee


@router.patch("/{id}", response_model=EmployeeResponse)
async def update_employee(
    id: str,
    emp_in: EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(manager_required),
) -> Any:
    result = await db.execute(select(User).options(joinedload(User.branch)).where(User.id == id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
        
    # Tenant check
    if current_user.organization_id and employee.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this employee record.",
        )
        
    # Role check
    if current_user.role in ("Branch Manager", "Auditor", "Appraiser"):
        if employee.branch_id != current_user.branch_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this employee record.",
            )
    elif current_user.role == "Regional Manager":
        if employee.role in ("Super Admin", "Regional Manager") and employee.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this employee record.",
            )
        if employee.branch and employee.branch.region != current_user.region:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this employee record.",
            )
            
    # Verify input modifications are within scope
    emp_data = emp_in.model_dump(exclude_unset=True)
    if "branch_id" in emp_data:
        if current_user.role in ("Branch Manager", "Auditor", "Appraiser"):
            emp_data["branch_id"] = current_user.branch_id
        elif current_user.role == "Regional Manager":
            if emp_data["branch_id"]:
                br_res = await db.execute(select(Branch).where(Branch.id == emp_data["branch_id"]))
                branch = br_res.scalar_one_or_none()
                if not branch or branch.region != current_user.region:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Cannot assign employee to a branch outside your region.",
                    )
        
    for k, v in emp_data.items():
        setattr(employee, k, v)
        
    db.add(employee)
    
    # Audit log update
    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        action="Employee Updated",
        detail=f"Updated details for employee profile: {employee.full_name}",
        bank_name=current_user.bank_name,
        organization_id=current_user.organization_id,
    )
    db.add(audit)
    
    return employee


@router.delete("/{id}")
async def delete_employee(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(manager_required),
) -> Any:
    result = await db.execute(select(User).options(joinedload(User.branch)).where(User.id == id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
        
    # Tenant check
    if current_user.organization_id and employee.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this employee record.",
        )
        
    # Role check
    if current_user.role in ("Branch Manager", "Auditor", "Appraiser"):
        if employee.branch_id != current_user.branch_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this employee record.",
            )
    elif current_user.role == "Regional Manager":
        if employee.role in ("Super Admin", "Regional Manager") and employee.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this employee record.",
            )
        if employee.branch and employee.branch.region != current_user.region:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this employee record.",
            )
        
    await db.delete(employee)
    
    # Audit log deletion
    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        action="Employee Deleted",
        detail=f"Deleted employee profile for {employee.full_name}",
        bank_name=current_user.bank_name,
        organization_id=current_user.organization_id,
    )
    db.add(audit)
    
    return {"message": "Employee deleted successfully"}
