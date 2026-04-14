from __future__ import annotations
from typing import Optional
import json
import logging
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.client import Client, PullJob
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
        job.status = "failed"
        job.error_message = error
        job.completed_at = datetime.now(timezone.utc)
        await self.db.commit()

    # ── Google Ads ──

    async def _pull_google_ads(self, client: Client) -> Optional[uuid.UUID]:
        job = await self._create_pull_job(client.id, "google_ads")
        total_rows = 0

        try:
            connector = GoogleAdsConnector()
            customer_id = client.google_ads_customer_id
            if not customer_id:
                await self._fail_job(job, "No google_ads_customer_id set")
                return job.id

            # 1. Campaign level (all clients)
            campaign_rows = connector.pull_campaign(customer_id)
            for row in campaign_rows:
                self.db.add(GoogleAdsCampaign(client_id=client.id, pull_job_id=job.id, **row))
            total_rows += len(campaign_rows)

            # 2. Search terms (search clients, top 10 by clicks)
            if client.type in SEARCH_TYPES:
                st_rows = connector.pull_search_terms(customer_id)
                for row in st_rows:
                    self.db.add(GoogleAdsSearchTerm(client_id=client.id, pull_job_id=job.id, **row))
                total_rows += len(st_rows)

            # 3. Keywords (search clients, top 10 by impressions)
            if client.type in SEARCH_TYPES:
                kw_rows = connector.pull_keywords(customer_id)
                for row in kw_rows:
                    self.db.add(GoogleAdsKeyword(client_id=client.id, pull_job_id=job.id, **row))
                total_rows += len(kw_rows)

            # 4. Time segments (all clients)
            ts_rows = connector.pull_time_segments(customer_id)
            for row in ts_rows:
                self.db.add(GoogleAdsTimeSegment(client_id=client.id, pull_job_id=job.id, **row))
            total_rows += len(ts_rows)

            # 5. Demographics (display/youtube only)
            if client.type in DISPLAY_TYPES:
                demo_rows = connector.pull_demographics(customer_id)
                for row in demo_rows:
                    self.db.add(GoogleAdsDemographic(client_id=client.id, pull_job_id=job.id, **row))
                total_rows += len(demo_rows)

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
            if not settings.META_ACCESS_TOKEN or not client.meta_ad_account_id:
                await self._fail_job(job, "Missing META_ACCESS_TOKEN in env or meta_ad_account_id on client")
                return job.id

            connector = MetaAdsConnector(
                access_token=settings.META_ACCESS_TOKEN,
                ad_account_id=client.meta_ad_account_id,
            )

            # 1. Campaign level
            camp_rows = connector.pull_campaign(client.type)
            for row in camp_rows:
                self.db.add(MetaCampaign(client_id=client.id, pull_job_id=job.id, **row))
            total_rows += len(camp_rows)

            # 2. Lead gen (leadgen clients only)
            if client.type == "leadgen":
                lg_rows = connector.pull_leadgen()
                for row in lg_rows:
                    self.db.add(MetaLeadgen(client_id=client.id, pull_job_id=job.id, **row))
                total_rows += len(lg_rows)

            # 3. Time segments
            ts_rows = connector.pull_time_segments()
            for row in ts_rows:
                self.db.add(MetaTimeSegment(client_id=client.id, pull_job_id=job.id, **row))
            total_rows += len(ts_rows)

            # 4. Demographics
            demo_rows = connector.pull_demographics()
            for row in demo_rows:
                self.db.add(MetaDemographic(client_id=client.id, pull_job_id=job.id, **row))
            total_rows += len(demo_rows)

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
            if not settings.SHOPIFY_ACCESS_TOKEN or not client.shopify_shop_domain:
                await self._fail_job(job, "Missing SHOPIFY_ACCESS_TOKEN in env or shopify_shop_domain on client")
                return job.id

            connector = ShopifyConnector(
                shop_domain=client.shopify_shop_domain,
                access_token=settings.SHOPIFY_ACCESS_TOKEN,
            )

            # 1. Fetch raw orders once — avoids a second Shopify API call for product aggregation
            raw_orders = connector.pull_raw_orders()
            order_rows = [ShopifyConnector._format_order(o) for o in raw_orders]
            for row in order_rows:
                self.db.add(ShopifyOrder(client_id=client.id, pull_job_id=job.id, **row))
            total_rows += len(order_rows)

            # 2. Products (aggregated from already-fetched raw orders)
            product_rows = connector.aggregate_products(orders_raw=raw_orders)
            for row in product_rows:
                self.db.add(ShopifyProduct(client_id=client.id, pull_job_id=job.id, **row))
            total_rows += len(product_rows)

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
            if not settings.GA4_SERVICE_ACCOUNT_JSON or not client.ga4_property_id:
                await self._fail_job(job, "Missing GA4_SERVICE_ACCOUNT_JSON in env or ga4_property_id on client")
                return job.id

            try:
                sa_info = json.loads(settings.GA4_SERVICE_ACCOUNT_JSON)
            except json.JSONDecodeError as exc:
                await self._fail_job(job, f"GA4_SERVICE_ACCOUNT_JSON is not valid JSON: {exc}")
                return job.id

            connector = GA4Connector(
                property_id=client.ga4_property_id,
                service_account_info=sa_info,
            )

            # 1. Revenue report
            rev_rows = connector.pull_revenue_report()
            for row in rev_rows:
                self.db.add(GA4Revenue(client_id=client.id, pull_job_id=job.id, **row))
            total_rows += len(rev_rows)

            # 2. Channel breakdown
            ch_rows = connector.pull_channel_breakdown()
            for row in ch_rows:
                self.db.add(GA4ChannelBreakdown(client_id=client.id, pull_job_id=job.id, **row))
            total_rows += len(ch_rows)

            # 3. Device breakdown
            dev_rows = connector.pull_device_breakdown()
            for row in dev_rows:
                self.db.add(GA4DeviceBreakdown(client_id=client.id, pull_job_id=job.id, **row))
            total_rows += len(dev_rows)

            await self._complete_job(job, total_rows)
            logger.info(f"GA4 pull complete for {client.name}: {total_rows} rows")

        except Exception as e:
            logger.error(f"GA4 pull failed for {client.name}: {e}")
            await self._fail_job(job, str(e))

        return job.id
