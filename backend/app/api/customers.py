from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.customer import Customer
from app.models.inspection import Inspection
from app.models.branch import Branch
from app.models.audit_log import AuditLog
from app.schemas.customer import CustomerResponse, CustomerDetailResponse, CustomerCreate, CustomerUpdate
from app.schemas.inspection import InspectionResponse
from app.api.deps import get_current_user

router = APIRouter()


@router.get("", response_model=List[CustomerDetailResponse])
async def read_customers(
    response: Response,
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Any:
    # Query customers scoped to the current user's organization
    stmt = select(Customer)
    if current_user.organization_id:
        stmt = stmt.where(Customer.organization_id == current_user.organization_id)
        
    # Role-based scoping
    if current_user.role in ("Appraiser", "Branch Manager", "Auditor") and current_user.branch_id:
        from sqlalchemy import not_
        stmt = stmt.where(
            (not_(Customer.inspections.any())) |
            (Customer.inspections.any(Inspection.branch_id == current_user.branch_id))
        )
    elif current_user.role == "Regional Manager":
        if current_user.region:
            from sqlalchemy import not_
            stmt = stmt.where(
                (not_(Customer.inspections.any())) |
                (Customer.inspections.any(Inspection.branch.has(Branch.region == current_user.region)))
            )
        else:
            stmt = stmt.where(Customer.id == "none")

    # Search filter
    if search:
        q = f"%{search.lower()}%"
        stmt = stmt.where(
            (Customer.name.ilike(q)) |
            (Customer.id.ilike(q)) |
            (Customer.contact.ilike(q))
        )

    subq = stmt.subquery()
    count_stmt = select(func.count(subq.c.id)).select_from(subq)
    count_res = await db.execute(count_stmt)
    total_count = count_res.scalar() or 0

    response.headers["X-Total-Count"] = str(total_count)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    # Paginate
    stmt = stmt.options(selectinload(Customer.inspections)).offset(skip).limit(limit)
    result = await db.execute(stmt)
    customers = result.scalars().all()
    
    details = []
    for c in customers:
        inspections = c.inspections
        
        inspections_count = len(inspections)
        active_loans_count = sum(1 for i in inspections if i.loan.get("decision") == "Approve")
        total_loan_value = sum(i.loan.get("amount", 0) for i in inspections if i.loan.get("decision") == "Approve")
        total_gold_weight = sum(i.weight for i in inspections)
        
        details.append({
            "id": c.id,
            "name": c.name,
            "contact": c.contact,
            "status": c.status,
            "created_at": c.created_at,
            "organization_id": c.organization_id,
            "inspections_count": inspections_count,
            "active_loans_count": active_loans_count,
            "total_loan_value": total_loan_value,
            "total_gold_weight": total_gold_weight,
            "highest_risk": c.status
        })
        
    return details


@router.get("/{id}", response_model=CustomerDetailResponse)
async def read_customer(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Any:
    result = await db.execute(
        select(Customer)
        .options(selectinload(Customer.inspections))
        .where(Customer.id == id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )
    if current_user.organization_id and customer.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this customer record.",
        )
        
    # Role-based check
    if current_user.role in ("Appraiser", "Branch Manager", "Auditor"):
        if current_user.branch_id and customer.inspections:
            has_branch_insp = any(i.branch_id == current_user.branch_id for i in customer.inspections)
            if not has_branch_insp:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to this customer record.",
                )
    elif current_user.role == "Regional Manager":
        if customer.inspections:
            has_region_insp = False
            for i in customer.inspections:
                if i.branch and i.branch.region == current_user.region:
                    has_region_insp = True
                    break
            if not has_region_insp:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to this customer record.",
                )
        
    # Use preloaded relationship
    inspections = customer.inspections
    
    inspections_count = len(inspections)
    active_loans_count = sum(1 for i in inspections if i.loan.get("decision") == "Approve")
    total_loan_value = sum(i.loan.get("amount", 0) for i in inspections if i.loan.get("decision") == "Approve")
    total_gold_weight = sum(i.weight for i in inspections)
    
    return {
        "id": customer.id,
        "name": customer.name,
        "contact": customer.contact,
        "status": customer.status,
        "created_at": customer.created_at,
        "organization_id": customer.organization_id,
        "inspections_count": inspections_count,
        "active_loans_count": active_loans_count,
        "total_loan_value": total_loan_value,
        "total_gold_weight": total_gold_weight,
        "highest_risk": customer.status
    }


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    cust_in: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Any:
    # Check if ID exists
    result = await db.execute(select(Customer).where(Customer.id == cust_in.id))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Customer with this ID already exists",
        )
        
    customer = Customer(**cust_in.model_dump())
    customer.bank_name = current_user.bank_name
    customer.organization_id = current_user.organization_id
    db.add(customer)
    
    # Audit log creation
    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        action="Customer Created",
        detail=f"Created customer profile: {customer.name} ({customer.id})",
        bank_name=current_user.bank_name,
        organization_id=current_user.organization_id,
    )
    db.add(audit)
    
    return customer


@router.patch("/{id}", response_model=CustomerResponse)
async def update_customer(
    id: str,
    cust_in: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Any:
    result = await db.execute(select(Customer).where(Customer.id == id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )
        
    for k, v in cust_in.model_dump(exclude_unset=True).items():
        setattr(customer, k, v)
        
    db.add(customer)
    
    # Audit log update
    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        action="Customer Updated",
        detail=f"Updated details for customer profile: {customer.name}",
        bank_name=current_user.bank_name,
        organization_id=current_user.organization_id,
    )
    db.add(audit)
    
    return customer
