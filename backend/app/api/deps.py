from typing import List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.security import ALGORITHM
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import TokenData

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)


async def get_current_user(
    db: AsyncSession = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[ALGORITHM]
        )
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid token type, access token required",
            )
        token_data = TokenData(user_id=payload.get("sub"), role=payload.get("role"))
    except (JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    
    if not token_data.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid token subject",
        )
        
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(User).options(selectinload(User.branch), selectinload(User.organization)).where(User.id == token_data.user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user"
        )
        
    if user.organization and user.organization.status == "suspended":
        if user.role != "Super Admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Organization is suspended. Contact system administrator."
            )
            
    return user


class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        # Super Admin bypasses role checks
        if current_user.role == "Super Admin":
            return current_user
            
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to access this resource",
            )
        return current_user
