from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class BranchBase(BaseModel):
    name: str
    city: str
    region: str | None = None
    avg_purity: str = "22K"
    map_x: float = 0.0
    map_y: float = 0.0


class BranchCreate(BranchBase):
    id: str


class BranchUpdate(BaseModel):
    name: str | None = None
    city: str | None = None
    region: str | None = None
    avg_purity: str | None = None
    map_x: float | None = None
    map_y: float | None = None


class BranchResponse(BranchBase):
    id: str
    inspections_today: int
    pending_reviews: int
    fraud_cases: int
    approval_rate: float
    fraud_rate: float
    risk_score: float
    gold_value_today: int
    gold_processed_kg: float
    organization_id: str | None = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )

