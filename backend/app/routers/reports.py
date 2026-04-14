from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sa_func
import uuid

from app.database import get_db
from app.models.reports import Report, ReportSection
from app.schemas.reports import (
    ReportRead,
    ReportSummary,
    GenerateReportRequest,
)

router = APIRouter()


# ── List Reports ──────────────────────────────────────────────────────────


@router.get("", response_model=list[ReportSummary])
async def list_reports(
    client_id: Optional[uuid.UUID] = Query(None, description="Filter by client"),
    report_type: Optional[str] = Query(None, description="weekly | monthly"),
    status: Optional[str] = Query(None, description="generating | ready | failed"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List reports with optional filters."""
    stmt = select(Report).order_by(Report.created_at.desc())

    if client_id:
        stmt = stmt.where(Report.client_id == client_id)
    if report_type:
        stmt = stmt.where(Report.report_type == report_type)
    if status:
        stmt = stmt.where(Report.status == status)

    stmt = stmt.limit(limit)
    result = await db.execute(stmt)
    reports = result.scalars().all()

    summaries = []
    for r in reports:
        # Count sections for this report
        count_result = await db.execute(
            select(sa_func.count(ReportSection.id)).where(ReportSection.report_id == r.id)
        )
        section_count = count_result.scalar() or 0

        summaries.append(ReportSummary(
            id=r.id,
            client_id=r.client_id,
            report_type=r.report_type,
            period_start=r.period_start,
            period_end=r.period_end,
            status=r.status,
            error_message=r.error_message,
            generated_at=r.generated_at,
            created_at=r.created_at,
            section_count=section_count,
        ))

    return summaries


# ── Get Full Report ───────────────────────────────────────────────────────


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
