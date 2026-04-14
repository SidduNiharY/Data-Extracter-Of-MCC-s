from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import uuid

from app.database import get_db
from app.models.client import PullJob
from app.schemas.client import PullJobRead

router = APIRouter()


class TriggerRequest(BaseModel):
    client_id: Optional[uuid.UUID] = None   # None = all active clients
    source: Optional[str] = None            # None = all sources for this client type


# IMPORTANT: /trigger must be defined BEFORE /{job_id} to avoid path param conflict.
@router.post("/trigger")
async def trigger_pull(req: TriggerRequest, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    """Trigger a data pull manually. Runs in background — returns job IDs immediately."""
    from app.services.extractor import Extractor
    extractor = Extractor(db)

    async def run():
        if req.client_id:
            await extractor.run_for_client(req.client_id, req.source)
        else:
            await extractor.run_for_all_clients()

    background_tasks.add_task(run)
    return {"status": "queued", "client_id": str(req.client_id) if req.client_id else "all"}


@router.get("", response_model=list[PullJobRead])
async def get_recent_jobs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PullJob).order_by(PullJob.created_at.desc()).limit(20))
    return result.scalars().all()


@router.get("/client/{client_id}", response_model=list[PullJobRead])
async def get_client_jobs(client_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PullJob).where(PullJob.client_id == client_id).order_by(PullJob.created_at.desc()))
    return result.scalars().all()


@router.get("/{job_id}", response_model=PullJobRead)
async def get_job(job_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    from fastapi import HTTPException
    result = await db.execute(select(PullJob).where(PullJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
