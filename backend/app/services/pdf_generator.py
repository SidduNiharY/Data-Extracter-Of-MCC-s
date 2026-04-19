import os
import uuid
import logging
import asyncio
from datetime import datetime
from jinja2 import Environment, FileSystemLoader
from playwright.async_api import async_playwright
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.reports import Report, ReportSection
from app.models.client import Client

logger = logging.getLogger(__name__)

class PDFGenerator:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.template_dir = os.path.join(os.path.dirname(__file__), "..", "templates")
        self.env = Environment(loader=FileSystemLoader(self.template_dir))

    async def generate_report_pdf(self, report_id: uuid.UUID) -> bytes:
        """Fetch report data, render HTML, and convert to PDF using Playwright."""
        # 1. Fetch Report and Client
        stmt = select(Report).where(Report.id == report_id)
        result = await self.db.execute(stmt)
        report = result.scalar_one_or_none()
        if not report:
            raise ValueError(f"Report {report_id} not found")

        stmt_client = select(Client).where(Client.id == report.client_id)
        result_client = await self.db.execute(stmt_client)
        client = result_client.scalar_one_or_none()
        
        # 2. Fetch Sections
        stmt_sections = select(ReportSection).where(ReportSection.report_id == report_id)
        result_sections = await self.db.execute(stmt_sections)
        sections = result_sections.scalars().all()

        # 3. Map Data to Template Context
        context = self._map_data_to_context(report, client, sections)

        # 4. Render HTML
        template = self.env.get_template("report_pdf.html")
        html_content = template.render(**context)

        # 5. Convert to PDF via Playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            # Set content and wait for network idle to ensure Chart.js scripts load
            await page.set_content(html_content, wait_until="networkidle")
            
            # Wait a bit more for Chart.js animations/rendering
            await asyncio.sleep(1)
            
            pdf_bytes = await page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "0px", "bottom": "0px", "left": "0px", "right": "0px"}
            )
            await browser.close()
            return pdf_bytes

    def _map_data_to_context(self, report: Report, client: Client, sections: list[ReportSection]) -> dict:
        """Transform database records into a clean dict for the Jinja2 template."""

        # 1. Extraction of summaries from each platform
        cross_sum_sec = next((s for s in sections if s.source == "cross_platform" and s.section_type == "summary"), None)
        gads_sum_sec = next((s for s in sections if s.source == "google_ads" and s.section_type == "summary"), None)
        meta_sum_sec = next((s for s in sections if s.source == "meta_ads" and s.section_type == "summary"), None)
        shop_sum_sec = next((s for s in sections if s.source == "shopify" and s.section_type == "summary"), None)
        ga4_sum_sec = next((s for s in sections if s.source == "ga4" and s.section_type == "summary"), None)

        # We need the inner 'summary' dict
        cross_data = cross_sum_sec.data if cross_sum_sec else {}
        gads_data = gads_sum_sec.data.get("summary", {}) if gads_sum_sec else {}
        meta_data = meta_sum_sec.data.get("summary", {}) if meta_sum_sec else {}
        # Shopify is flat (no inner "summary")
        shop_data = shop_sum_sec.data if shop_sum_sec else {}
        ga4_data = ga4_sum_sec.data if ga4_sum_sec else {}

        # Detect active platforms (drives fallback ordering for KPI sources)
        platforms_active = cross_data.get("platforms_active") or []
        if not platforms_active:
            if gads_data: platforms_active.append("google_ads")
            if meta_data: platforms_active.append("meta_ads")
            if shop_data: platforms_active.append("shopify")
            if ga4_data:  platforms_active.append("ga4")

        # Pick the "primary" ad platform for rate metrics (CTR/CPC).
        # Prefer Google Ads > Meta when both exist.
        if "google_ads" in platforms_active:
            primary_ad_data = gads_data
        elif "meta_ads" in platforms_active:
            primary_ad_data = meta_data
        else:
            primary_ad_data = {}

        # 2. Unified Metric Mapping
        # For totals, we prefer cross_platform.  Falls back to whichever platform has data.
        def get_total_metric(key, default="0"):
            cross_key = f"total_{key}" if key != "roas" else "blended_roas"
            if key == "revenue": cross_key = "total_revenue"

            val = cross_data.get(cross_key)
            if val is None or float(val or 0) == 0:
                # Try each platform summary in priority order
                for src in (gads_data, meta_data, shop_data, ga4_data):
                    if src.get(key) is not None:
                        val = src.get(key)
                        break
            return val if val is not None else default

        def get_rate_metric(key, default="0"):
            # Rates are usually in source-specific summaries
            val = primary_ad_data.get(key)
            if val is None:
                # Fallback to the other ad platform
                fallback = meta_data if primary_ad_data is gads_data else gads_data
                val = fallback.get(key)
            return val if val is not None else default

        growth = (
            primary_ad_data.get("growth")
            or meta_data.get("growth")
            or shop_data.get("growth")
            or ga4_data.get("growth")
            or cross_data.get("growth")
            or {}
        )
        
        # Currency from per-client report_settings → falls back to client.currency → USD
        _rs = (client.report_settings if client and client.report_settings else {}) or {}
        _currency_code = (_rs.get("currency") or (client.currency if client else "USD") or "USD").upper()
        _currency_symbols = {
            "USD": "$", "EUR": "€", "GBP": "£", "INR": "₹", "JPY": "¥",
            "AUD": "A$", "CAD": "C$", "CHF": "CHF ", "CNY": "¥",
        }
        _currency_symbol = _currency_symbols.get(_currency_code, _currency_code + " ")

        # Formatting helpers
        def fmt_curr(val):
            try:
                v = float(val or 0)
                return f"{_currency_symbol}{v:,.2f}"
            except: return f"{_currency_symbol}0.00"

        def fmt_num(val, dec=0):
            try:
                v = float(val or 0)
                return f"{v:,.{dec}f}"
            except: return "0"

        kpis = {
            "spend": fmt_curr(get_total_metric("spend")),
            "conversions": fmt_num(get_total_metric("conversions"), 2),
            "impressions": fmt_num(get_total_metric("impressions")),
            "clicks": fmt_num(get_total_metric("clicks")),
            "roas": fmt_num(get_total_metric("roas"), 2),
            "ctr": fmt_num(get_rate_metric("ctr"), 2),
            "cpc": fmt_curr(get_rate_metric("cpc")),
            "conv_rate": fmt_num(get_rate_metric("conversion_rate"), 2),
            # Shopify-specific
            "total_revenue": fmt_curr(get_total_metric("revenue") or shop_data.get("total_revenue")),
            "total_orders": fmt_num(shop_data.get("total_orders"), 0),
            "avg_order_value": fmt_curr(shop_data.get("avg_order_value")),
            "new_customers": fmt_num(shop_data.get("new_customers"), 0),
            "returning_customers": fmt_num(shop_data.get("returning_customers"), 0),
            "new_customer_pct": fmt_num(shop_data.get("new_customer_pct"), 2),
            # Meta-specific
            "frequency": fmt_num(meta_data.get("frequency"), 2),
            "cpm": fmt_curr(meta_data.get("cpm")),
            "reach": fmt_num(meta_data.get("reach"), 0),
        }

        # 3. Campaign Breakdown
        # Prefer Google Ads, then Meta, then any campaign_breakdown section
        cb_section = (
            next((s for s in sections if s.section_type == "campaign_breakdown" and s.source == "google_ads"), None)
            or next((s for s in sections if s.section_type == "campaign_breakdown" and s.source == "meta_ads"), None)
            or next((s for s in sections if s.section_type == "campaign_breakdown"), None)
        )
        raw_campaigns = cb_section.data.get("campaigns", []) if cb_section else []
        
        # 4. Mix Data (Use raw data before formatting)
        mix = {"Search": 0, "Display": 0, "Shopping": 0, "Video": 0, "Other": 0}
        for c in raw_campaigns:
            name = str(c.get("campaign_name", "")).lower()
            raw_spend = float(c.get("spend", 0) or 0)
            
            if "search" in name: mix["Search"] += raw_spend
            elif "display" in name: mix["Display"] += raw_spend
            elif "shop" in name: mix["Shopping"] += raw_spend
            elif "video" in name or "youtube" in name: mix["Video"] += raw_spend
            else: mix["Other"] += raw_spend
        
        mix_labels = [k for k, v in mix.items() if v > 0]
        mix_values = [v for k, v in mix.items() if v > 0]

        # 5. Formatted Campaign List for UI
        display_campaigns = []
        for c in raw_campaigns:
            display_campaigns.append({
                "campaign_name": c.get("campaign_name"),
                "spend": fmt_curr(c.get("spend")),
                "roas": fmt_num(c.get("roas"), 2),
                "ctr": fmt_num(c.get("ctr"), 2),
                "conversions": fmt_num(c.get("conversions"), 1),
                "impressions": fmt_num(c.get("impressions"), 0),
                "clicks": fmt_num(c.get("clicks"), 0)
            })
        
        # 6. Trend Data — prefer Google Ads day_of_week, fall back to Meta day
        trend_labels = []
        trend_clicks = []
        trend_conversions = []
        ts_section = (
            next((s for s in sections if s.section_type == "time_segments" and s.source == "google_ads"), None)
            or next((s for s in sections if s.section_type == "time_segments" and s.source == "meta_ads"), None)
            or next((s for s in sections if s.section_type == "time_segments"), None)
        )
        if ts_section:
            day_data = ts_section.data.get("day_of_week") or ts_section.data.get("day") or []
            for d in day_data:
                label = str(d.get("segment_value") or d.get("date") or "")
                trend_labels.append(label[:10])
                trend_clicks.append(float(d.get("clicks") or 0))
                trend_conversions.append(float(d.get("conversions") or 0))

        mix_labels = [k for k, v in mix.items() if v > 0]
        mix_values = [v for k, v in mix.items() if v > 0]

        # 7. Insights (Auto-generate if empty) — honour client report_settings targets
        insights = {"positive": [], "negative": []}

        roas_val = float(get_total_metric("roas", 0) or 0)
        target_roas = _rs.get("target_roas")
        if target_roas is not None:
            try:
                tgt = float(target_roas)
                if tgt > 0:
                    if roas_val >= tgt:
                        insights["positive"].append(
                            f"ROAS of {roas_val:.2f}x meets or beats target ({tgt:.2f}x)."
                        )
                    else:
                        insights["negative"].append(
                            f"ROAS of {roas_val:.2f}x is below target ({tgt:.2f}x)."
                        )
            except (TypeError, ValueError):
                pass
        elif roas_val > 4:
            insights["positive"].append(f"Exceptional ROAS performance ({roas_val:.2f}x).")

        target_cpa = _rs.get("target_cpa")
        if target_cpa is not None:
            try:
                tgt_cpa = float(target_cpa)
                spend_v = float(get_total_metric("spend", 0) or 0)
                conv_v = float(get_total_metric("conversions", 0) or 0)
                if conv_v > 0 and tgt_cpa > 0:
                    actual_cpa = spend_v / conv_v
                    if actual_cpa <= tgt_cpa:
                        insights["positive"].append(
                            f"CPA of {fmt_curr(actual_cpa)} is within target ({fmt_curr(tgt_cpa)})."
                        )
                    else:
                        insights["negative"].append(
                            f"CPA of {fmt_curr(actual_cpa)} exceeds target ({fmt_curr(tgt_cpa)})."
                        )
            except (TypeError, ValueError):
                pass

        conv_growth = float(growth.get("conversions_growth", 0) or 0)
        if conv_growth > 0:
            insights["positive"].append(f"Conversions grew by {conv_growth}% this period.")
        else:
            insights["negative"].append(f"Conversions declined by {abs(conv_growth)}% vs previous period.")

        spend_growth = float(growth.get("spend_growth", 0) or 0)
        if spend_growth > 15:
            insights["negative"].append(f"Ad spend increased by {spend_growth}%, outpacing growth.")

        if not insights["positive"]: insights["positive"].append("Campaigns are maintaining baseline performance.")
        if not insights["negative"]: insights["negative"].append("No critical efficiency issues detected.")

        # Best Day Calculation (based on clicks)
        best_day = "Mid-Week"
        if trend_labels and trend_clicks:
            try:
                max_clicks_idx = trend_clicks.index(max(trend_clicks))
                best_day_label = trend_labels[max_clicks_idx]
                from datetime import datetime as dt
                try:
                    best_day = dt.strptime(best_day_label[:10], "%Y-%m-%d").strftime("%A")
                except:
                    best_day = str(best_day_label)
            except:
                pass

        import datetime as dt_mod
        now_str = dt_mod.datetime.now().strftime("%A, %I:%M %p")
        next_report_date = (report.period_end + dt_mod.timedelta(days=7)).strftime("%A, %b %d, %Y") if report.report_type == "weekly" else (report.period_end + dt_mod.timedelta(days=30)).strftime("%A, %b %d, %Y")

        # report_settings was already loaded into _rs / _currency_code above
        res = {
            "client_name": client.name if client else "Unknown Client",
            "client_type": client.type if client else "",
            "currency": _currency_code,
            "currency_symbol": _currency_symbol,
            "target_roas": _rs.get("target_roas"),
            "target_cpa": _rs.get("target_cpa"),
            "platforms_active": platforms_active,
            "report_period": report.period_start.strftime("%B %Y") if report.report_type == "monthly" else f"Week of {report.period_start}",
            "report_period_dates": f"{report.period_start} to {report.period_end}",
            "report_type": report.report_type.capitalize(),
            "summary_text": self._generate_summary(kpis, growth, report.report_type),
            "kpis": kpis,
            "growth": growth,
            "campaigns": display_campaigns[:15],
            "trend_labels": trend_labels,
            "trend_clicks": trend_clicks,
            "trend_conversions": trend_conversions,
            "mix_labels": mix_labels,
            "mix_values": mix_values,
            "insights": insights,
            "generated_date_str": now_str,
            "next_report_date": next_report_date,
            "best_day": best_day,
        }
        return res

    def _generate_summary(self, kpis: dict, growth: dict, rtype: str) -> str:
        period = "month" if rtype == "monthly" else "week"
        comp = "MoM" if rtype == "monthly" else "WoW"
        
        roas = kpis["roas"]
        conv_growth = growth.get("conversions_growth", "0")
        spend_val = kpis["spend"]
        
        summary = f"This {period}, your account successfully generated a ROAS of {roas}x on a total ad spend of {spend_val}. "
        if float(conv_growth) >= 0:
            summary += f"We observed a significant conversion lift of {conv_growth}% {comp}, reflecting strong channel efficiency. "
        else:
            summary += f"While conversions saw a {abs(float(conv_growth))}% dip {comp}, high-value campaign optimization is priority. "
            
        summary += "Overall, the account remains healthy with stable engagement rates across core search and discovery placements."
        return summary
