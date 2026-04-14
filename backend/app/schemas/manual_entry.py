from __future__ import annotations
from datetime import date
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field

class GoogleAdsManualRow(BaseModel):
    report_date: date
    campaign_name: str
    campaign_id: Optional[str] = None
    impressions: Optional[int] = 0
    clicks: Optional[int] = 0
    spend: Optional[Decimal] = Field(default=Decimal("0.0"), decimal_places=2)
    conversions: Optional[Decimal] = Field(default=Decimal("0.0"), decimal_places=2)
    conv_value: Optional[Decimal] = Field(default=Decimal("0.0"), decimal_places=2)
    impression_share: Optional[Decimal] = Field(default=None, decimal_places=4)

class MetaAdsManualRow(BaseModel):
    report_date: date
    campaign_name: str
    campaign_id: Optional[str] = None
    impressions: Optional[int] = 0
    clicks: Optional[int] = 0
    spend: Optional[Decimal] = Field(default=Decimal("0.0"), decimal_places=2)
    conversions: Optional[Decimal] = Field(default=Decimal("0.0"), decimal_places=2)
    conv_value: Optional[Decimal] = Field(default=Decimal("0.0"), decimal_places=2)
    reach: Optional[int] = 0
    frequency: Optional[Decimal] = Field(default=None, decimal_places=4)

class ShopifyManualRow(BaseModel):
    order_date: date
    total_price: Decimal = Field(..., decimal_places=2)
    is_new_customer: bool = True
    order_id: Optional[str] = None

class ManualEntryRequest(BaseModel):
    source: str # google_ads | meta_ads | shopify
    google_rows: List[GoogleAdsManualRow] = []
    meta_rows: List[MetaAdsManualRow] = []
    shopify_rows: List[ShopifyManualRow] = []
