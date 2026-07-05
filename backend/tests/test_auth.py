import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.core.security import get_password_hash

@pytest.fixture
async def test_user(db_session: AsyncSession) -> User:
    hashed_password = get_password_hash("password123")
    user = User(
        id="test-user-id",
        email="test@goldguard.ai",
        hashed_password=hashed_password,
        full_name="Test User",
        designation="Senior Appraiser",
        role="Appraiser",
        is_active=True,
        branch_id=None
    )
    db_session.add(user)
    await db_session.flush()
    return user

@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, test_user: User):
    response = await client.post(
        "/api/v1/auth/login",
        data={"username": "test@goldguard.ai", "password": "password123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"

@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, test_user: User):
    response = await client.post(
        "/api/v1/auth/login",
        data={"username": "test@goldguard.ai", "password": "wrongpassword"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Incorrect email or password"

@pytest.mark.asyncio
async def test_read_user_me(client: AsyncClient, test_user: User):
    # Step 1: Login to get access token
    login_response = await client.post(
        "/api/v1/auth/login",
        data={"username": "test@goldguard.ai", "password": "password123"}
    )
    access_token = login_response.json()["access_token"]
    
    # Step 2: Use token to fetch profile
    headers = {"Authorization": f"Bearer {access_token}"}
    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@goldguard.ai"
    assert data["full_name"] == "Test User"
    assert data["role"] == "Appraiser"

@pytest.mark.asyncio
async def test_refresh_token(client: AsyncClient, test_user: User):
    # Step 1: Login to get refresh token
    login_response = await client.post(
        "/api/v1/auth/login",
        data={"username": "test@goldguard.ai", "password": "password123"}
    )
    refresh_token = login_response.json()["refresh_token"]
    
    # Step 2: Call refresh endpoint
    response = await client.post(
        f"/api/v1/auth/refresh?refresh_token={refresh_token}"
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
