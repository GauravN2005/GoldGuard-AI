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
        id="appraiser-1",
        email="appraiser@goldguard.ai",
        hashed_password=hashed_password,
        full_name="Appraiser Appy",
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
        data={"username": "appraiser@goldguard.ai", "password": "password123"}
    )
    access_token = login_response.json()["access_token"]
    
    # 3. Apply authorization headers
    client.headers.update({"Authorization": f"Bearer {access_token}"})
    return client

@pytest.mark.asyncio
async def test_get_sync_status(authenticated_client: AsyncClient):
    response = await authenticated_client.get("/api/v1/sync/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "Online"
    assert "pending_sync" in data
    assert "last_sync_time" in data

@pytest.mark.asyncio
async def test_sync_drafts(authenticated_client: AsyncClient):
    payload = {
        "drafts": [
            {
                "id": "INS-MOCK-SYNC-1",
                "customerName": "John Doe",
                "jewelryType": "Necklace",
                "weight": 24.5,
                "step": 3,
                "savedAt": "2026-06-25T10:00:00Z"
            }
        ]
    }
    response = await authenticated_client.post("/api/v1/sync/drafts", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "synced_ids" in data
    assert "INS-MOCK-SYNC-1" in data["synced_ids"]
