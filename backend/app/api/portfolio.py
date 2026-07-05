from typing import List, Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone

from app.core.database import get_db
from app.models.inspection import Inspection
from app.models.branch import Branch
from app.models.user import User
from app.models.audit_log import AuditLog
from app.api.deps import get_current_user
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class BranchPortfolioItem(BaseModel):
    branch_id: str
    branch_name: str
    total_inspections: int
    genuine_count: int
    suspicious_count: int
    portfolio_value: float
    approval_rate: float
    gold_processed_kg: float
    avg_purity: str

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class PortfolioTrendItem(BaseModel):
    d: int
    v: float

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class PortfolioSummaryResponse(BaseModel):
    total_value: float
    total_kg: float
    active_loan_value: float
    avg_purity: str
    trend: List[PortfolioTrendItem]
    branches: List[BranchPortfolioItem]

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class AuditLogEntry(BaseModel):
    id: int
    actor_id: str | None
    actor_name: str
    action: str
    detail: str | None
    timestamp: datetime

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/portfolio", response_model=PortfolioSummaryResponse)
async def get_portfolio(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Any:
    """Return aggregated portfolio summary and metrics per branch."""
    from sqlalchemy.orm import selectinload
    
    stmt = select(Branch)
    if current_user.organization_id:
        stmt = stmt.where(Branch.organization_id == current_user.organization_id)
        
    # Role-based filtering
    if current_user.role in ("Appraiser", "Branch Manager", "Auditor") and current_user.branch_id:
        stmt = stmt.where(Branch.id == current_user.branch_id)
    elif current_user.role == "Regional Manager":
        if current_user.region:
            stmt = stmt.where(Branch.region == current_user.region)
        else:
            stmt = stmt.where(Branch.id == "none")
            
    stmt = stmt.options(selectinload(Branch.inspections)).offset(skip).limit(limit)
    
    branches_result = await db.execute(stmt)
    branches = branches_result.scalars().all()

    branch_items = []
    total_val = 0.0
    total_weight = 0.0
    total_active_loan_val = 0.0
    all_purities = []

    for br in branches:
        inspections = br.inspections

        total = len(inspections)
        genuine = sum(1 for i in inspections if i.status == "Genuine")
        suspicious = sum(1 for i in inspections if i.status in ("Suspicious", "High Risk"))

        portfolio_value = 0.0
        branch_weight = 0.0
        branch_active_loan_val = 0.0
        branch_purities = []

        for i in inspections:
            loan = i.loan or {}
            if loan.get("decision") == "Approve":
                rate = loan.get("marketRate", 7200)
                # 22K gold purity factor default helper
                purity_mult = { "18K": 0.75, "20K": 0.83, "22K": 0.916, "24K": 1.0 }
                factor = purity_mult.get(i.purity, 0.916)
                portfolio_value += (i.weight or 0) * rate * factor
                branch_weight += (i.weight or 0)
                branch_active_loan_val += float(loan.get("amount") or 0.0)
                
                try:
                    p_val = int(i.purity.replace("K", ""))
                    branch_purities.append(p_val)
                    all_purities.append(p_val)
                except Exception:
                    branch_purities.append(22)
                    all_purities.append(22)

        approval_rate = round((genuine / total * 100), 1) if total > 0 else 0.0
        avg_branch_p = round(sum(branch_purities) / len(branch_purities)) if branch_purities else 22

        total_val += portfolio_value
        total_weight += branch_weight
        total_active_loan_val += branch_active_loan_val

        branch_items.append(BranchPortfolioItem(
            branch_id=br.id,
            branch_name=br.name,
            total_inspections=total,
            genuine_count=genuine,
            suspicious_count=suspicious,
            portfolio_value=round(portfolio_value, 2),
            approval_rate=approval_rate,
            gold_processed_kg=round(branch_weight / 1000.0, 2),
            avg_purity=f"{avg_branch_p}K",
        ))

    # Trend calculation (last 30 days cumulative)
    from datetime import date, timedelta
    trend_dict = {}
    today = date.today()
    for idx in range(29, -1, -1):
        d = today - timedelta(days=idx)
        trend_dict[d] = 0.0

    for br in branches:
        for ins in br.inspections:
            loan = ins.loan or {}
            if loan.get("decision") == "Approve":
                ins_date = ins.date.date()
                if ins_date in trend_dict:
                    trend_dict[ins_date] += float(loan.get("amount") or 0.0)

    cumulative = 0.0
    trend_data = []
    for d in sorted(trend_dict.keys()):
        cumulative += trend_dict[d]
        trend_data.append(PortfolioTrendItem(d=d.day, v=cumulative))

    global_avg_purity = f"{round(sum(all_purities) / len(all_purities))}K" if all_purities else "22K"

    return PortfolioSummaryResponse(
        total_value=round(total_val, 2),
        total_kg=round(total_weight / 1000.0, 2),
        active_loan_value=round(total_active_loan_val, 2),
        avg_purity=global_avg_purity,
        trend=trend_data,
        branches=branch_items,
    )



@router.get("/audit-logs", response_model=List[AuditLogEntry])
async def get_audit_logs(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Any:
    """Return global audit log entries scoped to the current user's organization."""
    stmt = select(AuditLog)
    if current_user.organization_id:
        stmt = stmt.where(AuditLog.organization_id == current_user.organization_id)
        
    # Role-based filtering
    if current_user.role in ("Appraiser", "Branch Manager", "Auditor") and current_user.branch_id:
        stmt = stmt.join(User, AuditLog.actor_id == User.id).where(User.branch_id == current_user.branch_id)
    elif current_user.role == "Regional Manager":
        if current_user.region:
            stmt = stmt.join(User, AuditLog.actor_id == User.id).join(Branch, User.branch_id == Branch.id).where(Branch.region == current_user.region)
        else:
            stmt = stmt.where(AuditLog.id == -1)
            
    stmt = stmt.order_by(AuditLog.timestamp.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()
