from __future__ import annotations
from typing import Optional
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Index, Numeric, SmallInteger, String, Text, UniqueConstraint, VARCHAR
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class GoogleAdsCampaign(Base):
    """Campaign-level metrics — pulled for ALL clients with Google Ads."""
    __tablename__ = "google_ads_campaign"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    pull_job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pull_jobs.id"), nullable=False)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    campaign_id: Mapped[Optional[str]] = mapped_column(String(50))
    campaign_name: Mapped[Optional[str]] = mapped_column(String(255))
    impressions: Mapped[Optional[int]] = mapped_column(BigInteger)
    clicks: Mapped[Optional[int]] = mapped_column(BigInteger)
    spend: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))           # cost_micros / 1_000_000
    ctr: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4))
    avg_cpc: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4))         # average_cpc / 1_000_000
    conversions: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    conversion_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4))
    conv_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))      # ecomm only
    cost_per_conv: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4))   # cost_per_conversion / 1_000_000
    roas: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4))            # calculated: conv_value / spend
    impression_share: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("client_id", "campaign_id", "report_date", name="uq_gads_camp_client_campaign_date"),
        Index("idx_gads_camp_client_date", "client_id", "report_date"),
    )


class GoogleAdsSearchTerm(Base):
    """Top 10 search terms by clicks — Search Campaign clients only."""
    __tablename__ = "google_ads_search_terms"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    pull_job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pull_jobs.id"), nullable=False)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    search_term: Mapped[str] = mapped_column(Text, nullable=False)
    impressions: Mapped[Optional[int]] = mapped_column(BigInteger)
    clicks: Mapped[Optional[int]] = mapped_column(BigInteger)
    ctr: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4))
    avg_cpc: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4))
    conversions: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    conv_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))      # ecomm only
    roas: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), comment="Calculated: conv_value / spend. NULL for non-ecomm.")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_gads_st_client_date", "client_id", "report_date"),
    )


class GoogleAdsKeyword(Base):
    """Top 10 keywords by impressions — Search Campaign clients only."""
    __tablename__ = "google_ads_keywords"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    pull_job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pull_jobs.id"), nullable=False)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    keyword_text: Mapped[Optional[str]] = mapped_column(String(500))
    match_type: Mapped[Optional[str]] = mapped_column(String(20))              # BROAD | PHRASE | EXACT
    impressions: Mapped[Optional[int]] = mapped_column(BigInteger)
    clicks: Mapped[Optional[int]] = mapped_column(BigInteger)
    ctr: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4))
    avg_cpc: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4))
    quality_score: Mapped[Optional[int]] = mapped_column(SmallInteger)          # 1–10
    conversions: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_gads_kw_client_date", "client_id", "report_date"),
    )


class GoogleAdsTimeSegment(Base):
    """Day-of-week and hour-of-day metrics — All Google Ads clients."""
    __tablename__ = "google_ads_time_segments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    pull_job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pull_jobs.id"), nullable=False)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    segment_type: Mapped[str] = mapped_column(String(15), nullable=False)    # day_of_week | hour_of_day
    segment_value: Mapped[str] = mapped_column(String(20), nullable=False)   # MONDAY…SUNDAY | 0…23
    impressions: Mapped[Optional[int]] = mapped_column(BigInteger)
    clicks: Mapped[Optional[int]] = mapped_column(BigInteger)
    spend: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    conversions: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("client_id", "report_date", "segment_type", "segment_value", name="uq_gads_ts_unique"),
        Index("idx_gads_ts_client_date", "client_id", "report_date"),
    )


class GoogleAdsDemographic(Base):
    """Gender & Age breakdown — Display / YouTube campaigns only."""
    __tablename__ = "google_ads_demographics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    pull_job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pull_jobs.id"), nullable=False)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    gender: Mapped[Optional[str]] = mapped_column(String(20))                   # FEMALE | MALE | UNKNOWN
    age_range: Mapped[Optional[str]] = mapped_column(String(30))               # AGE_RANGE_18_24 … 65+
    impressions: Mapped[Optional[int]] = mapped_column(BigInteger)
    clicks: Mapped[Optional[int]] = mapped_column(BigInteger)
    spend: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    conversions: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("client_id", "report_date", "gender", "age_range", name="uq_gads_demo_unique"),
        Index("idx_gads_demo_client_date", "client_id", "report_date"),
    )


class GoogleAdsCampaignRaw(Base):
    """
    Raw Google Ads campaign-level data — one row per campaign per day per MCC client.

    Accepts both CSV uploads (from Google Ads UI exports) and future API ingestion.
    Different MCCs are differentiated by client_id — never mix data across clients.

    Source CSV headers (Google Ads UI export):
        Day, Campaign, Impr., Clicks, CTR, Currency code,
        Cost, Avg. CPC, Conversions, Cost / conv.,
        Conv. value / cost, Conv. value, Conv. rate, Avg. order value
    """
    __tablename__ = "google_ads_campaign_raw"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── Client / MCC identity ─────────────────────────────────────────────────
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False,
        comment="Links to the MCC sub-account (Client record). Each MCC has its own rows.",
    )
    pull_job_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pull_jobs.id"), nullable=True,
        comment="NULL for CSV uploads; set when ingested via API pull job.",
    )
    ingestion_source: Mapped[str] = mapped_column(
        VARCHAR(10), nullable=False, server_default="csv",
        comment="'csv' = uploaded via UI export | 'api' = pulled via Google Ads API",
    )

    # ── Identity dimensions ───────────────────────────────────────────────────
    report_date:   Mapped[date]           = mapped_column(Date, nullable=False)
    campaign_name: Mapped[Optional[str]]  = mapped_column(String(255))
    currency:      Mapped[Optional[str]]  = mapped_column(String(10), server_default="AUD")

    # ── Volume metrics ────────────────────────────────────────────────────────
    impressions: Mapped[Optional[int]]     = mapped_column(BigInteger)
    clicks:      Mapped[Optional[int]]     = mapped_column(BigInteger)

    # ── Cost metrics (always stored in actual currency, NOT micros) ───────────
    spend:               Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 4),
        comment="CSV: Cost column (already in currency). API: cost_micros / 1_000_000")
    avg_cpc:             Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4),
        comment="CSV: Avg. CPC. API: average_cpc / 1_000_000")
    cost_per_conversion: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 4),
        comment="CSV: Cost / conv. NULL when conversions = 0.")

    # ── Rate metrics (stored as percentage 0–100, e.g. 10.51 not 0.1051) ─────
    ctr:             Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4),
        comment="CSV: CTR column (strip % sign). Recalculated: clicks/impressions*100")
    conversion_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4),
        comment="CSV: Conv. rate (strip %). Recalculated: conversions/clicks*100")
    impression_share: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4),
        comment="API only. NULL for CSV uploads (not in UI export).")

    # ── Conversion metrics ────────────────────────────────────────────────────
    conversions:      Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    conversion_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 4),
        comment="CSV: Conv. value. NULL for non-ecomm clients.")
    roas:             Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4),
        comment="CSV: Conv. value / cost. Recalculated: conv_value/spend. NULL for non-ecomm.")
    avg_order_value:  Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 4),
        comment="CSV: Avg. order value. NULL when no conversions or non-ecomm.")

    # ── Audit ─────────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(),
                                                  onupdate=func.now())

    __table_args__ = (
        # One row per (MCC client, date, campaign) — prevents duplicates on re-upload
        UniqueConstraint(
            "client_id", "report_date", "campaign_name",
            name="uq_gads_raw_client_date_campaign",
        ),
        Index("idx_gads_raw_client_date",     "client_id", "report_date"),
        Index("idx_gads_raw_client_campaign",  "client_id", "campaign_name"),
    )
