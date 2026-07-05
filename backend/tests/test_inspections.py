import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.customer import Customer
from app.models.branch import Branch
from app.core.security import get_password_hash

@pytest.fixture
async def setup_data(db_session: AsyncSession):
    hashed_password = get_password_hash("password123")
    
    # Create Branch
    branch = Branch(
        id="br-mumbai",
        name="Mumbai Fort",
        city="Mumbai",
        map_x=32.0,
        map_y=53.0
    )
    db_session.add(branch)
    
    # Create User
    user = User(
        id="appraiser-2",
        email="appy2@goldguard.ai",
        hashed_password=hashed_password,
        full_name="Appraiser Two",
        designation="Appraiser",
        role="Appraiser",
        is_active=True,
        branch_id="br-mumbai"
    )
    db_session.add(user)
    
    # Create Customer
    customer = Customer(
        id="CUS-9999",
        name="Alice Smith",
        contact="+91 99999 00000",
        status="Genuine"
    )
    db_session.add(customer)
    
    await db_session.flush()
    return user, customer

@pytest.fixture
async def auth_client(client: AsyncClient, setup_data) -> AsyncClient:
    user, _ = setup_data
    login_response = await client.post(
        "/api/v1/auth/login",
        data={"username": user.email, "password": "password123"}
    )
    access_token = login_response.json()["access_token"]
    client.headers.update({"Authorization": f"Bearer {access_token}"})
    return client

@pytest.mark.asyncio
async def test_create_and_fetch_inspection(auth_client: AsyncClient, setup_data):
    _, customer = setup_data
    
    # Create Inspection
    ins_payload = {
        "customer_id": customer.id,
        "jewelry_type": "Ring",
        "purity": "22K",
        "weight": 12.5,
        "length": 22.0,
        "width": 22.0,
        "thickness": 2.1,
        "description": "Gold ring with simple design"
    }
    create_response = await auth_client.post("/api/v1/inspections", json=ins_payload)
    assert create_response.status_code == 201
    created_data = create_response.json()
    assert created_data["jewelryType"] == "Ring"
    assert created_data["purity"] == "22K"
    assert created_data["weight"] == 12.5
    
    ins_id = created_data["id"]
    
    # Get Single Inspection
    get_response = await auth_client.get(f"/api/v1/inspections/{ins_id}")
    assert get_response.status_code == 200
    assert get_response.json()["jewelryType"] == "Ring"
    
    # List Inspections
    list_response = await auth_client.get("/api/v1/inspections")
    assert list_response.status_code == 200
    assert len(list_response.json()) >= 1

@pytest.mark.asyncio
async def test_ai_analyze_inspection(auth_client: AsyncClient, setup_data):
    _, customer = setup_data
    
    # Create Inspection first
    ins_payload = {
        "customer_id": customer.id,
        "jewelry_type": "Coin",
        "purity": "24K",
        "weight": 10.0,
        "length": 20.0,
        "width": 20.0,
        "thickness": 1.5,
        "description": "Gold coin for analysis"
    }
    create_response = await auth_client.post("/api/v1/inspections", json=ins_payload)
    ins_id = create_response.json()["id"]
    
    # Trigger AI analyze
    ai_response = await auth_client.post(f"/api/v1/ai/analyze/{ins_id}")
    assert ai_response.status_code == 200
    ai_data = ai_response.json()
    assert "authenticityScore" in ai_data
    assert "riskScore" in ai_data
    assert "factors" in ai_data
    assert "reasoning" in ai_data
    
    # Read the inspection again to verify DB fields updated
    get_response = await auth_client.get(f"/api/v1/inspections/{ins_id}")
    updated_data = get_response.json()
    assert updated_data["authenticityScore"] == ai_data["authenticityScore"]
    assert updated_data["riskScore"] == ai_data["riskScore"]
    assert updated_data["status"] != "Pending"
