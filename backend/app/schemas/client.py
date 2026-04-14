from __future__ import annotations
from typing import Optional
from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel


class ClientType(str, Enum):
    google_only = "google_only"
    meta_only = "meta_only"
    google_meta = "google_meta"
    ecomm_shopify = "ecomm_shopify"
    ecomm_ga4 = "ecomm_ga4"
    leadgen = "leadgen"


class DataSource(str, Enum):
    google_ads = "google_ads"
    meta_ads = "meta_ads"
    shopify = "shopify"
    ga4 = "ga4"


class JobStatus(str, Enum):
    pending = "pending"
    running = "running"
    success = "success"
    failed = "failed"
    partial = "partial"


# ── Client schemas ──


class ClientCreate(BaseModel):
    name: str
    type: ClientType
    google_ads_customer_id: Optional[str] = None
    meta_ad_account_id: Optional[str] = None
    shopify_shop_domain: Optional[str] = None
    ga4_property_id: Optional[str] = None
    currency: str = "USD"
    timezone: str = "UTC"
    report_settings: Optional[dict] = {}


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[ClientType] = None
    google_ads_customer_id: Optional[str] = None
    meta_ad_account_id: Optional[str] = None
    shopify_shop_domain: Optional[str] = None
    ga4_property_id: Optional[str] = None
    currency: Optional[str] = None
    timezone: Optional[str] = None
    report_settings: Optional[dict] = None
    is_active: Optional[bool] = None


class ClientRead(BaseModel):
    id: UUID
    name: str
    type: ClientType
    google_ads_customer_id: Optional[str]
    meta_ad_account_id: Optional[str]
    shopify_shop_domain: Optional[str]
    ga4_property_id: Optional[str]
    currency: str
    timezone: str
    report_settings: Optional[dict]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Connection schemas ──


class ConnectionCreate(BaseModel):
    source: DataSource
    credentials: dict


class ConnectionRead(BaseModel):
    id: UUID
    client_id: UUID
    source: DataSource
    is_active: bool
    last_used_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Pull Job schemas ──


class PullTrigger(BaseModel):
    client_id: Optional[UUID] = None       # None = all active clients
    source: Optional[DataSource] = None    # None = all sources for client type
    date_range_start: Optional[str] = None # YYYY-MM-DD, defaults to last 7 days
    date_range_end: Optional[str] = None


class PullJobRead(BaseModel):
    id: UUID
    client_id: UUID
    source: str
    status: JobStatus
    date_range_start: datetime
    date_range_end: datetime
    rows_pulled: Optional[int]
    error_message: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}
