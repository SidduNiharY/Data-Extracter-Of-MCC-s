from __future__ import annotations
import uuid
import csv
import io
from datetime import datetime, timezone, date
from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select, delete, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.client import Client, PullJob
from app.models.google_ads import GoogleAdsCampaign
from app.models.meta_ads import MetaCampaign
from app.models.shopify import ShopifyOrder
from app.schemas.manual_entry import ManualEntryRequest

router = APIRouter(tags=["Manual Entry"])

def parse_decimal(val: str) -> Decimal:
    if not val: return Decimal("0.0")
    # Remove currency symbols and commas
    clean_val = val.replace('$', '').replace(',', '').strip()
    try:
        return Decimal(clean_val)
    except:
        return Decimal("0.0")

def parse_int(val: str) -> int:
    if not val: return 0
    clean_val = val.replace(',', '').strip()
    try:
        return int(float(clean_val))
    except:
        return 0

def parse_date(val: str) -> date:
    for fmt in ('%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y/%m/%d'):
        try:
            return datetime.strptime(val, fmt).date()
        except ValueError:
            continue
    return datetime.now(timezone.utc).date()

@router.post("/{client_id}/upload-csv")
async def upload_csv(
    client_id: uuid.UUID,
    source: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """Ingest metrics from a CSV file."""
    # 1. Verify client
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # 2. Read CSV
    content = await file.read()
    try:
        decoded = content.decode('utf-8-sig') # Handle BOM
        reader = csv.DictReader(io.StringIO(decoded))
        rows = list(reader)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read CSV: {str(e)}")

    if not rows:
        return {"status": "success", "rows_processed": 0, "message": "CSV was empty"}

    # 3. Create PullJob
    dates = []
    # Identify date column (support case-insensitive 'Date', 'report_date', 'order_date')
    date_col = next((c for c in rows[0].keys() if c.lower() in ('date', 'report_date', 'order_date')), None)
    
    if date_col:
        for r in rows:
            try:
                dates.append(parse_date(r[date_col]))
            except: pass
    
    start_date = min(dates) if dates else datetime.now(timezone.utc).date()
    end_date = max(dates) if dates else datetime.now(timezone.utc).date()

    job = PullJob(
        client_id=client_id,
        source=source,
        status="success",
        date_range_start=start_date,
        date_range_end=end_date,
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        rows_pulled=len(rows),
        error_message=f"CSV Upload: {file.filename}"
    )
    db.add(job)
    await db.flush()

    # 4. Process Rows
    processed = 0
    for r in rows:
        # Standardize keys to lowercase
        r_low = {k.lower(): v for k, v in r.items() if k}
        
        if source == "google_ads":
            # Map common headers
            campaign_name = r_low.get('campaign', r_low.get('campaign_name', 'Manual Campaign'))
            report_date = parse_date(r_low.get('date', r_low.get('report_date', '')))
            
            await db.execute(delete(GoogleAdsCampaign).where(and_(
                GoogleAdsCampaign.client_id == client_id,
                GoogleAdsCampaign.campaign_name == campaign_name,
                GoogleAdsCampaign.report_date == report_date
            )))
            
            obj = GoogleAdsCampaign(
                client_id=client_id,
                pull_job_id=job.id,
                report_date=report_date,
                campaign_name=campaign_name,
                impressions=parse_int(r_low.get('impressions', '0')),
                clicks=parse_int(r_low.get('clicks', '0')),
                spend=parse_decimal(r_low.get('spend', r_low.get('cost', '0'))),
                conversions=parse_decimal(r_low.get('conversions', '0')),
                conv_value=parse_decimal(r_low.get('conv_value', r_low.get('revenue', '0'))),
                impression_share=parse_decimal(r_low.get('impression_share', r_low.get('share', '0')))
            )
            db.add(obj)
            processed += 1

        elif source == "meta_ads":
            campaign_name = r_low.get('campaign', r_low.get('campaign_name', 'Manual Campaign'))
            report_date = parse_date(r_low.get('date', r_low.get('report_date', '')))
            
            await db.execute(delete(MetaCampaign).where(and_(
                MetaCampaign.client_id == client_id,
                MetaCampaign.campaign_name == campaign_name,
                MetaCampaign.report_date == report_date
            )))
            
            obj = MetaCampaign(
                client_id=client_id,
                pull_job_id=job.id,
                report_date=report_date,
                campaign_name=campaign_name,
                impressions=parse_int(r_low.get('impressions', '0')),
                clicks=parse_int(r_low.get('clicks', '0')),
                spend=parse_decimal(r_low.get('spend', r_low.get('cost', '0'))),
                conversions=parse_decimal(r_low.get('conversions', r_low.get('purchases', '0'))),
                conv_value=parse_decimal(r_low.get('conv_value', r_low.get('revenue', '0'))),
                reach=parse_int(r_low.get('reach', '0')),
                frequency=parse_decimal(r_low.get('frequency', '1.0'))
            )
            db.add(obj)
            processed += 1

        elif source == "shopify":
            order_date = parse_date(r_low.get('date', r_low.get('order_date', '')))
            order_id = r_low.get('order_id', r_low.get('id', ''))
            
            if order_id:
                await db.execute(delete(ShopifyOrder).where(and_(
                    ShopifyOrder.client_id == client_id,
                    ShopifyOrder.order_id == order_id
                )))
            
            obj = ShopifyOrder(
                client_id=client_id,
                pull_job_id=job.id,
                order_date=order_date,
                order_id=order_id,
                total_price=parse_decimal(r_low.get('total_price', r_low.get('revenue', '0'))),
                is_new_customer=r_low.get('new_customer', r_low.get('is_new', 'true')).lower() == 'true'
            )
            db.add(obj)
            processed += 1

    await db.commit()
    return {"status": "success", "pull_job_id": job.id, "rows_processed": processed}

@router.post("/{client_id}/manual-entry")
async def create_manual_entry(
    client_id: uuid.UUID,
    req: ManualEntryRequest,
    db: AsyncSession = Depends(get_db)
):
    """Bulk ingest manual data rows (Original grid method maintained for legacy)."""
    # ... (keeping existing implementation just in case)
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client: raise HTTPException(status_code=404, detail="Client not found")
    
    dates = []
    if req.source == "google_ads": dates = [r.report_date for r in req.google_rows]
    elif req.source == "meta_ads": dates = [r.report_date for r in req.meta_rows]
    elif req.source == "shopify": dates = [r.order_date for r in req.shopify_rows]
    
    start_date = min(dates) if dates else datetime.now(timezone.utc).date()
    end_date = max(dates) if dates else datetime.now(timezone.utc).date()

    job = PullJob(
        client_id=client_id,
        source=req.source,
        status="success",
        date_range_start=start_date,
        date_range_end=end_date,
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        rows_pulled=len(req.google_rows) or len(req.meta_rows) or len(req.shopify_rows),
        error_message="Manual Entry Submission"
    )
    db.add(job)
    await db.flush()

    if req.source == "google_ads":
        for row in req.google_rows:
            await db.execute(delete(GoogleAdsCampaign).where(and_(
                GoogleAdsCampaign.client_id == client_id,
                GoogleAdsCampaign.campaign_name == row.campaign_name,
                GoogleAdsCampaign.report_date == row.report_date
            )))
            db.add(GoogleAdsCampaign(client_id=client_id, pull_job_id=job.id, **row.model_dump()))
    elif req.source == "meta_ads":
        for row in req.meta_rows:
            await db.execute(delete(MetaCampaign).where(and_(
                MetaCampaign.client_id == client_id,
                MetaCampaign.campaign_name == row.campaign_name,
                MetaCampaign.report_date == row.report_date
            )))
            db.add(MetaCampaign(client_id=client_id, pull_job_id=job.id, **row.model_dump()))
    elif req.source == "shopify":
        for row in req.shopify_rows:
            if row.order_id:
                await db.execute(delete(ShopifyOrder).where(and_(
                    ShopifyOrder.client_id == client_id,
                    ShopifyOrder.order_id == row.order_id
                )))
            db.add(ShopifyOrder(client_id=client_id, pull_job_id=job.id, **row.model_dump()))

    await db.commit()
    return {"status": "success", "pull_job_id": job.id, "rows_processed": job.rows_pulled}
