import asyncio
import json
from app.database import async_session
from app.models.reports import ReportSection
from sqlalchemy import select

async def run():
    async with async_session() as s:
        res = await s.execute(select(ReportSection).where(ReportSection.source == "google_ads", ReportSection.section_type == "summary").limit(1))
        r = res.scalar_one_or_none()
        if r:
            print(json.dumps(r.data, indent=2))
        else:
            print("No GAds summary found")

if __name__ == "__main__":
    asyncio.run(run())
