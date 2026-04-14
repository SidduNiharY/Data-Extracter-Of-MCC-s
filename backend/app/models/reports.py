from __future__ import annotations
from typing import Optional
import uuid
from datetime import date, datetime

from sqlalchemy import DateTime, Date, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class Report(Base):
    """Master report record — one per client per period per type.

    report_type: 'weekly' | 'monthly'
    status:      'generating' | 'ready' | 'failed'
    """

    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    report_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # 'weekly' | 'monthly'

    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)

    status: Mapped[str] = mapped_column(String(20), default="generating")
    # 'generating' | 'ready' | 'failed'

    error_message: Mapped[Optional[str]] = mapped_column(Text)
    generated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    client: Mapped["Client"] = relationship("Client")  # noqa: F821
    sections: Mapped[list["ReportSection"]] = relationship(
        back_populates="report", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("client_id", "report_type", "period_start", name="uq_report_client_type_period"),
        Index("idx_reports_client", "client_id"),
        Index("idx_reports_type", "report_type"),
        Index("idx_reports_period", "period_start"),
        Index("idx_reports_status", "status"),
    )


class ReportSection(Base):
    """One section of a report — stores aggregated metrics as JSONB.

    source:       'google_ads' | 'meta_ads' | 'shopify' | 'ga4' | 'cross_platform'
    section_type: 'summary' | 'campaign_breakdown' | 'search_terms' |
                  'keywords' | 'time_segments' | 'demographics' |
                  'leadgen' | 'orders' | 'products' | 'revenue' |
                  'channel_breakdown' | 'device_breakdown' | 'comparison'
    """

    __tablename__ = "report_sections"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reports.id", ondelete="CASCADE"), nullable=False
    )
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    section_type: Mapped[str] = mapped_column(String(40), nullable=False)
    data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    report: Mapped["Report"] = relationship(back_populates="sections")

    __table_args__ = (
        Index("idx_report_sections_report", "report_id"),
        Index("idx_report_sections_source", "source"),
    )
