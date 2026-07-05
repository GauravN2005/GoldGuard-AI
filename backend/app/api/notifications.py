from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete

from app.core.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationResponse
from app.api.deps import get_current_user

router = APIRouter()


@router.get("", response_model=List[NotificationResponse])
async def read_notifications(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.patch("/{id}/read", response_model=NotificationResponse)
async def read_notification(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    result = await db.execute(
        select(Notification).where(
            (Notification.id == id) & (Notification.user_id == current_user.id)
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
        
    notification.read = True
    db.add(notification)
    return notification


@router.patch("/read-all")
async def read_all_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    await db.execute(
        update(Notification)
        .where((Notification.user_id == current_user.id) & (Notification.read == False))
        .values(read=True)
    )
    return {"message": "All notifications marked as read"}


@router.delete("/{id}")
async def delete_notification(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    result = await db.execute(
        select(Notification).where(
            (Notification.id == id) & (Notification.user_id == current_user.id)
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
        
    await db.delete(notification)
    return {"message": "Notification deleted successfully"}
