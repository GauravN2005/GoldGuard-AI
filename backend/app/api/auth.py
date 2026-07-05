from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.core.config import settings
from app.core import security
from app.core.database import get_db
from app.models.organization import Organization
from app.models.user import User
from app.models.branch import Branch
from app.models.audit_log import AuditLog
from app.schemas.auth import Token, UserResponse, PasswordChange, UserCreate, UserRegister
from app.core.limiter import limiter
from app.api.deps import get_current_user

router = APIRouter()

@router.get("/db-check")
async def db_check_endpoint(db: AsyncSession = Depends(get_db)) -> Any:
    tables = [
        "organizations", "branches", "users", "customers", "reports", 
        "notifications", "inspections", "escalations", "audit_logs", 
        "drafts", "employee_performance", "branch_metrics", 
        "customer_loan_history", "ai_jobs", "ai_predictions", "ai_feedback", "ai_models"
    ]
    results = {}
    for table in tables:
        try:
            res = await db.execute(text(f"SELECT COUNT(*) FROM {table}"))
            results[table] = res.scalar()
        except Exception as e:
            results[table] = f"error: {str(e)}"
    return results

@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
async def login(
    request: Request,
    db: AsyncSession = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> Any:
    print("-----------------------------------------------------------------")
    print(f"LOGIN ATTEMPT - DATABASE_URL in process: {settings.async_database_url}")
    print("-----------------------------------------------------------------")
    # Authenticate user
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        # Audit log failed login
        audit = AuditLog(
            actor_id=None,
            actor_name=form_data.username,
            action="Failed Login",
            detail=f"Brute force attempt or incorrect password for {form_data.username}",
            bank_name="Unknown",
        )
        db.add(audit)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
        
    if not user.is_active:
        if user.status == "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your registration request is pending approval from the appropriate authority.",
            )
        elif user.status == "rejected":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your registration request has been rejected.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account.",
        )
        
    # Generate token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    # Audit log login
    audit = AuditLog(
        actor_id=user.id,
        actor_name=user.full_name,
        action="User Login",
        detail=f"Logged in from operator terminal. Role: {user.role}",
        bank_name=user.bank_name,
        organization_id=user.organization_id,
    )
    db.add(audit)
    await db.commit()
    
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "refresh_token": security.create_refresh_token(
            user.id, expires_delta=refresh_token_expires
        ),
        "token_type": "bearer",
    }


@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh_token: str,
    db: AsyncSession = Depends(get_db)
) -> Any:
    try:
        payload = security.verify_refresh_token(refresh_token)
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate refresh credentials",
        )
        
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found or inactive",
        )
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)) -> Any:
    # In a fully production stateless JWT, logouts can optionally blocklist tokens in Redis
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def read_user_me(
    current_user: User = Depends(get_current_user),
) -> Any:
    return current_user


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserRegister,
    db: AsyncSession = Depends(get_db)
) -> Any:
    import uuid
    # Find or create Organization
    org_res = await db.execute(select(Organization).where(Organization.name == user_in.bank_name))
    org = org_res.scalar_one_or_none()
    
    # If Bank Administrator, create organization (bank) on-the-fly
    if not org:
        if user_in.role != "Bank Administrator":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Bank '{user_in.bank_name}' does not exist. Only a Bank Administrator can register a new bank.",
            )
            
        org_id = "org-" + user_in.bank_name.lower().replace(" ", "-")
        org_chk = await db.execute(select(Organization).where(Organization.id == org_id))
        if org_chk.scalar_one_or_none():
            org_id = org_id + "-" + uuid.uuid4().hex[:4]
            
        org = Organization(
            id=org_id,
            name=user_in.bank_name,
            code=user_in.bank_name.upper().replace(" ", "_"),
            logo=None,
            status="pending"
        )
        db.add(org)
        await db.flush()

    def map_city_to_region(city_name: str) -> str:
        c = city_name.lower()
        if "mumbai" in c or "west" in c:
            return "West Region"
        if "pune" in c or "south" in c:
            return "South Region"
        if "nashik" in c or "north" in c:
            return "North Region"
        if "east" in c:
            return "East Region"
        return "West Region"

    # Find or create branch (only for non-admin, non-regional roles)
    branch = None
    branch_region = None
    if user_in.role not in ("Bank Administrator", "Regional Manager"):
        branch_name = user_in.city or "Mumbai"
        branch_region = map_city_to_region(branch_name)
        br_res = await db.execute(
            select(Branch)
            .where(Branch.name == branch_name)
            .where(Branch.organization_id == org.id)
        )
        branch = br_res.scalar_one_or_none()
        
        if not branch:
            branch_id = "br-" + branch_name.lower().replace(" ", "-")
            chk_res = await db.execute(select(Branch).where(Branch.id == branch_id))
            if chk_res.scalar_one_or_none():
                branch_id = branch_id + "-" + uuid.uuid4().hex[:4]
                
            branch = Branch(
                id=branch_id,
                name=branch_name,
                bank_name=user_in.bank_name,
                organization_id=org.id,
                city=branch_name,
                region=branch_region,
                inspections_today=0,
                pending_reviews=0,
                fraud_cases=0,
                approval_rate=95.0,
                fraud_rate=0.0,
                risk_score=15.0,
                gold_value_today=0,
                gold_processed_kg=0.0,
                avg_purity="22K"
            )
            db.add(branch)
            await db.flush()
        else:
            branch_region = branch.region or branch_region
        
    # Check if email is already taken
    email_res = await db.execute(select(User).where(User.email == user_in.email))
    if email_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address already registered",
        )
        
    user_id = "usr-" + uuid.uuid4().hex[:12]
    
    # All registered roles start in a pending state, requiring manual activation by their respective authority
    is_active = False
    user_status = "pending"
    
    region_val = None
    if user_in.role == "Regional Manager":
        region_val = map_city_to_region(user_in.city or "West Region")
    elif branch:
        region_val = branch_region

    user = User(
        id=user_id,
        email=user_in.email,
        hashed_password=security.get_password_hash(user_in.password),
        full_name=user_in.full_name,
        designation=user_in.designation,
        role=user_in.role,
        bank_name=user_in.bank_name,
        organization_id=org.id,
        branch_id=branch.id if branch else None,
        region=region_val,
        is_active=is_active,
        status=user_status,
        phone=user_in.phone,
        address=user_in.address
    )
    db.add(user)
    
    audit = AuditLog(
        actor_id=user_id,
        actor_name=user_in.full_name,
        action="User Registered",
        detail=f"Registered user profile for {user_in.full_name} ({user_in.email}) with role {user_in.role}. Status: {user_status}.",
        bank_name=user_in.bank_name,
        organization_id=org.id,
    )
    db.add(audit)
    
    await db.commit()
    return user


@router.get("/banks", response_model=list[str])
async def get_active_banks(db: AsyncSession = Depends(get_db)) -> Any:
    result = await db.execute(select(Organization.name).where(Organization.status == "active"))
    org_names = result.scalars().all()
    return list(org_names)
