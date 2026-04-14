from __future__ import annotations
from typing import Optional
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class GA4RevenueRow(BaseModel):
    id: UUID
    client_id: UUID
    report_date: date
    purchase_revenue: Optional[Decimal]
    transactions: Optional[int]
    avg_purchase_revenue: Optional[Decimal]
    session_conversion_rate: Optional[Decimal]
    active_users: Optional[int]
    sessions: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}


class GA4ChannelRow(BaseModel):
    id: UUID
    client_id: UUID
    report_date: date
    channel_group: Optional[str]
    revenue: Optional[Decimal]
    sessions: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}


class GA4DeviceRow(BaseModel):
    id: UUID
    client_id: UUID
    report_date: date
    device_category: Optional[str]
    revenue: Optional[Decimal]
    sessions: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}
