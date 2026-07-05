from pydantic import BaseModel
from typing import List, Dict, Any


class KpiAnalyticsItem(BaseModel):
    value: str
    delta: str | None = None
    hint: str | None = None


class DashboardAnalyticsResponse(BaseModel):
    total_inspections: KpiAnalyticsItem
    genuine_gold: KpiAnalyticsItem
    suspicious: KpiAnalyticsItem
    high_risk: KpiAnalyticsItem
    pending_reviews: KpiAnalyticsItem
    approval_rate: KpiAnalyticsItem
    fraud_detection: KpiAnalyticsItem
    
    fraud_trend: List[Dict[str, Any]] = []
    status_distribution: List[Dict[str, Any]] = []
    branch_performance: List[Dict[str, Any]] = []
    monthly_volume: List[Dict[str, Any]] = []
