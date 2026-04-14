from __future__ import annotations
from typing import Optional
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class MetaCampaignRow(BaseModel):
    id: UUID
    client_id: UUID
    report_date: date
    campaign_id: Optional[str]
    campaign_name: Optional[str]
    impressions: Optional[int]
    clicks: Optional[int]
    spend: Optional[Decimal]
    ctr: Optional[Decimal]
    cpc: Optional[Decimal]
    reach: Optional[int]
    frequency: Optional[Decimal]
    cpm: Optional[Decimal]
    cost_per_result: Optional[Decimal]
    conversions: Optional[Decimal]
    conv_value: Optional[Decimal]
    roas: Optional[Decimal]
    created_at: datetime

    model_config = {"from_attributes": True}


class MetaLeadgenRow(BaseModel):
    id: UUID
    client_id: UUID
    report_date: date
    campaign_id: Optional[str]
    campaign_name: Optional[str]
    leads: Optional[Decimal]
    cost_per_lead: Optional[Decimal]
    lead_form_opens: Optional[Decimal]
    form_completion_rate: Optional[Decimal]
    link_clicks: Optional[int]
    landing_page_views: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}


class MetaTimeSegmentRow(BaseModel):
    id: UUID
    client_id: UUID
    report_date: date
    segment_type: str
    segment_value: str
    impressions: Optional[int]
    clicks: Optional[int]
    spend: Optional[Decimal]
    created_at: datetime

    model_config = {"from_attributes": True}


class MetaDemographicRow(BaseModel):
    id: UUID
    client_id: UUID
    report_date: date
    gender: Optional[str]
    age_group: Optional[str]
    impressions: Optional[int]
    clicks: Optional[int]
    spend: Optional[Decimal]
    conversions: Optional[Decimal]
    created_at: datetime

    model_config = {"from_attributes": True}
