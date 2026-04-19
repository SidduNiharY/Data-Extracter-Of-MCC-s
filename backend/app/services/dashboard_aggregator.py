from __future__ import annotations
import asyncio
from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client, ClientConnection
from app.models.google_ads import GoogleAdsCampaign
from app.models.shopify import ShopifyOrder
from app.models.ga4 import GA4Revenue
from app.schemas.dashboard import DashboardRow


class DashboardAggregator:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def aggregate_for_client(
        self,
        client: Client,
        connected_sources: list[str],
        date_from: date,
        date_to: date,
    ) -> DashboardRow:
        """Build a single DashboardRow for one client by querying each source."""
        gads_task = self._query_google_ads(client.id, date_from, date_to)
        shopify_task = self._query_shopify(client.id, date_from, date_to)
        ga4_task = self._query_ga4(client.id, date_from, date_to)

        gads, shopify, ga4 = await asyncio.gather(gads_task, shopify_task, ga4_task)

        # Cross-platform derived
        cost = gads["cost"]
        shopify_revenue = shopify["revenue"]
        ga4_revenue = ga4["revenue"]
        revenue = shopify_revenue if shopify_revenue is not None else ga4_revenue

        shopify_orders = shopify["orders"]
        ga4_orders = ga4["orders"]
        # Prefer shopify order count; fallback to ga4 transactions
        orders = shopify_orders if shopify_orders is not None else ga4_orders

        rc_ratio = (revenue / cost) if (revenue is not None and cost and cost > 0) else None
        shopify_roas = (shopify_revenue / cost) if (shopify_revenue is not None and cost and cost > 0) else None
        ga4_roas = (ga4_revenue / cost) if (ga4_revenue is not None and cost and cost > 0) else None

        return DashboardRow(
            client_id=client.id,
            client_name=client.name,
            priority=client.priority,
            connected_sources=connected_sources,
            impressions=gads["impressions"],
            clicks=gads["clicks"],
            cost=_f(cost),
            cpc=_f(gads["cpc"]),
            orders=orders,
            revenue=_f(revenue),
            rc_ratio=_f(rc_ratio),
            shopify_orders=shopify_orders,
            shopify_revenue=_f(shopify_revenue),
            shopify_roas=_f(shopify_roas),
            ga4_orders=ga4_orders,
            ga4_revenue=_f(ga4_revenue),
            ga4_roas=_f(ga4_roas),
        )

    async def _query_google_ads(self, client_id: UUID, date_from: date, date_to: date) -> dict:
        stmt = select(
            sa_func.coalesce(sa_func.sum(GoogleAdsCampaign.impressions), 0).label("impressions"),
            sa_func.coalesce(sa_func.sum(GoogleAdsCampaign.clicks), 0).label("clicks"),
            sa_func.coalesce(sa_func.sum(GoogleAdsCampaign.spend), 0).label("cost"),
        ).where(
            GoogleAdsCampaign.client_id == client_id,
            GoogleAdsCampaign.report_date >= date_from,
            GoogleAdsCampaign.report_date <= date_to,
        )
        result = await self.db.execute(stmt)
        row = result.one()
        impressions = int(row.impressions) if row.impressions else None
        clicks = int(row.clicks) if row.clicks else None
        cost = Decimal(row.cost) if row.cost else None
        cpc = (cost / clicks) if (cost is not None and clicks and clicks > 0) else None
        if not impressions and not clicks and not cost:
            return {"impressions": None, "clicks": None, "cost": None, "cpc": None}
        return {"impressions": impressions, "clicks": clicks, "cost": cost, "cpc": cpc}

    async def _query_shopify(self, client_id: UUID, date_from: date, date_to: date) -> dict:
        stmt = select(
            sa_func.count(ShopifyOrder.id).label("orders"),
            sa_func.coalesce(sa_func.sum(ShopifyOrder.total_price), 0).label("revenue"),
        ).where(
            ShopifyOrder.client_id == client_id,
            ShopifyOrder.order_date >= date_from,
            ShopifyOrder.order_date <= date_to,
        )
        result = await self.db.execute(stmt)
        row = result.one()
        orders = int(row.orders) if row.orders else None
        revenue = Decimal(row.revenue) if row.revenue else None
        if not orders and not revenue:
            return {"orders": None, "revenue": None}
        return {"orders": orders, "revenue": revenue}

    async def _query_ga4(self, client_id: UUID, date_from: date, date_to: date) -> dict:
        stmt = select(
            sa_func.coalesce(sa_func.sum(GA4Revenue.transactions), 0).label("orders"),
            sa_func.coalesce(sa_func.sum(GA4Revenue.purchase_revenue), 0).label("revenue"),
        ).where(
            GA4Revenue.client_id == client_id,
            GA4Revenue.report_date >= date_from,
            GA4Revenue.report_date <= date_to,
        )
        result = await self.db.execute(stmt)
        row = result.one()
        orders = int(row.orders) if row.orders else None
        revenue = Decimal(row.revenue) if row.revenue else None
        if not orders and not revenue:
            return {"orders": None, "revenue": None}
        return {"orders": orders, "revenue": revenue}

    async def aggregate_all(
        self,
        date_from: date,
        date_to: date,
        client_ids: Optional[list[UUID]] = None,
    ) -> list[DashboardRow]:
        """Fetch all active clients and build one row per client."""
        stmt = select(Client).where(Client.is_active == True)
        if client_ids:
            stmt = stmt.where(Client.id.in_(client_ids))
        result = await self.db.execute(stmt)
        clients = result.scalars().all()

        conn_stmt = select(ClientConnection).where(
            ClientConnection.is_active == True,
            ClientConnection.client_id.in_([c.id for c in clients] or [None]),
        )
        conn_result = await self.db.execute(conn_stmt)
        connections = conn_result.scalars().all()
        conns_by_client: dict[UUID, list[str]] = {}
        for conn in connections:
            conns_by_client.setdefault(conn.client_id, []).append(conn.source)

        rows: list[DashboardRow] = []
        for client in clients:
            row = await self.aggregate_for_client(
                client,
                conns_by_client.get(client.id, []),
                date_from,
                date_to,
            )
            rows.append(row)
        return rows


def _f(v) -> Optional[float]:
    """Convert Decimal/int to float, preserve None."""
    return float(v) if v is not None else None
