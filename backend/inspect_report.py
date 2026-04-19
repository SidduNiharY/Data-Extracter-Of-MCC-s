import asyncio
import uuid
import json
from app.database import async_session
from app.models.reports import ReportSection
from sqlalchemy import select

async def run():
    async with async_session() as s:
        rid = uuid.UUID('3708e2a2-461d-4c7e-9aea-5683397504c4')
        res = await s.execute(select(ReportSection).where(ReportSection.report_id == rid))
        sections = res.scalars().all()
        for r in sections:
            print(f"Source: {r.source}, Type: {r.section_type}")
            print(json.dumps(r.data, indent=2))
            print("-" * 40)

if __name__ == "__main__":
    asyncio.run(run())
