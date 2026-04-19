from __future__ import annotations
from typing import Optional
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class DashboardThreshold(Base):
    """Global threshold configuration for dashboard metric colorization.

    One row per metric_name. Per-client overrides live in
    clients.report_settings['threshold_overrides'].
    """
    __tablename__ = "dashboard_thresholds"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    metric_name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    red_below: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    green_above: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
