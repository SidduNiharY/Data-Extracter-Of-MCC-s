from __future__ import annotations
from typing import Optional
from datetime import date
from uuid import UUID

from pydantic import BaseModel


class DashboardRow(BaseModel):
    """One row per client in the performance dashboard."""
    client_id: UUID
    client_name: str
    priority: Optional[int] = None
    connected_sources: list[str] = []

    # Google Ads
    impressions: Optional[int] = None
    clicks: Optional[int] = None
    cost: Optional[float] = None
    cpc: Optional[float] = None

    # Cross-platform (derived)
    orders: Optional[int] = None
    revenue: Optional[float] = None
    rc_ratio: Optional[float] = None

    # Shopify
    shopify_orders: Optional[int] = None
    shopify_revenue: Optional[float] = None
    shopify_roas: Optional[float] = None

    # GA4
    ga4_orders: Optional[int] = None
    ga4_revenue: Optional[float] = None
    ga4_roas: Optional[float] = None


class ThresholdConfig(BaseModel):
    """One threshold rule for a metric."""
    metric_name: str
    red_below: Optional[float] = None
    green_above: Optional[float] = None

    model_config = {"from_attributes": True}


class ThresholdConfigUpdate(BaseModel):
    """Bulk update payload for global thresholds."""
    thresholds: list[ThresholdConfig]


class ThresholdOverride(BaseModel):
    """Single-metric per-client override (matches JSONB shape)."""
    red_below: Optional[float] = None
    green_above: Optional[float] = None


class ClientThresholdOverrideUpdate(BaseModel):
    """Write payload for PATCH /api/clients/{id}/thresholds."""
    overrides: dict[str, ThresholdOverride]


class PriorityUpdate(BaseModel):
    priority: Optional[int] = None


class DashboardPerformanceQuery(BaseModel):
    date_from: date
    date_to: date
    client_ids: Optional[list[UUID]] = None
