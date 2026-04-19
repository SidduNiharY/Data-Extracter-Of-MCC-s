import asyncio
import uuid
import os
from app.database import async_session
from app.services.pdf_generator import PDFGenerator

async def run():
    async with async_session() as s:
        # Use the latest ready report
        from app.models.reports import Report
        from sqlalchemy import select
        res = await s.execute(select(Report).where(Report.status == "ready").order_by(Report.created_at.desc()).limit(1))
        report = res.scalar_one_or_none()
        if not report:
            print("No ready reports found")
            return
            
        print(f"Generating PDF for report: {report.id}")
        generator = PDFGenerator(s)
        
        pdf_bytes = await generator.generate_report_pdf(report.id)
        
        with open(f"test_report_{report.id}.pdf", "wb") as f:
            f.write(pdf_bytes)
        print(f"PDF saved to test_report_{report.id}.pdf")

if __name__ == "__main__":
    asyncio.run(run())
