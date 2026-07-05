import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.core.security import get_password_hash

@pytest.fixture
async def authenticated_client(client: AsyncClient, db_session: AsyncSession) -> AsyncClient:
    # 1. Create a user
    hashed_password = get_password_hash("password123")
    user = User(
        id="appraiser-settings-test",
        email="appraiser_settings@goldguard.ai",
        hashed_password=hashed_password,
        full_name="Appraiser Settings",
        designation="Junior Appraiser",
        role="Appraiser",
        is_active=True,
        branch_id="br-mumbai"
    )
    db_session.add(user)
    await db_session.flush()
    
    # 2. Login
    login_response = await client.post(
        "/api/v1/auth/login",
        data={"username": "appraiser_settings@goldguard.ai", "password": "password123"}
    )
    access_token = login_response.json()["access_token"]
    
    # 3. Apply authorization headers
    client.headers.update({"Authorization": f"Bearer {access_token}"})
    return client

@pytest.mark.asyncio
async def test_get_default_settings(authenticated_client: AsyncClient):
    response = await authenticated_client.get("/api/v1/settings")
    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "en"
    assert data["defaultBranch"] == "br-mumbai"
    assert data["density"] == "comfortable"
    assert data["twoFactor"] is False
    assert data["emailAlerts"] is True

@pytest.mark.asyncio
async def test_update_settings(authenticated_client: AsyncClient):
    payload = {
        "language": "hi",
        "default_branch": "br-delhi",
        "density": "compact",
        "two_factor": True,
        "email_alerts": False,
        "push_notifications": False,
        "sms_alerts": True,
        "weekly_reports": False
    }
    response = await authenticated_client.patch("/api/v1/settings", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "hi"
    assert data["defaultBranch"] == "br-delhi"
    assert data["density"] == "compact"
    assert data["twoFactor"] is True
    assert data["emailAlerts"] is False
    assert data["pushNotifications"] is False
    assert data["smsAlerts"] is True
    assert data["weeklyReports"] is False

    # Get settings again and verify persistence
    get_response = await authenticated_client.get("/api/v1/settings")
    assert get_response.status_code == 200
    get_data = get_response.json()
    assert get_data["language"] == "hi"
    assert get_data["defaultBranch"] == "br-delhi"
    assert get_data["twoFactor"] is True
