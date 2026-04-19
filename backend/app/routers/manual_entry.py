from __future__ import annotations
import csv
import io
import uuid
from datetime import datetime, timezone, date
from decimal import Decimal, InvalidOperation
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy import select, delete, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.client import Client, PullJob
from app.models.google_ads import (
    GoogleAdsCampaign, GoogleAdsSearchTerm, GoogleAdsKeyword,
    GoogleAdsTimeSegment, GoogleAdsDemographic,
    GoogleAdsCampaignRaw,
)
from app.services.google_ads_csv_parser import parse_google_ads_csv
from app.models.meta_ads import (
    MetaCampaign, MetaLeadgen, MetaTimeSegment, MetaDemographic,
)
from app.models.shopify import ShopifyOrder, ShopifyProduct
from app.models.ga4 import GA4Revenue, GA4ChannelBreakdown, GA4DeviceBreakdown
from app.schemas.manual_entry import ManualEntryRequest
from app.services.csv_templates import (
    get_template, get_templates_for_client_type, ALL_TEMPLATES,
)

router = APIRouter(tags=["Manual Entry"])


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _dec(val: str | None, default: str = "0.0") -> Decimal:
    if not val:
        return Decimal(default)
    clean = str(val).replace("$", "").replace(",", "").strip()
    try:
        return Decimal(clean)
    except InvalidOperation:
        return Decimal(default)


def _int(val: str | None, default: int = 0) -> int:
    if not val:
        return default
    clean = str(val).replace(",", "").strip()
    try:
        return int(float(clean))
    except (ValueError, TypeError):
        return default


def _bool(val: str | None, default: bool = False) -> bool:
    if val is None:
        return default
    return str(val).strip().lower() in ("1", "true", "yes", "y")


def _date(val: str | None) -> date:
    if not val:
        return datetime.now(timezone.utc).date()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(val.strip(), fmt).date()
        except ValueError:
            continue
    return datetime.now(timezone.utc).date()


def _read_csv(content: bytes) -> list[dict]:
    decoded = content.decode("utf-8-sig")  # handles BOM
    reader = csv.DictReader(io.StringIO(decoded))
    return [{k.strip().lower(): v.strip() for k, v in row.items() if k} for row in reader]


def _date_range(rows: list[dict], *date_cols: str) -> tuple[date, date]:
    dates: list[date] = []
    for r in rows:
        for col in date_cols:
            raw = r.get(col)
            if raw:
                try:
                    dates.append(_date(raw))
                    break
                except Exception:
                    pass
    today = datetime.now(timezone.utc).date()
    return (min(dates) if dates else today, max(dates) if dates else today)


async def _make_job(db: AsyncSession, client_id: uuid.UUID,
                    source: str, rows: list[dict],
                    filename: str, *date_cols: str) -> PullJob:
    start, end = _date_range(rows, *date_cols)
    job = PullJob(
        client_id=client_id,
        source=source,
        status="success",
        date_range_start=start,
        date_range_end=end,
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        rows_pulled=len(rows),
        error_message=f"CSV Upload: {filename}",
    )
    db.add(job)
    await db.flush()
    return job


# ─────────────────────────────────────────────────────────────
# Template endpoints  (no client_id required)
# ─────────────────────────────────────────────────────────────

@router.get("/templates")
async def list_templates(client_type: Optional[str] = None):
    """Return metadata for all CSV templates, optionally filtered by client type."""
    if client_type:
        templates = get_templates_for_client_type(client_type)
    else:
        templates = list(ALL_TEMPLATES.values())
    return [t.to_dict() for t in templates]


@router.get("/csv-template")
async def download_template(source: str, table: str):
    """
    Download a blank CSV template (headers + one sample row) for a given
    source + table combination.

    Example: GET /api/manual-entry/csv-template?source=google_ads&table=campaign
    """
    tpl = get_template(source, table)
    if not tpl:
        raise HTTPException(
            status_code=404,
            detail=f"No template defined for source='{source}' table='{table}'. "
                   f"Valid sources: google_ads, meta_ads, shopify, ga4."
        )

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=tpl.headers())
    writer.writeheader()
    writer.writerow(tpl.sample_row())

    filename = f"{source}_{table}_template.csv"
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ─────────────────────────────────────────────────────────────
# CSV upload  (requires client_id)
# ─────────────────────────────────────────────────────────────

@router.post("/{client_id}/upload-csv")
async def upload_csv(
    client_id: uuid.UUID,
    source: str = Form(...),
    table: str = Form("campaign"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Ingest metrics from a CSV file into the correct raw-data table.

    - source: google_ads | meta_ads | shopify | ga4
    - table:  campaign | search_terms | keywords | time_segments | demographics |
              leadgen | orders | products | revenue | channels | devices
    """
    # Verify client
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Validate template exists
    tpl = get_template(source, table)
    if not tpl:
        raise HTTPException(status_code=400,
                            detail=f"Unknown source/table: {source}/{table}")

    # Parse CSV
    content = await file.read()
    try:
        rows = _read_csv(content)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {exc}")

    if not rows:
        return {"status": "success", "rows_processed": 0, "message": "CSV was empty"}

    processed = 0

    # ── Google Ads ────────────────────────────────────────────
    if source == "google_ads":

        # ── campaign_raw: accepts direct Google Ads UI CSV exports ──────────
        if table == "campaign_raw":
            # Determine whether this client is ecomm (conversion value applicable)
            is_ecomm = client.type in ("ecomm_shopify", "ecomm_ga4")

            parse_result = parse_google_ads_csv(
                content,
                is_ecomm=is_ecomm,
                default_currency=client.currency or "AUD",
            )

            if parse_result.errors and not parse_result.rows:
                # Fatal parse error — nothing usable
                raise HTTPException(
                    status_code=400,
                    detail=f"CSV parse failed: {'; '.join(parse_result.errors[:5])}",
                )

            if not parse_result.rows:
                return {
                    "status": "success",
                    "source": source,
                    "table": table,
                    "pull_job_id": None,
                    "rows_processed": 0,
                    "message": "CSV contained no data rows.",
                }

            # Create a pull job to track this upload
            dates      = [r.report_date for r in parse_result.rows]
            range_start = min(dates)
            range_end   = max(dates)
            job = PullJob(
                client_id        = client_id,
                source           = source,
                status           = "success",
                date_range_start = range_start,
                date_range_end   = range_end,
                started_at       = datetime.now(timezone.utc),
                completed_at     = datetime.now(timezone.utc),
                rows_pulled      = len(parse_result.rows),
                error_message    = f"CSV Upload: {file.filename}",
            )
            db.add(job)
            await db.flush()

            for row in parse_result.rows:
                # Delete existing row for this (client, date, campaign) — upsert
                await db.execute(
                    delete(GoogleAdsCampaignRaw).where(and_(
                        GoogleAdsCampaignRaw.client_id    == client_id,
                        GoogleAdsCampaignRaw.report_date  == row.report_date,
                        GoogleAdsCampaignRaw.campaign_name == row.campaign_name,
                    ))
                )
                db.add(GoogleAdsCampaignRaw(
                    client_id           = client_id,
                    pull_job_id         = job.id,
                    ingestion_source    = "csv",
                    report_date         = row.report_date,
                    campaign_name       = row.campaign_name,
                    currency            = row.currency,
                    impressions         = row.impressions,
                    clicks              = row.clicks,
                    spend               = row.spend,
                    avg_cpc             = row.avg_cpc,
                    ctr                 = row.ctr,
                    conversions         = row.conversions,
                    conversion_rate     = row.conversion_rate,
                    cost_per_conversion = row.cost_per_conversion,
                    conversion_value    = row.conversion_value,
                    roas                = row.roas,
                    avg_order_value     = row.avg_order_value,
                ))
                processed += 1

            await db.commit()
            return {
                "status":        "success",
                "source":        source,
                "table":         table,
                "pull_job_id":   str(job.id),
                "rows_processed": processed,
                "rows_skipped":  parse_result.skipped,
                "warnings":      parse_result.errors,
            }

        # ── campaign: internal normalised format ─────────────────────────────
        if table == "campaign":
            job = await _make_job(db, client_id, source, rows, file.filename,
                                  "report_date", "date")
            for r in rows:
                report_date = _date(r.get("report_date") or r.get("date"))
                campaign_name = r.get("campaign_name") or r.get("campaign", "Manual Campaign")
                await db.execute(delete(GoogleAdsCampaign).where(and_(
                    GoogleAdsCampaign.client_id == client_id,
                    GoogleAdsCampaign.report_date == report_date,
                    GoogleAdsCampaign.campaign_name == campaign_name,
                )))
                db.add(GoogleAdsCampaign(
                    client_id=client_id, pull_job_id=job.id,
                    report_date=report_date,
                    campaign_id=r.get("campaign_id") or None,
                    campaign_name=campaign_name,
                    impressions=_int(r.get("impressions")),
                    clicks=_int(r.get("clicks")),
                    spend=_dec(r.get("spend") or r.get("cost")),
                    ctr=_dec(r.get("ctr")),
                    avg_cpc=_dec(r.get("avg_cpc")),
                    conversions=_dec(r.get("conversions")),
                    conversion_rate=_dec(r.get("conversion_rate")),
                    conv_value=_dec(r.get("conv_value") or r.get("revenue")),
                    cost_per_conv=_dec(r.get("cost_per_conv")),
                    roas=_dec(r.get("roas")),
                    impression_share=_dec(r.get("impression_share")),
                ))
                processed += 1

        elif table == "search_terms":
            job = await _make_job(db, client_id, source, rows, file.filename, "report_date")
            for r in rows:
                db.add(GoogleAdsSearchTerm(
                    client_id=client_id, pull_job_id=job.id,
                    report_date=_date(r.get("report_date")),
                    search_term=r.get("search_term", ""),
                    impressions=_int(r.get("impressions")),
                    clicks=_int(r.get("clicks")),
                    ctr=_dec(r.get("ctr")),
                    avg_cpc=_dec(r.get("avg_cpc")),
                    conversions=_dec(r.get("conversions")),
                    conv_value=_dec(r.get("conv_value")),
                ))
                processed += 1

        elif table == "keywords":
            job = await _make_job(db, client_id, source, rows, file.filename, "report_date")
            for r in rows:
                db.add(GoogleAdsKeyword(
                    client_id=client_id, pull_job_id=job.id,
                    report_date=_date(r.get("report_date")),
                    keyword_text=r.get("keyword_text", ""),
                    match_type=r.get("match_type", "BROAD"),
                    impressions=_int(r.get("impressions")),
                    clicks=_int(r.get("clicks")),
                    ctr=_dec(r.get("ctr")),
                    avg_cpc=_dec(r.get("avg_cpc")),
                    quality_score=_int(r.get("quality_score")),
                    conversions=_dec(r.get("conversions")),
                ))
                processed += 1

        elif table == "time_segments":
            job = await _make_job(db, client_id, source, rows, file.filename, "report_date")
            for r in rows:
                db.add(GoogleAdsTimeSegment(
                    client_id=client_id, pull_job_id=job.id,
                    report_date=_date(r.get("report_date")),
                    segment_type=r.get("segment_type", "day_of_week"),
                    segment_value=r.get("segment_value", ""),
                    impressions=_int(r.get("impressions")),
                    clicks=_int(r.get("clicks")),
                    spend=_dec(r.get("spend")),
                    conversions=_dec(r.get("conversions")),
                ))
                processed += 1

        elif table == "demographics":
            job = await _make_job(db, client_id, source, rows, file.filename, "report_date")
            for r in rows:
                db.add(GoogleAdsDemographic(
                    client_id=client_id, pull_job_id=job.id,
                    report_date=_date(r.get("report_date")),
                    gender=r.get("gender", "UNKNOWN"),
                    age_range=r.get("age_range", "UNKNOWN"),
                    impressions=_int(r.get("impressions")),
                    clicks=_int(r.get("clicks")),
                    spend=_dec(r.get("spend")),
                    conversions=_dec(r.get("conversions")),
                ))
                processed += 1

        else:
            raise HTTPException(status_code=400,
                                detail=f"Unknown table '{table}' for google_ads")

    # ── Meta Ads ──────────────────────────────────────────────
    elif source == "meta_ads":
        if table == "campaign":
            job = await _make_job(db, client_id, source, rows, file.filename,
                                  "report_date", "date")
            for r in rows:
                report_date = _date(r.get("report_date") or r.get("date"))
                campaign_name = r.get("campaign_name") or r.get("campaign", "Manual Campaign")
                await db.execute(delete(MetaCampaign).where(and_(
                    MetaCampaign.client_id == client_id,
                    MetaCampaign.report_date == report_date,
                    MetaCampaign.campaign_name == campaign_name,
                )))
                db.add(MetaCampaign(
                    client_id=client_id, pull_job_id=job.id,
                    report_date=report_date,
                    campaign_id=r.get("campaign_id") or None,
                    campaign_name=campaign_name,
                    impressions=_int(r.get("impressions")),
                    clicks=_int(r.get("clicks")),
                    spend=_dec(r.get("spend") or r.get("cost")),
                    ctr=_dec(r.get("ctr")),
                    cpc=_dec(r.get("cpc")),
                    reach=_int(r.get("reach")),
                    frequency=_dec(r.get("frequency")),
                    cpm=_dec(r.get("cpm")),
                    cost_per_result=_dec(r.get("cost_per_result")),
                    conversions=_dec(r.get("conversions")),
                    conv_value=_dec(r.get("conv_value") or r.get("revenue")),
                    roas=_dec(r.get("roas")),
                ))
                processed += 1

        elif table == "leadgen":
            job = await _make_job(db, client_id, source, rows, file.filename, "report_date")
            for r in rows:
                db.add(MetaLeadgen(
                    client_id=client_id, pull_job_id=job.id,
                    report_date=_date(r.get("report_date")),
                    campaign_id=r.get("campaign_id") or None,
                    campaign_name=r.get("campaign_name", ""),
                    leads=_int(r.get("leads")),
                    cost_per_lead=_dec(r.get("cost_per_lead")),
                    lead_form_opens=_int(r.get("lead_form_opens")),
                    form_completion_rate=_dec(r.get("form_completion_rate")),
                    link_clicks=_int(r.get("link_clicks")),
                    landing_page_views=_int(r.get("landing_page_views")),
                ))
                processed += 1

        elif table == "time_segments":
            job = await _make_job(db, client_id, source, rows, file.filename, "report_date")
            for r in rows:
                db.add(MetaTimeSegment(
                    client_id=client_id, pull_job_id=job.id,
                    report_date=_date(r.get("report_date")),
                    segment_type=r.get("segment_type", "day_of_week"),
                    segment_value=r.get("segment_value", ""),
                    impressions=_int(r.get("impressions")),
                    clicks=_int(r.get("clicks")),
                    spend=_dec(r.get("spend")),
                ))
                processed += 1

        elif table == "demographics":
            job = await _make_job(db, client_id, source, rows, file.filename, "report_date")
            for r in rows:
                db.add(MetaDemographic(
                    client_id=client_id, pull_job_id=job.id,
                    report_date=_date(r.get("report_date")),
                    gender=r.get("gender", "unknown"),
                    age_group=r.get("age_group", "unknown"),
                    impressions=_int(r.get("impressions")),
                    clicks=_int(r.get("clicks")),
                    spend=_dec(r.get("spend")),
                    conversions=_dec(r.get("conversions")),
                ))
                processed += 1

        else:
            raise HTTPException(status_code=400,
                                detail=f"Unknown table '{table}' for meta_ads")

    # ── Shopify ───────────────────────────────────────────────
    elif source == "shopify":
        if table == "orders":
            job = await _make_job(db, client_id, source, rows, file.filename,
                                  "order_date", "date")
            for r in rows:
                order_id = r.get("shopify_order_id") or r.get("order_id") or r.get("id")
                order_date = _date(r.get("order_date") or r.get("date"))
                if order_id:
                    await db.execute(delete(ShopifyOrder).where(and_(
                        ShopifyOrder.client_id == client_id,
                        ShopifyOrder.shopify_order_id == order_id,
                    )))
                db.add(ShopifyOrder(
                    client_id=client_id, pull_job_id=job.id,
                    shopify_order_id=order_id or f"manual_{uuid.uuid4().hex[:8]}",
                    order_date=order_date,
                    total_price=_dec(r.get("total_price") or r.get("revenue")),
                    customer_orders_count=_int(r.get("customer_orders_count"), 1),
                    is_new_customer=_bool(r.get("is_new_customer"), True),
                ))
                processed += 1

        elif table == "products":
            job = await _make_job(db, client_id, source, rows, file.filename, "report_date")
            for r in rows:
                db.add(ShopifyProduct(
                    client_id=client_id, pull_job_id=job.id,
                    report_date=_date(r.get("report_date")),
                    product_title=r.get("product_title", ""),
                    total_quantity=_int(r.get("total_quantity")),
                    total_revenue=_dec(r.get("total_revenue") or r.get("revenue")),
                ))
                processed += 1

        else:
            raise HTTPException(status_code=400,
                                detail=f"Unknown table '{table}' for shopify")

    # ── GA4 ───────────────────────────────────────────────────
    elif source == "ga4":
        if table == "revenue":
            job = await _make_job(db, client_id, source, rows, file.filename, "report_date")
            for r in rows:
                db.add(GA4Revenue(
                    client_id=client_id, pull_job_id=job.id,
                    report_date=_date(r.get("report_date")),
                    purchase_revenue=_dec(r.get("purchase_revenue") or r.get("revenue")),
                    transactions=_int(r.get("transactions")),
                    avg_purchase_revenue=_dec(r.get("avg_purchase_revenue")),
                    session_conversion_rate=_dec(r.get("session_conversion_rate")),
                    active_users=_int(r.get("active_users")),
                    sessions=_int(r.get("sessions")),
                ))
                processed += 1

        elif table == "channels":
            job = await _make_job(db, client_id, source, rows, file.filename, "report_date")
            for r in rows:
                db.add(GA4ChannelBreakdown(
                    client_id=client_id, pull_job_id=job.id,
                    report_date=_date(r.get("report_date")),
                    channel_group=r.get("channel_group", ""),
                    revenue=_dec(r.get("revenue")),
                    sessions=_int(r.get("sessions")),
                ))
                processed += 1

        elif table == "devices":
            job = await _make_job(db, client_id, source, rows, file.filename, "report_date")
            for r in rows:
                db.add(GA4DeviceBreakdown(
                    client_id=client_id, pull_job_id=job.id,
                    report_date=_date(r.get("report_date")),
                    device_category=r.get("device_category", ""),
                    revenue=_dec(r.get("revenue")),
                    sessions=_int(r.get("sessions")),
                ))
                processed += 1

        else:
            raise HTTPException(status_code=400,
                                detail=f"Unknown table '{table}' for ga4")

    else:
        raise HTTPException(status_code=400,
                            detail=f"Unknown source '{source}'")

    await db.commit()
    return {
        "status": "success",
        "source": source,
        "table": table,
        "pull_job_id": str(job.id),
        "rows_processed": processed,
    }


# ─────────────────────────────────────────────────────────────
# Legacy JSON manual-entry  (kept for backward compat)
# ─────────────────────────────────────────────────────────────

@router.post("/{client_id}/manual-entry")
async def create_manual_entry(
    client_id: uuid.UUID,
    req: ManualEntryRequest,
    db: AsyncSession = Depends(get_db),
):
    """Bulk ingest manual data rows via JSON body (legacy endpoint)."""
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    dates: list[date] = []
    if req.source == "google_ads":
        dates = [r.report_date for r in req.google_rows]
    elif req.source == "meta_ads":
        dates = [r.report_date for r in req.meta_rows]
    elif req.source == "shopify":
        dates = [r.order_date for r in req.shopify_rows]

    today = datetime.now(timezone.utc).date()
    job = PullJob(
        client_id=client_id,
        source=req.source,
        status="success",
        date_range_start=min(dates) if dates else today,
        date_range_end=max(dates) if dates else today,
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        rows_pulled=len(req.google_rows) + len(req.meta_rows) + len(req.shopify_rows),
        error_message="Manual Entry Submission",
    )
    db.add(job)
    await db.flush()

    if req.source == "google_ads":
        for row in req.google_rows:
            await db.execute(delete(GoogleAdsCampaign).where(and_(
                GoogleAdsCampaign.client_id == client_id,
                GoogleAdsCampaign.campaign_name == row.campaign_name,
                GoogleAdsCampaign.report_date == row.report_date,
            )))
            db.add(GoogleAdsCampaign(client_id=client_id, pull_job_id=job.id,
                                     **row.model_dump()))
    elif req.source == "meta_ads":
        for row in req.meta_rows:
            await db.execute(delete(MetaCampaign).where(and_(
                MetaCampaign.client_id == client_id,
                MetaCampaign.campaign_name == row.campaign_name,
                MetaCampaign.report_date == row.report_date,
            )))
            db.add(MetaCampaign(client_id=client_id, pull_job_id=job.id,
                                **row.model_dump()))
    elif req.source == "shopify":
        for row in req.shopify_rows:
            if row.order_id:
                await db.execute(delete(ShopifyOrder).where(and_(
                    ShopifyOrder.client_id == client_id,
                    ShopifyOrder.shopify_order_id == row.order_id,
                )))
            db.add(ShopifyOrder(client_id=client_id, pull_job_id=job.id,
                                **row.model_dump()))

    await db.commit()
    return {"status": "success", "pull_job_id": str(job.id),
            "rows_processed": job.rows_pulled}
