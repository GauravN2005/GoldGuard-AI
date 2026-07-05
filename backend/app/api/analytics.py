from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload
from datetime import datetime

from app.core.database import get_db
from app.models.inspection import Inspection
from app.models.branch import Branch
from app.models.user import User
from app.models.customer import Customer
from app.api.deps import get_current_user

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard_analytics(
    branch_id: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    # 1. Query inspections scoped to the current user's organization
    insp_stmt = select(Inspection)
    branch_stmt = select(Branch)

    if current_user.role in ("Appraiser", "Branch Manager", "Auditor") and current_user.branch_id:
        # Show only this branch's data
        insp_stmt = insp_stmt.where(Inspection.branch_id == current_user.branch_id)
        branch_stmt = branch_stmt.where(Branch.id == current_user.branch_id)
    elif current_user.role == "Regional Manager":
        if current_user.region:
            insp_stmt = insp_stmt.join(Branch, Inspection.branch_id == Branch.id).where(
                Branch.region == current_user.region,
                Inspection.organization_id == current_user.organization_id
            )
            branch_stmt = branch_stmt.where(
                Branch.region == current_user.region,
                Branch.organization_id == current_user.organization_id
            )
        else:
            insp_stmt = insp_stmt.where(Inspection.id == "none")
            branch_stmt = branch_stmt.where(Branch.id == "none")
    elif current_user.organization_id:
        # Super Admin — scope to entire organization
        insp_stmt = insp_stmt.where(Inspection.organization_id == current_user.organization_id)
        branch_stmt = branch_stmt.where(Branch.organization_id == current_user.organization_id)

    # Apply filters
    if branch_id:
        insp_stmt = insp_stmt.where(Inspection.branch_id == branch_id)
    if from_date:
        try:
            from_dt = datetime.fromisoformat(from_date.replace("Z", "+00:00"))
            insp_stmt = insp_stmt.where(Inspection.date >= from_dt)
        except Exception:
            pass
    if to_date:
        try:
            to_dt = datetime.fromisoformat(to_date.replace("Z", "+00:00"))
            insp_stmt = insp_stmt.where(Inspection.date <= to_dt)
        except Exception:
            pass
    if search:
        q = f"%{search.lower()}%"
        insp_stmt = insp_stmt.join(Customer, Inspection.customer_id == Customer.id).where(
            (Inspection.id.ilike(q)) |
            (Customer.name.ilike(q)) |
            (Inspection.jewelry_type.ilike(q))
        )

    insp_result = await db.execute(insp_stmt)
    inspections = insp_result.scalars().all()
    
    total = len(inspections)
    genuine = sum(1 for i in inspections if i.status == "Genuine")
    suspicious = sum(1 for i in inspections if i.status == "Suspicious")
    high_risk = sum(1 for i in inspections if i.status == "High Risk")
    pending = sum(1 for i in inspections if i.status == "Pending")
    
    approved = sum(1 for i in inspections if i.loan.get("decision") == "Approve")
    approval_rate = int((approved / total * 100)) if total else 0
    fraud_rate = float(f"{(high_risk / total * 100):.1f}") if total else 0.0

    # status distribution matching statusDist formatting
    status_dist = [
        {"name": "Genuine", "value": genuine, "color": "#2E8B57"},
        {"name": "Low Risk", "value": sum(1 for i in inspections if i.status == "Low Risk"), "color": "#D4AF37"},
        {"name": "Suspicious", "value": suspicious, "color": "#E67E22"},
        {"name": "High Risk", "value": high_risk, "color": "#C0392B"},
        {"name": "Pending", "value": pending, "color": "#9CA3AF"},
    ]

    # Generate 30 days fraud trend series based on actual data
    from datetime import datetime
    trend_dict = {}
    for insp in inspections:
        if insp.status in ("High Risk", "Suspicious"):
            day_str = insp.date.strftime("%d %b")
            trend_dict[day_str] = trend_dict.get(day_str, 0) + 1

    fraud_trend = []
    sorted_days = sorted(trend_dict.keys(), key=lambda d: datetime.strptime(d + f" {datetime.now().year}", "%d %b %Y"))
    for day in sorted_days:
        fraud_trend.append({
            "date": day,
            "cases": trend_dict[day]
        })

    # Branch ranking details (already filtered to this organization's branches)
    branch_result = await db.execute(branch_stmt)
    branches = branch_result.scalars().all()
    branch_perf = []
    for br in branches:
        branch_perf.append({
            "name": br.city,
            "inspections": sum(1 for i in inspections if i.branch_id == br.id),
            "fraud": sum(1 for i in inspections if i.branch_id == br.id and i.status in ["High Risk", "Suspicious"])
        })

    # Monthly volumes from actual inspections data
    month_dict = {}
    for insp in inspections:
        m_str = insp.date.strftime("%b")
        if m_str not in month_dict:
            month_dict[m_str] = {"total": 0, "flagged": 0}
        month_dict[m_str]["total"] += 1
        if insp.status in ("High Risk", "Suspicious"):
            month_dict[m_str]["flagged"] += 1

    monthly_vol = []
    sorted_months = sorted(month_dict.keys(), key=lambda m: datetime.strptime(m, "%b").month)
    for m in sorted_months:
        monthly_vol.append({
            "month": m,
            "total": month_dict[m]["total"],
            "flagged": month_dict[m]["flagged"]
        })

    # Calculate MoM delta dynamically
    from datetime import timedelta, timezone
    now_dt = datetime.now(timezone.utc)
    this_month_start = now_dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_end = this_month_start - timedelta(seconds=1)
    last_month_start = last_month_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    this_month_cnt = sum(1 for i in inspections if i.date >= this_month_start)
    last_month_cnt = sum(1 for i in inspections if last_month_start <= i.date <= last_month_end)
    
    if last_month_cnt > 0:
        delta_val = int(((this_month_cnt - last_month_cnt) / last_month_cnt) * 100)
        delta_str = f"{'+' if delta_val >= 0 else ''}{delta_val}% MoM"
    else:
        delta_str = f"+{this_month_cnt} this month"

    return {
        "total_inspections": {"value": str(total), "delta": delta_str},
        "genuine_gold": {"value": str(genuine), "hint": f"{approval_rate}% approved"},
        "suspicious": {"value": str(suspicious), "hint": "Awaiting assay"},
        "high_risk": {"value": str(high_risk), "hint": "Action required"},
        "pending_reviews": {"value": str(pending), "hint": "Manual audit"},
        "approval_rate": {"value": f"{approval_rate}%", "hint": "Loan approvals"},
        "fraud_detection": {"value": f"{fraud_rate}%", "hint": "Of total"},
        "fraud_trend": fraud_trend,
        "status_distribution": status_dist,
        "branch_performance": branch_perf,
        "monthly_volume": monthly_vol
    }


@router.get("/branches")
async def get_branch_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    # Query branch stats filtered by organization
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
    result = await db.execute(stmt)
    branches = result.scalars().all()
    
    out = []
    for br in branches:
        # Fetch inspections for this branch to calculate stats dynamically
        insp_stmt = select(Inspection).where(Inspection.branch_id == br.id)
        insp_res = await db.execute(insp_stmt)
        br_inspections = insp_res.scalars().all()
        
        total_insp = len(br_inspections)
        flagged = sum(1 for i in br_inspections if i.status in ("High Risk", "Suspicious"))
        approved = sum(1 for i in br_inspections if i.loan and i.loan.get("decision") == "Approve")
        rejected = sum(1 for i in br_inspections if i.loan and i.loan.get("decision") == "Reject")
        escalated = sum(1 for i in br_inspections if i.escalation_stage is not None)
        pending = sum(1 for i in br_inspections if i.status == "Pending")
        closed = approved + rejected
        
        fraud_rate = round((flagged / total_insp * 100), 1) if total_insp else 0.0
        approval_rate = round((approved / total_insp * 100), 1) if total_insp else 0.0
        rejection_rate = round((rejected / total_insp * 100), 1) if total_insp else 0.0
        escalation_rate = round((escalated / total_insp * 100), 1) if total_insp else 0.0
        risk_score = round(sum(i.risk_score for i in br_inspections) / total_insp) if total_insp else 0
        gold_weight = round(sum(i.weight for i in br_inspections if i.loan and i.loan.get("decision") == "Approve") / 1000, 2) if br_inspections else 0.0
        value = sum(float(i.loan.get("amount") or 0.0) for i in br_inspections if i.loan and i.loan.get("decision") == "Approve")
        
        # Unique appraiser count
        unique_appraisers = len(set(i.appraiser_id for i in br_inspections if i.appraiser_id))
        
        # Average processing time
        durations = []
        for i in br_inspections:
            if i.loan and i.loan.get("decision") in ("Approve", "Reject") and i.audit:
                try:
                    first_ts = i.date
                    last_ts = datetime.fromisoformat(i.audit[-1]["ts"].replace("Z", "+00:00"))
                    diff = (last_ts - first_ts).total_seconds() / 60.0 # in minutes
                    if diff > 0:
                        durations.append(diff)
                except Exception:
                    pass
        avg_processing_time = round(sum(durations) / len(durations), 1) if durations else 15.0 # default 15 mins
        
        out.append({
            "id": br.id,
            "name": br.name,
            "city": br.city,
            "inspections": total_insp,
            "fraud_rate": fraud_rate,
            "risk_score": risk_score,
            "gold_weight": gold_weight,
            "value": value,
            "approval_rate": approval_rate,
            "rejection_rate": rejection_rate,
            "escalation_rate": escalation_rate,
            "pending_cases": pending,
            "closed_cases": closed,
            "active_appraisers": unique_appraisers,
            "avg_processing_time": avg_processing_time
        })
    return out


@router.get("/manager")
async def get_manager_analytics(
    branch_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    # 1. Resolve branch_id
    target_branch_id = branch_id
    if current_user.role in ("Appraiser", "Branch Manager", "Auditor") and current_user.branch_id:
        target_branch_id = current_user.branch_id

    if not target_branch_id:
        # Get first branch of organization
        stmt = select(Branch)
        if current_user.organization_id:
            stmt = stmt.where(Branch.organization_id == current_user.organization_id)
        res = await db.execute(stmt)
        first_branch = res.scalars().first()
        target_branch_id = first_branch.id if first_branch else None

    if not target_branch_id:
        return {
            "todayCount": 0,
            "pendingCount": 0,
            "fraudCount": 0,
            "riskScore": 0,
            "branchName": "",
            "hourlyVelocity": [],
            "topAppraisers": [],
            "escalations": [],
            "approvalRate": 0.0,
            "rejectionRate": 0.0,
            "escalationRate": 0.0,
            "pendingCases": 0,
            "closedCases": 0,
            "activeAppraisers": 0,
            "avgProcessingTime": 0.0
        }

    # Fetch branch details
    br_res = await db.execute(select(Branch).where(Branch.id == target_branch_id))
    branch = br_res.scalar_one_or_none()
    branch_name = branch.name if branch else ""

    # Fetch inspections for today
    from datetime import date, timedelta, timezone
    today = date.today()
    start_of_today = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc)

    # 1. Total inspections today
    stmt_today = select(func.count(Inspection.id)).where(
        Inspection.branch_id == target_branch_id,
        Inspection.date >= start_of_today
    )
    today_count_res = await db.execute(stmt_today)
    today_count = today_count_res.scalar() or 0

    # 2. Pending reviews (status == Pending)
    stmt_pending = select(func.count(Inspection.id)).where(
        Inspection.branch_id == target_branch_id,
        Inspection.status == "Pending"
    )
    pending_count_res = await db.execute(stmt_pending)
    pending_count = pending_count_res.scalar() or 0

    # 3. Fraud cases (status == High Risk or Suspicious)
    stmt_fraud = select(func.count(Inspection.id)).where(
        Inspection.branch_id == target_branch_id,
        Inspection.status.in_(["High Risk", "Suspicious"])
    )
    fraud_count_res = await db.execute(stmt_fraud)
    fraud_count = fraud_count_res.scalar() or 0

    # 4. Hourly velocity (for today, by hour from 9 AM to 8 PM)
    stmt_hourly = select(Inspection.date).where(
        Inspection.branch_id == target_branch_id,
        Inspection.date >= start_of_today
    )
    hourly_res = await db.execute(stmt_hourly)
    dates = hourly_res.scalars().all()
    
    hourly_dict = {f"{h}h": 0 for h in range(9, 21)}
    for d in dates:
        local_hour = d.hour
        if 9 <= local_hour <= 20:
            hourly_dict[f"{local_hour}h"] += 1
            
    hourly_velocity = [{"h": k, "v": v} for k, v in hourly_dict.items()]

    # 5. Top Appraisers
    stmt_appraisers = select(
        User.id,
        User.full_name,
        func.count(Inspection.id).label("total_inspections"),
        func.avg(Inspection.authenticity_score).label("avg_accuracy")
    ).join(Inspection, User.id == Inspection.appraiser_id).where(
        Inspection.branch_id == target_branch_id
    ).group_by(User.id, User.full_name).order_by(func.count(Inspection.id).desc()).limit(5)
    
    appraisers_res = await db.execute(stmt_appraisers)
    appraisers = appraisers_res.all()
    top_appraisers = []
    for app in appraisers:
        names = app.full_name.split()
        initials = "".join([n[0] for n in names[:2]]).upper() if names else "AP"
        
        stmt_flagged = select(func.count(Inspection.id)).where(
            Inspection.appraiser_id == app.id,
            Inspection.status.in_(["High Risk", "Suspicious"])
        )
        flagged_res = await db.execute(stmt_flagged)
        flagged = flagged_res.scalar() or 0

        top_appraisers.append({
            "id": app.id,
            "name": app.full_name,
            "initials": initials,
            "inspections": app.total_inspections,
            "flagged": flagged,
            "accuracy": int(app.avg_accuracy) if app.avg_accuracy is not None else 100
        })

    # 6. Active Escalations
    from app.api.inspections import map_inspection_to_response
    stmt_esc = select(Inspection).where(
        Inspection.branch_id == target_branch_id,
        Inspection.escalation_stage.isnot(None)
    ).order_by(Inspection.date.desc()).limit(5)
    
    esc_res = await db.execute(stmt_esc)
    inspections_esc = esc_res.scalars().all()
    
    escalations = []
    for i in inspections_esc:
        escalations.append(await map_inspection_to_response(i, db))

    # Fetch all inspections for this branch to calculate stats dynamically
    stmt_all = select(Inspection).where(Inspection.branch_id == target_branch_id)
    all_res = await db.execute(stmt_all)
    branch_inspections = all_res.scalars().all()
    
    total_insp = len(branch_inspections)
    flagged = sum(1 for i in branch_inspections if i.status in ("High Risk", "Suspicious"))
    approved = sum(1 for i in branch_inspections if i.loan and i.loan.get("decision") == "Approve")
    rejected = sum(1 for i in branch_inspections if i.loan and i.loan.get("decision") == "Reject")
    escalated = sum(1 for i in branch_inspections if i.escalation_stage is not None)
    closed = approved + rejected
    
    approval_rate = round((approved / total_insp * 100), 1) if total_insp else 0.0
    rejection_rate = round((rejected / total_insp * 100), 1) if total_insp else 0.0
    escalation_rate = round((escalated / total_insp * 100), 1) if total_insp else 0.0
    risk_score = round(sum(i.risk_score for i in branch_inspections) / total_insp) if total_insp else 0
    
    unique_appraisers = len(set(i.appraiser_id for i in branch_inspections if i.appraiser_id))
    
    durations = []
    for i in branch_inspections:
        if i.loan and i.loan.get("decision") in ("Approve", "Reject") and i.audit:
            try:
                first_ts = i.date
                last_ts = datetime.fromisoformat(i.audit[-1]["ts"].replace("Z", "+00:00"))
                diff = (last_ts - first_ts).total_seconds() / 60.0
                if diff > 0:
                    durations.append(diff)
            except Exception:
                pass
    avg_processing_time = round(sum(durations) / len(durations), 1) if durations else 15.0

    return {
        "todayCount": today_count,
        "pendingCount": pending_count,
        "fraudCount": fraud_count,
        "riskScore": risk_score,
        "branchName": branch_name,
        "hourlyVelocity": hourly_velocity,
        "topAppraisers": top_appraisers,
        "escalations": escalations,
        "approvalRate": approval_rate,
        "rejectionRate": rejection_rate,
        "escalationRate": escalation_rate,
        "pendingCases": pending_count,
        "closedCases": closed,
        "activeAppraisers": unique_appraisers,
        "avgProcessingTime": avg_processing_time
    }


@router.get("/fraud-trends")
async def get_fraud_trends(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    # 1. Fetch inspections for current organization (or all if Super Admin)
    stmt = select(Inspection).options(joinedload(Inspection.branch)).join(Branch, Inspection.branch_id == Branch.id)
    if current_user.organization_id:
        stmt = stmt.where(Inspection.organization_id == current_user.organization_id)
            
    # Apply role-based visibility rules as well
    if current_user.role in ("Appraiser", "Branch Manager", "Auditor") and current_user.branch_id:
        stmt = stmt.where(Inspection.branch_id == current_user.branch_id)
    elif current_user.role == "Regional Manager" and current_user.region:
        stmt = stmt.where(Branch.region == current_user.region)

    result = await db.execute(stmt)
    inspections = result.scalars().all()

    # Calculate targets (flagged cases by jewelry type)
    flagged_inspections = [i for i in inspections if i.status in ("High Risk", "Suspicious")]
    
    target_counts = {}
    for i in flagged_inspections:
        target_counts[i.jewelry_type] = target_counts.get(i.jewelry_type, 0) + 1
        
    colors = ["#C0392B", "#E67E22", "#D4AF37", "#9CA3AF", "#2E8B57", "#3B82F6"]
    targets = []
    for idx, (name, val) in enumerate(target_counts.items()):
        targets.append({
            "name": name,
            "value": val,
            "color": colors[idx % len(colors)]
        })
    if not targets:
        targets = [{"name": "No cases", "value": 0, "color": "#9CA3AF"}]

    # Growth rate: compute monthly fraud rate = flagged / total inspections for each month in the last 6 months
    month_data = {}
    for i in inspections:
        m_str = i.date.strftime("%b")
        m_num = i.date.month
        year = i.date.year
        key = (year, m_num, m_str)
        if key not in month_data:
            month_data[key] = {"total": 0, "flagged": 0}
        month_data[key]["total"] += 1
        if i.status in ("High Risk", "Suspicious"):
            month_data[key]["flagged"] += 1
            
    sorted_keys = sorted(month_data.keys(), key=lambda k: (k[0], k[1]))
    growth = []
    for key in sorted_keys:
        total = month_data[key]["total"]
        flagged = month_data[key]["flagged"]
        rate = round((flagged / total * 100), 1) if total else 0.0
        growth.append({
            "month": key[2],
            "rate": rate
        })
    if not growth:
        growth = [{"month": datetime.now().strftime("%b"), "rate": 0.0}]

    # DETECT ADVANCED FRAUD PATTERNS
    # A. Repeated Customers in the last 30 days
    from datetime import timedelta, timezone
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    customer_counts = {}
    for i in inspections:
        if i.date >= thirty_days_ago:
            customer_counts[i.customer_id] = customer_counts.get(i.customer_id, 0) + 1
    repeated_customers = {cid: cnt for cid, cnt in customer_counts.items() if cnt > 3}

    # B. Repeated Contacts
    # Find customers with the same contact
    cust_res = await db.execute(select(Customer))
    customers = cust_res.scalars().all()
    contact_map = {}
    for c in customers:
        if c.contact:
            contact_map.setdefault(c.contact, []).append(c.id)
    duplicate_contacts = {contact: cids for contact, cids in contact_map.items() if len(cids) > 1}

    # C. Repeated Submissions within a short time window (e.g. 1 hour)
    short_window_alerts = []
    inspections_sorted = sorted(inspections, key=lambda x: x.date)
    for idx, i1 in enumerate(inspections_sorted):
        for i2 in inspections_sorted[idx+1:]:
            if (i2.date - i1.date).total_seconds() > 3600:
                break
            if i1.customer_id == i2.customer_id and i1.id != i2.id:
                short_window_alerts.append(i1.customer_id)

    # D. Cross-branch submissions for same customer
    customer_branches = {}
    for i in inspections:
        customer_branches.setdefault(i.customer_id, set()).add(i.branch_id)
    cross_branch_customers = {cid: branches for cid, branches in customer_branches.items() if len(branches) > 1}

    # E. Duplicate Image hashes (inspections that have duplicate image hash warnings)
    dup_hash_inspections = []
    for i in inspections:
        for audit_entry in (i.audit or []):
            if audit_entry.get("action") == "Fraud Alert - Image Reuse":
                dup_hash_inspections.append(i)
                break

    # Build Hotspots dynamically by incorporating these advanced alerts
    # Group by branch
    branch_alerts = {}
    for i in inspections:
        br_name = i.branch.city or i.branch.name if i.branch else "Unknown Branch"
        if br_name not in branch_alerts:
            branch_alerts[br_name] = {"count": 0, "issues": []}
            
        # Check if this inspection triggered a fraud alert
        is_fraud = i.status in ("High Risk", "Suspicious")
        
        # Check specific triggers
        reasons = []
        if i.customer_id in repeated_customers:
            reasons.append("High-frequency customer submissions")
        if i.customer_id in short_window_alerts:
            reasons.append("Repeated sub-1hr velocity check")
        if i.customer_id in cross_branch_customers:
            reasons.append("Multi-branch loan layering attempt")
        if i in dup_hash_inspections:
            reasons.append("Reused/Synthetic image signature match")
            
        if is_fraud:
            branch_alerts[br_name]["count"] += 1
            if reasons:
                branch_alerts[br_name]["issues"].extend(reasons)
            elif i.notes:
                branch_alerts[br_name]["issues"].append(i.notes[:50])

    hotspots = []
    for br_name, data in branch_alerts.items():
        if data["count"] > 0 or data["issues"]:
            unique_issues = list(set(data["issues"]))
            issue_summary = ", ".join(unique_issues[:2]) if unique_issues else "Verification irregularities flagged"
            hotspots.append({
                "branch": br_name,
                "cases": data["count"],
                "purityMismatch": issue_summary
            })
            
    # Sort by case counts descending
    hotspots.sort(key=lambda h: h["cases"], reverse=True)
    if not hotspots:
        hotspots = [
            {"branch": "Pune South", "cases": 0, "purityMismatch": "No suspicious activity detected"},
            {"branch": "Mumbai Fort", "cases": 0, "purityMismatch": "No suspicious activity detected"}
        ]

    return {
        "targets": targets,
        "growth": growth,
        "hotspots": hotspots[:5]
    }
