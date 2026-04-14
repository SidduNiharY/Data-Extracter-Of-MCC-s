import asyncio
import uuid
import random
from datetime import datetime
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.client import Client, PullJob
from app.models.google_ads import GoogleAdsCampaign
from app.models.meta_ads import MetaCampaign
from app.models.shopify import ShopifyOrder

async def seed_data():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    print("Starting database seed...")

    async with async_session() as session:
        # Create some clients
        client1 = Client(
            id=uuid.uuid4(),
            name="Acme E-commerce",
            type="ecomm_shopify",
            currency="USD",
            timezone="UTC"
        )
        client2 = Client(
            id=uuid.uuid4(),
            name="Stark Industries",
            type="leadgen",
            currency="USD",
            timezone="UTC"
        )

        session.add_all([client1, client2])
        await session.flush()
        print("Inserted Clients")

        # Create some pull jobs
        job1 = PullJob(
            id=uuid.uuid4(),
            client_id=client1.id,
            source="google_ads",
            status="success",
            date_range_start=datetime.strptime("2026-04-01", "%Y-%m-%d").date(),
            date_range_end=datetime.strptime("2026-04-07", "%Y-%m-%d").date(),
            rows_pulled=150,
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow()
        )
        job2 = PullJob(
            id=uuid.uuid4(),
            client_id=client1.id,
            source="shopify",
            status="running",
            date_range_start=datetime.strptime("2026-04-01", "%Y-%m-%d").date(),
            date_range_end=datetime.strptime("2026-04-07", "%Y-%m-%d").date(),
            started_at=datetime.utcnow()
        )

        session.add_all([job1, job2])
        await session.flush()
        print("Inserted Pull Jobs")

        # Google Ads Campaign Metrics
        g_camp = GoogleAdsCampaign(
            id=uuid.uuid4(),
            client_id=client1.id,
            pull_job_id=job1.id,
            report_date=datetime.strptime("2026-04-07", "%Y-%m-%d").date(),
            campaign_id="1111",
            campaign_name="Search - Brand",
            impressions=12500,
            clicks=450,
            spend=150.00,
            conversions=8.5,
            conv_value=1250.00
        )

        # Meta Campaign Metrics
        m_camp = MetaCampaign(
             id=uuid.uuid4(),
             client_id=client2.id,
             pull_job_id=job1.id, # Mocking sharing job
             report_date=datetime.strptime("2026-04-07", "%Y-%m-%d").date(),
             campaign_id="2222",
             campaign_name="LeadGen FB",
             impressions=45000,
             clicks=1200,
             spend=300.00,
        )

        session.add_all([g_camp, m_camp])
        await session.commit()
        print("Inserted Metrics")

    print("Seed Complete!")

if __name__ == "__main__":
    asyncio.run(seed_data())
