"""Smoke test for DashboardAggregator — run manually."""
import asyncio
from datetime import date, timedelta

from app.database import async_session
from app.services.dashboard_aggregator import DashboardAggregator


async def main():
    async with async_session() as db:
        agg = DashboardAggregator(db)
        today = date.today()
        rows = await agg.aggregate_all(today - timedelta(days=30), today)
        print(f"Got {len(rows)} rows")
        for r in rows[:5]:
            print(f"  {r.client_name}: cost={r.cost} revenue={r.revenue} roas={r.shopify_roas or r.ga4_roas}")


if __name__ == "__main__":
    asyncio.run(main())
