from __future__ import annotations
from typing import Optional
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Boolean, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class ShopifyOrder(Base):
    """Individual order records — Ecomm clients with Shopify."""
    __tablename__ = "shopify_orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    pull_job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pull_jobs.id"), nullable=False)
    shopify_order_id: Mapped[str] = mapped_column(String(50), nullable=False)
    order_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    customer_orders_count: Mapped[Optional[int]] = mapped_column(Integer)
    is_new_customer: Mapped[Optional[bool]] = mapped_column(Boolean)           # orders_count = 1 → True
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("client_id", "shopify_order_id", name="uq_shopify_order_unique"),
        Index("idx_shopify_orders_client_date", "client_id", "order_date"),
    )


class ShopifyProduct(Base):
    """Top products aggregated from line_items — Ecomm clients with Shopify."""
    __tablename__ = "shopify_products"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    pull_job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pull_jobs.id"), nullable=False)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    product_title: Mapped[Optional[str]] = mapped_column(String(500))
    total_quantity: Mapped[Optional[int]] = mapped_column(Integer)
    total_revenue: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("client_id", "report_date", "product_title", name="uq_shopify_product_unique"),
        Index("idx_shopify_products_client_date", "client_id", "report_date"),
    )
