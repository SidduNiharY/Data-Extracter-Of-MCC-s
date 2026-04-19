from __future__ import annotations
import logging
import uuid
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reports import Report, ReportSection
from app.models.report_metrics import ReportMetric

logger = logging.getLogger(__name__)

# Metrics that are "lower is better" -- for these, a decrease is green (good)
INVERSE_METRICS = {
    "spend", "avg_cpc", "cpc", "cpm", "cost_per_conv",
    "cost_per_lead", "cost_per_result", "cpa",
}

# Which metrics to extract from each source's summary
SOURCE_METRICS = {
    "google_ads": [
        "impressions", "clicks", "spend", "conversions", "conv_value",
        "ctr", "avg_cpc", "roas", "conversion_rate", "cost_per_conv",
    ],
    "meta_ads": [
        "impressions", "clicks", "spend", "conversions", "conv_value",
        "ctr", "cpc", "roas", "reach", "frequency", "cpm",
    ],
    "shopify": [
        "total_revenue", "total_orders", "avg_order_value", "new_customers",
    ],
    "ga4": [
        "purchase_revenue", "transactions", "sessions", "active_users",
        "session_conversion_rate",
    ],
    "cross_platform": [
        "total_spend", "total_revenue", "total_conversions", "blended_roas",
    ],
}


class MetricsExtractor:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def extract_and_save(self, report_id: uuid.UUID) -> int:
        """Extract metrics from a report's summary sections and save as ReportMetric rows.

        Returns the number of metrics saved.
        """
        result = await self.db.execute(select(Report).where(Report.id == report_id))
        report = result.scalar_one_or_none()
        if not report:
            logger.warning("Report %s not found for metric extraction", report_id)
            return 0

        # Delete existing metrics for this report (idempotent re-extraction)
        await self.db.execute(
            delete(ReportMetric).where(ReportMetric.report_id == report_id)
        )

        # Load summary sections
        sections_result = await self.db.execute(
            select(ReportSection).where(
                ReportSection.report_id == report_id,
                ReportSection.section_type == "summary",
            )
        )
        sections = sections_result.scalars().all()

        count = 0
        for section in sections:
            source = section.source
            data = section.data or {}

            # For google_ads/meta_ads, summary metrics are nested under "summary" key
            summary = data.get("summary", data)
            growth = summary.get("growth", {}) if isinstance(summary, dict) else {}

            metric_names = SOURCE_METRICS.get(source, [])

            for metric_name in metric_names:
                current_str = summary.get(metric_name)
                if current_str is None:
                    continue

                try:
                    current_value = float(Decimal(str(current_str)))
                except (ValueError, TypeError, ArithmeticError):
                    continue

                # Derive previous_value from growth percentage
                growth_key = f"{metric_name}_growth"
                # Some growth keys don't have the _growth suffix in the data
                change_pct = None
                for candidate in [growth_key, metric_name]:
                    raw_pct = growth.get(candidate)
                    if raw_pct is not None:
                        try:
                            change_pct = float(Decimal(str(raw_pct)))
                        except (ValueError, TypeError):
                            pass
                        break

                previous_value = None
                if change_pct is not None and change_pct != 0:
                    # current = previous * (1 + pct/100)
                    # previous = current / (1 + pct/100)
                    divisor = 1 + change_pct / 100
                    if divisor != 0:
                        previous_value = current_value / divisor

                # Determine direction
                direction = "flat"
                if change_pct is not None:
                    if change_pct > 0:
                        direction = "up"
                    elif change_pct < 0:
                        direction = "down"

                metric = ReportMetric(
                    report_id=report_id,
                    client_id=report.client_id,
                    source=source,
                    metric_name=metric_name,
                    current_value=current_value,
                    previous_value=previous_value,
                    change_pct=change_pct,
                    direction=direction,
                )
                self.db.add(metric)
                count += 1

        await self.db.flush()
        logger.info("Extracted %d metrics from report %s", count, report_id)
        return count
