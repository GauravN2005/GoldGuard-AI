from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.core.database import get_db
from app.models.inspection import Inspection
from app.models.customer import Customer
from app.models.branch import Branch
from app.models.user import User
from app.models.audit_log import AuditLog
from app.models.additional_models import AIPrediction
from app.schemas.ai import (
    AnalysisResponse,
    DensityAnalysisRequest,
    DensityAnalysisResponse,
    FinalRiskRequest,
    FinalRiskResponse
)
from app.services.ai_services import ai_orchestrator
from app.api.deps import get_current_user

router = APIRouter()


@router.post("/analyze/{inspection_id}", response_model=AnalysisResponse)
async def analyze_inspection(
    inspection_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    result = await db.execute(select(Inspection).where(Inspection.id == inspection_id))
    inspection = result.scalar_one_or_none()
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inspection not found",
        )
        
    # Tenant verification
    if current_user.role in ("Appraiser", "Branch Manager"):
        if current_user.branch_id and inspection.branch_id != current_user.branch_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this inspection.",
            )
    elif current_user.organization_id:
        if inspection.organization_id != current_user.organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this inspection.",
            )

    # Check if customer has prior fraud cases to simulate a suspicious item
    cust_res = await db.execute(select(Customer).where(Customer.id == inspection.customer_id))
    customer = cust_res.scalar_one_or_none()
    is_suspicious = False
    if customer and customer.status in ["Suspicious", "High Risk"]:
        is_suspicious = True
    # Also simulate suspicious based on keyword in description
    if inspection.description and ("antique" in inspection.description.lower() or "suspicious" in inspection.description.lower()):
        is_suspicious = True

    # Run AI diagnostic calculation
    analysis = await ai_orchestrator.run_diagnostics(inspection, db, is_suspicious=is_suspicious)
    
    # Commit database changes (since run_diagnostics updates DB models)
    await db.commit()
    
    # Smart risk notification generation
    if inspection.status in ["Suspicious", "High Risk"] or (inspection.authenticity_score and inspection.authenticity_score < 80):
        from app.services.llm_service import llm_service
        from app.models.notification import Notification
        import uuid
        
        notif_payload = {
            "inspection_id": inspection.id,
            "jewelry_type": inspection.jewelry_type,
            "purity": inspection.purity,
            "authenticity_score": inspection.authenticity_score,
            "overall_risk": "High Risk" if inspection.status == "High Risk" else "Medium Risk",
            "factors": inspection.factors
        }
        smart_message = await llm_service.generate_risk_notification(notif_payload)
        
        recipients = [current_user.id]
        if current_user.branch_id:
            from app.models.user import User
            stmt = select(User.id).where(User.branch_id == current_user.branch_id)
            res = await db.execute(stmt)
            branch_users = res.scalars().all()
            recipients = list(set(recipients + list(branch_users)))
            
        for user_id in recipients:
            notif = Notification(
                id=f"notif-{uuid.uuid4().hex[:12]}",
                user_id=user_id,
                type="High Risk Alert",
                title="AI High Risk Warning",
                message=smart_message[:254],
                read=False,
                created_at=datetime.now(timezone.utc)
            )
            db.add(notif)
        await db.commit()

    # Audit log creation
    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=f"AI Engine ({current_user.full_name})",
        action="AI Diagnostics Run",
        detail=f"Completed automated analysis for inspection {inspection_id}. Rating: {inspection.authenticity_score}%",
        bank_name=current_user.bank_name,
        organization_id=current_user.organization_id,
    )
    db.add(audit)
    await db.commit()
    
    # Format return to camelCase standard expected by AnalysisResponse
    return {
        "inspection_id": analysis["inspection_id"],
        "status": analysis["status"],
        "authenticity_score": analysis["authenticity_score"],
        "risk_score": analysis["risk_score"],
        "confidence": analysis["confidence"],
        "quality_score": analysis["quality_score"],
        "factors": analysis["factors"],
        "reasoning": analysis["reasoning"],
        "llm_reasoning": analysis.get("llm_reasoning")
    }


@router.post("/density-analysis", response_model=DensityAnalysisResponse)
async def density_analysis(
    req: DensityAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    result = await db.execute(select(Inspection).where(Inspection.id == req.inspection_id))
    inspection = result.scalar_one_or_none()
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inspection not found",
        )
        
    # Copy inspection data to respect manual overrides
    temp_ins = Inspection(
        id=inspection.id,
        jewelry_type=req.jewelry_type or inspection.jewelry_type,
        weight=req.weight if req.weight is not None else inspection.weight,
        length=req.length if req.length is not None else inspection.length,
        width=req.width if req.width is not None else inspection.width,
        thickness=req.thickness if req.thickness is not None else inspection.thickness,
        purity=req.purity or inspection.purity
    )
    
    tolerance = req.tolerance if req.tolerance is not None else 0.03
    analysis = await ai_orchestrator.density.analyze_density(temp_ins, tolerance=tolerance)
    
    return {
        "calculated_density": analysis["calculated_density"],
        "expected_density": analysis["expected_density"],
        "difference_percentage": analysis["difference_percentage"],
        "confidence": analysis["score"],
        "density_score": analysis["density_score"],
        "confidence_score": analysis["confidence_score"],
        "risk_level": analysis["risk_level"],
        "explanation": analysis["details"],
        "possible_core_material": analysis["possible_core_material"]
    }


@router.post("/final-risk", response_model=FinalRiskResponse)
async def final_risk(
    req: FinalRiskRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    result = await db.execute(select(Inspection).where(Inspection.id == req.inspection_id))
    inspection = result.scalar_one_or_none()
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inspection not found",
        )
        
    # Gather scores (use request parameter overrides, or read from database inspection factors)
    factors = inspection.factors or {}
    surface = req.surface_score if req.surface_score is not None else factors.get("surface", 90.0)
    defect = req.defect_score if req.defect_score is not None else factors.get("visualDefect", 90.0)
    reflection = req.reflection_score if req.reflection_score is not None else factors.get("reflection", 90.0)
    touchstone = req.touchstone_score if req.touchstone_score is not None else factors.get("touchstone", 90.0)
    density = req.density_score if req.density_score is not None else factors.get("density", 90.0)
    
    fusion = await ai_orchestrator.fusion.run_fusion(
        surface_score=surface,
        defect_score=defect,
        reflection_score=reflection,
        touchstone_score=touchstone,
        density_score=density
    )
    
    return {
        "authenticity_score": fusion["authenticity_score"],
        "confidence_score": fusion["confidence_score"],
        "overall_risk": fusion["overall_risk"],
        "recommendation": fusion["recommendation"],
        "explainability": fusion["explainability"],
        "individual_scores": fusion["individual_scores"]
    }


@router.get("/result/{inspection_id}")
async def get_ai_result(
    inspection_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    stmt = select(AIPrediction).where(AIPrediction.inspection_id == inspection_id).order_by(AIPrediction.created_at.desc())
    res = await db.execute(stmt)
    prediction = res.scalars().first()
    if not prediction:
        # If no prediction records yet, calculate a fresh one
        result = await db.execute(select(Inspection).where(Inspection.id == inspection_id))
        inspection = result.scalar_one_or_none()
        if not inspection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inspection not found",
            )
        # Compute fresh
        fresh = await ai_orchestrator.run_diagnostics(inspection, db)
        await db.commit()
        
        # Re-fetch prediction
        res = await db.execute(stmt)
        prediction = res.scalars().first()
        if not prediction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="AI results prediction not found.",
            )
            
    return prediction.prediction_data


@router.get("/status")
async def get_ai_status(
    current_user: User = Depends(get_current_user),
) -> Any:
    from app.services.llm_service import llm_service
    return llm_service.get_status()


@router.post("/chat")
async def chat_with_assistant(
    req_body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Conversational chat endpoint with dynamic RBAC context building and topic restriction."""
    message = req_body.get("message", "")
    if not message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message field cannot be empty.",
        )
        
    role = current_user.role
    context = {
        "user_role": role,
        "user_name": current_user.full_name,
        "branch_id": current_user.branch_id,
        "bank_name": current_user.bank_name,
    }
    
    try:
        from sqlalchemy import func
        # Appraiser & Branch Manager role-scoped query
        if role in ["Appraiser", "Branch Manager"] and current_user.branch_id:
            stmt = select(Inspection).where(Inspection.branch_id == current_user.branch_id).order_by(Inspection.date.desc()).limit(15)
            res = await db.execute(stmt)
            inspections = res.scalars().all()
            context["recent_inspections"] = [
                {
                    "id": ins.id,
                    "jewelry_type": ins.jewelry_type,
                    "status": ins.status,
                    "authenticity_score": ins.authenticity_score,
                    "date": ins.date.isoformat() if ins.date else None
                } for ins in inspections
            ]
            
            stmt_count = select(func.count(Inspection.id)).where(Inspection.branch_id == current_user.branch_id)
            res_count = await db.execute(stmt_count)
            context["total_branch_inspections"] = res_count.scalar() or 0
            
            stmt_flagged = select(func.count(Inspection.id)).where(
                Inspection.branch_id == current_user.branch_id,
                Inspection.status.in_(["Suspicious", "High Risk"])
            )
            res_flagged = await db.execute(stmt_flagged)
            context["flagged_branch_inspections"] = res_flagged.scalar() or 0
            
        # Regional Manager / Super Admin stats query
        else:
            stmt_count = select(func.count(Inspection.id))
            res_count = await db.execute(stmt_count)
            context["total_system_inspections"] = res_count.scalar() or 0
            
            stmt_flagged = select(func.count(Inspection.id)).where(
                Inspection.status.in_(["Suspicious", "High Risk"])
            )
            res_flagged = await db.execute(stmt_flagged)
            context["flagged_system_inspections"] = res_flagged.scalar() or 0

        from app.services.llm_service import llm_service
        reply = await llm_service.chat_with_context(message, context)
        
        # Log to audit trail
        audit = AuditLog(
            actor_id=current_user.id,
            actor_name=current_user.full_name,
            action="AI Chat Inquiry",
            detail=f"User asked: '{message[:40]}...'",
            bank_name=current_user.bank_name,
            organization_id=current_user.organization_id,
        )
        db.add(audit)
        await db.commit()
        
        return {"reply": reply, "llm_status": llm_service.status}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat query failed: {str(e)}"
        )

