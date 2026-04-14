from __future__ import annotations
from datetime import date, timedelta
from decimal import Decimal

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange,
    Dimension,
    Metric,
    RunReportRequest,
)
from google.oauth2 import service_account


class GA4Connector:
    """Pulls data from Google Analytics 4 Data API v1beta.

    Authentication: Service Account JSON key per GA4 property.
    Method: runReport
    Date range: last 7 days relative to report date.
    """

    SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"]

    def __init__(self, property_id: str, service_account_info: dict):
        credentials = service_account.Credentials.from_service_account_info(
            service_account_info, scopes=self.SCOPES
        )
        self.client = BetaAnalyticsDataClient(credentials=credentials)
        self.property_id = property_id

    def _get_date_range(self, start_date: date = None, end_date: date = None) -> DateRange:
        if start_date and end_date:
            return DateRange(start_date=str(start_date), end_date=str(end_date))
        end = date.today() - timedelta(days=1)
        start = end - timedelta(days=6)
        return DateRange(start_date=str(start), end_date=str(end))

    def pull_revenue_report(self, start_date: date = None, end_date: date = None) -> list[dict]:
        """Pull overall revenue summary — Ecomm clients with GA4.

        Maps to PDF: Google Analytics 4 — Revenue
        Metrics: purchaseRevenue, transactions, averagePurchaseRevenue,
                 sessionConversionRate, activeUsers, sessions
        """
        request = RunReportRequest(
            property=f"properties/{self.property_id}",
            date_ranges=[self._get_date_range(start_date, end_date)],
            dimensions=[Dimension(name="date")],
            metrics=[
                Metric(name="purchaseRevenue"),
                Metric(name="transactions"),
                Metric(name="averagePurchaseRevenue"),
                Metric(name="sessionConversionRate"),
                Metric(name="activeUsers"),
                Metric(name="sessions"),
            ],
        )

        response = self.client.run_report(request)
        results = []

        for row in response.rows:
            report_date = row.dimension_values[0].value  # YYYYMMDD format
            formatted_date = f"{report_date[:4]}-{report_date[4:6]}-{report_date[6:8]}"

            results.append({
                "report_date": formatted_date,
                "purchase_revenue": Decimal(row.metric_values[0].value) if row.metric_values[0].value else None,
                "transactions": int(row.metric_values[1].value) if row.metric_values[1].value else None,
                "avg_purchase_revenue": Decimal(row.metric_values[2].value) if row.metric_values[2].value else None,
                "session_conversion_rate": Decimal(row.metric_values[3].value) if row.metric_values[3].value else None,
                "active_users": int(row.metric_values[4].value) if row.metric_values[4].value else None,
                "sessions": int(row.metric_values[5].value) if row.metric_values[5].value else None,
            })

        return results

    def pull_channel_breakdown(self, start_date: date = None, end_date: date = None) -> list[dict]:
        """Pull revenue by channel — Ecomm clients with GA4.

        Maps to PDF: Revenue by Channel → dimension: sessionDefaultChannelGroup
        """
        request = RunReportRequest(
            property=f"properties/{self.property_id}",
            date_ranges=[self._get_date_range(start_date, end_date)],
            dimensions=[Dimension(name="sessionDefaultChannelGroup")],
            metrics=[
                Metric(name="purchaseRevenue"),
                Metric(name="sessions"),
            ],
        )

        response = self.client.run_report(request)
        results = []

        for row in response.rows:
            results.append({
                "report_date": str(date.today()),
                "channel_group": row.dimension_values[0].value,
                "revenue": Decimal(row.metric_values[0].value) if row.metric_values[0].value else None,
                "sessions": int(row.metric_values[1].value) if row.metric_values[1].value else None,
            })

        return results

    def pull_device_breakdown(self, start_date: date = None, end_date: date = None) -> list[dict]:
        """Pull revenue by device — Ecomm clients with GA4.

        Maps to PDF: Revenue by Device → dimension: deviceCategory
        """
        request = RunReportRequest(
            property=f"properties/{self.property_id}",
            date_ranges=[self._get_date_range(start_date, end_date)],
            dimensions=[Dimension(name="deviceCategory")],
            metrics=[
                Metric(name="purchaseRevenue"),
                Metric(name="sessions"),
            ],
        )

        response = self.client.run_report(request)
        results = []

        for row in response.rows:
            results.append({
                "report_date": str(date.today()),
                "device_category": row.dimension_values[0].value,
                "revenue": Decimal(row.metric_values[0].value) if row.metric_values[0].value else None,
                "sessions": int(row.metric_values[1].value) if row.metric_values[1].value else None,
            })

        return results
