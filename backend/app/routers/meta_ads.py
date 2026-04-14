from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import uuid

from app.database import get_db
from app.models.meta_ads import MetaCampaign

from app.models.client import Client
from app.connectors.meta_ads import MetaAdsConnector
from app.core.config import settings

router = APIRouter()

@router.get("/accounts")
async def get_meta_accounts(db: AsyncSession = Depends(get_db)):
    """Fetch all accessible ad accounts from the Meta Business Manager."""
    try:
        # Use system token from settings for discovery
        token = settings.META_ACCESS_TOKEN
        if not token:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="Meta Access Token not configured in backend.")
            
        accounts = MetaAdsConnector.list_ad_accounts(token)
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Meta API error: {str(e)}")

    # Mark accounts already imported
    result = await db.execute(
        select(Client.meta_ad_account_id).where(Client.meta_ad_account_id.isnot(None))
    )
    existing_ids = {str(row[0]) for row in result.all()}

    for acc in accounts:
        # Check against both the numeric ID and the 'act_' prefixed ID
        acc["is_imported"] = acc["customer_id"] in existing_ids or acc["meta_id"] in existing_ids

    return {"accounts": accounts}

@router.get("/{client_id}/campaign")
async def get_meta_ads_metrics(client_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            func.sum(MetaCampaign.impressions).label("impressions"),
            func.sum(MetaCampaign.clicks).label("clicks"),
            func.sum(MetaCampaign.spend).label("spend"),
            func.sum(MetaCampaign.conversions).label("conversions"),
            func.sum(MetaCampaign.conv_value).label("revenue")
        ).where(MetaCampaign.client_id == client_id)
    )
    row = result.fetchone()
    if row and row.impressions is not None:
        return {
            "impressions": int(row.impressions),
            "clicks": int(row.clicks) if row.clicks else 0,
            "spend": float(row.spend) if row.spend else 0.0,
            "conversions": float(row.conversions) if row.conversions else 0.0,
            "revenue": float(row.revenue) if row.revenue else 0.0,
        }
    return {}
