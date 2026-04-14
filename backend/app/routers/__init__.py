from __future__ import annotations
from .clients import router as clients_router
from .pulls import router as pulls_router
from .google_ads import router as google_ads_router
from .meta_ads import router as meta_ads_router
from .shopify import router as shopify_router
from .ga4 import router as ga4_router
from .reports import router as reports_router

__all__ = [
    "clients_router",
    "pulls_router",
    "google_ads_router",
    "meta_ads_router",
    "shopify_router",
    "ga4_router",
    "reports_router",
]
