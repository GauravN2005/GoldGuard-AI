import asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func, text
from app.core.database import AsyncSessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.organization import Organization
from app.models.branch import Branch
from app.models.user import User
from app.models.customer import Customer
from app.models.inspection import Inspection
from app.models.escalation import Escalation
from app.models.report import Report
from app.models.notification import Notification
from app.models.audit_log import AuditLog

async def seed_db():
    print("GoldGuard DB seeding starting...")
    
    # 1. Initialize schemas/tables if missing
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        # Patch/Migrate schemas: add missing columns if they don't exist
        migration_stmts = [
            "ALTER TABLE branches ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100) DEFAULT 'GoldGuard Bank'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100) DEFAULT 'GoldGuard Bank'",
            "ALTER TABLE customers ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100) DEFAULT 'GoldGuard Bank'",
            "ALTER TABLE reports ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100) DEFAULT 'GoldGuard Bank'",
            "ALTER TABLE branches ADD COLUMN IF NOT EXISTS organization_id VARCHAR(50) REFERENCES organizations(id)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id VARCHAR(50) REFERENCES organizations(id)",
            "ALTER TABLE customers ADD COLUMN IF NOT EXISTS organization_id VARCHAR(50) REFERENCES organizations(id)",
            "ALTER TABLE reports ADD COLUMN IF NOT EXISTS organization_id VARCHAR(50) REFERENCES organizations(id)",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS organization_id VARCHAR(50) REFERENCES organizations(id)",
            "ALTER TABLE inspections ADD COLUMN IF NOT EXISTS organization_id VARCHAR(50) REFERENCES organizations(id)",
            "ALTER TABLE branches ADD COLUMN IF NOT EXISTS region VARCHAR(50)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS region VARCHAR(50)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(255)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'",
            "ALTER TABLE inspections ALTER COLUMN notes TYPE TEXT",
        ]
        for stmt in migration_stmts:
            try:
                await conn.execute(text(stmt))
            except Exception as e:
                print(f"Migration statement skipped: {stmt} -> {e}")

    async with AsyncSessionLocal() as session:
        # 2. Seed default organization if missing
        org_res = await session.execute(select(Organization).where(Organization.id == "org-goldguard"))
        org = org_res.scalar_one_or_none()
        if not org:
            org = Organization(
                id="org-goldguard",
                name="GoldGuard Bank",
                code="GOLDGUARD",
                logo=None,
                status="active"
            )
            session.add(org)
            await session.commit()
            print("Seeded default organization: org-goldguard")
        else:
            print("Default organization already exists.")

        # 3. Seed default branches if missing
        branches_count_res = await session.execute(select(func.count(Branch.id)))
        branches_count = branches_count_res.scalar() or 0
        if branches_count == 0:
            default_branches = [
                Branch(id="br-nashik", name="Nashik Central", bank_name="GoldGuard Bank", organization_id="org-goldguard", city="Nashik", region="North Region", inspections_today=18, pending_reviews=4, fraud_cases=2, approval_rate=94.0, fraud_rate=3.1, risk_score=38.0, gold_value_today=782000, gold_processed_kg=1.2, avg_purity="22K", map_x=36.0, map_y=49.0),
                Branch(id="br-pune", name="Pune South", bank_name="GoldGuard Bank", organization_id="org-goldguard", city="Pune", region="South Region", inspections_today=24, pending_reviews=6, fraud_cases=4, approval_rate=91.0, fraud_rate=4.4, risk_score=52.0, gold_value_today=1240000, gold_processed_kg=1.9, avg_purity="22K", map_x=38.0, map_y=56.0),
                Branch(id="br-mumbai", name="Mumbai Fort", bank_name="GoldGuard Bank", organization_id="org-goldguard", city="Mumbai", region="West Region", inspections_today=31, pending_reviews=8, fraud_cases=3, approval_rate=96.0, fraud_rate=2.6, risk_score=29.0, gold_value_today=1860000, gold_processed_kg=2.8, avg_purity="22K", map_x=32.0, map_y=53.0),
                Branch(id="br-aurangabad", name="Aurangabad", bank_name="GoldGuard Bank", organization_id="org-goldguard", city="Aurangabad", region="West Region", inspections_today=14, pending_reviews=3, fraud_cases=1, approval_rate=92.0, fraud_rate=2.9, risk_score=34.0, gold_value_today=520000, gold_processed_kg=0.8, avg_purity="20K", map_x=41.0, map_y=50.0),
            ]
            session.add_all(default_branches)
            await session.commit()
            print("Seeded default branches.")
        else:
            print(f"Branches table already has {branches_count} records. Skipping branch seeding.")

        # 4. Seed default users if missing
        default_users = [
            {
                "id": "usr-super-admin",
                "email": "superadmin@gold.com",
                "full_name": "Super Admin",
                "designation": "Super Admin",
                "role": "Super Admin",
                "branch_id": None,
                "region": None,
            },
            {
                "id": "usr-priya-sharma",
                "email": "priya.sharma@goldguard.ai",
                "full_name": "Priya Sharma",
                "designation": "Lead Appraiser",
                "role": "Appraiser",
                "branch_id": "br-mumbai",
                "region": "West Region",
            },
            {
                "id": "usr-sneha-joshi",
                "email": "sneha.joshi@goldguard.ai",
                "full_name": "Sneha Joshi",
                "designation": "Appraiser",
                "role": "Appraiser",
                "branch_id": "br-mumbai",
                "region": "West Region",
            },
            {
                "id": "usr-amit-deshmukh",
                "email": "amit.deshmukh@goldguard.ai",
                "full_name": "Amit Deshmukh",
                "designation": "Appraiser",
                "role": "Appraiser",
                "branch_id": "br-pune",
                "region": "South Region",
            },
            {
                "id": "usr-auditor",
                "email": "auditor@goldguard.ai",
                "full_name": "Preethi Subramaniam",
                "designation": "Senior Auditor",
                "role": "Auditor",
                "branch_id": "br-mumbai",
                "region": "West Region",
            },
            {
                "id": "usr-regional-manager",
                "email": "regional.manager@goldguard.ai",
                "full_name": "Rajan Mehta",
                "designation": "Regional Manager",
                "role": "Regional Manager",
                "branch_id": None,
                "region": "West Region",
            },
        ]
        
        hashed_password = get_password_hash("password123")
        admin_hashed_password = get_password_hash("SuperAdmin123")
        
        for ud in default_users:
            u_res = await session.execute(select(User).where(User.email == ud["email"]))
            if not u_res.scalar_one_or_none():
                h_pwd = admin_hashed_password if ud["role"] == "Super Admin" else hashed_password
                user = User(
                    id=ud["id"],
                    email=ud["email"],
                    hashed_password=h_pwd,
                    full_name=ud["full_name"],
                    designation=ud["designation"],
                    role=ud["role"],
                    bank_name="GoldGuard Bank",
                    organization_id="org-goldguard",
                    branch_id=ud["branch_id"],
                    region=ud["region"],
                    is_active=True,
                    status="active"
                )
                session.add(user)
                print(f"Seeded user: {ud['email']}")
        await session.commit()

        # 5. Seed default customers if missing
        customers_count_res = await session.execute(select(func.count(Customer.id)))
        customers_count = customers_count_res.scalar() or 0
        if customers_count == 0:
            names = [
                "Rohit Sharma", "Anjali Patel", "Suresh Joshi", "Meera Mehta", "Karan Kulkarni", 
                "Pooja Rao", "Ajay Iyer", "Neha Bhosale", "Sanjay Pawar", "Divya Verma", 
                "Mahesh Kapoor", "Sunita Patil", "Vivek Deshmukh", "Rekha Rao"
            ]
            default_customers = []
            for idx, name in enumerate(names):
                status_val = "Genuine"
                if idx in (3, 7):
                    status_val = "Suspicious"
                elif idx == 10:
                    status_val = "High Risk"
                
                cust = Customer(
                    id=f"CUS-2000{idx:02d}",
                    name=name,
                    contact=f"+91 98200 123{idx:02d}",
                    status=status_val,
                    bank_name="GoldGuard Bank",
                    organization_id="org-goldguard"
                )
                default_customers.append(cust)
            session.add_all(default_customers)
            await session.commit()
            print("Seeded default customers.")
        else:
            print(f"Customers table already has {customers_count} records. Skipping customer seeding.")

        # 6. Seed default inspections if missing
        inspections_count_res = await session.execute(select(func.count(Inspection.id)))
        inspections_count = inspections_count_res.scalar() or 0
        if inspections_count == 0:
            import random
            random.seed(42)
            
            # Fetch all customers
            cust_res = await session.execute(select(Customer))
            all_custs = cust_res.scalars().all()
            
            # Types & purities
            jewelry_types = ["Necklace", "Bangle", "Ring", "Chain", "Earring", "Coin", "Pendant"]
            purities = ["18K", "20K", "22K", "24K"]
            purity_ltvs = {"18K": 70, "20K": 75, "22K": 80, "24K": 85}
            purity_mults = {"18K": 0.75, "20K": 0.83, "22K": 0.916, "24K": 1.0}
            
            default_inspections = []
            now_dt = datetime.now(timezone.utc)
            
            for idx in range(30):
                customer = all_custs[idx % len(all_custs)]
                j_type = jewelry_types[idx % len(jewelry_types)]
                purity = purities[idx % len(purities)]
                weight = round(10.0 + (idx * 2.3) % 65.0, 2)
                
                # Determine status based on customer status or index
                if customer.status == "High Risk":
                    status_val = "High Risk"
                    auth_score = 35
                    risk_score = 65
                    decision = "Reject"
                elif customer.status == "Suspicious":
                    status_val = "Suspicious"
                    auth_score = 55
                    risk_score = 45
                    decision = "Hold"
                else:
                    status_val = "Genuine"
                    auth_score = 94
                    risk_score = 6
                    decision = "Approve"
                
                # Appraiser
                appraiser_id = "usr-priya-sharma" if idx % 2 == 0 else "usr-sneha-joshi"
                branch_id = "br-mumbai"
                if idx % 3 == 0:
                    appraiser_id = "usr-amit-deshmukh"
                    branch_id = "br-pune"
                
                market_rate = 7200
                gross_value = int(weight * market_rate * purity_mults[purity])
                ltv = purity_ltvs[purity] if decision != "Reject" else 0
                loan_amount = int(gross_value * (ltv / 100))
                
                date_val = now_dt - timedelta(days=(idx * 2) % 28, hours=idx % 24)
                ins_id = f"INS-1000{idx:02d}"
                
                insp = Inspection(
                    id=ins_id,
                    customer_id=customer.id,
                    appraiser_id=appraiser_id,
                    branch_id=branch_id,
                    jewelry_type=j_type,
                    purity=purity,
                    description=f"{purity} {j_type.lower()} — traditional Indian craftmanship design",
                    weight=weight,
                    length=45.0,
                    width=15.0,
                    thickness=2.5,
                    date=date_val,
                    status=status_val,
                    authenticity_score=auth_score,
                    risk_score=risk_score,
                    confidence=94,
                    quality_score=92,
                    lighting=90,
                    focus=95,
                    angle_coverage=90,
                    factors={
                        "density": auth_score,
                        "surface": auth_score - 2,
                        "reflection": auth_score + 1,
                        "touchstone": auth_score - 1,
                        "visualDefect": auth_score,
                    },
                    images={
                        "front": "/static/fallback.jpg",
                        "back": "/static/fallback.jpg",
                    },
                    loan={
                        "decision": decision,
                        "ltv": ltv,
                        "amount": loan_amount,
                        "marketRate": market_rate,
                    },
                    audit=[
                        {"ts": (date_val).isoformat(), "actor": "Priya Sharma", "action": "Inspection Created", "detail": f"ID {ins_id}"},
                        {"ts": (date_val + timedelta(minutes=5)).isoformat(), "actor": "System", "action": "Risk Analysis Completed"}
                    ],
                    notes="All parameters verified successfully." if status_val == "Genuine" else "Base metal core suspect under spectroscopic density test.",
                    escalation_stage="Manager Review" if status_val == "High Risk" else "Escalated" if status_val == "Suspicious" else None,
                    organization_id="org-goldguard"
                )
                default_inspections.append(insp)
            session.add_all(default_inspections)
            await session.commit()
            print("Seeded default inspections.")
            
            # 7. Seed default escalations
            escalations = []
            for insp in default_inspections:
                if insp.status in ("High Risk", "Suspicious"):
                    esc = Escalation(
                        id=f"esc-{insp.id.lower()}",
                        inspection_id=insp.id,
                        stage="Manager Review" if insp.status == "High Risk" else "Escalated",
                        assigned_to_id="usr-regional-manager",
                        reason=insp.notes,
                        decision="Pending",
                        created_at=insp.date
                    )
                    escalations.append(esc)
            session.add_all(escalations)
            await session.commit()
            print("Seeded default escalations.")
            
            # 8. Seed default reports
            reports = []
            for idx in range(5):
                rep_date = now_dt - timedelta(days=idx * 7)
                rep = Report(
                    id=f"REP-2026-{idx}",
                    title=f"Weekly Audit Report - Week {24 - idx}",
                    type="Weekly",
                    date=rep_date,
                    branch_id="br-mumbai",
                    size="480 KB",
                    description="Automated system integrity and collateral evaluation audit summary.",
                    file_url="/static/fallback.jpg",
                    bank_name="GoldGuard Bank",
                    organization_id="org-goldguard"
                )
                reports.append(rep)
            session.add_all(reports)
            await session.commit()
            print("Seeded default reports.")
            
            # 9. Seed default notifications
            notifications = []
            for idx, user_mail in enumerate(["priya.sharma@goldguard.ai", "auditor@goldguard.ai", "regional.manager@goldguard.ai"]):
                usr_res = await session.execute(select(User).where(User.email == user_mail))
                usr = usr_res.scalar_one_or_none()
                if usr:
                    notif = Notification(
                        id=f"notif-{usr.id[:6]}-{idx}",
                        user_id=usr.id,
                        type="High Risk Alert" if idx == 0 else "Report Generated",
                        title="High Risk Collateral Warning" if idx == 0 else "New Weekly Report Published",
                        message="INS-10010 flagged for inspection anomalies" if idx == 0 else "The week 24 system audit report is now available.",
                        read=False,
                        created_at=now_dt - timedelta(hours=idx * 4)
                    )
                    notifications.append(notif)
            session.add_all(notifications)
            await session.commit()
            print("Seeded default notifications.")

        else:
            print(f"Inspections table already has {inspections_count} records. Skipping data seeding.")

    print("GoldGuard DB seeding complete!")

if __name__ == "__main__":
    asyncio.run(seed_db())
