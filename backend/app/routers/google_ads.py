from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import uuid

from app.database import get_db
from app.models.client import Client
from app.models.google_ads import GoogleAdsCampaign
from app.connectors.google_ads import GoogleAdsConnector

router = APIRouter()

# IMPORTANT: /mcc-accounts must be defined BEFORE /{client_id}/campaign
# to prevent FastAPI matching "mcc-accounts" as a UUID client_id path param.
@router.get("/mcc-accounts")
async def get_mcc_accounts(mcc_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """Fetch all accessible child accounts from the Google Ads MCC."""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        connector = GoogleAdsConnector(mcc_id=mcc_id)
        mcc_accounts = connector.list_child_accounts()
        logger.info("MCC returned %d accounts", len(mcc_accounts))
    except Exception as e:
        logger.error("Failed to connect to Google Ads MCC: %s", e)
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Google Ads API error: {str(e)}")

    # Mark accounts already imported into the DB
    result = await db.execute(
        select(Client.google_ads_customer_id).where(Client.google_ads_customer_id.isnot(None))
    )
    existing_ids = {str(row[0]).replace("-", "") for row in result.all()}

    any_token_limited = False
    for account in mcc_accounts:
        account["is_imported"] = account["customer_id"].replace("-", "") in existing_ids
        if account.get("token_limited"):
            any_token_limited = True

    return {
        "accounts": mcc_accounts,
        "token_limited": any_token_limited,
        "token_warning": (
            "Developer token is in Test Mode — account names are unavailable. "
            "Apply for Basic Access at Google Ads API Center to see real names."
        ) if any_token_limited else None,
    }


@router.get("/{client_id}/campaign")
async def get_google_ads_metrics(client_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            func.sum(GoogleAdsCampaign.impressions).label("impressions"),
            func.sum(GoogleAdsCampaign.clicks).label("clicks"),
            func.sum(GoogleAdsCampaign.spend).label("spend"),
            func.sum(GoogleAdsCampaign.conversions).label("conversions"),
            func.sum(GoogleAdsCampaign.conv_value).label("revenue")
        ).where(GoogleAdsCampaign.client_id == client_id)
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
