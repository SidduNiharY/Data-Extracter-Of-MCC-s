from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sa_func
import uuid
from typing import Optional
from datetime import datetime
import logging
import io

from app.database import get_db
from app.models.client import Client
from app.models.reports import Report, ReportSection
from app.schemas.reports import (
    ReportRead,
    ReportSummary,
    GenerateReportRequest,
    ReportMetricRead,
    ReportProgressRow,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ── List Reports ──────────────────────────────────────────────────────────


@router.get("", response_model=list[ReportSummary])
async def list_reports(
    client_id: Optional[uuid.UUID] = Query(None),
    report_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """List reports."""
    stmt = select(Report).order_by(Report.created_at.desc())
    if client_id: stmt = stmt.where(Report.client_id == client_id)
    if report_type: stmt = stmt.where(Report.report_type == report_type)
    if status: stmt = stmt.where(Report.status == status)
    
    result = await db.execute(stmt.limit(limit))
    reports = result.scalars().all()
    
    summaries = []
    for r in reports:
        count_res = await db.execute(select(sa_func.count(ReportSection.id)).where(ReportSection.report_id == r.id))
        summaries.append(ReportSummary(id=r.id, client_id=r.client_id, report_type=r.report_type, period_start=r.period_start, period_end=r.period_end, status=r.status, error_message=r.error_message, generated_at=r.generated_at, created_at=r.created_at, section_count=count_res.scalar() or 0))
    return summaries

@router.get("/v/download/{report_id}")
async def download_report_pdf(report_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Generate and download PDF."""
    from app.services.pdf_generator import PDFGenerator
    try:
        generator = PDFGenerator(db)
        pdf_bytes = await generator.generate_report_pdf(report_id)
        filename = f"Report_{report_id}_{datetime.now().strftime('%Y%m%d')}.pdf"
        return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={filename}"})
    except ValueError as e: raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error("PDF generation failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")


# ── Download PDF ──────────────────────────────────────────────────────────


# ── Get Latest Reports for Client ─────────────────────────────────────────


@router.get("/client/{client_id}/latest")
async def get_latest_reports(client_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get the latest weekly and monthly reports for a client."""
    weekly_result = await db.execute(
        select(Report)
        .where(Report.client_id == client_id, Report.report_type == "weekly", Report.status == "ready")
        .order_by(Report.period_start.desc())
        .limit(1)
    )
    monthly_result = await db.execute(
        select(Report)
        .where(Report.client_id == client_id, Report.report_type == "monthly", Report.status == "ready")
        .order_by(Report.period_start.desc())
        .limit(1)
    )

    weekly = weekly_result.scalar_one_or_none()
    monthly = monthly_result.scalar_one_or_none()

    response = {}
    if weekly:
        w_sections = await db.execute(
            select(ReportSection).where(ReportSection.report_id == weekly.id)
        )
        response["weekly"] = ReportRead(
            id=weekly.id, client_id=weekly.client_id, report_type=weekly.report_type,
            period_start=weekly.period_start, period_end=weekly.period_end,
            status=weekly.status, error_message=weekly.error_message,
            generated_at=weekly.generated_at, created_at=weekly.created_at,
            sections=w_sections.scalars().all(),
        )
    if monthly:
        m_sections = await db.execute(
            select(ReportSection).where(ReportSection.report_id == monthly.id)
        )
        response["monthly"] = ReportRead(
            id=monthly.id, client_id=monthly.client_id, report_type=monthly.report_type,
            period_start=monthly.period_start, period_end=monthly.period_end,
            status=monthly.status, error_message=monthly.error_message,
            generated_at=monthly.generated_at, created_at=monthly.created_at,
            sections=m_sections.scalars().all(),
        )

    return response


# ── Generate Report ───────────────────────────────────────────────────────


@router.post("/generate")
async def generate_report(
    req: GenerateReportRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Trigger report generation for a client. Runs in background."""
    from app.services.report_generator import ReportGenerator
    from app.database import async_session

    async def run():
        async with async_session() as session:
            generator = ReportGenerator(session)
            if req.report_type == "weekly":
                await generator.generate_weekly(
                    req.client_id,
                    week_start=req.period_start,
                    week_end=req.period_end,
                )
            else:
                await generator.generate_monthly(
                    req.client_id,
                    year=req.year,
                    month=req.month,
                )

    background_tasks.add_task(run)
    return {
        "status": "queued",
        "client_id": str(req.client_id),
        "report_type": req.report_type,
    }


# ── Generate All Reports ────────────────────────────────────────────────


@router.post("/generate-all")
async def generate_all_reports(
    background_tasks: BackgroundTasks,
    report_type: str = Query("weekly", description="weekly | monthly"),
    db: AsyncSession = Depends(get_db),
):
    """Trigger report generation for ALL active clients."""
    from app.services.report_generator import ReportGenerator
    from app.database import async_session

    async def run():
        async with async_session() as session:
            generator = ReportGenerator(session)
            if report_type == "weekly":
                await generator.generate_all_weekly()
            else:
                await generator.generate_all_monthly()

    background_tasks.add_task(run)
    return {"status": "queued", "report_type": report_type, "scope": "all_clients"}


# ── Backfill: single client ───────────────────────────────────────────────


@router.post("/backfill/{client_id}")
async def backfill_client_reports(
    client_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    months: int = Query(12, ge=1, le=24, description="How many past months to generate"),
    weeks: int = Query(6, ge=1, le=12, description="How many past weeks to generate"),
    db: AsyncSession = Depends(get_db),
):
    """Backfill last N monthly + weekly reports for a specific client.

    Skips periods that already have a ready report.
    Runs in the background — returns immediately.
    """
    from app.services.report_generator import ReportGenerator
    from app.database import async_session

    async def run():
        async with async_session() as session:
            generator = ReportGenerator(session)
            result = await generator.generate_backfill(client_id, months=months, weeks=weeks)
            logger.info("Backfill complete for %s: %s", client_id, result)

    background_tasks.add_task(run)
    return {
        "status": "queued",
        "client_id": str(client_id),
        "months": months,
        "weeks": weeks,
    }


# ── Backfill: all clients ─────────────────────────────────────────────────


@router.post("/backfill")
async def backfill_all_reports(
    background_tasks: BackgroundTasks,
    months: int = Query(12, ge=1, le=24),
    weeks: int = Query(6, ge=1, le=12),
    db: AsyncSession = Depends(get_db),
):
    """Backfill historical reports for ALL active clients."""
    from app.services.report_generator import ReportGenerator
    from app.database import async_session

    async def run():
        async with async_session() as session:
            result = await session.execute(select(Client).where(Client.is_active == True))
            clients = result.scalars().all()
            generator = ReportGenerator(session)
            for client in clients:
                try:
                    await generator.generate_backfill(client.id, months=months, weeks=weeks)
                except Exception as e:
                    logger.error("Backfill failed for %s: %s", client.id, e)

    background_tasks.add_task(run)
    return {"status": "queued", "scope": "all_clients", "months": months, "weeks": weeks}


# ── Get Report Metrics ───────────────────────────────────────────────────


@router.get("/{report_id}/metrics", response_model=list[ReportMetricRead])
async def get_report_metrics(report_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get all pre-computed metrics for a report."""
    from app.models.report_metrics import ReportMetric
    result = await db.execute(
        select(ReportMetric).where(ReportMetric.report_id == report_id)
    )
    return result.scalars().all()


# ── Client Progress ──────────────────────────────────────────────────────


@router.get("/client/{client_id}/progress")
async def get_client_progress(
    client_id: uuid.UUID,
    report_type: str = Query("monthly", description="weekly | monthly"),
    source: str = Query("google_ads", description="Source to show metrics for"),
    limit: int = Query(24, ge=1, le=48),
    db: AsyncSession = Depends(get_db),
):
    """Get progress/trend data for a client: reports with their pre-computed metrics."""
    from app.models.report_metrics import ReportMetric

    # Get reports
    stmt = (
        select(Report)
        .where(
            Report.client_id == client_id,
            Report.report_type == report_type,
            Report.status == "ready",
        )
        .order_by(Report.period_start.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    reports = result.scalars().all()

    rows = []
    for r in reports:
        metrics_result = await db.execute(
            select(ReportMetric).where(
                ReportMetric.report_id == r.id,
                ReportMetric.source == source,
            )
        )
        metrics = metrics_result.scalars().all()

        rows.append(ReportProgressRow(
            report_id=r.id,
            report_type=r.report_type,
            period_start=r.period_start,
            period_end=r.period_end,
            status=r.status,
            generated_at=r.generated_at,
            metrics=[ReportMetricRead.model_validate(m) for m in metrics],
        ))

    return rows


# ── Backfill Metrics for Existing Reports ────────────────────────────────


@router.post("/backfill-metrics")
async def backfill_metrics(
    client_id: Optional[uuid.UUID] = Query(None),
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
):
    """Extract and save metrics for all existing ready reports that don't have metrics yet."""
    from app.services.metrics_extractor import MetricsExtractor
    from app.models.report_metrics import ReportMetric
    from app.database import async_session

    async def run():
        async with async_session() as session:
            stmt = select(Report).where(Report.status == "ready")
            if client_id:
                stmt = stmt.where(Report.client_id == client_id)
            result = await session.execute(stmt)
            reports = result.scalars().all()

            extractor = MetricsExtractor(session)
            extracted = 0
            for report in reports:
                # Check if metrics already exist
                existing = await session.execute(
                    select(sa_func.count(ReportMetric.id)).where(
                        ReportMetric.report_id == report.id
                    )
                )
                if (existing.scalar() or 0) > 0:
                    continue
                try:
                    count = await extractor.extract_and_save(report.id)
                    extracted += count
                except Exception as e:
                    logger.error("Metrics extraction failed for report %s: %s", report.id, e)

            await session.commit()
            logger.info("Backfill metrics complete: %d metrics extracted", extracted)

    background_tasks.add_task(run)
    return {"status": "queued", "scope": "all" if not client_id else str(client_id)}


@router.get("/{report_id}", response_model=ReportRead)
async def get_report(report_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get full report with all sections."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Eagerly load sections
    sections_result = await db.execute(
        select(ReportSection)
        .where(ReportSection.report_id == report_id)
        .order_by(ReportSection.source, ReportSection.section_type)
    )
    sections = sections_result.scalars().all()

    # Build response manually to include sections
    return ReportRead(
        id=report.id,
        client_id=report.client_id,
        report_type=report.report_type,
        period_start=report.period_start,
        period_end=report.period_end,
        status=report.status,
        error_message=report.error_message,
        generated_at=report.generated_at,
        created_at=report.created_at,
        sections=sections,
    )

