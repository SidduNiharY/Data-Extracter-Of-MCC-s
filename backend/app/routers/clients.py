from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.database import get_db
from app.models.client import Client
from app.models.dashboard import DashboardThreshold
from app.schemas.client import ClientRead
from app.schemas.dashboard import (
    ThresholdConfig,
    ClientThresholdOverrideUpdate,
    PriorityUpdate,
)
from pydantic import BaseModel

router = APIRouter()

@router.get("", response_model=list[ClientRead])
async def get_clients(
    mcc_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Client)
    if mcc_id:
        stmt = stmt.where(Client.mcc_id == mcc_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/mccs", response_model=list[str])
async def list_mcc_ids(db: AsyncSession = Depends(get_db)):
    """Return distinct, non-null MCC IDs across all clients."""
    result = await db.execute(
        select(Client.mcc_id).where(Client.mcc_id.isnot(None)).distinct()
    )
    return [row[0] for row in result.all() if row[0]]

@router.get("/{client_id}", response_model=ClientRead)
async def get_client(client_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client

class MCCImportRequest(BaseModel):
    customer_id: str
    name: str
    mcc_id: Optional[str] = None  # Manager (MCC) account that owns this customer

@router.post("/import-mcc", response_model=ClientRead)
async def import_mcc_account(req: MCCImportRequest, db: AsyncSession = Depends(get_db)):
    # Check if this customer ID is already fully imported
    result = await db.execute(select(Client).where(Client.google_ads_customer_id == req.customer_id))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="This Google Ads account is already imported.")

    # Check if a client with this name exists manually created without google ads
    result_name = await db.execute(select(Client).where(Client.name == req.name))
    existing_client = result_name.scalar_one_or_none()

    if existing_client:
        existing_client.google_ads_customer_id = req.customer_id
        if req.mcc_id:
            existing_client.mcc_id = req.mcc_id
        # Upgrade type to allow multiple platforms so we don't get the error
        if existing_client.type == "meta_only":
            existing_client.type = "google_meta"
        client = existing_client
    else:
        client = Client(
            name=req.name,
            type="google_only",
            google_ads_customer_id=req.customer_id,
            mcc_id=req.mcc_id,
        )
        db.add(client)

    await db.commit()
    await db.refresh(client)
    return client
class MetaImportRequest(BaseModel):
    meta_id: str
    name: str

@router.post("/import-meta", response_model=ClientRead)
async def import_meta_account(req: MetaImportRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Client).where(Client.meta_ad_account_id == req.meta_id))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="This Meta Ad account is already imported.")
    
    result_name = await db.execute(select(Client).where(Client.name == req.name))
    existing_client = result_name.scalar_one_or_none()
    
    if existing_client:
        existing_client.meta_ad_account_id = req.meta_id
        if existing_client.type == "google_only":
            existing_client.type = "google_meta"
        client = existing_client
    else:
        client = Client(
            name=req.name,
            type="meta_only",
            meta_ad_account_id=req.meta_id
        )
        db.add(client)
        
    await db.commit()
    await db.refresh(client)
    return client

class ShopifyImportRequest(BaseModel):
    shop_url: str
    name: str
    access_token: Optional[str] = None

@router.post("/import-shopify", response_model=ClientRead)
async def import_shopify_account(req: ShopifyImportRequest, db: AsyncSession = Depends(get_db)):
    from app.core.config import settings
    token = req.access_token or settings.SHOPIFY_ACCESS_TOKEN
    
    if not token:
        raise HTTPException(
            status_code=400, 
            detail="Shopify Access Token not provided and not found in environment."
        )

    result = await db.execute(select(Client).where(Client.shopify_shop_domain == req.shop_url))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="This Shopify store is already imported.")
    
    result_name = await db.execute(select(Client).where(Client.name == req.name))
    existing_client = result_name.scalar_one_or_none()
    
    if existing_client:
        existing_client.shopify_shop_domain = req.shop_url
        if "google" in (existing_client.type or ""):
            existing_client.type = "ecomm_shopify" # Or hybrid type
        client = existing_client
    else:
        client = Client(
            name=req.name,
            type="ecomm_shopify",
            shopify_shop_domain=req.shop_url
        )
        db.add(client)
    
    await db.commit()
    await db.refresh(client)

    # Save connection
    from app.models.client import ClientConnection
    conn = ClientConnection(
        client_id=client.id,
        source="shopify",
        credentials={"shop_url": req.shop_url, "access_token": token}
    )
    db.add(conn)
    await db.commit()
    
    return client

class ManualSetupRequest(BaseModel):
    name: str
    type: str # e.g. google_only, ecomm_shopify, etc.
    google_ads_id: Optional[str] = None
    mcc_id: Optional[str] = None
    meta_ads_id: Optional[str] = None
    shopify_url: Optional[str] = None
    ga4_id: Optional[str] = None
    currency: str = "USD"
    timezone: str = "UTC"
    report_settings: Optional[dict] = {}

@router.post("/manual-setup", response_model=ClientRead)
async def manual_setup_account(req: ManualSetupRequest, db: AsyncSession = Depends(get_db)):
    """Manually create a client and link platform IDs without discovery."""
    result = await db.execute(select(Client).where(Client.name == req.name))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A client with this name already exists.")
    client = Client(
        name=req.name,
        type=req.type,
        google_ads_customer_id=req.google_ads_id,
        mcc_id=req.mcc_id,
        meta_ad_account_id=req.meta_ads_id,
        shopify_shop_domain=req.shopify_url,
        ga4_property_id=req.ga4_id,
        currency=req.currency,
        timezone=req.timezone,
        report_settings=req.report_settings or {}
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client


# ── New unified create endpoint ───────────────────────────────────────────────

class ClientCreateRequest(BaseModel):
    name: str
    platforms: list[str]              # ["google_ads", "meta_ads", "shopify", "ga4"]
    is_leadgen: bool = False
    google_ads_customer_id: Optional[str] = None
    mcc_id:                 Optional[str] = None
    meta_ad_account_id:     Optional[str] = None
    shopify_shop_domain:    Optional[str] = None
    ga4_property_id:        Optional[str] = None
    currency: str = "USD"
    timezone: str = "UTC"


@router.post("/create", response_model=ClientRead)
async def create_client(req: ClientCreateRequest, db: AsyncSession = Depends(get_db)):
    """
    Create a client by selecting platforms — client type is auto-derived.
    Works for both API-pull and CSV-upload workflows.
    """
    from app.services.csv_templates import derive_client_type

    # Duplicate name check
    result = await db.execute(select(Client).where(Client.name == req.name))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400,
                            detail=f"A client named '{req.name}' already exists.")

    client_type = derive_client_type(req.platforms, req.is_leadgen)

    client = Client(
        name=req.name,
        type=client_type,
        google_ads_customer_id=req.google_ads_customer_id or None,
        mcc_id=req.mcc_id or None,
        meta_ad_account_id=req.meta_ad_account_id or None,
        shopify_shop_domain=req.shopify_shop_domain or None,
        ga4_property_id=req.ga4_property_id or None,
        currency=req.currency,
        timezone=req.timezone,
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client

class ClientUpdateRequest(BaseModel):
    name: Optional[str] = None
    currency: Optional[str] = None
    timezone: Optional[str] = None
    google_ads_customer_id: Optional[str] = None
    mcc_id: Optional[str] = None
    meta_ad_account_id: Optional[str] = None
    shopify_shop_domain: Optional[str] = None
    ga4_property_id: Optional[str] = None
    report_settings: Optional[dict] = None
    is_active: Optional[bool] = None


@router.patch("/{client_id}", response_model=ClientRead)
async def update_client(
    client_id: uuid.UUID,
    req: ClientUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Partial update — only fields provided in the body are changed."""
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    for field, value in req.model_dump(exclude_none=True).items():
        setattr(client, field, value)

    await db.commit()
    await db.refresh(client)
    return client


class ConnectRequest(BaseModel):
    source: str       # google_ads | meta_ads | shopify | ga4
    credentials: dict  # Platform-specific credential JSON


@router.post("/{client_id}/connect")
async def connect_data_source(
    client_id: uuid.UUID,
    req: ConnectRequest,
    db: AsyncSession = Depends(get_db),
):
    """Attach API credentials for a data source to a client.

    Stores encrypted credentials in client_connections.
    """
    from app.models.client import ClientConnection

    # Verify client exists
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Check if connection already exists
    existing = await db.execute(
        select(ClientConnection).where(
            ClientConnection.client_id == client_id,
            ClientConnection.source == req.source,
        )
    )
    conn = existing.scalar_one_or_none()

    if conn:
        # Update existing connection
        conn.credentials = req.credentials
        conn.is_active = True
    else:
        # Create new connection
        conn = ClientConnection(
            client_id=client_id,
            source=req.source,
            credentials=req.credentials,
        )
        db.add(conn)

    # Update Client table fields map specifically
    if req.source == "meta_ads" and "ad_account_id" in req.credentials:
        client.meta_ad_account_id = req.credentials.get("ad_account_id")
    elif req.source == "shopify" and "shop_domain" in req.credentials:
        client.shopify_shop_domain = req.credentials.get("shop_domain")
    elif req.source == "ga4" and "property_id" in req.credentials:
        client.ga4_property_id = req.credentials.get("property_id")

    await db.commit()
    return {"status": "connected", "client_id": str(client_id), "source": req.source}



# ── Priority ─────────────────────────────────────────────────────


@router.patch("/{client_id}/priority", response_model=ClientRead)
async def update_client_priority(
    client_id: uuid.UUID,
    payload: PriorityUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client.priority = payload.priority
    await db.commit()
    await db.refresh(client)
    return client


# ── Per-Client Threshold Overrides ──────────────────────────────


@router.get("/{client_id}/thresholds", response_model=list[ThresholdConfig])
async def get_client_thresholds(
    client_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Return merged thresholds: global defaults overlaid with per-client overrides."""
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    gres = await db.execute(select(DashboardThreshold).order_by(DashboardThreshold.metric_name))
    globals_map = {g.metric_name: g for g in gres.scalars().all()}

    overrides = (client.report_settings or {}).get("threshold_overrides") or {}

    merged: list[ThresholdConfig] = []
    for metric_name, g in globals_map.items():
        ov = overrides.get(metric_name) or {}
        merged.append(ThresholdConfig(
            metric_name=metric_name,
            red_below=ov.get("red_below", float(g.red_below) if g.red_below is not None else None),
            green_above=ov.get("green_above", float(g.green_above) if g.green_above is not None else None),
        ))
    return merged


@router.patch("/{client_id}/thresholds", response_model=ClientRead)
async def save_client_threshold_overrides(
    client_id: uuid.UUID,
    payload: ClientThresholdOverrideUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Replace the full threshold_overrides dict on the client."""
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    settings = dict(client.report_settings or {})
    settings["threshold_overrides"] = {
        metric: ov.model_dump() for metric, ov in payload.overrides.items()
    }
    client.report_settings = settings
    await db.commit()
    await db.refresh(client)
    return client
