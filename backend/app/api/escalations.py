from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from datetime import datetime, timezone
import uuid

from app.core.database import get_db
from app.models.escalation import Escalation
from app.models.inspection import Inspection
from app.models.branch import Branch
from app.models.audit_log import AuditLog
from app.schemas.escalation import EscalationResponse, EscalationCreate, EscalationUpdate
from app.api.deps import RoleChecker, get_current_user
from app.models.user import User
from app.models.notification import Notification

router = APIRouter()


async def send_event_notification(db: AsyncSession, org_id: str, branch_id: str | None, user_id_target: str | None, type_str: str, title: str, message: str) -> None:
    import uuid
    users = []
    if user_id_target:
        res = await db.execute(select(User).where(User.id == user_id_target))
        u = res.scalar_one_or_none()
        if u:
            users.append(u)
    else:
        stmt = select(User)
        if org_id:
            stmt = stmt.where(User.organization_id == org_id)
        if branch_id:
            stmt = stmt.where(User.branch_id == branch_id)
        res = await db.execute(stmt)
        users = res.scalars().all()
        users = [u for u in users if u.role in ("Super Admin", "Bank Administrator", "Regional Manager", "Branch Manager", "Auditor")]
        
    for u in users:
        notif = Notification(
            id="notif-" + uuid.uuid4().hex[:12],
            user_id=u.id,
            type=type_str,
            title=title,
            message=message,
            read=False,
            created_at=datetime.now(timezone.utc)
        )
        db.add(notif)
manager_required = RoleChecker(["Super Admin", "Regional Manager", "Branch Manager"])


@router.get("", response_model=List[EscalationResponse])
async def read_escalations(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    stmt = select(Escalation).order_by(Escalation.created_at.desc())

    if current_user.role in ("Appraiser", "Branch Manager", "Auditor") and current_user.branch_id:
        # Filter escalations to only those inspections belonging to this branch
        stmt = (
            stmt.join(Inspection, Escalation.inspection_id == Inspection.id)
            .where(Inspection.branch_id == current_user.branch_id)
        )
    elif current_user.role == "Regional Manager":
        if current_user.region:
            stmt = (
                stmt.join(Inspection, Escalation.inspection_id == Inspection.id)
                .join(Branch, Inspection.branch_id == Branch.id)
                .where(
                    Branch.region == current_user.region,
                    Inspection.organization_id == current_user.organization_id
                )
            )
        else:
            stmt = stmt.where(Escalation.id == "none")
    elif current_user.organization_id:
        # Filter to this organization only via Inspection join
        stmt = (
            stmt.join(Inspection, Escalation.inspection_id == Inspection.id)
            .where(Inspection.organization_id == current_user.organization_id)
        )

    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=EscalationResponse, status_code=status.HTTP_201_CREATED)
async def create_escalation(
    esc_in: EscalationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(manager_required),
) -> Any:
    # Verify inspection exists
    insp_res = await db.execute(
        select(Inspection)
        .options(joinedload(Inspection.branch))
        .where(Inspection.id == esc_in.inspection_id)
    )
    inspection = insp_res.scalar_one_or_none()
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inspection not found",
        )
        
    # Tenant verification
    if current_user.organization_id and inspection.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this inspection.",
        )
        
    # Role verification
    if current_user.role in ("Appraiser", "Branch Manager", "Auditor"):
        if current_user.branch_id and inspection.branch_id != current_user.branch_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this inspection.",
            )
    elif current_user.role == "Regional Manager":
        if not current_user.region or inspection.branch.region != current_user.region:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this inspection.",
            )
        
    # Check if duplicate escalation exists
    dup_res = await db.execute(select(Escalation).where(Escalation.inspection_id == esc_in.inspection_id))
    if dup_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inspection is already escalated",
        )
        
    esc_id = esc_in.id or "esc-" + uuid.uuid4().hex[:12]
    escalation = Escalation(
        id=esc_id,
        inspection_id=esc_in.inspection_id,
        stage="Escalated",
        reason=esc_in.reason,
        decision="Pending",
    )
    db.add(escalation)
    
    # Update inspection's escalation stage field
    inspection.escalation_stage = "Escalated"
    db.add(inspection)
    
    # Audit trail in inspection
    audit_data = inspection.audit or []
    audit_data.append({
        "ts": datetime.now(timezone.utc).isoformat(),
        "actor": current_user.full_name,
        "action": "Escalation Created",
        "detail": esc_in.reason or "Forwarded for manager escalation"
    })
    inspection.audit = audit_data
    
    # Audit log entry
    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        action="Escalation Created",
        detail=f"Escalated inspection {esc_in.inspection_id} for manager check",
        bank_name=current_user.bank_name,
        organization_id=current_user.organization_id,
    )
    db.add(audit)
    
    await send_event_notification(
        db=db,
        org_id=inspection.organization_id,
        branch_id=None,
        user_id_target=None,
        type_str="Review Required",
        title="New Escalation Case Created",
        message=f"Inspection {inspection.id} has been escalated for review: {esc_in.reason or 'Forwarded for manager escalation'}"
    )
    
    await db.commit()
    await db.refresh(escalation)
    return escalation


@router.post("/{id}/approve", response_model=EscalationResponse)
async def approve_escalation(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(manager_required),
) -> Any:
    result = await db.execute(select(Escalation).where(Escalation.id == id))
    escalation = result.scalar_one_or_none()
    if not escalation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Escalation case not found",
        )
        
    insp_res = await db.execute(
        select(Inspection)
        .options(joinedload(Inspection.branch))
        .where(Inspection.id == escalation.inspection_id)
    )
    inspection = insp_res.scalar_one_or_none()
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated inspection not found",
        )
        
    # Tenant verification
    if current_user.organization_id and inspection.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this case.",
        )
        
    # Role verification
    if current_user.role in ("Appraiser", "Branch Manager", "Auditor"):
        if current_user.branch_id and inspection.branch_id != current_user.branch_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this case.",
            )
    elif current_user.role == "Regional Manager":
        if not current_user.region or inspection.branch.region != current_user.region:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this case.",
            )
            
    escalation.decision = "Approve"
    escalation.stage = "Final Decision"
    escalation.resolved_at = datetime.now(timezone.utc)
    db.add(escalation)
    
    # Update inspection status and decisions
    insp_res = await db.execute(select(Inspection).where(Inspection.id == escalation.inspection_id))
    inspection = insp_res.scalar_one_or_none()
    if inspection:
        inspection.escalation_stage = "Final Decision"
        loan = inspection.loan or {}
        loan["decision"] = "Approve"
        inspection.loan = loan
        
        # Append audit trail
        audit_data = inspection.audit or []
        audit_data.append({
            "ts": datetime.now(timezone.utc).isoformat(),
            "actor": current_user.full_name,
            "action": "Escalation Approved",
            "detail": "Manager approved loan proposal"
        })
        inspection.audit = audit_data
        db.add(inspection)
        
    # General audit log
    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        action="Escalation Approved",
        detail=f"Approved loan appraisal for escalation case: {id}",
        bank_name=current_user.bank_name,
        organization_id=current_user.organization_id,
    )
    db.add(audit)
    
    if inspection:
        await send_event_notification(
            db=db,
            org_id=inspection.organization_id,
            branch_id=None,
            user_id_target=inspection.appraiser_id,
            type_str="Inspection Completed",
            title="Escalation Loan Approved",
            message=f"Escalation loan proposal approved for inspection {inspection.id}."
        )
        
    await db.commit()
    await db.refresh(escalation)
    return escalation


@router.post("/{id}/reject", response_model=EscalationResponse)
async def reject_escalation(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(manager_required),
) -> Any:
    result = await db.execute(select(Escalation).where(Escalation.id == id))
    escalation = result.scalar_one_or_none()
    if not escalation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Escalation case not found",
        )
        
    insp_res = await db.execute(
        select(Inspection)
        .options(joinedload(Inspection.branch))
        .where(Inspection.id == escalation.inspection_id)
    )
    inspection = insp_res.scalar_one_or_none()
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated inspection not found",
        )
        
    # Tenant verification
    if current_user.organization_id and inspection.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this case.",
        )
        
    # Role verification
    if current_user.role in ("Appraiser", "Branch Manager", "Auditor"):
        if current_user.branch_id and inspection.branch_id != current_user.branch_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this case.",
            )
    elif current_user.role == "Regional Manager":
        if not current_user.region or inspection.branch.region != current_user.region:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this case.",
            )
            
    escalation.decision = "Reject"
    escalation.stage = "Final Decision"
    escalation.resolved_at = datetime.now(timezone.utc)
    db.add(escalation)
    
    insp_res = await db.execute(select(Inspection).where(Inspection.id == escalation.inspection_id))
    inspection = insp_res.scalar_one_or_none()
    if inspection:
        inspection.escalation_stage = "Final Decision"
        loan = inspection.loan or {}
        loan["decision"] = "Reject"
        inspection.loan = loan
        
        audit_data = inspection.audit or []
        audit_data.append({
            "ts": datetime.now(timezone.utc).isoformat(),
            "actor": current_user.full_name,
            "action": "Escalation Rejected",
            "detail": "Manager rejected loan proposal due to high fraud risk"
        })
        inspection.audit = audit_data
        db.add(inspection)
        
    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        action="Escalation Rejected",
        detail=f"Rejected loan proposal for escalation case: {id}",
        bank_name=current_user.bank_name,
        organization_id=current_user.organization_id,
    )
    db.add(audit)
    
    if inspection:
        await send_event_notification(
            db=db,
            org_id=inspection.organization_id,
            branch_id=None,
            user_id_target=inspection.appraiser_id,
            type_str="High Risk Alert",
            title="Escalation Loan Rejected",
            message=f"Escalation loan proposal rejected for inspection {inspection.id}."
        )
        
    await db.commit()
    await db.refresh(escalation)
    return escalation


@router.post("/{id}/close", response_model=EscalationResponse)
async def close_escalation(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(manager_required),
) -> Any:
    """Close an escalation case without approve/reject (e.g. withdrawn or cancelled)."""
    result = await db.execute(select(Escalation).where(Escalation.id == id))
    escalation = result.scalar_one_or_none()
    if not escalation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Escalation case not found",
        )
        
    insp_res = await db.execute(
        select(Inspection)
        .options(joinedload(Inspection.branch))
        .where(Inspection.id == escalation.inspection_id)
    )
    inspection = insp_res.scalar_one_or_none()
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated inspection not found",
        )
        
    # Tenant verification
    if current_user.organization_id and inspection.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this case.",
        )
        
    # Role verification
    if current_user.role in ("Appraiser", "Branch Manager", "Auditor"):
        if current_user.branch_id and inspection.branch_id != current_user.branch_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this case.",
            )
    elif current_user.role == "Regional Manager":
        if not current_user.region or inspection.branch.region != current_user.region:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this case.",
            )

    escalation.decision = "Closed"
    escalation.stage = "Final Decision"
    escalation.resolved_at = datetime.now(timezone.utc)
    db.add(escalation)

    insp_res = await db.execute(select(Inspection).where(Inspection.id == escalation.inspection_id))
    inspection = insp_res.scalar_one_or_none()
    if inspection:
        inspection.escalation_stage = "Final Decision"
        audit_data = inspection.audit or []
        audit_data.append({
            "ts": datetime.now(timezone.utc).isoformat(),
            "actor": current_user.full_name,
            "action": "Escalation Closed",
            "detail": "Case closed without formal decision"
        })
        inspection.audit = audit_data
        db.add(inspection)

    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        action="Escalation Closed",
        detail=f"Closed escalation case: {id}",
        bank_name=current_user.bank_name,
        organization_id=current_user.organization_id,
    )
    db.add(audit)
    
    if inspection:
        await send_event_notification(
            db=db,
            org_id=inspection.organization_id,
            branch_id=None,
            user_id_target=inspection.appraiser_id,
            type_str="Inspection Completed",
            title="Escalation Case Closed",
            message=f"Escalation case closed without formal decision for inspection {inspection.id}."
        )
        
    await db.commit()
    await db.refresh(escalation)
    return escalation


@router.patch("/{id}/stage", response_model=EscalationResponse)
async def update_escalation_stage(
    id: str,
    esc_update: EscalationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(manager_required),
) -> Any:
    from sqlalchemy.orm import joinedload
    result = await db.execute(select(Escalation).where(Escalation.id == id))
    escalation = result.scalar_one_or_none()
    if not escalation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Escalation case not found",
        )
        
    insp_res = await db.execute(
        select(Inspection)
        .options(joinedload(Inspection.branch))
        .where(Inspection.id == escalation.inspection_id)
    )
    inspection = insp_res.scalar_one_or_none()
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated inspection not found",
        )
        
    # Tenant verification
    if current_user.organization_id and inspection.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this case.",
        )
        
    # Role verification
    if current_user.role in ("Appraiser", "Branch Manager", "Auditor"):
        if current_user.branch_id and inspection.branch_id != current_user.branch_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this case.",
            )
    elif current_user.role == "Regional Manager":
        if not current_user.region or inspection.branch.region != current_user.region:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this case.",
            )

    new_stage = esc_update.stage or escalation.stage
    old_stage = escalation.stage
    escalation.stage = new_stage
    db.add(escalation)
    
    # Update inspection escalation stage
    inspection.escalation_stage = new_stage
    
    # Append to inspection audit trail
    audit_data = inspection.audit or []
    audit_data.append({
        "ts": datetime.now(timezone.utc).isoformat(),
        "actor": current_user.full_name,
        "action": f"Escalation Stage Changed",
        "detail": f"Stage updated from {old_stage} to {new_stage}"
    })
    inspection.audit = audit_data
    db.add(inspection)
    
    # General audit log
    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        action="Escalation Stage Changed",
        detail=f"Changed stage from {old_stage} to {new_stage} for escalation case: {id}",
        bank_name=current_user.bank_name,
        organization_id=current_user.organization_id,
    )
    db.add(audit)
    
    await send_event_notification(
        db=db,
        org_id=inspection.organization_id,
        branch_id=None,
        user_id_target=None,
        type_str="Review Required",
        title="Escalation Stage Updated",
        message=f"Escalation case stage transitioned from {old_stage} to {new_stage} for inspection {inspection.id}."
    )
    
    await db.commit()
    await db.refresh(escalation)
    return escalation

