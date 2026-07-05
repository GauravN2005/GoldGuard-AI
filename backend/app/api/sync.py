from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from pydantic import BaseModel

from app.core.database import get_db
from app.models.inspection import Inspection
from app.models.customer import Customer
from app.models.branch import Branch
from app.models.audit_log import AuditLog
from app.api.deps import get_current_user

router = APIRouter()


class DraftItem(BaseModel):
    id: str
    customerName: str
    jewelryType: str
    weight: float
    step: int
    savedAt: str


class SyncRequest(BaseModel):
    drafts: List[DraftItem]


@router.post("/drafts")
async def sync_drafts(
    req: SyncRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Any:
    synced_ids = []
    
    default_branch_id = current_user.branch_id
    if not default_branch_id:
        br_stmt = select(Branch).where(Branch.organization_id == current_user.organization_id)
        if current_user.role == "Regional Manager" and current_user.region:
            br_stmt = br_stmt.where(Branch.region == current_user.region)
        br_res = await db.execute(br_stmt)
        first_br = br_res.scalars().first()
        default_branch_id = first_br.id if first_br else "br-mumbai"
    
    for draft in req.drafts:
        # Check if customer profile exists or create mock customer
        import uuid
        cust_id = "cus-sync-" + uuid.uuid4().hex[:12]
        cust_res = await db.execute(
            select(Customer)
            .where((Customer.name == draft.customerName) & (Customer.organization_id == current_user.organization_id))
        )
        customer = cust_res.scalar_one_or_none()
        
        if not customer:
            customer = Customer(
                id=cust_id,
                name=draft.customerName,
                contact="+91 99999 88888",
                status="Genuine",
                bank_name=current_user.bank_name,
                organization_id=current_user.organization_id
            )
            db.add(customer)
            await db.flush()
            
        # Create inspection row
        audit_events = [
            {
                "ts": draft.savedAt,
                "actor": current_user.full_name,
                "action": "Inspection Created Offline",
                "detail": "Cached on local app storage"
            },
            {
                "ts": datetime.now(timezone.utc).isoformat(),
                "actor": "System",
                "action": "Inspection Synchronized",
                "detail": "Uploaded to vault database"
            }
        ]
        
        inspection = Inspection(
            id=draft.id,
            customer_id=customer.id,
            appraiser_id=current_user.id,
            branch_id=default_branch_id,
            organization_id=current_user.organization_id,
            jewelry_type=draft.jewelryType,
            purity="22K", # Default synced purity
            description=f"Synchronized offline draft of {draft.jewelryType}",
            weight=draft.weight,
            length=0.0, width=0.0, thickness=0.0,
            status="Pending",
            authenticity_score=95,
            risk_score=5,
            confidence=90,
            quality_score=90,
            lighting=90, focus=90, angle_coverage=90,
            factors={"density": 95, "surface": 95, "reflection": 95, "touchstone": 95, "visualDefect": 95},
            images={},
            loan={"decision": "Pending", "ltv": 75, "amount": int(draft.weight * 7200 * 0.916 * 0.75), "marketRate": 7200},
            audit=audit_events
        )
        db.add(inspection)
        synced_ids.append(draft.id)
        
        # Log audit entry
        audit = AuditLog(
            actor_id=current_user.id,
            actor_name=current_user.full_name,
            action="Draft Synchronized",
            detail=f"Synced offline inspection {draft.id} for customer {draft.customerName}",
            bank_name=current_user.bank_name,
            organization_id=current_user.organization_id,
        )
        db.add(audit)
        
    await db.flush()
    return {"message": "Drafts synchronized successfully", "synced_ids": synced_ids}


@router.get("/status")
async def get_sync_status(
    current_user: Any = Depends(get_current_user),
) -> Any:
    return {
        "status": "Online",
        "pending_sync": 0,
        "last_sync_time": datetime.now(timezone.utc).isoformat()
    }
