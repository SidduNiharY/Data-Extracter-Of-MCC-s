from __future__ import annotations
from typing import Optional
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class ShopifyOrderRow(BaseModel):
    id: UUID
    client_id: UUID
    shopify_order_id: str
    order_date: date
    total_price: Optional[Decimal]
    customer_orders_count: Optional[int]
    is_new_customer: Optional[bool]
    created_at: datetime

    model_config = {"from_attributes": True}


class ShopifyProductRow(BaseModel):
    id: UUID
    client_id: UUID
    report_date: date
    product_title: Optional[str]
    total_quantity: Optional[int]
    total_revenue: Optional[Decimal]
    created_at: datetime

    model_config = {"from_attributes": True}


class ShopifyOrderSummary(BaseModel):
    total_orders: int
    total_revenue: Decimal
    avg_order_value: Decimal
    new_customers: int
    returning_customers: int
