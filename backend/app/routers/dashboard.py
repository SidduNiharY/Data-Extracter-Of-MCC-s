from __future__ import annotations
import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.dashboard import DashboardThreshold
from app.schemas.dashboard import (
    DashboardRow,
    ThresholdConfig,
    ThresholdConfigUpdate,
)
from app.services.dashboard_aggregator import DashboardAggregator

router = APIRouter()


@router.get("/performance", response_model=list[DashboardRow])
async def get_performance(
    date_from: date = Query(..., description="YYYY-MM-DD inclusive"),
    date_to: date = Query(..., description="YYYY-MM-DD inclusive"),
    client_ids: Optional[str] = Query(None, description="Comma-separated UUIDs"),
    db: AsyncSession = Depends(get_db),
):
    """Aggregate metrics for all active clients in the given date range."""
    if date_from > date_to:
        raise HTTPException(status_code=400, detail="date_from must be <= date_to")

    parsed_ids: Optional[list[uuid.UUID]] = None
    if client_ids:
        try:
            parsed_ids = [uuid.UUID(x.strip()) for x in client_ids.split(",") if x.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid UUID in client_ids")

    agg = DashboardAggregator(db)
    return await agg.aggregate_all(date_from, date_to, parsed_ids)


@router.get("/thresholds", response_model=list[ThresholdConfig])
async def list_thresholds(db: AsyncSession = Depends(get_db)):
    """Return all global threshold rows."""
    result = await db.execute(select(DashboardThreshold).order_by(DashboardThreshold.metric_name))
    return result.scalars().all()


@router.put("/thresholds", response_model=list[ThresholdConfig])
async def save_thresholds(
    payload: ThresholdConfigUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Upsert threshold rows by metric_name. Missing metrics are left untouched."""
    for t in payload.thresholds:
        result = await db.execute(
            select(DashboardThreshold).where(DashboardThreshold.metric_name == t.metric_name)
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.red_below = t.red_below
            existing.green_above = t.green_above
        else:
            db.add(DashboardThreshold(
                metric_name=t.metric_name,
                red_below=t.red_below,
                green_above=t.green_above,
            ))
    await db.commit()
    result = await db.execute(select(DashboardThreshold).order_by(DashboardThreshold.metric_name))
    return result.scalars().all()
