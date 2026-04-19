import asyncio
import uuid
import json
from app.database import async_session
from app.models.reports import Report, ReportSection
from sqlalchemy import select

async def run():
    async with async_session() as s:
        res = await s.execute(select(Report).order_by(Report.created_at.desc()).limit(1))
        report = res.scalar_one_or_none()
        if not report:
            print("No reports found")
            return
            
        print(f"Report ID: {report.id}, Client ID: {report.client_id}, Status: {report.status}")
        
        res = await s.execute(select(ReportSection).where(ReportSection.report_id == report.id))
        sections = res.scalars().all()
        for r in sections:
            print(f"Source: {r.source}, Type: {r.section_type}")
            print(json.dumps(r.data, indent=2))
            print("-" * 40)

if __name__ == "__main__":
    asyncio.run(run())
