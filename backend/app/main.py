from __future__ import annotations
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import clients, pulls, google_ads, meta_ads, shopify, ga4, reports, manual_entry
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
app.include_router(clients.router, prefix="/api/clients", tags=["Clients"])
app.include_router(pulls.router, prefix="/api/pulls", tags=["Pull Jobs"])
app.include_router(google_ads.router, prefix="/api/data/google-ads", tags=["Google Ads"])
app.include_router(meta_ads.router, prefix="/api/data/meta", tags=["Meta Ads"])
app.include_router(shopify.router, prefix="/api/data/shopify", tags=["Shopify"])
app.include_router(ga4.router, prefix="/api/data/ga4", tags=["GA4"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(manual_entry.router, prefix="/api/manual-entry", tags=["Manual Entry"])


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME}
