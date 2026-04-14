from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import uuid

from app.database import get_db
from app.models.ga4 import GA4Revenue

router = APIRouter()

@router.get("/{client_id}/revenue")
async def get_ga4_metrics(client_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            func.sum(GA4Revenue.purchase_revenue).label("revenue"),
            func.sum(GA4Revenue.sessions).label("sessions")
        ).where(GA4Revenue.client_id == client_id)
    )
    row = result.fetchone()
    if row and row.sessions is not None:
        return {
            "revenue": float(row.revenue) if row.revenue else 0.0,
            "sessions": int(row.sessions) if row.sessions else 0,
        }
    return {}
