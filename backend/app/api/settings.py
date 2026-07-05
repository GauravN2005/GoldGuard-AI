from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.additional_models import Draft
from app.api.deps import get_current_user
from pydantic import BaseModel, ConfigDict

router = APIRouter()

# Schema for settings update
class SettingsUpdate(BaseModel):
    language: str | None = None
    default_branch: str | None = None
    density: str | None = None
    two_factor: bool | None = None
    email_alerts: bool | None = None
    push_notifications: bool | None = None
    sms_alerts: bool | None = None
    weekly_reports: bool | None = None

    model_config = ConfigDict(populate_by_name=True)

# Default terminal configuration preferences
SETTINGS_DEFAULT = {
    "language": "en",
    "defaultBranch": "br-mumbai",
    "density": "comfortable",
    "twoFactor": False,
    "emailAlerts": True,
    "pushNotifications": True,
    "smsAlerts": False,
    "weeklyReports": True,
}

def to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])

@router.get("")
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Any:
    """Get terminal preferences for the current logged-in user."""
    result = await db.execute(
        select(Draft).where(
            Draft.user_id == current_user.id,
            Draft.draft_type == "settings"
        )
    )
    draft = result.scalar_one_or_none()
    if draft:
        return draft.payload_json
    return SETTINGS_DEFAULT

@router.patch("")
async def update_settings(
    payload: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Any:
    """Update terminal preferences for the current user."""
    result = await db.execute(
        select(Draft).where(
            Draft.user_id == current_user.id,
            Draft.draft_type == "settings"
        )
    )
    draft = result.scalar_one_or_none()
    
    updates = payload.model_dump(exclude_unset=True)
    camel_updates = {}
    for k, v in updates.items():
        camel_updates[to_camel(k)] = v

    if not draft:
        # Create a new settings draft row
        payload_json = {**SETTINGS_DEFAULT, **camel_updates}
        draft = Draft(
            id=f"settings-{current_user.id}",
            user_id=current_user.id,
            draft_type="settings",
            payload_json=payload_json,
            status="settings"
        )
        db.add(draft)
    else:
        # Merge updates into existing settings JSON
        payload_json = {**draft.payload_json, **camel_updates}
        draft.payload_json = payload_json
        db.add(draft)

    await db.commit()
    await db.refresh(draft)
    return draft.payload_json
