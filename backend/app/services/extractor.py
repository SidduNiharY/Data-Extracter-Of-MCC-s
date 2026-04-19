from __future__ import annotations
from typing import Optional
import json
import logging
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.client import Client, ClientConnection, PullJob
from app.models.google_ads import (
    GoogleAdsCampaign,
    GoogleAdsDemographic,
    GoogleAdsKeyword,
    GoogleAdsSearchTerm,
    GoogleAdsTimeSegment,
)
from app.models.meta_ads import MetaCampaign, MetaDemographic, MetaLeadgen, MetaTimeSegment
from app.models.shopify import ShopifyOrder, ShopifyProduct
from app.models.ga4 import GA4ChannelBreakdown, GA4DeviceBreakdown, GA4Revenue

from app.connectors.google_ads import GoogleAdsConnector
from app.connectors.meta_ads import MetaAdsConnector
from app.connectors.shopify import ShopifyConnector
from app.connectors.google_analytics import GA4Connector

logger = logging.getLogger(__name__)

# Client types that use each source
GOOGLE_ADS_TYPES = {"google_only", "google_meta", "ecomm_shopify", "ecomm_ga4", "leadgen"}
META_ADS_TYPES = {"meta_only", "google_meta", "ecomm_shopify", "ecomm_ga4", "leadgen"}
SHOPIFY_TYPES = {"ecomm_shopify"}
GA4_TYPES = {"ecomm_ga4"}

# Client types with search campaign data
SEARCH_TYPES = {"google_only", "google_meta", "ecomm_shopify", "ecomm_ga4", "leadgen"}
DISPLAY_TYPES = {"google_only", "google_meta", "ecomm_shopify", "ecomm_ga4"}


class Extractor:
    """Orchestrator — routes each client to the correct connectors based on type."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def run_for_client(self, client_id: uuid.UUID, source: Optional[str] = None) -> list[uuid.UUID]:
        """Run data pull for a specific client. Returns list of pull job IDs."""
        result = await self.db.execute(select(Client).where(Client.id == client_id))
        client = result.scalar_one_or_none()
        if not client:
            raise ValueError(f"Client {client_id} not found")

        job_ids = []

        if (source is None or source == "google_ads") and client.type in GOOGLE_ADS_TYPES:
            job_id = await self._pull_google_ads(client)
            if job_id:
                job_ids.append(job_id)

        if (source is None or source == "meta_ads") and client.type in META_ADS_TYPES:
            job_id = await self._pull_meta_ads(client)
            if job_id:
                job_ids.append(job_id)

        if (source is None or source == "shopify") and client.type in SHOPIFY_TYPES:
            job_id = await self._pull_shopify(client)
            if job_id:
                job_ids.append(job_id)

        if (source is None or source == "ga4") and client.type in GA4_TYPES:
            job_id = await self._pull_ga4(client)
            if job_id:
                job_ids.append(job_id)

        return job_ids

    async def run_for_all_clients(self) -> list[uuid.UUID]:
        """Run data pull for ALL active clients. Returns all pull job IDs."""
        result = await self.db.execute(select(Client).where(Client.is_active == True))
        clients = result.scalars().all()
        all_job_ids = []
        for client in clients:
            try:
                job_ids = await self.run_for_client(client.id)
                all_job_ids.extend(job_ids)
            except Exception as e:
                logger.error(f"Failed pull for client {client.name}: {e}")
        return all_job_ids

    async def _get_connection_credentials(self, client_id: uuid.UUID, source: str) -> dict:
        """Look up per-client credentials stored in ClientConnection. Returns {} when none."""
        result = await self.db.execute(
            select(ClientConnection).where(
                ClientConnection.client_id == client_id,
                ClientConnection.source == source,
                ClientConnection.is_active == True,  # noqa: E712
            )
        )
        conn = result.scalar_one_or_none()
        return conn.credentials if conn and conn.credentials else {}

    async def _create_pull_job(self, client_id: uuid.UUID, source: str) -> PullJob:
        today = date.today()
        job = PullJob(
            client_id=client_id,
            source=source,
            status="running",
            date_range_start=today - timedelta(days=7),
            date_range_end=today,
            started_at=datetime.now(timezone.utc),
        )
        self.db.add(job)
        await self.db.flush()
        return job

    async def _complete_job(self, job: PullJob, rows: int):
        job.status = "success"
        job.rows_pulled = rows
        job.completed_at = datetime.now(timezone.utc)
        await self.db.commit()

    async def _fail_job(self, job: PullJob, error: str):
        # Rollback any staged deletes/inserts so stale data is NOT lost on API failure
        await self.db.rollback()
        # Re-create the job record (rollback cleared the flushed job row)
        fresh_job = PullJob(
            client_id=job.client_id,
            source=job.source,
            status="failed",
            date_range_start=job.date_range_start,
            date_range_end=job.date_range_end,
            error_message=error,
            started_at=job.started_at,
            completed_at=datetime.now(timezone.utc),
        )
        self.db.add(fresh_job)
        await self.db.commit()

    # ── Google Ads ──

    async def _pull_google_ads(self, client: Client) -> Optional[uuid.UUID]:
        job = await self._create_pull_job(client.id, "google_ads")

        try:
            connector = GoogleAdsConnector()
            customer_id = client.google_ads_customer_id
            if not customer_id:
                await self._fail_job(job, "No google_ads_customer_id set")
                return job.id

            # ── Step 1: fetch ALL data from API before touching the DB ──
            campaign_rows = connector.pull_campaign(customer_id)
            st_rows    = connector.pull_search_terms(customer_id) if client.type in SEARCH_TYPES  else []
            kw_rows    = connector.pull_keywords(customer_id)     if client.type in SEARCH_TYPES  else []
            ts_rows    = connector.pull_time_segments(customer_id)
            demo_rows  = connector.pull_demographics(customer_id) if client.type in DISPLAY_TYPES else []

            # ── Step 2: clear stale rows for this client's date range ──
            today      = date.today()
            start_date = today - timedelta(days=7)
            await self.db.execute(sa_delete(GoogleAdsCampaign).where(
                GoogleAdsCampaign.client_id == client.id,
                GoogleAdsCampaign.report_date >= start_date))
            await self.db.execute(sa_delete(GoogleAdsSearchTerm).where(
                GoogleAdsSearchTerm.client_id == client.id,
                GoogleAdsSearchTerm.report_date >= start_date))
            await self.db.execute(sa_delete(GoogleAdsKeyword).where(
                GoogleAdsKeyword.client_id == client.id,
                GoogleAdsKeyword.report_date >= start_date))
            await self.db.execute(sa_delete(GoogleAdsTimeSegment).where(
                GoogleAdsTimeSegment.client_id == client.id,
                GoogleAdsTimeSegment.report_date >= start_date))
            await self.db.execute(sa_delete(GoogleAdsDemographic).where(
                GoogleAdsDemographic.client_id == client.id,
                GoogleAdsDemographic.report_date >= start_date))

            # ── Step 3: insert fresh rows ──
            for row in campaign_rows:
                self.db.add(GoogleAdsCampaign(client_id=client.id, pull_job_id=job.id, **row))
            for row in st_rows:
                self.db.add(GoogleAdsSearchTerm(client_id=client.id, pull_job_id=job.id, **row))
            for row in kw_rows:
                self.db.add(GoogleAdsKeyword(client_id=client.id, pull_job_id=job.id, **row))
            for row in ts_rows:
                self.db.add(GoogleAdsTimeSegment(client_id=client.id, pull_job_id=job.id, **row))
            for row in demo_rows:
                self.db.add(GoogleAdsDemographic(client_id=client.id, pull_job_id=job.id, **row))

            total_rows = len(campaign_rows) + len(st_rows) + len(kw_rows) + len(ts_rows) + len(demo_rows)
            await self._complete_job(job, total_rows)
            logger.info(f"Google Ads pull complete for {client.name}: {total_rows} rows")

        except Exception as e:
            logger.error(f"Google Ads pull failed for {client.name}: {e}")
            await self._fail_job(job, str(e))

        return job.id

    # ── Meta Ads ──

    async def _pull_meta_ads(self, client: Client) -> Optional[uuid.UUID]:
        job = await self._create_pull_job(client.id, "meta_ads")
        total_rows = 0

        try:
            # Prefer per-client connection credentials, fall back to global env token
            creds = await self._get_connection_credentials(client.id, "meta_ads")
            access_token = creds.get("access_token") or settings.META_ACCESS_TOKEN
            ad_account_id = creds.get("ad_account_id") or client.meta_ad_account_id

            if not access_token or not ad_account_id:
                await self._fail_job(
                    job,
                    "Missing Meta access token (set per-client connection or META_ACCESS_TOKEN env) "
                    "or meta_ad_account_id on client",
                )
                return job.id

            connector = MetaAdsConnector(
                access_token=access_token,
                ad_account_id=ad_account_id,
            )

            # ── Step 1: fetch ALL data from API before touching the DB ──
            camp_rows = connector.pull_campaign(client.type)
            lg_rows   = connector.pull_leadgen()   if client.type == "leadgen" else []
            ts_rows   = connector.pull_time_segments()
            demo_rows = connector.pull_demographics()

            # ── Step 2: clear stale rows for this client's date range ──
            today      = date.today()
            start_date = today - timedelta(days=7)
            await self.db.execute(sa_delete(MetaCampaign).where(
                MetaCampaign.client_id == client.id,
                MetaCampaign.report_date >= start_date))
            await self.db.execute(sa_delete(MetaLeadgen).where(
                MetaLeadgen.client_id == client.id,
                MetaLeadgen.report_date >= start_date))
            await self.db.execute(sa_delete(MetaTimeSegment).where(
                MetaTimeSegment.client_id == client.id,
                MetaTimeSegment.report_date >= start_date))
            await self.db.execute(sa_delete(MetaDemographic).where(
                MetaDemographic.client_id == client.id,
                MetaDemographic.report_date >= start_date))

            # ── Step 3: insert fresh rows ──
            for row in camp_rows:
                self.db.add(MetaCampaign(client_id=client.id, pull_job_id=job.id, **row))
            for row in lg_rows:
                self.db.add(MetaLeadgen(client_id=client.id, pull_job_id=job.id, **row))
            for row in ts_rows:
                self.db.add(MetaTimeSegment(client_id=client.id, pull_job_id=job.id, **row))
            for row in demo_rows:
                self.db.add(MetaDemographic(client_id=client.id, pull_job_id=job.id, **row))

            total_rows = len(camp_rows) + len(lg_rows) + len(ts_rows) + len(demo_rows)
            await self._complete_job(job, total_rows)
            logger.info(f"Meta Ads pull complete for {client.name}: {total_rows} rows")

        except Exception as e:
            logger.error(f"Meta Ads pull failed for {client.name}: {e}")
            await self._fail_job(job, str(e))

        return job.id

    # ── Shopify ──

    async def _pull_shopify(self, client: Client) -> Optional[uuid.UUID]:
        job = await self._create_pull_job(client.id, "shopify")
        total_rows = 0

        try:
            # Prefer per-client connection credentials, fall back to global env token
            creds = await self._get_connection_credentials(client.id, "shopify")
            access_token = creds.get("access_token") or settings.SHOPIFY_ACCESS_TOKEN
            shop_domain = creds.get("shop_domain") or client.shopify_shop_domain

            if not access_token or not shop_domain:
                await self._fail_job(
                    job,
                    "Missing Shopify access token (set per-client connection or SHOPIFY_ACCESS_TOKEN env) "
                    "or shopify_shop_domain on client",
                )
                return job.id

            connector = ShopifyConnector(
                shop_domain=shop_domain,
                access_token=access_token,
            )

            # ── Step 1: fetch ALL data from API before touching the DB ──
            raw_orders   = connector.pull_raw_orders()
            order_rows   = [ShopifyConnector._format_order(o) for o in raw_orders]
            product_rows = connector.aggregate_products(orders_raw=raw_orders)

            # ── Step 2: clear stale rows for this client's date range ──
            today      = date.today()
            start_date = today - timedelta(days=7)
            await self.db.execute(sa_delete(ShopifyOrder).where(
                ShopifyOrder.client_id == client.id,
                ShopifyOrder.order_date >= start_date))
            await self.db.execute(sa_delete(ShopifyProduct).where(
                ShopifyProduct.client_id == client.id,
                ShopifyProduct.report_date >= start_date))

            # ── Step 3: insert fresh rows ──
            for row in order_rows:
                self.db.add(ShopifyOrder(client_id=client.id, pull_job_id=job.id, **row))
            for row in product_rows:
                self.db.add(ShopifyProduct(client_id=client.id, pull_job_id=job.id, **row))

            total_rows = len(order_rows) + len(product_rows)
            await self._complete_job(job, total_rows)
            logger.info(f"Shopify pull complete for {client.name}: {total_rows} rows")

        except Exception as e:
            logger.error(f"Shopify pull failed for {client.name}: {e}")
            await self._fail_job(job, str(e))

        return job.id

    # ── GA4 ──

    async def _pull_ga4(self, client: Client) -> Optional[uuid.UUID]:
        job = await self._create_pull_job(client.id, "ga4")
        total_rows = 0

        try:
            # Prefer per-client connection credentials, fall back to global env service account
            creds = await self._get_connection_credentials(client.id, "ga4")
            sa_raw = creds.get("service_account_json") or settings.GA4_SERVICE_ACCOUNT_JSON
            property_id = creds.get("property_id") or client.ga4_property_id

            if not sa_raw or not property_id:
                await self._fail_job(
                    job,
                    "Missing GA4 service account (set per-client connection or "
                    "GA4_SERVICE_ACCOUNT_JSON env) or ga4_property_id on client",
                )
                return job.id

            try:
                sa_info = sa_raw if isinstance(sa_raw, dict) else json.loads(sa_raw)
            except json.JSONDecodeError as exc:
                await self._fail_job(job, f"GA4 service account is not valid JSON: {exc}")
                return job.id

            connector = GA4Connector(
                property_id=property_id,
                service_account_info=sa_info,
            )

            # ── Step 1: fetch ALL data from API before touching the DB ──
            rev_rows = connector.pull_revenue_report()
            ch_rows  = connector.pull_channel_breakdown()
            dev_rows = connector.pull_device_breakdown()

            # ── Step 2: clear stale rows for this client's date range ──
            today      = date.today()
            start_date = today - timedelta(days=7)
            await self.db.execute(sa_delete(GA4Revenue).where(
                GA4Revenue.client_id == client.id,
                GA4Revenue.report_date >= start_date))
            await self.db.execute(sa_delete(GA4ChannelBreakdown).where(
                GA4ChannelBreakdown.client_id == client.id,
                GA4ChannelBreakdown.report_date >= start_date))
            await self.db.execute(sa_delete(GA4DeviceBreakdown).where(
                GA4DeviceBreakdown.client_id == client.id,
                GA4DeviceBreakdown.report_date >= start_date))

            # ── Step 3: insert fresh rows ──
            for row in rev_rows:
                self.db.add(GA4Revenue(client_id=client.id, pull_job_id=job.id, **row))
            for row in ch_rows:
                self.db.add(GA4ChannelBreakdown(client_id=client.id, pull_job_id=job.id, **row))
            for row in dev_rows:
                self.db.add(GA4DeviceBreakdown(client_id=client.id, pull_job_id=job.id, **row))

            total_rows = len(rev_rows) + len(ch_rows) + len(dev_rows)
            await self._complete_job(job, total_rows)
            logger.info(f"GA4 pull complete for {client.name}: {total_rows} rows")

        except Exception as e:
            logger.error(f"GA4 pull failed for {client.name}: {e}")
            await self._fail_job(job, str(e))

        return job.id
