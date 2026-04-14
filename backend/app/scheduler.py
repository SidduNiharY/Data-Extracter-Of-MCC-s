"""Scheduler — automated data pulls and report generation.

Uses APScheduler's AsyncIOScheduler integrated with FastAPI's lifespan.
No Redis dependency required.

Schedule:
  - Weekly data pull: Every Monday at 06:00 UTC
  - Weekly report generation: Every Monday at 08:00 UTC (after pull)
  - Monthly report generation: 1st of each month at 09:00 UTC
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.database import async_session

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def _pull_all_clients():
    """Scheduled task: pull raw data for all active clients."""
    logger.info("⏰ Scheduled weekly pull starting...")
    async with async_session() as db:
        from app.services.extractor import Extractor

        extractor = Extractor(db)
        job_ids = await extractor.run_for_all_clients()
        logger.info("✅ Weekly pull complete: %d jobs", len(job_ids))


async def _generate_weekly_reports():
    """Scheduled task: generate weekly reports for all active clients."""
    logger.info("⏰ Scheduled weekly report generation starting...")
    async with async_session() as db:
        from app.services.report_generator import ReportGenerator

        generator = ReportGenerator(db)
        report_ids = await generator.generate_all_weekly()
        logger.info("✅ Weekly reports generated: %d reports", len(report_ids))


async def _generate_monthly_reports():
    """Scheduled task: generate monthly reports for all active clients."""
    logger.info("⏰ Scheduled monthly report generation starting...")
    async with async_session() as db:
        from app.services.report_generator import ReportGenerator

        generator = ReportGenerator(db)
        report_ids = await generator.generate_all_monthly()
        logger.info("✅ Monthly reports generated: %d reports", len(report_ids))


def setup_scheduler():
    """Register all scheduled jobs."""
    # Weekly data pull — Monday 6:00 AM UTC
    scheduler.add_job(
        _pull_all_clients,
        CronTrigger(day_of_week="mon", hour=6, minute=0),
        id="weekly_pull",
        name="Weekly Data Pull (All Clients)",
        replace_existing=True,
    )

    # Weekly report generation — Monday 8:00 AM UTC (after pull)
    scheduler.add_job(
        _generate_weekly_reports,
        CronTrigger(day_of_week="mon", hour=8, minute=0),
        id="weekly_reports",
        name="Weekly Report Generation",
        replace_existing=True,
    )

    # Monthly report generation — 1st of each month at 9:00 AM UTC
    scheduler.add_job(
        _generate_monthly_reports,
        CronTrigger(day=1, hour=9, minute=0),
        id="monthly_reports",
        name="Monthly Report Generation",
        replace_existing=True,
    )

    logger.info("📅 Scheduler configured with %d jobs", len(scheduler.get_jobs()))


@asynccontextmanager
async def lifespan(app):
    """FastAPI lifespan handler — starts/stops the scheduler."""
    setup_scheduler()
    scheduler.start()
    logger.info("🚀 Scheduler started")
    yield
    scheduler.shutdown()
    logger.info("⏹  Scheduler stopped")
