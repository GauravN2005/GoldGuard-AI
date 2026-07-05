from datetime import datetime, timezone, timedelta
import uuid
import asyncio
from sqlalchemy import select, func
from app.models.report import Report
from app.models.inspection import Inspection
from app.models.branch import Branch
from app.models.audit_log import AuditLog
from app.services.report_generator import report_generator
from app.services.storage_service import storage_service
from app.core.logger import logger

async def generate_automatic_weekly_reports(db) -> None:
    # Determine current date
    now = datetime.now(timezone.utc)
    # Find the current week's Sunday date
    days_since_sunday = (now.weekday() - 6) % 7
    current_sunday = now.date() - timedelta(days=days_since_sunday)
    
    # We name the report "Weekly Operations Summary Report — Week of YYYY-MM-DD"
    title = f"Weekly Operations Summary Report - Week of {current_sunday.strftime('%Y-%m-%d')}"
    
    # Check if a report with this title already exists in the DB to avoid duplicates
    res = await db.execute(select(Report).where(Report.title == title))
    existing = res.scalars().all()
    if existing:
        logger.info("Weekly report already exists, skipping automatic generation", title=title)
        return
        
    logger.info("Initializing automatic weekly report generation", title=title)
    
    seven_days_ago = now - timedelta(days=7)
    
    # Query inspections in last 7 days
    stmt = select(Inspection).where(Inspection.date >= seven_days_ago)
    insp_res = await db.execute(stmt)
    inspections = insp_res.scalars().all()
    
    # Calculate stats
    total_inspections = len(inspections)
    genuine = sum(1 for i in inspections if i.status == "Genuine")
    suspicious = sum(1 for i in inspections if i.status in ("Suspicious", "High Risk"))
    approved = sum(1 for i in inspections if i.loan.get("decision") == "Approve")
    rejected = sum(1 for i in inspections if i.loan.get("decision") == "Reject")
    
    # Group by branch
    branch_counts = {}
    for i in inspections:
        branch_counts[i.branch_id] = branch_counts.get(i.branch_id, 0) + 1
        
    branch_stats_str = ", ".join([f"Branch {bid}: {cnt} inspections" for bid, cnt in branch_counts.items()])
    
    # Portfolio summary
    total_gold_weight = sum(i.weight for i in inspections)
    total_loan_value = sum(i.loan.get("amount", 0) for i in inspections if i.loan.get("decision") == "Approve")
    
    # Notes description
    notes = (
        f"Weekly summary report for all active branches.\n"
        f"Total weekly inspections processed: {total_inspections}\n"
        f"Genuine cases: {genuine} | Suspicious/High-Risk flagged: {suspicious}\n"
        f"Approvals: {approved} | Rejections: {rejected}\n"
        f"Portfolio loan value: INR {total_loan_value:,.2f} | Gold processed: {total_gold_weight / 1000:.2f} kg\n"
        f"Branch activity summary: {branch_stats_str or 'No activity recorded.'}"
    )
    
    rep_id = "REP-" + uuid.uuid4().hex[:12].upper()
    
    rep_data = {
        "id": rep_id,
        "customerName": "Multiple Customers",
        "customerId": "MULTI-CUST",
        "date": now.isoformat(),
        "branch": "All Active Branches",
        "appraiser": "System Scheduler",
        "status": "Weekly Report",
        "weight": total_gold_weight,
        "purity": "Multi-Purity",
        "jewelryType": "Collateral Summary",
        "length": 0,
        "width": 0,
        "thickness": 0,
        "authenticityScore": 95,
        "notes": notes,
        "factors": {}
    }
    
    # Generate FPDF document
    pdf_bytes = await asyncio.to_thread(report_generator.generate_inspection_pdf, rep_data)
    
    # Save file
    filename = f"reports/{rep_id}_report.pdf"
    s3_path = storage_service.upload_file(pdf_bytes, filename, content_type="application/pdf")
    presigned = storage_service.get_presigned_url(s3_path)
    
    report_record = Report(
        id=rep_id,
        title=title,
        type="Weekly",
        date=now,
        branch_id=None,
        size=f"{len(pdf_bytes) // 1024} KB",
        description=f"Automated weekly operations audit summary.",
        file_url=presigned,
        bank_name="GoldGuard Bank",
        organization_id="org-goldguard"
    )
    db.add(report_record)
    
    # Also add notification for all bank administrators / managers
    from app.models.user import User
    from app.models.notification import Notification
    
    users_res = await db.execute(select(User).where(User.role.in_(["Super Admin", "Bank Administrator", "Regional Manager", "Branch Manager"])))
    users = users_res.scalars().all()
    
    for u in users:
        notif = Notification(
            id="notif-" + uuid.uuid4().hex[:12],
            user_id=u.id,
            type="Report Generated",
            title="Weekly Operations Report Generated",
            message=f"Weekly Summary report '{title}' has been automatically compiled.",
            read=False,
            created_at=now
        )
        db.add(notif)
        
    logger.info("Successfully completed weekly report generation", title=title, report_id=rep_id)
