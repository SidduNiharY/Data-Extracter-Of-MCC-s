from __future__ import annotations
from typing import Optional
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class GoogleAdsCampaignRow(BaseModel):
    id: UUID
    client_id: UUID
    report_date: date
    campaign_id: Optional[str]
    campaign_name: Optional[str]
    impressions: Optional[int]
    clicks: Optional[int]
    spend: Optional[Decimal]
    ctr: Optional[Decimal]
    avg_cpc: Optional[Decimal]
    conversions: Optional[Decimal]
    conversion_rate: Optional[Decimal]
    conv_value: Optional[Decimal]
    cost_per_conv: Optional[Decimal]
    roas: Optional[Decimal]
    impression_share: Optional[Decimal]
    created_at: datetime

    model_config = {"from_attributes": True}


class GoogleAdsSearchTermRow(BaseModel):
    id: UUID
    client_id: UUID
    report_date: date
    search_term: str
    impressions: Optional[int]
    clicks: Optional[int]
    ctr: Optional[Decimal]
    avg_cpc: Optional[Decimal]
    conversions: Optional[Decimal]
    conv_value: Optional[Decimal]
    created_at: datetime

    model_config = {"from_attributes": True}


class GoogleAdsKeywordRow(BaseModel):
    id: UUID
    client_id: UUID
    report_date: date
    keyword_text: Optional[str]
    match_type: Optional[str]
    impressions: Optional[int]
    clicks: Optional[int]
    ctr: Optional[Decimal]
    avg_cpc: Optional[Decimal]
    quality_score: Optional[int]
    conversions: Optional[Decimal]
    created_at: datetime

    model_config = {"from_attributes": True}


class GoogleAdsTimeSegmentRow(BaseModel):
    id: UUID
    client_id: UUID
    report_date: date
    segment_type: str
    segment_value: str
    impressions: Optional[int]
    clicks: Optional[int]
    spend: Optional[Decimal]
    conversions: Optional[Decimal]
    created_at: datetime

    model_config = {"from_attributes": True}


class GoogleAdsDemographicRow(BaseModel):
    id: UUID
    client_id: UUID
    report_date: date
    gender: Optional[str]
    age_range: Optional[str]
    impressions: Optional[int]
    clicks: Optional[int]
    spend: Optional[Decimal]
    conversions: Optional[Decimal]
    created_at: datetime

    model_config = {"from_attributes": True}
