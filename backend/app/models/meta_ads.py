from __future__ import annotations
from typing import Optional
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Index, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class MetaCampaign(Base):
    """Campaign-level metrics — pulled for ALL Meta clients."""
    __tablename__ = "meta_campaign"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    pull_job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pull_jobs.id"), nullable=False)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    campaign_id: Mapped[Optional[str]] = mapped_column(String(50))
    campaign_name: Mapped[Optional[str]] = mapped_column(String(255))
    impressions: Mapped[Optional[int]] = mapped_column(BigInteger)
    clicks: Mapped[Optional[int]] = mapped_column(BigInteger)
    spend: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    ctr: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4))
    cpc: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4))
    reach: Mapped[Optional[int]] = mapped_column(BigInteger)
    frequency: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4))
    cpm: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4))
    cost_per_result: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4))
    conversions: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))     # ecomm only (action_type=purchase)
    conv_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))      # ecomm only
    roas: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4))            # calculated: conv_value / spend
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("client_id", "campaign_id", "report_date", name="uq_meta_camp_unique"),
        Index("idx_meta_camp_client_date", "client_id", "report_date"),
    )


class MetaLeadgen(Base):
    """Lead Gen specific metrics — Lead Gen clients ONLY."""
    __tablename__ = "meta_leadgen"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    pull_job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pull_jobs.id"), nullable=False)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    campaign_id: Mapped[Optional[str]] = mapped_column(String(50))
    campaign_name: Mapped[Optional[str]] = mapped_column(String(255))
    leads: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    cost_per_lead: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4))
    lead_form_opens: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    form_completion_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4))
    link_clicks: Mapped[Optional[int]] = mapped_column(BigInteger)
    landing_page_views: Mapped[Optional[int]] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("client_id", "campaign_id", "report_date", name="uq_meta_lg_unique"),
        Index("idx_meta_lg_client_date", "client_id", "report_date"),
    )


class MetaTimeSegment(Base):
    """Day-of-week and hour-of-day — All Meta clients."""
    __tablename__ = "meta_time_segments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    pull_job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pull_jobs.id"), nullable=False)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    segment_type: Mapped[str] = mapped_column(String(10), nullable=False)    # day | hour
    segment_value: Mapped[str] = mapped_column(String(20), nullable=False)
    impressions: Mapped[Optional[int]] = mapped_column(BigInteger)
    clicks: Mapped[Optional[int]] = mapped_column(BigInteger)
    spend: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("client_id", "report_date", "segment_type", "segment_value", name="uq_meta_ts_unique"),
        Index("idx_meta_ts_client_date", "client_id", "report_date"),
    )


class MetaDemographic(Base):
    """Gender & Age breakdown — ALL Meta campaigns."""
    __tablename__ = "meta_demographics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    pull_job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pull_jobs.id"), nullable=False)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    gender: Mapped[Optional[str]] = mapped_column(String(20))
    age_group: Mapped[Optional[str]] = mapped_column(String(20))
    impressions: Mapped[Optional[int]] = mapped_column(BigInteger)
    clicks: Mapped[Optional[int]] = mapped_column(BigInteger)
    spend: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    conversions: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))     # ecomm only
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("client_id", "report_date", "gender", "age_group", name="uq_meta_demo_unique"),
        Index("idx_meta_demo_client_date", "client_id", "report_date"),
    )
