"""Report Generator Service.

Aggregates raw daily data from all platform tables into structured
weekly and monthly reports.  Each report consists of a master Report
record and multiple ReportSection records (one per platform per
section type).
"""

from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, func as sa_func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.reports import Report, ReportSection
from app.models.google_ads import (
    GoogleAdsCampaign,
    GoogleAdsCampaignRaw,
    GoogleAdsSearchTerm,
    GoogleAdsKeyword,
    GoogleAdsTimeSegment,
    GoogleAdsDemographic,
)
from app.models.meta_ads import (
    MetaCampaign,
    MetaLeadgen,
    MetaTimeSegment,
    MetaDemographic,
)
from app.models.shopify import ShopifyOrder, ShopifyProduct
from app.models.ga4 import GA4Revenue, GA4ChannelBreakdown, GA4DeviceBreakdown

from app.services.calculator import (
    safe_sum,
    safe_avg,
    build_summary_with_derived,
    wow_growth,
    avg_order_value,
    cpl,
    form_completion_rate,
)
from app.services.metrics_extractor import MetricsExtractor

logger = logging.getLogger(__name__)


def _dec(value) -> Optional[str]:
    """Convert Decimal/numeric to string for JSON serialisation."""
    if value is None:
        return None
    return str(value)


def _row_to_dict(row, keys: list[str]) -> dict:
    """Extract named attributes from an ORM row into a JSON-safe dict."""
    d = {}
    for k in keys:
        v = getattr(row, k, None)
        if isinstance(v, Decimal):
            d[k] = str(v)
        elif isinstance(v, (date, datetime)):
            d[k] = str(v)
        else:
            d[k] = v
    return d


class ReportGenerator:
    """Orchestrates report generation for clients."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ══════════════════════════════════════════════════════════════════════
    #  PUBLIC API
    # ══════════════════════════════════════════════════════════════════════

    async def generate_weekly(
        self,
        client_id: uuid.UUID,
        week_start: Optional[date] = None,
        week_end: Optional[date] = None,
    ) -> uuid.UUID:
        """Generate a weekly report for a client.

        Defaults to the previous full week (Mon-Sun).
        Returns the report ID.
        """
        if week_start is None or week_end is None:
            today = date.today()
            # Last Monday → Last Sunday
            last_monday = today - timedelta(days=today.weekday() + 7)
            last_sunday = last_monday + timedelta(days=6)
            week_start = week_start or last_monday
            week_end = week_end or last_sunday

        client = await self._get_client(client_id)
        if not client:
            raise ValueError(f"Client {client_id} not found")

        # Create report record
        report = Report(
            client_id=client_id,
            report_type="weekly",
            period_start=week_start,
            period_end=week_end,
            status="generating",
        )
        self.db.add(report)
        await self.db.flush()

        try:
            # Previous week for WoW comparison
            prev_start = week_start - timedelta(days=7)
            prev_end = week_end - timedelta(days=7)

            sections = []

            # Google Ads sections — run if API customer_id is set OR CSV data was uploaded
            if client.google_ads_customer_id or await self._has_raw_google_ads_data(
                client.id, week_start, week_end
            ):
                sections.extend(
                    await self._google_ads_sections(client, report.id, week_start, week_end, prev_start, prev_end)
                )

            # Meta Ads sections
            if client.meta_ad_account_id:
                sections.extend(
                    await self._meta_ads_sections(client, report.id, week_start, week_end, prev_start, prev_end)
                )

            # Shopify sections
            if client.shopify_shop_domain:
                sections.extend(
                    await self._shopify_sections(client, report.id, week_start, week_end, prev_start, prev_end)
                )

            # GA4 sections
            if client.ga4_property_id:
                sections.extend(
                    await self._ga4_sections(client, report.id, week_start, week_end, prev_start, prev_end)
                )

            # Cross-platform summary
            sections.append(
                await self._cross_platform_section(client, report.id, week_start, week_end, prev_start, prev_end)
            )

            for section in sections:
                self.db.add(section)

            report.status = "ready"
            report.generated_at = datetime.now(timezone.utc)

            # Extract pre-computed metrics from summary sections
            extractor = MetricsExtractor(self.db)
            await extractor.extract_and_save(report.id)

            await self.db.commit()
            logger.info(
                "Weekly report generated for %s (%s → %s): %d sections",
                client.name, week_start, week_end, len(sections),
            )
            return report.id

        except Exception as e:
            report.status = "failed"
            report.error_message = str(e)[:500]
            report.generated_at = datetime.now(timezone.utc)
            await self.db.commit()
            logger.error("Weekly report failed for %s: %s", client.name, e)
            raise

    async def generate_monthly(
        self,
        client_id: uuid.UUID,
        year: Optional[int] = None,
        month: Optional[int] = None,
    ) -> uuid.UUID:
        """Generate a monthly report for a client.

        Defaults to the previous full calendar month.
        Returns the report ID.
        """
        today = date.today()
        if year is None or month is None:
            # Previous month
            first_of_this_month = today.replace(day=1)
            last_of_prev_month = first_of_this_month - timedelta(days=1)
            year = last_of_prev_month.year
            month = last_of_prev_month.month

        month_start = date(year, month, 1)
        if month == 12:
            month_end = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            month_end = date(year, month + 1, 1) - timedelta(days=1)

        # Previous month for MoM comparison
        prev_month_end = month_start - timedelta(days=1)
        prev_month_start = prev_month_end.replace(day=1)

        client = await self._get_client(client_id)
        if not client:
            raise ValueError(f"Client {client_id} not found")

        report = Report(
            client_id=client_id,
            report_type="monthly",
            period_start=month_start,
            period_end=month_end,
            status="generating",
        )
        self.db.add(report)
        await self.db.flush()

        try:
            sections = []

            # Google Ads sections — run if API customer_id is set OR CSV data was uploaded
            if client.google_ads_customer_id or await self._has_raw_google_ads_data(
                client.id, month_start, month_end
            ):
                sections.extend(
                    await self._google_ads_sections(
                        client, report.id, month_start, month_end, prev_month_start, prev_month_end
                    )
                )

            if client.meta_ad_account_id:
                sections.extend(
                    await self._meta_ads_sections(
                        client, report.id, month_start, month_end, prev_month_start, prev_month_end
                    )
                )

            if client.shopify_shop_domain:
                sections.extend(
                    await self._shopify_sections(
                        client, report.id, month_start, month_end, prev_month_start, prev_month_end
                    )
                )

            if client.ga4_property_id:
                sections.extend(
                    await self._ga4_sections(
                        client, report.id, month_start, month_end, prev_month_start, prev_month_end
                    )
                )

            sections.append(
                await self._cross_platform_section(
                    client, report.id, month_start, month_end, prev_month_start, prev_month_end
                )
            )

            for section in sections:
                self.db.add(section)

            report.status = "ready"
            report.generated_at = datetime.now(timezone.utc)

            # Extract pre-computed metrics from summary sections
            extractor = MetricsExtractor(self.db)
            await extractor.extract_and_save(report.id)

            await self.db.commit()
            logger.info(
                "Monthly report generated for %s (%s → %s): %d sections",
                client.name, month_start, month_end, len(sections),
            )
            return report.id

        except Exception as e:
            report.status = "failed"
            report.error_message = str(e)[:500]
            report.generated_at = datetime.now(timezone.utc)
            await self.db.commit()
            logger.error("Monthly report failed for %s: %s", client.name, e)
            raise

    async def generate_all_weekly(self) -> list[uuid.UUID]:
        """Generate weekly reports for ALL active clients."""
        result = await self.db.execute(select(Client).where(Client.is_active == True))
        clients = result.scalars().all()
        report_ids = []
        for client in clients:
            try:
                rid = await self.generate_weekly(client.id)
                report_ids.append(rid)
            except Exception as e:
                logger.error("Weekly report failed for %s: %s", client.name, e)
        return report_ids

    async def generate_all_monthly(self) -> list[uuid.UUID]:
        """Generate monthly reports for ALL active clients."""
        result = await self.db.execute(select(Client).where(Client.is_active == True))
        clients = result.scalars().all()
        report_ids = []
        for client in clients:
            try:
                rid = await self.generate_monthly(client.id)
                report_ids.append(rid)
            except Exception as e:
                logger.error("Monthly report failed for %s: %s", client.name, e)
        return report_ids

    async def generate_backfill(
        self,
        client_id: uuid.UUID,
        months: int = 12,
        weeks: int = 6,
    ) -> dict:
        """Backfill historical reports: last `months` monthly + last `weeks` weekly.

        Skips any period that already has a ready report so it is safe to
        call multiple times.
        """
        today = date.today()
        monthly_generated = 0
        weekly_generated   = 0
        monthly_skipped    = 0
        weekly_skipped     = 0
        errors: list[str]  = []

        # ── Monthly: last N complete calendar months ──────────────────────
        for i in range(1, months + 1):
            year  = today.year
            month = today.month - i
            while month <= 0:
                month += 12
                year  -= 1

            month_start = date(year, month, 1)

            existing = await self.db.execute(
                select(Report).where(
                    and_(
                        Report.client_id   == client_id,
                        Report.report_type == "monthly",
                        Report.period_start == month_start,
                        Report.status      == "ready",
                    )
                )
            )
            if existing.scalar_one_or_none():
                monthly_skipped += 1
                continue

            try:
                await self.generate_monthly(client_id, year=year, month=month)
                monthly_generated += 1
            except Exception as e:
                errors.append(f"Monthly {year}-{month:02d}: {str(e)[:120]}")

        # ── Weekly: last N complete Mon–Sun weeks ─────────────────────────
        # today.weekday(): Mon=0 … Sun=6
        last_sunday = today - timedelta(days=today.weekday() + 1)
        last_monday = last_sunday - timedelta(days=6)

        for i in range(weeks):
            week_start = last_monday - timedelta(weeks=i)
            week_end   = last_sunday - timedelta(weeks=i)

            existing = await self.db.execute(
                select(Report).where(
                    and_(
                        Report.client_id    == client_id,
                        Report.report_type  == "weekly",
                        Report.period_start == week_start,
                        Report.status       == "ready",
                    )
                )
            )
            if existing.scalar_one_or_none():
                weekly_skipped += 1
                continue

            try:
                await self.generate_weekly(client_id, week_start=week_start, week_end=week_end)
                weekly_generated += 1
            except Exception as e:
                errors.append(f"Weekly {week_start}: {str(e)[:120]}")

        logger.info(
            "Backfill %s: monthly +%d (skip %d) | weekly +%d (skip %d) | errors %d",
            client_id, monthly_generated, monthly_skipped,
            weekly_generated, weekly_skipped, len(errors),
        )
        return {
            "monthly_generated": monthly_generated,
            "weekly_generated":  weekly_generated,
            "monthly_skipped":   monthly_skipped,
            "weekly_skipped":    weekly_skipped,
            "errors": errors,
        }

    # ══════════════════════════════════════════════════════════════════════
    #  PRIVATE HELPERS
    # ══════════════════════════════════════════════════════════════════════

    async def _get_client(self, client_id: uuid.UUID) -> Optional[Client]:
        """Fetch a Client record by ID, returns None if not found."""
        result = await self.db.execute(select(Client).where(Client.id == client_id))
        return result.scalar_one_or_none()

    async def _has_raw_google_ads_data(
        self, client_id: uuid.UUID, start: date, end: date
    ) -> bool:
        """Return True if GoogleAdsCampaignRaw has any rows for this client/period."""
        stmt = (
            select(sa_func.count(GoogleAdsCampaignRaw.id))
            .where(
                and_(
                    GoogleAdsCampaignRaw.client_id == client_id,
                    GoogleAdsCampaignRaw.report_date >= start,
                    GoogleAdsCampaignRaw.report_date <= end,
                )
            )
        )
        result = await self.db.execute(stmt)
        return (result.scalar() or 0) > 0

    # ═══════════════════════════�    # ── Google Ads ───────────────────────────────────────────────────────
    async def _google_ads_sections(
        self, client: Client, report_id: uuid.UUID,
        start: date, end: date, prev_start: date, prev_end: date,
    ) -> list[ReportSection]:
        sections = []
        campaign_keys = [
            "campaign_id", "campaign_name", "impressions", "clicks",
            "spend", "ctr", "avg_cpc", "conversions", "conversion_rate",
            "conv_value", "cost_per_conv", "roas", "impression_share",
        ]
        agg_keys = ["impressions", "clicks", "spend", "conversions", "conv_value"]

        # ── Campaign Summary ──
        # Prefer API-pulled data (GoogleAdsCampaign); fall back to CSV raw data.
        rows = await self._query_date_range(GoogleAdsCampaign, client.id, start, end)
        prev_rows = await self._query_date_range(GoogleAdsCampaign, client.id, prev_start, prev_end)
        using_raw = False

        if not rows:
            # No API data — use CSV-uploaded raw rows instead
            raw_rows = await self._query_date_range(GoogleAdsCampaignRaw, client.id, start, end)
            prev_raw_rows = await self._query_date_range(GoogleAdsCampaignRaw, client.id, prev_start, prev_end)
            if raw_rows:
                using_raw = True
                # Map GoogleAdsCampaignRaw fields → canonical keys expected below
                raw_campaign_keys = [
                    "campaign_name", "impressions", "clicks",
                    "spend", "ctr", "avg_cpc", "conversions", "conversion_rate",
                    "conversion_value", "cost_per_conversion", "roas", "impression_share",
                ]
                raw_agg_keys = ["impressions", "clicks", "spend", "conversions", "conversion_value"]
                campaign_data = [_row_to_dict(r, raw_campaign_keys) for r in raw_rows]
                # Normalise field names to match what build_summary_with_derived expects
                for d in campaign_data:
                    d["conv_value"] = d.pop("conversion_value", None)
                    d["cost_per_conv"] = d.pop("cost_per_conversion", None)
                    d.setdefault("campaign_id", None)

                raw_totals = self._sum_rows(raw_rows, raw_agg_keys)
                prev_raw_totals = self._sum_rows(prev_raw_rows, raw_agg_keys)
                # Normalise totals keys
                totals = {
                    "impressions": raw_totals.get("impressions"),
                    "clicks": raw_totals.get("clicks"),
                    "spend": raw_totals.get("spend"),
                    "conversions": raw_totals.get("conversions"),
                    "conv_value": raw_totals.get("conversion_value"),
                }
                prev_totals = {
                    "impressions": prev_raw_totals.get("impressions"),
                    "clicks": prev_raw_totals.get("clicks"),
                    "spend": prev_raw_totals.get("spend"),
                    "conversions": prev_raw_totals.get("conversions"),
                    "conv_value": prev_raw_totals.get("conversion_value"),
                }
                summary = build_summary_with_derived(totals, prev_totals)
                sections.append(ReportSection(
                    report_id=report_id,
                    source="google_ads",
                    section_type="summary",
                    data={
                        "summary": summary,
                        "total_campaigns": len(set(r.campaign_name for r in raw_rows)),
                        "data_source": "csv_upload",
                    },
                ))
                sections.append(ReportSection(
                    report_id=report_id,
                    source="google_ads",
                    section_type="campaign_breakdown",
                    data={"campaigns": campaign_data, "data_source": "csv_upload"},
                ))

        if not using_raw:
            campaign_data = [_row_to_dict(r, campaign_keys) for r in rows]
            totals = self._sum_rows(rows, agg_keys)
            prev_totals = self._sum_rows(prev_rows, agg_keys)
            summary = build_summary_with_derived(totals, prev_totals)

            sections.append(ReportSection(
                report_id=report_id,
                source="google_ads",
                section_type="summary",
                data={"summary": summary, "total_campaigns": len(set(r.campaign_id for r in rows))},
            ))
            sections.append(ReportSection(
                report_id=report_id,
                source="google_ads",
                section_type="campaign_breakdown",
                data={"campaigns": campaign_data},
            ))

        # ── Search Terms (Top 10 by Clicks) ──
        st_stmt = (
            select(GoogleAdsSearchTerm)
            .where(
                and_(
                    GoogleAdsSearchTerm.client_id == client.id,
                    GoogleAdsSearchTerm.report_date >= start,
                    GoogleAdsSearchTerm.report_date <= end,
                )
            )
            .order_by(GoogleAdsSearchTerm.clicks.desc())
            .limit(10)
        )
        st_result = await self.db.execute(st_stmt)
        st_rows = st_result.scalars().all()
        if st_rows:
            st_data = [_row_to_dict(r, ["search_term", "impressions", "clicks", "ctr", "avg_cpc", "conversions", "conv_value", "roas"]) for r in st_rows]
            sections.append(ReportSection(
                report_id=report_id,
                source="google_ads",
                section_type="search_terms",
                data={"search_terms": st_data},
            ))

        # ── Keywords (Top 10 by Impressions) ──
        kw_stmt = (
            select(GoogleAdsKeyword)
            .where(
                and_(
                    GoogleAdsKeyword.client_id == client.id,
                    GoogleAdsKeyword.report_date >= start,
                    GoogleAdsKeyword.report_date <= end,
                )
            )
            .order_by(GoogleAdsKeyword.impressions.desc())
            .limit(10)
        )
        kw_result = await self.db.execute(kw_stmt)
        kw_rows = kw_result.scalars().all()
        if kw_rows:
            kw_data = [_row_to_dict(r, ["keyword_text", "match_type", "quality_score", "impressions", "clicks", "ctr", "avg_cpc", "conversions"]) for r in kw_rows]
            sections.append(ReportSection(
                report_id=report_id,
                source="google_ads",
                section_type="keywords",
                data={"keywords": kw_data},
            ))

        # ── Time Segments ──
        ts_rows = await self._query_date_range(GoogleAdsTimeSegment, client.id, start, end)
        if ts_rows:
            day_data = [_row_to_dict(r, ["segment_value", "impressions", "clicks", "spend", "conversions"]) for r in ts_rows if r.segment_type == "day_of_week"]
            hour_data = [_row_to_dict(r, ["segment_value", "impressions", "clicks", "spend", "conversions"]) for r in ts_rows if r.segment_type == "hour_of_day"]
            sections.append(ReportSection(
                report_id=report_id,
                source="google_ads",
                section_type="time_segments",
                data={"day_of_week": day_data, "hour_of_day": hour_data},
            ))

        # ── Demographics (Only for Non-Search campaigns) ──
        # Since searching campaigns do NOT have gender/age data according to spec
        demo_rows = await self._query_date_range(GoogleAdsDemographic, client.id, start, end)
        if demo_rows:
            demo_data = [_row_to_dict(r, ["gender", "age_range", "impressions", "clicks", "spend", "conversions"]) for r in demo_rows]
            sections.append(ReportSection(
                report_id=report_id,
                source="google_ads",
                section_type="demographics",
                data={"demographics": demo_data},
            ))

        return sections

    # ── Meta Ads ─────────────────────────────────────────────────────────

    async def _meta_ads_sections(
        self, client: Client, report_id: uuid.UUID,
        start: date, end: date, prev_start: date, prev_end: date,
    ) -> list[ReportSection]:
        sections = []
        campaign_keys = [
            "campaign_id", "campaign_name", "impressions", "clicks",
            "spend", "ctr", "cpc", "reach", "frequency", "cpm",
            "cost_per_result", "conversions", "conv_value", "roas",
        ]
        agg_keys = ["impressions", "clicks", "spend", "conversions", "conv_value", "reach"]

        # ── Campaign Summary ──
        rows = await self._query_date_range(MetaCampaign, client.id, start, end)
        prev_rows = await self._query_date_range(MetaCampaign, client.id, prev_start, prev_end)

        campaign_data = [_row_to_dict(r, campaign_keys) for r in rows]
        totals = self._sum_rows(rows, agg_keys)
        prev_totals = self._sum_rows(prev_rows, agg_keys)
        summary = build_summary_with_derived(totals, prev_totals)

        # Compute frequency and CPM from aggregated totals (can't be summed naively)
        _imp = Decimal(str(totals.get("impressions") or 0))
        _reach = Decimal(str(totals.get("reach") or 0))
        _spend = Decimal(str(totals.get("spend") or 0))
        if _reach > 0:
            summary["frequency"] = _dec(_imp / _reach)
        if _imp > 0:
            summary["cpm"] = _dec(_spend / _imp * 1000)

        # WoW growth for frequency and CPM
        _growth = summary.get("growth", {})
        if isinstance(_growth, dict) and prev_totals:
            _prev_imp = Decimal(str(prev_totals.get("impressions") or 0))
            _prev_reach = Decimal(str(prev_totals.get("reach") or 0))
            _prev_spend = Decimal(str(prev_totals.get("spend") or 0))
            if _reach > 0 and _prev_reach > 0:
                _growth["frequency_growth"] = str(
                    wow_growth(summary.get("frequency"), _dec(_prev_imp / _prev_reach)) or "0"
                )
            if _imp > 0 and _prev_imp > 0:
                _growth["cpm_growth"] = str(
                    wow_growth(summary.get("cpm"), _dec(_prev_spend / _prev_imp * 1000)) or "0"
                )
            summary["growth"] = _growth

        sections.append(ReportSection(
            report_id=report_id,
            source="meta_ads",
            section_type="summary",
            data={"summary": summary, "total_campaigns": len(set(r.campaign_id for r in rows))},
        ))
        sections.append(ReportSection(
            report_id=report_id,
            source="meta_ads",
            section_type="campaign_breakdown",
            data={"campaigns": campaign_data},
        ))

        # ── Lead Gen ──
        lg_rows = await self._query_date_range(MetaLeadgen, client.id, start, end)
        if lg_rows:
            lg_data = [_row_to_dict(r, ["campaign_id", "campaign_name", "leads", "cost_per_lead", "lead_form_opens", "form_completion_rate", "link_clicks", "landing_page_views"]) for r in lg_rows]
            total_leads = safe_sum([r.leads for r in lg_rows])
            total_spend = safe_sum([getattr(r, "spend", 0) or 0 for r in lg_rows])
            sections.append(ReportSection(
                report_id=report_id,
                source="meta_ads",
                section_type="leadgen",
                data={
                    "leadgen": lg_data,
                    "total_leads": _dec(total_leads),
                    "avg_cpl": _dec(cpl(total_spend, total_leads)),
                },
            ))

        # ── Time Segments ──
        ts_rows = await self._query_date_range(MetaTimeSegment, client.id, start, end)
        if ts_rows:
            day_data = [_row_to_dict(r, ["segment_value", "impressions", "clicks", "spend"]) for r in ts_rows if r.segment_type == "day"]
            hour_data = [_row_to_dict(r, ["segment_value", "impressions", "clicks", "spend"]) for r in ts_rows if r.segment_type == "hour"]
            sections.append(ReportSection(
                report_id=report_id,
                source="meta_ads",
                section_type="time_segments",
                data={"day": day_data, "hour": hour_data},
            ))

        # ── Demographics ──
        demo_rows = await self._query_date_range(MetaDemographic, client.id, start, end)
        if demo_rows:
            demo_data = [_row_to_dict(r, ["gender", "age_group", "impressions", "clicks", "spend", "conversions"]) for r in demo_rows]
            sections.append(ReportSection(
                report_id=report_id,
                source="meta_ads",
                section_type="demographics",
                data={"demographics": demo_data},
            ))

        return sections

    # ── Shopify ──────────────────────────────────────────────────────────

    async def _shopify_sections(
        self, client: Client, report_id: uuid.UUID,
        start: date, end: date, prev_start: date, prev_end: date,
    ) -> list[ReportSection]:
        sections = []

        # ── Orders Summary ──
        order_rows = await self._query_shopify_orders(client.id, start, end)
        prev_order_rows = await self._query_shopify_orders(client.id, prev_start, prev_end)

        total_revenue = safe_sum([r.total_price for r in order_rows])
        total_orders = len(order_rows)
        new_customers = sum(1 for r in order_rows if r.is_new_customer)
        returning = total_orders - new_customers

        prev_revenue = safe_sum([r.total_price for r in prev_order_rows])
        prev_orders = len(prev_order_rows)

        sections.append(ReportSection(
            report_id=report_id,
            source="shopify",
            section_type="summary",
            data={
                "total_revenue": _dec(total_revenue),
                "total_orders": total_orders,
                "avg_order_value": _dec(avg_order_value(total_revenue, total_orders)),
                "new_customers": new_customers,
                "returning_customers": returning,
                "new_customer_pct": _dec(
                    Decimal(str(new_customers)) / Decimal(str(total_orders)) * 100
                ) if total_orders > 0 else "0",
                "growth": {
                    "revenue_growth": _dec(wow_growth(total_revenue, prev_revenue)),
                    "orders_growth": _dec(wow_growth(total_orders, prev_orders)),
                },
            },
        ))

        # ── Top Products ──
        product_rows = await self._query_date_range(ShopifyProduct, client.id, start, end)
        if product_rows:
            prod_data = [_row_to_dict(r, ["product_title", "total_quantity", "total_revenue"]) for r in product_rows]
            # Sort by revenue descending
            prod_data.sort(key=lambda x: Decimal(str(x.get("total_revenue", "0"))), reverse=True)
            sections.append(ReportSection(
                report_id=report_id,
                source="shopify",
                section_type="products",
                data={"top_products": prod_data[:20]},
            ))

        # ── Revenue by Day ──
        daily_stmt = (
            select(
                ShopifyOrder.order_date,
                sa_func.sum(ShopifyOrder.total_price).label("revenue"),
                sa_func.count(ShopifyOrder.id).label("orders"),
            )
            .where(
                and_(
                    ShopifyOrder.client_id == client.id,
                    ShopifyOrder.order_date >= start,
                    ShopifyOrder.order_date <= end,
                )
            )
            .group_by(ShopifyOrder.order_date)
            .order_by(ShopifyOrder.order_date)
        )
        daily_result = await self.db.execute(daily_stmt)
        daily_rows = daily_result.all()
        if daily_rows:
            sections.append(ReportSection(
                report_id=report_id,
                source="shopify",
                section_type="revenue_by_day",
                data={
                    "daily": [
                        {
                            "date": str(row.order_date),
                            "revenue": _dec(row.revenue),
                            "orders": row.orders,
                        }
                        for row in daily_rows
                    ]
                },
            ))

        return sections

    # ── GA4 ──────────────────────────────────────────────────────────────

    async def _ga4_sections(
        self, client: Client, report_id: uuid.UUID,
        start: date, end: date, prev_start: date, prev_end: date,
    ) -> list[ReportSection]:
        sections = []

        # ── Revenue Summary ──
        rev_rows = await self._query_date_range(GA4Revenue, client.id, start, end)
        prev_rev_rows = await self._query_date_range(GA4Revenue, client.id, prev_start, prev_end)

        total_revenue = safe_sum([r.purchase_revenue for r in rev_rows])
        total_transactions = safe_sum([r.transactions for r in rev_rows])
        total_sessions = safe_sum([r.sessions for r in rev_rows])
        total_users = safe_sum([r.active_users for r in rev_rows])

        prev_revenue = safe_sum([r.purchase_revenue for r in prev_rev_rows])
        prev_transactions = safe_sum([r.transactions for r in prev_rev_rows])

        avg_conv_rate = safe_avg([r.session_conversion_rate for r in rev_rows])

        sections.append(ReportSection(
            report_id=report_id,
            source="ga4",
            section_type="summary",
            data={
                "purchase_revenue": _dec(total_revenue),
                "transactions": _dec(total_transactions),
                "avg_purchase_revenue": _dec(avg_order_value(total_revenue, total_transactions)),
                "session_conversion_rate": _dec(avg_conv_rate),
                "sessions": _dec(total_sessions),
                "active_users": _dec(total_users),
                "growth": {
                    "revenue_growth": _dec(wow_growth(total_revenue, prev_revenue)),
                    "transactions_growth": _dec(wow_growth(total_transactions, prev_transactions)),
                },
            },
        ))

        # ── Channel Breakdown ──
        ch_rows = await self._query_date_range(GA4ChannelBreakdown, client.id, start, end)
        if ch_rows:
            ch_data = [_row_to_dict(r, ["channel_group", "revenue", "sessions"]) for r in ch_rows]
            sections.append(ReportSection(
                report_id=report_id,
                source="ga4",
                section_type="channel_breakdown",
                data={"channels": ch_data},
            ))

        # ── Device Breakdown ──
        dev_rows = await self._query_date_range(GA4DeviceBreakdown, client.id, start, end)
        if dev_rows:
            dev_data = [_row_to_dict(r, ["device_category", "revenue", "sessions"]) for r in dev_rows]
            sections.append(ReportSection(
                report_id=report_id,
                source="ga4",
                section_type="device_breakdown",
                data={"devices": dev_data},
            ))

        return sections

    # ── Cross-Platform ───────────────────────────────────────────────────

    async def _cross_platform_section(
        self, client: Client, report_id: uuid.UUID,
        start: date, end: date, prev_start: date, prev_end: date,
    ) -> ReportSection:
        """Aggregate spend, revenue, ROAS across all platforms."""
        total_spend = Decimal("0")
        total_revenue = Decimal("0")
        total_conversions = Decimal("0")
        prev_spend = Decimal("0")
        prev_revenue = Decimal("0")
        platforms_active = []

        # Google Ads — use API data when available, fall back to raw CSV data
        ga_rows = await self._query_date_range(GoogleAdsCampaign, client.id, start, end)
        prev_ga = await self._query_date_range(GoogleAdsCampaign, client.id, prev_start, prev_end)
        if not ga_rows:
            ga_rows = await self._query_date_range(GoogleAdsCampaignRaw, client.id, start, end)
            prev_ga = await self._query_date_range(GoogleAdsCampaignRaw, client.id, prev_start, prev_end)
            if ga_rows:
                total_spend += safe_sum([r.spend for r in ga_rows])
                total_revenue += safe_sum([r.conversion_value for r in ga_rows if r.conversion_value])
                total_conversions += safe_sum([r.conversions for r in ga_rows])
                prev_spend += safe_sum([r.spend for r in prev_ga])
                prev_revenue += safe_sum([r.conversion_value for r in prev_ga if r.conversion_value])
                platforms_active.append("google_ads")
        elif ga_rows:
            total_spend += safe_sum([r.spend for r in ga_rows])
            total_revenue += safe_sum([r.conv_value for r in ga_rows])
            total_conversions += safe_sum([r.conversions for r in ga_rows])
            prev_spend += safe_sum([r.spend for r in prev_ga])
            prev_revenue += safe_sum([r.conv_value for r in prev_ga])
            platforms_active.append("google_ads")

        # Meta Ads
        if client.meta_ad_account_id:
            meta_rows = await self._query_date_range(MetaCampaign, client.id, start, end)
            prev_meta = await self._query_date_range(MetaCampaign, client.id, prev_start, prev_end)
            total_spend += safe_sum([r.spend for r in meta_rows])
            total_revenue += safe_sum([r.conv_value for r in meta_rows])
            total_conversions += safe_sum([r.conversions for r in meta_rows])
            prev_spend += safe_sum([r.spend for r in prev_meta])
            prev_revenue += safe_sum([r.conv_value for r in prev_meta])
            platforms_active.append("meta_ads")

        # Shopify revenue
        if client.shopify_shop_domain:
            shop_rows = await self._query_shopify_orders(client.id, start, end)
            prev_shop = await self._query_shopify_orders(client.id, prev_start, prev_end)
            shop_rev = safe_sum([r.total_price for r in shop_rows])
            prev_shop_rev = safe_sum([r.total_price for r in prev_shop])
            total_revenue += shop_rev
            prev_revenue += prev_shop_rev
            platforms_active.append("shopify")

        # GA4 revenue
        if client.ga4_property_id:
            ga4_rows = await self._query_date_range(GA4Revenue, client.id, start, end)
            prev_ga4 = await self._query_date_range(GA4Revenue, client.id, prev_start, prev_end)
            ga4_rev = safe_sum([r.purchase_revenue for r in ga4_rows])
            prev_ga4_rev = safe_sum([r.purchase_revenue for r in prev_ga4])
            total_revenue += ga4_rev
            prev_revenue += prev_ga4_rev
            platforms_active.append("ga4")

        blended_roas = (total_revenue / total_spend) if total_spend > 0 else None

        return ReportSection(
            report_id=report_id,
            source="cross_platform",
            section_type="summary",
            data={
                "total_spend": _dec(total_spend),
                "total_revenue": _dec(total_revenue),
                "total_conversions": _dec(total_conversions),
                "blended_roas": _dec(blended_roas),
                "platforms_active": platforms_active,
                "growth": {
                    "spend_growth": _dec(wow_growth(total_spend, prev_spend)),
                    "revenue_growth": _dec(wow_growth(total_revenue, prev_revenue)),
                },
            },
        )

    # ── Query Helpers ────────────────────────────────────────────────────

    async def _query_date_range(self, model, client_id: uuid.UUID, start: date, end: date):
        """Query any model with client_id and report_date range."""
        stmt = (
            select(model)
            .where(
                and_(
                    model.client_id == client_id,
                    model.report_date >= start,
                    model.report_date <= end,
                )
            )
            .order_by(model.report_date)
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def _query_shopify_orders(self, client_id: uuid.UUID, start: date, end: date):
        """Query Shopify orders by order_date range."""
        stmt = (
            select(ShopifyOrder)
            .where(
                and_(
                    ShopifyOrder.client_id == client_id,
                    ShopifyOrder.order_date >= start,
                    ShopifyOrder.order_date <= end,
                )
            )
            .order_by(ShopifyOrder.order_date)
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    @staticmethod
    def _sum_rows(rows, keys: list[str]) -> dict:
        """Sum numeric fields across a list of ORM rows."""
        totals = {}
        for key in keys:
            totals[key] = safe_sum([getattr(r, key, None) for r in rows])
        return totals
