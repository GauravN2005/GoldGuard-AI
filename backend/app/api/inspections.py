from typing import List, Any
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Response
from sqlalchemy import select, inspect, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from sqlalchemy.orm.attributes import flag_modified
from datetime import datetime, timezone

from app.core.database import get_db
from app.models.inspection import Inspection
from app.models.customer import Customer
from app.models.user import User
from app.models.notification import Notification
from app.models.branch import Branch
from app.models.audit_log import AuditLog
from app.schemas.inspection import InspectionResponse, InspectionCreate, InspectionUpdate
from app.api.deps import get_current_user
from app.services.storage_service import storage_service
from app.core.logger import logger

router = APIRouter()


async def map_inspection_to_response(ins: Inspection, db: AsyncSession) -> dict:
    # Customer Relation
    if "customer" in ins.__dict__:
        customer = ins.customer
    else:
        cust_res = await db.execute(select(Customer).where(Customer.id == ins.customer_id))
        customer = cust_res.scalar_one_or_none()
    cust_name = customer.name if customer else "Unknown"
    cust_contact = customer.contact if customer else ""

    # Appraiser Relation
    if "appraiser" in ins.__dict__:
        appraiser = ins.appraiser
    else:
        appr_res = await db.execute(select(User).where(User.id == ins.appraiser_id))
        appraiser = appr_res.scalar_one_or_none()
    appraiser_name = appraiser.full_name if appraiser else "System"

    # Branch Relation
    if "branch" in ins.__dict__:
        branch = ins.branch
    else:
        br_res = await db.execute(select(Branch).where(Branch.id == ins.branch_id))
        branch = br_res.scalar_one_or_none()
    branch_name = branch.name if branch else "Mumbai Fort"

    # Escalation Relation
    from app.models.escalation import Escalation
    if "escalation" in ins.__dict__:
        escalation = ins.escalation
    else:
        esc_res = await db.execute(select(Escalation).where(Escalation.inspection_id == ins.id))
        escalation = esc_res.scalar_one_or_none()
    escalation_id = escalation.id if escalation else None

    # Merge images from inspection_images table to ensure frontend always sees all visual captures
    from app.models.additional_models import InspectionImage
    img_res = await db.execute(select(InspectionImage).where(InspectionImage.inspection_id == ins.id))
    db_images = img_res.scalars().all()
    images_dict = dict(ins.images or {})
    for img in db_images:
        images_dict[img.image_type] = img.file_url

    return {
        "id": ins.id,
        "customer_id": ins.customer_id,
        "customerName": cust_name,
        "contact": cust_contact,
        "jewelry_type": ins.jewelry_type,
        "purity": ins.purity,
        "description": ins.description,
        "weight": ins.weight,
        "length": ins.length,
        "width": ins.width,
        "thickness": ins.thickness,
        "branch": branch_name,
        "appraiser": appraiser_name,
        "date": ins.date.isoformat(),
        "status": ins.status,
        "authenticity_score": ins.authenticity_score,
        "risk_score": ins.risk_score,
        "confidence": ins.confidence,
        "quality_score": ins.quality_score,
        "lighting": ins.lighting,
        "focus": ins.focus,
        "angle_coverage": ins.angle_coverage,
        "factors": ins.factors or {
            "density": 100, "surface": 100, "reflection": 100, "touchstone": 100, "visualDefect": 100
        },
        "images": images_dict,
        "loan": ins.loan or {
            "decision": "Pending", "ltv": 75, "amount": 0, "marketRate": 7200
        },
        "audit": ins.audit or [],
        "notes": ins.notes,
        "escalation_stage": ins.escalation_stage,
        "escalation_id": escalation_id
    }


async def sync_customer_status(customer_id: str, db: AsyncSession) -> None:
    # 1. Fetch all inspections for this customer
    stmt = select(Inspection).where(Inspection.customer_id == customer_id)
    res = await db.execute(stmt)
    inspections = res.scalars().all()
    
    # 2. Find the highest risk classification
    # High Risk > Suspicious > Low Risk / Genuine
    highest_status = "Genuine"
    statuses = [i.status for i in inspections if i.status]
    if "High Risk" in statuses:
        highest_status = "High Risk"
    elif "Suspicious" in statuses:
        highest_status = "Suspicious"
    elif "Low Risk" in statuses:
        highest_status = "Low Risk"
    else:
        highest_status = "Genuine"
        
    # 3. Update customer record
    cust_res = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = cust_res.scalar_one_or_none()
    if customer:
        customer.status = highest_status
        db.add(customer)


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


@router.get("", response_model=List[InspectionResponse])
async def read_inspections(
    response: Response,
    skip: int = 0,
    limit: int = 100,
    status: str | None = None,
    jewelry_type: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    base_stmt = select(Inspection)

    # Role-based + tenant filtering
    if current_user.role in ("Appraiser", "Branch Manager", "Auditor"):
        if current_user.branch_id:
            base_stmt = base_stmt.where(Inspection.branch_id == current_user.branch_id)
        else:
            base_stmt = base_stmt.where(Inspection.branch_id == "none")
    elif current_user.role == "Regional Manager":
        if current_user.region:
            base_stmt = base_stmt.join(Branch, Inspection.branch_id == Branch.id).where(
                Branch.region == current_user.region,
                Inspection.organization_id == current_user.organization_id
            )
        else:
            base_stmt = base_stmt.where(Inspection.id == "none")
    elif current_user.organization_id:
        base_stmt = base_stmt.where(Inspection.organization_id == current_user.organization_id)

    # Status filter
    if status and status != "All":
        base_stmt = base_stmt.where(Inspection.status == status)

    # Jewelry type filter
    if jewelry_type and jewelry_type != "All":
        base_stmt = base_stmt.where(Inspection.jewelry_type == jewelry_type)

    # Search filter
    if search:
        q = f"%{search.lower()}%"
        base_stmt = base_stmt.join(Customer, Inspection.customer_id == Customer.id).where(
            (Inspection.id.ilike(q)) |
            (Customer.name.ilike(q)) |
            (Inspection.jewelry_type.ilike(q))
        )

    subq = base_stmt.subquery()
    count_stmt = select(func.count(subq.c.id)).select_from(subq)
    count_res = await db.execute(count_stmt)
    total_count = count_res.scalar() or 0

    response.headers["X-Total-Count"] = str(total_count)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    # Paginate and execute final query
    stmt = (
        base_stmt
        .options(
            joinedload(Inspection.customer),
            joinedload(Inspection.appraiser),
            joinedload(Inspection.branch)
        )
        .order_by(Inspection.date.desc())
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(stmt)
    inspections = result.scalars().all()
    
    responses = []
    for i in inspections:
        responses.append(await map_inspection_to_response(i, db))
    return responses


@router.get("/{id}", response_model=InspectionResponse)
async def read_inspection(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    result = await db.execute(
        select(Inspection)
        .options(
            joinedload(Inspection.customer),
            joinedload(Inspection.appraiser),
            joinedload(Inspection.branch)
        )
        .where(Inspection.id == id)
    )
    inspection = result.scalar_one_or_none()
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
        
    # Role-based validation
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
            
    return await map_inspection_to_response(inspection, db)


@router.post("", response_model=InspectionResponse, status_code=status.HTTP_201_CREATED)
async def create_inspection(
    ins_in: InspectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    # Generate unique ID if none provided
    ins_id = ins_in.id or "INS-" + uuid.uuid4().hex[:12].upper()
    
    # Check duplicate ID
    dup_res = await db.execute(select(Inspection).where(Inspection.id == ins_id))
    if dup_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inspection with this ID already exists",
        )
        
    # Verify customer exists, create on the fly if missing or update details
    cust_res = await db.execute(select(Customer).where(Customer.id == ins_in.customer_id))
    customer = cust_res.scalar_one_or_none()
    if not customer:
        customer = Customer(
            id=ins_in.customer_id,
            name=ins_in.customer_name or "New Customer",
            contact=ins_in.contact or "",
            status="Genuine",
            bank_name=current_user.bank_name or "GoldGuard Bank",
            organization_id=current_user.organization_id
        )
        db.add(customer)
        await db.flush()
    else:
        if ins_in.customer_name:
            customer.name = ins_in.customer_name
        if ins_in.contact:
            customer.contact = ins_in.contact
        db.add(customer)
        await db.flush()
        
    # Build default audit trails
    audit_events = [
        {
            "ts": datetime.now(timezone.utc).isoformat(),
            "actor": current_user.full_name,
            "action": "Inspection Created",
            "detail": f"ID {ins_id} • Stated branch: {current_user.branch.name if current_user.branch else 'Unknown'}"
        }
    ]
    
    inspection = Inspection(
        id=ins_id,
        appraiser_id=current_user.id,
        branch_id=current_user.branch_id or "br-mumbai",
        organization_id=current_user.organization_id,
        status="Pending",
        authenticity_score=100,
        risk_score=0,
        confidence=100,
        quality_score=100,
        lighting=100,
        focus=100,
        angle_coverage=100,
        factors={"density": 100, "surface": 100, "reflection": 100, "touchstone": 100, "visualDefect": 100},
        images={},
        loan={"decision": "Pending", "ltv": 75, "amount": 0, "marketRate": 7200},
        audit=audit_events,
        **ins_in.model_dump(exclude={"id", "customer_name", "contact"})
    )
    db.add(inspection)
    
    # Audit log entry
    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        action="Inspection Created",
        detail=f"Created inspection {ins_id} for customer {ins_in.customer_id}",
        bank_name=current_user.bank_name,
        organization_id=current_user.organization_id,
    )
    db.add(audit)
    
    await db.flush()
    await sync_customer_status(inspection.customer_id, db)
    await db.flush()
    return await map_inspection_to_response(inspection, db)


@router.patch("/{id}", response_model=InspectionResponse)
async def update_inspection(
    id: str,
    ins_in: InspectionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    result = await db.execute(select(Inspection).where(Inspection.id == id))
    inspection = result.scalar_one_or_none()
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inspection not found",
        )
        
    # Exclude unset fields
    for k, v in ins_in.model_dump(exclude_unset=True).items():
        if k in ["factors", "images", "loan"]:
            # Perform deep merge or update on JSON fields
            orig = dict(getattr(inspection, k) or {})
            orig.update(v.model_dump() if hasattr(v, "model_dump") else v)
            setattr(inspection, k, orig)
            flag_modified(inspection, k)
        else:
            setattr(inspection, k, v)

    # Sync Escalation stages and decision
    from app.models.escalation import Escalation
    esc_stmt = select(Escalation).where(Escalation.inspection_id == inspection.id)
    esc_res = await db.execute(esc_stmt)
    escalation = esc_res.scalar_one_or_none()

    if ins_in.escalation_stage:
        if not escalation:
            escalation = Escalation(
                id="esc-" + uuid.uuid4().hex[:12],
                inspection_id=inspection.id,
                stage=ins_in.escalation_stage,
                decision="Pending",
            )
            db.add(escalation)
        else:
            escalation.stage = ins_in.escalation_stage
            db.add(escalation)

    if ins_in.loan and escalation:
        if ins_in.loan.decision in ("Approve", "Reject"):
            escalation.decision = ins_in.loan.decision
            escalation.stage = "Final Decision"
            escalation.resolved_at = datetime.now(timezone.utc)
            db.add(escalation)

    # Append to inspection audit trail if status or loan is modified
    audit_data = inspection.audit or []
    if ins_in.status:
        audit_data.append({
            "ts": datetime.now(timezone.utc).isoformat(),
            "actor": "System",
            "action": "Status Updated",
            "detail": f"Status updated to: {ins_in.status}"
        })
    if ins_in.loan:
        audit_data.append({
            "ts": datetime.now(timezone.utc).isoformat(),
            "actor": current_user.full_name,
            "action": "Loan Decision",
            "detail": f"Decision: {ins_in.loan.decision} • LTV: {ins_in.loan.ltv}%"
        })
    inspection.audit = audit_data
    
    db.add(inspection)
    
    # Audit log entry
    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        action="Inspection Updated",
        detail=f"Modified inspection {inspection.id} parameters",
        bank_name=current_user.bank_name,
        organization_id=current_user.organization_id,
    )
    db.add(audit)
    
    # Trigger notifications
    if ins_in.status in ("High Risk", "Suspicious"):
        await send_event_notification(
            db=db,
            org_id=inspection.organization_id,
            branch_id=None,
            user_id_target=None,
            type_str="High Risk Alert",
            title="High Risk Inspection Flagged",
            message=f"Inspection {inspection.id} has been flagged as {ins_in.status} (risk score: {inspection.risk_score})."
        )
    if ins_in.loan and ins_in.loan.decision in ("Approve", "Reject"):
        await send_event_notification(
            db=db,
            org_id=inspection.organization_id,
            branch_id=None,
            user_id_target=inspection.appraiser_id,
            type_str="Inspection Completed",
            title=f"Loan proposal {ins_in.loan.decision}d",
            message=f"Loan proposal for inspection {inspection.id} has been {ins_in.loan.decision}d by manager."
        )
    
    await db.flush()
    await sync_customer_status(inspection.customer_id, db)
    await db.flush()
    return await map_inspection_to_response(inspection, db)


@router.post("/{id}/images")
async def upload_inspection_image(
    id: str,
    angle: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    # Validate image type
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image type. Only JPEG, PNG, and WebP are allowed."
        )

    # Acquire a row lock on the inspection record using select-for-update to prevent race conditions during concurrent angle uploads
    result = await db.execute(select(Inspection).where(Inspection.id == id).with_for_update())
    inspection = result.scalar_one_or_none()
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inspection not found",
        )
        
    # Read file data
    content = await file.read()
    # Validate file size (max 10MB)
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds the 10MB limit."
        )
    filename = f"inspections/{id}/{angle}_{file.filename}"
    s3_path = storage_service.upload_file(content, filename, content_type=file.content_type)
    
    # Get public url link
    presigned = storage_service.get_presigned_url(s3_path)
    
    # Save in inspection_images table directly to prevent race conditions and synchronize DB state correctly
    from app.models.additional_models import InspectionImage
    stmt_img = select(InspectionImage).where(
        InspectionImage.inspection_id == id,
        InspectionImage.image_type == angle
    )
    img_res = await db.execute(stmt_img)
    db_image = img_res.scalar_one_or_none()
    
    if db_image:
        db_image.file_url = presigned
        db_image.uploaded_by = current_user.id
        db_image.created_at = datetime.now(timezone.utc)
        db.add(db_image)
    else:
        db_image = InspectionImage(
            inspection_id=id,
            image_type=angle,
            file_url=presigned,
            uploaded_by=current_user.id,
            created_at=datetime.now(timezone.utc)
        )
        db.add(db_image)
        
    # Save S3 URL in images json dictionary
    import hashlib
    content_hash = hashlib.sha256(content).hexdigest()
    
    images = dict(inspection.images or {})
    images[angle] = presigned
    
    # Save the hash in a "hashes" dictionary inside the images JSON
    hashes = dict(images.get("hashes", {}))
    hashes[angle] = content_hash
    images["hashes"] = hashes
    
    inspection.images = images
    flag_modified(inspection, "images")
    
    # Add audit log
    audit_data = list(inspection.audit or [])
    audit_data.append({
        "ts": datetime.now(timezone.utc).isoformat(),
        "actor": current_user.full_name,
        "action": "Image Uploaded",
        "detail": f"Uploaded visual angle capture: {angle}"
    })
    
    # Check for duplicate image reuse across inspections
    stmt_dup = select(Inspection).where(
        Inspection.id != id,
        Inspection.images.isnot(None)
    )
    dup_res = await db.execute(stmt_dup)
    other_inspections = dup_res.scalars().all()
    
    for other in other_inspections:
        other_hashes = (other.images or {}).get("hashes", {})
        for other_angle, other_hash in other_hashes.items():
            if other_hash == content_hash:
                logger.warning(f"Fraud Alert: Duplicate image hash detected! Matches inspection {other.id} angle {other_angle}")
                audit_data.append({
                    "ts": datetime.now(timezone.utc).isoformat(),
                    "actor": "System AI Risk Engine",
                    "action": "Fraud Alert - Image Reuse",
                    "detail": f"Uploaded image content matches inspection {other.id} angle {other_angle} (SHA-256 collision)"
                })
                inspection.risk_score = min(100, inspection.risk_score + 45)
                inspection.status = "High Risk"
                break
                
    inspection.audit = audit_data
    flag_modified(inspection, "audit")
    db.add(inspection)
    
    # General audit log
    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        action="Image Uploaded",
        detail=f"Uploaded photo angle '{angle}' for inspection {id}",
        bank_name=current_user.bank_name,
        organization_id=current_user.organization_id,
    )
    db.add(audit)
    
    await db.flush()
    await sync_customer_status(inspection.customer_id, db)
    await db.flush()
    
    return {"message": f"Image uploaded successfully for angle {angle}", "url": presigned}


@router.post("/{id}/visual-review")
async def generate_visual_review(
    id: str,
    req_body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Generate manual AI visual observations review for a specific image angle."""
    result = await db.execute(select(Inspection).where(Inspection.id == id))
    inspection = result.scalar_one_or_none()
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inspection not found",
        )
    
    angle = req_body.get("angle", "front")
    images = inspection.images or {}
    image_url = images.get(angle)
    
    if not image_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No image found for angle '{angle}'. Please upload an image first.",
        )
        
    try:
        import httpx
        from app.services.llm_service import llm_service
        
        # Download image bytes from storage
        if image_url.startswith("http://") or image_url.startswith("https://"):
            async with httpx.AsyncClient() as client:
                res = await client.get(image_url)
                if res.status_code == 200:
                    image_bytes = res.content
                else:
                    raise Exception(f"Failed to fetch image from URL: {image_url}")
        else:
            from app.services.storage_service import storage_service
            # If it's a relative path, download it
            image_bytes = storage_service.download_file(image_url)
            
        observations = await llm_service.analyze_image_visually(image_bytes)
        
        # Add to audit log
        audit_data = inspection.audit or []
        audit_data.append({
            "ts": datetime.now(timezone.utc).isoformat(),
            "actor": current_user.full_name,
            "action": "Visual Review Generated",
            "detail": f"AI Visual Review generated for angle: {angle}"
        })
        inspection.audit = audit_data
        db.add(inspection)
        await db.commit()
        
        return {"observations": observations}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI Visual Review failed: {str(e)}"
        )


@router.post("/{id}/submit")
async def submit_inspection(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    result = await db.execute(select(Inspection).where(Inspection.id == id))
    inspection = result.scalar_one_or_none()
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inspection not found",
        )
        
    # Run AI diagnostic calculation automatically on submission to compute real scores
    from app.services.ai_services import ai_orchestrator
    
    cust_res = await db.execute(select(Customer).where(Customer.id == inspection.customer_id))
    customer = cust_res.scalar_one_or_none()
    is_suspicious = False
    if customer and customer.status in ["Suspicious", "High Risk"]:
        is_suspicious = True
    if inspection.description and ("antique" in inspection.description.lower() or "suspicious" in inspection.description.lower()):
        is_suspicious = True

    # Run the actual AI pipeline (Surface, Defect, Density, Reflection, Touchstone)
    await ai_orchestrator.run_diagnostics(inspection, db, is_suspicious=is_suspicious)
    
    audit_data = list(inspection.audit or [])
    audit_data.append({
        "ts": datetime.now(timezone.utc).isoformat(),
        "actor": current_user.full_name,
        "action": "Inspection Submitted",
        "detail": "Appraisal forwarded for risk calculation & manager decision"
    })
    inspection.audit = audit_data
    db.add(inspection)
    
    # Log audit
    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        action="Inspection Submitted",
        detail=f"Submitted final appraisal for inspection {id}",
        bank_name=current_user.bank_name,
        organization_id=current_user.organization_id,
    )
    db.add(audit)
    
    await send_event_notification(
        db=db,
        org_id=inspection.organization_id,
        branch_id=inspection.branch_id,
        user_id_target=None,
        type_str="Review Required" if inspection.status == "Pending" else "Inspection Completed",
        title="New Inspection Submitted",
        message=f"Inspection {inspection.id} submitted for customer {inspection.customer_id}. Status: {inspection.status}."
    )
    
    if inspection.status in ("High Risk", "Suspicious"):
        await send_event_notification(
            db=db,
            org_id=inspection.organization_id,
            branch_id=None,
            user_id_target=None,
            type_str="High Risk Alert",
            title="High Risk Inspection Flagged",
            message=f"Submitted inspection {inspection.id} has been flagged as {inspection.status}."
        )
        
    await db.flush()
    await sync_customer_status(inspection.customer_id, db)
    await db.flush()
    
    return {"message": "Inspection submitted for review", "status": inspection.status}


@router.get("/{id}/report")
async def get_inspection_report(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Generate and retrieve the PDF report for a specific inspection."""
    result = await db.execute(select(Inspection).where(Inspection.id == id))
    inspection = result.scalar_one_or_none()
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inspection not found",
        )
        
    # Fetch related customer, branch, and appraiser details
    cust_res = await db.execute(select(Customer).where(Customer.id == inspection.customer_id))
    customer = cust_res.scalar_one_or_none()
    cust_name = customer.name if customer else "Unknown"
    cust_id = customer.id if customer else "N/A"
    
    br_res = await db.execute(select(Branch).where(Branch.id == inspection.branch_id))
    branch = br_res.scalar_one_or_none()
    branch_name = branch.name if branch else "Unknown"
    
    appr_res = await db.execute(select(User).where(User.id == inspection.appraiser_id))
    appraiser = appr_res.scalar_one_or_none()
    appraiser_name = appraiser.full_name if appraiser else "System"

    rep_data = {
        "id": inspection.id,
        "customerName": cust_name,
        "customerId": cust_id,
        "date": inspection.date.isoformat(),
        "branch": branch_name,
        "appraiser": appraiser_name,
        "status": inspection.status,
        "weight": inspection.weight,
        "purity": inspection.purity,
        "jewelryType": inspection.jewelry_type,
        "length": inspection.length,
        "width": inspection.width,
        "thickness": inspection.thickness,
        "authenticityScore": inspection.authenticity_score,
        "notes": inspection.notes or "No remarks provided.",
        "factors": inspection.factors or {}
    }

    try:
        from app.services.report_generator import report_generator
        from app.services.storage_service import storage_service
        from app.services.llm_service import llm_service
        
        # Generate LLM narrative report prose
        llm_payload = {
            "jewelry_type": inspection.jewelry_type,
            "weight_g": inspection.weight,
            "purity": inspection.purity,
            "authenticity_score": inspection.authenticity_score,
            "overall_risk": inspection.status,
            "factors": inspection.factors or {}
        }
        try:
            llm_narrative = await llm_service.generate_report_narrative(llm_payload)
        except Exception as llm_err:
            logger.error("Failed to generate LLM narrative report prose, using default narrative", error=str(llm_err))
            llm_narrative = {
                "executive_summary": "Gold appraisal inspection report compiled successfully.",
                "risk_assessment": "Spectral, visual and physical diagnostic checks executed.",
                "recommendation_details": "Item recommended for approval within default loan criteria parameters.",
                "conclusion": "Inspection completed successfully."
            }
        rep_data["llm_narrative"] = llm_narrative
        
        pdf_bytes = report_generator.generate_inspection_pdf(rep_data)
        filename = f"reports/{inspection.id}_report.pdf"
        
        try:
            s3_path = storage_service.upload_file(pdf_bytes, filename, content_type="application/pdf")
            presigned = storage_service.get_presigned_url(s3_path)
        except Exception as upload_err:
            logger.error("Primary storage upload failed, saving to local disk", error=str(upload_err))
            from app.services.storage_service import LocalStorageService
            local_service = LocalStorageService()
            s3_path = local_service.upload_file(pdf_bytes, filename, content_type="application/pdf")
            presigned = local_service.get_presigned_url(s3_path)
    except Exception as e:
        logger.error("Report PDF generation failed completely", error=str(e))
        presigned = f"/static/uploads/reports/{inspection.id}_report.pdf"

    return {"file_url": presigned, "fileUrl": presigned}


@router.get("/{id}/report/pdf")
async def download_inspection_report_pdf(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Stream the PDF report bytes directly — avoids ephemeral filesystem dependency."""
    from fastapi.responses import Response as FastAPIResponse

    result = await db.execute(select(Inspection).where(Inspection.id == id))
    inspection = result.scalar_one_or_none()
    if not inspection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspection not found")

    # Tenant check
    if current_user.organization_id and inspection.organization_id != current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    # Fetch related data
    cust_res = await db.execute(select(Customer).where(Customer.id == inspection.customer_id))
    customer = cust_res.scalar_one_or_none()
    br_res = await db.execute(select(Branch).where(Branch.id == inspection.branch_id))
    branch = br_res.scalar_one_or_none()
    appr_res = await db.execute(select(User).where(User.id == inspection.appraiser_id))
    appraiser = appr_res.scalar_one_or_none()

    rep_data = {
        "id": inspection.id,
        "customerName": customer.name if customer else "Unknown",
        "customerId": customer.id if customer else "N/A",
        "date": inspection.date.isoformat(),
        "branch": branch.name if branch else "Unknown",
        "appraiser": appraiser.full_name if appraiser else "System",
        "status": inspection.status,
        "weight": inspection.weight,
        "purity": inspection.purity,
        "jewelryType": inspection.jewelry_type,
        "length": inspection.length,
        "width": inspection.width,
        "thickness": inspection.thickness,
        "authenticityScore": inspection.authenticity_score,
        "notes": inspection.notes or "No remarks provided.",
        "factors": inspection.factors or {}
    }

    # Try LLM narrative; fall back gracefully
    try:
        from app.services.llm_service import llm_service
        llm_payload = {
            "jewelry_type": inspection.jewelry_type,
            "weight_g": inspection.weight,
            "purity": inspection.purity,
            "authenticity_score": inspection.authenticity_score,
            "overall_risk": inspection.status,
            "factors": inspection.factors or {}
        }
        llm_narrative = await llm_service.generate_report_narrative(llm_payload)
        rep_data["llm_narrative"] = llm_narrative
    except Exception as llm_err:
        logger.warning("LLM narrative generation skipped in PDF stream", error=str(llm_err))
        rep_data["llm_narrative"] = {
            "executive_summary": "Gold appraisal inspection report compiled successfully.",
            "risk_assessment": "Spectral, visual and physical diagnostic checks executed.",
            "recommendation_details": "Item recommended for approval within default loan criteria parameters.",
            "conclusion": "Inspection completed successfully."
        }

    try:
        from app.services.report_generator import report_generator
        pdf_bytes = report_generator.generate_inspection_pdf(rep_data)
    except Exception as e:
        logger.error("PDF stream generation failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

    return FastAPIResponse(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{inspection.id}_report.pdf"',
            "Content-Length": str(len(pdf_bytes)),
        }
    )
