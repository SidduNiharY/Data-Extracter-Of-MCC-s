from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import uuid

from app.database import get_db
from app.models.shopify import ShopifyOrder

from app.models.client import Client
from app.connectors.shopify import ShopifyConnector
from app.core.config import settings

router = APIRouter()

@router.get("/stores")
async def get_shopify_stores(db: AsyncSession = Depends(get_db)):
    """Fetch managed stores from the Shopify Partner account."""
    if not settings.SHOPIFY_PARTNER_ID or not settings.SHOPIFY_PARTNER_TOKEN:
        return {"accounts": [], "setup_required": True}
        
    try:
        stores = ShopifyConnector.list_partner_stores(
            settings.SHOPIFY_PARTNER_ID, 
            settings.SHOPIFY_PARTNER_TOKEN
        )
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Shopify Partner API error: {str(e)}")

    # Mark stores already imported
    result = await db.execute(
        select(Client.shopify_shop_domain).where(Client.shopify_shop_domain.isnot(None))
    )
    existing_domains = {str(row[0]) for row in result.all()}

    for store in stores:
        store["is_imported"] = store["shop_domain"] in existing_domains

    return {"accounts": stores}

@router.get("/{client_id}/orders")
async def get_shopify_metrics(client_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            func.sum(ShopifyOrder.total_price).label("revenue"),
            func.count(ShopifyOrder.id).label("orders")
        ).where(ShopifyOrder.client_id == client_id)
    )
    row = result.fetchone()
    if row and row.orders is not None and row.orders > 0:
        return {
            "revenue": float(row.revenue) if row.revenue else 0.0,
            "orders": int(row.orders),
        }
    return {}
