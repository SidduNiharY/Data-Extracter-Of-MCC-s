from __future__ import annotations
from typing import Optional
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class GA4Revenue(Base):
    """Overall revenue summary — Ecomm clients with GA4."""
    __tablename__ = "ga4_revenue"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    pull_job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pull_jobs.id"), nullable=False)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    purchase_revenue: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    transactions: Mapped[Optional[int]] = mapped_column(Integer)
    avg_purchase_revenue: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4))
    session_conversion_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4))
    active_users: Mapped[Optional[int]] = mapped_column(Integer)
    sessions: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("client_id", "report_date", name="uq_ga4_rev_unique"),
        Index("idx_ga4_rev_client_date", "client_id", "report_date"),
    )


class GA4ChannelBreakdown(Base):
    """Revenue by channel — Ecomm clients with GA4."""
    __tablename__ = "ga4_channel_breakdown"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    pull_job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pull_jobs.id"), nullable=False)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    channel_group: Mapped[Optional[str]] = mapped_column(String(100))
    revenue: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    sessions: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("client_id", "report_date", "channel_group", name="uq_ga4_ch_unique"),
        Index("idx_ga4_ch_client_date", "client_id", "report_date"),
    )


class GA4DeviceBreakdown(Base):
    """Revenue by device — Ecomm clients with GA4."""
    __tablename__ = "ga4_device_breakdown"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    pull_job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pull_jobs.id"), nullable=False)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    device_category: Mapped[Optional[str]] = mapped_column(String(50))         # desktop | mobile | tablet
    revenue: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    sessions: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("client_id", "report_date", "device_category", name="uq_ga4_dev_unique"),
        Index("idx_ga4_dev_client_date", "client_id", "report_date"),
    )
