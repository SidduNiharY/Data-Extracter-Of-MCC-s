from __future__ import annotations
from typing import Optional
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class ReportMetric(Base):
    """Pre-computed KPI values extracted from report summary sections.

    One row per report x source x metric_name.
    Enables fast progress/trend queries without re-parsing JSONB.
    """
    __tablename__ = "report_metrics"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reports.id", ondelete="CASCADE"), nullable=False
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    source: Mapped[str] = mapped_column(String(30), nullable=False)
    # 'google_ads' | 'meta_ads' | 'shopify' | 'ga4' | 'cross_platform'

    metric_name: Mapped[str] = mapped_column(String(50), nullable=False)
    # e.g. 'impressions', 'clicks', 'spend', 'conversions', 'roas', 'ctr', etc.

    current_value: Mapped[Optional[float]] = mapped_column(Numeric(18, 4))
    previous_value: Mapped[Optional[float]] = mapped_column(Numeric(18, 4))
    change_pct: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    direction: Mapped[Optional[str]] = mapped_column(String(10))
    # 'up' | 'down' | 'flat'

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    report: Mapped["Report"] = relationship("Report", back_populates="metrics")

    __table_args__ = (
        UniqueConstraint("report_id", "source", "metric_name", name="uq_report_metric"),
        Index("idx_rm_client", "client_id"),
        Index("idx_rm_report", "report_id"),
        Index("idx_rm_source", "source"),
    )
