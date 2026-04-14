from __future__ import annotations
from app.models.client import Client, ClientConnection, PullJob
from app.models.google_ads import (
    GoogleAdsCampaign,
    GoogleAdsSearchTerm,
    GoogleAdsKeyword,
    GoogleAdsTimeSegment,
    GoogleAdsDemographic,
)
from app.models.meta_ads import (
    MetaCampaign,
    MetaLeadgen,
    MetaTimeSegment,
    MetaDemographic,
)
from app.models.shopify import ShopifyOrder, ShopifyProduct
from app.models.ga4 import GA4Revenue, GA4ChannelBreakdown, GA4DeviceBreakdown
from app.models.reports import Report, ReportSection

__all__ = [
    "Client",
    "ClientConnection",
    "PullJob",
    "GoogleAdsCampaign",
    "GoogleAdsSearchTerm",
    "GoogleAdsKeyword",
    "GoogleAdsTimeSegment",
    "GoogleAdsDemographic",
    "MetaCampaign",
    "MetaLeadgen",
    "MetaTimeSegment",
    "MetaDemographic",
    "ShopifyOrder",
    "ShopifyProduct",
    "GA4Revenue",
    "GA4ChannelBreakdown",
    "GA4DeviceBreakdown",
    "Report",
    "ReportSection",
]
