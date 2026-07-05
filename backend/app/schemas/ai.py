from pydantic import BaseModel, Field
from typing import Dict, Any


class AnalysisResponse(BaseModel):
    inspectionId: str = Field(..., validation_alias="inspection_id")
    status: str  # Completed, Processing, Failed
    authenticityScore: int = Field(..., validation_alias="authenticity_score")
    riskScore: int = Field(..., validation_alias="risk_score")
    confidence: int
    qualityScore: int = Field(..., validation_alias="quality_score")
    factors: Dict[str, int]
    reasoning: str
    llmReasoning: Dict[str, Any] | None = Field(None, validation_alias="llm_reasoning")

    class Config:
        from_attributes = True
        populate_by_name = True


class DensityAnalysisRequest(BaseModel):
    inspection_id: str
    weight: float | None = None
    jewelry_type: str | None = None
    length: float | None = None
    width: float | None = None
    thickness: float | None = None
    purity: str | None = None
    tolerance: float | None = None


class DensityAnalysisResponse(BaseModel):
    calculated_density: float
    expected_density: float
    difference_percentage: float
    confidence: int
    density_score: int
    confidence_score: int
    risk_level: str
    explanation: str
    possible_core_material: str


class FinalRiskRequest(BaseModel):
    inspection_id: str
    surface_score: float | None = None
    defect_score: float | None = None
    reflection_score: float | None = None
    touchstone_score: float | None = None
    density_score: float | None = None


class FinalRiskResponse(BaseModel):
    authenticity_score: int
    confidence_score: int
    overall_risk: str
    recommendation: str
    explainability: str
    individual_scores: Dict[str, float]

