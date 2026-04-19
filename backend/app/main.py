from __future__ import annotations
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import (
    clients_router,
    pulls_router,
    google_ads_router,
    meta_ads_router,
    shopify_router,
    ga4_router,
    reports_router,
    manual_entry,
    dashboard_router,
)
from app.scheduler import lifespan

app = FastAPI(
    title=settings.APP_NAME,
    description="Multi-Platform Ads Data Extractor — Agency Reporting Tool",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(clients_router, prefix="/api/clients", tags=["Clients"])
app.include_router(pulls_router, prefix="/api/pulls", tags=["Pull Jobs"])
app.include_router(google_ads_router, prefix="/api/data/google-ads", tags=["Google Ads"])
app.include_router(meta_ads_router, prefix="/api/data/meta", tags=["Meta Ads"])
app.include_router(shopify_router, prefix="/api/data/shopify", tags=["Shopify"])
app.include_router(ga4_router, prefix="/api/data/ga4", tags=["GA4"])
app.include_router(reports_router, prefix="/api/reports", tags=["Reports"])
app.include_router(manual_entry.router, prefix="/api/manual-entry", tags=["Manual Entry"])
app.include_router(dashboard_router, prefix="/api/dashboard", tags=["Dashboard"])


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME}
