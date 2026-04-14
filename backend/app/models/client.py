from __future__ import annotations
from typing import Optional
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    # Allowed: google_only | meta_only | google_meta | ecomm_shopify | ecomm_ga4 | leadgen

    google_ads_customer_id: Mapped[Optional[str]] = mapped_column(String(20))
    meta_ad_account_id: Mapped[Optional[str]] = mapped_column(String(50))
    shopify_shop_domain: Mapped[Optional[str]] = mapped_column(String(255))
    ga4_property_id: Mapped[Optional[str]] = mapped_column(String(50))

    currency: Mapped[str] = mapped_column(String(10), default="USD")
    timezone: Mapped[str] = mapped_column(String(50), default="UTC")
    report_settings: Mapped[Optional[dict]] = mapped_column(JSONB, server_default='{}')
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    connections: Mapped[list["ClientConnection"]] = relationship(back_populates="client", cascade="all, delete-orphan")
    pull_jobs: Mapped[list["PullJob"]] = relationship(back_populates="client")

    __table_args__ = (
        Index("idx_clients_type", "type"),
        Index("idx_clients_active", "is_active"),
    )


class ClientConnection(Base):
    __tablename__ = "client_connections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    # Allowed: google_ads | meta_ads | shopify | ga4
    credentials: Mapped[dict] = mapped_column(JSONB, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    client: Mapped["Client"] = relationship(back_populates="connections")

    __table_args__ = (
        UniqueConstraint("client_id", "source", name="uq_connection_client_source"),
        Index("idx_connections_client", "client_id"),
        Index("idx_connections_source", "source"),
    )


class PullJob(Base):
    __tablename__ = "pull_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    # Allowed: pending | running | success | failed | partial
    date_range_start: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    date_range_end: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    rows_pulled: Mapped[Optional[int]] = mapped_column(Integer)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    client: Mapped["Client"] = relationship(back_populates="pull_jobs")

    __table_args__ = (
        Index("idx_pull_jobs_client", "client_id"),
        Index("idx_pull_jobs_status", "status"),
        Index("idx_pull_jobs_source", "source"),
        Index("idx_pull_jobs_created", "created_at"),
    )
