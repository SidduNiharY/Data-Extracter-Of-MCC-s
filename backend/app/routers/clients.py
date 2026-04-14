from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.database import get_db
from app.models.client import Client
from app.schemas.client import ClientRead
from pydantic import BaseModel

router = APIRouter()

@router.get("", response_model=list[ClientRead])
async def get_clients(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Client))
    return result.scalars().all()

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
        # Upgrade type to allow multiple platforms so we don't get the error
        if existing_client.type == "meta_only":
            existing_client.type = "google_meta"
        client = existing_client
    else:
        client = Client(
            name=req.name,
            type="google_only",
            google_ads_customer_id=req.customer_id
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
    meta_ads_id: Optional[str] = None
    shopify_url: Optional[str] = None
    ga4_id: Optional[str] = None
    currency: str = "USD"
    timezone: str = "UTC"
    report_settings: Optional[dict] = {}

@router.post("/manual-setup", response_model=ClientRead)
async def manual_setup_account(req: ManualSetupRequest, db: AsyncSession = Depends(get_db)):
    """Manually create a client and link platform IDs without discovery."""
    
    # Check if a client with this name already exists
    result = await db.execute(select(Client).where(Client.name == req.name))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A client with this name already exists.")
    
    client = Client(
        name=req.name,
        type=req.type,
        google_ads_customer_id=req.google_ads_id,
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

