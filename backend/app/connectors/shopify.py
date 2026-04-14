from __future__ import annotations
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

import httpx


class ShopifyConnector:
    """Pulls order and product data from Shopify REST Admin API.

    Authentication: X-Shopify-Access-Token header per store.
    Filter: orders created in the last 7 days.
    """

    API_VERSION = "2025-01"

    def __init__(self, shop_domain: str, access_token: str):
        self.base_url = f"https://{shop_domain}/admin/api/{self.API_VERSION}"
        self.headers = {
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json",
        }

    @staticmethod
    def list_partner_stores(partner_id: str, partner_token: str) -> list[dict]:
        """List managed stores via Shopify Partner API (GraphQL)."""
        url = f"https://partners.shopify.com/{partner_id}/api/2023-01/graphql.json"
        headers = {
            "X-Shopify-Access-Token": partner_token,
            "Content-Type": "application/json",
        }
        query = """
        {
          stores(first: 100) {
            edges {
              node {
                id
                name
                shopDomain
                storeType
              }
            }
          }
        }
        """
        try:
            with httpx.Client(headers=headers, timeout=30) as client:
                response = client.post(url, json={"query": query})
                response.raise_for_status()
                data = response.json()
                
                stores = data.get("data", {}).get("stores", {}).get("edges", [])
                results = []
                for edge in stores:
                    node = edge["node"]
                    results.append({
                        "name": node["name"],
                        "customer_id": node["shopDomain"], # Using customer_id for naming consistency
                        "shop_domain": node["shopDomain"],
                        "shopify_id": node["id"],
                    })
                return results
        except Exception as e:
            import logging
            logging.getLogger(__name__).error("Failed to fetch Shopify Partner stores: %s", e)
            return []

    @staticmethod
    def _format_order(order: dict) -> dict:
        """Convert a raw Shopify order JSON to a DB-ready dict."""
        customer = order.get("customer", {}) or {}
        orders_count = customer.get("orders_count", 0)
        return {
            "shopify_order_id": str(order["id"]),
            "order_date": order["created_at"][:10],
            "total_price": Decimal(str(order.get("total_price", "0"))),
            "customer_orders_count": orders_count,
            "is_new_customer": orders_count == 1,
        }

    def pull_orders(self, start_date: date = None, end_date: date = None) -> list[dict]:
        """Pull all orders within the date range with pagination.

        Maps to PDF: Shopify — Revenue & Orders
        Returns individual order records for DB storage.
        """
        return [self._format_order(o) for o in self.pull_raw_orders(start_date, end_date)]

    def aggregate_products(self, orders_raw: list[dict] | None = None, start_date: date = None, end_date: date = None) -> list[dict]:
        """Aggregate line items by product — top products by revenue.

        Maps to PDF: Shopify — Top Products
        Groups by product title, sums quantity * price.
        """
        if orders_raw is None:
            orders_raw = self.pull_raw_orders(start_date, end_date)

        product_data: dict[str, dict] = defaultdict(lambda: {"quantity": 0, "revenue": Decimal("0")})

        for order in orders_raw:
            line_items = order.get("line_items", [])
            for item in line_items:
                title = item.get("title", "Unknown")
                qty = int(item.get("quantity", 0))
                price = Decimal(str(item.get("price", "0")))
                product_data[title]["quantity"] += qty
                product_data[title]["revenue"] += price * qty

        results = []
        for title, data in product_data.items():
            results.append({
                "report_date": str(end_date or date.today()),
                "product_title": title,
                "total_quantity": data["quantity"],
                "total_revenue": data["revenue"],
            })

        # Sort by revenue descending
        results.sort(key=lambda x: x["total_revenue"], reverse=True)
        return results

    def pull_raw_orders(self, start_date: date = None, end_date: date = None) -> list[dict]:
        """Pull raw order JSON (with line_items) for product aggregation."""
        since_date = (start_date or (date.today() - timedelta(days=7))).isoformat()
        all_orders = []
        url = f"{self.base_url}/orders.json"
        until_date = (end_date or date.today()).isoformat() + "T23:59:59"
        params = {
            "status": "any",
            "created_at_min": since_date,
            "created_at_max": until_date,
            "limit": 250,
        }

        with httpx.Client(headers=self.headers, timeout=30) as client:
            while url:
                response = client.get(url, params=params)
                response.raise_for_status()
                data = response.json()
                all_orders.extend(data.get("orders", []))

                link_header = response.headers.get("Link", "")
                url = None
                params = None
                if 'rel="next"' in link_header:
                    for part in link_header.split(","):
                        if 'rel="next"' in part:
                            url = part.split("<")[1].split(">")[0]
                            break

        return all_orders
