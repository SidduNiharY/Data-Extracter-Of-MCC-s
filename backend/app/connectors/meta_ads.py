from __future__ import annotations
from typing import Optional
from datetime import date, timedelta
from decimal import Decimal

from facebook_business.adobjects.adaccount import AdAccount
from facebook_business.api import FacebookAdsApi

from app.core.config import settings


class MetaAdsConnector:
    """Pulls data from Meta (Facebook) Ads API via Graph API.

    Authentication: System User Token or User Token per ad account.
    """

    def __init__(self, access_token: str, ad_account_id: str):
        FacebookAdsApi.init(
            app_id=settings.META_APP_ID,
            app_secret=settings.META_APP_SECRET,
            access_token=access_token,
        )
        self.account = AdAccount(ad_account_id)

    @staticmethod
    def list_ad_accounts(access_token: str) -> list[dict]:
        """List all ad accounts accessible via the provided token."""
        FacebookAdsApi.init(
            app_id=settings.META_APP_ID,
            app_secret=settings.META_APP_SECRET,
            access_token=access_token,
        )
        from facebook_business.adobjects.user import User
        me = User(fbid='me')
        accounts = me.get_ad_accounts(fields=['name', 'account_id', 'id'])
        
        results = []
        for acc in accounts:
            results.append({
                "name": acc.get('name', 'Unnamed Account'),
                "customer_id": acc.get('account_id'), # Using customer_id for naming consistency with Google
                "meta_id": acc.get('id'), # The internal Meta ID with 'act_' prefix
            })
        return results

    @staticmethod
    def _date_params(start_date: date = None, end_date: date = None) -> dict:
        """Build Meta API date parameters. Defaults to last_7d if no dates given."""
        if start_date and end_date:
            return {"time_range": {"since": str(start_date), "until": str(end_date)}}
        return {"date_preset": "last_7d"}

    @staticmethod
    def _extract_action_value(actions: Optional[list], action_type: str) -> Optional[Decimal]:
        """Extract a specific action value from Meta's actions array."""
        if not actions:
            return None
        for action in actions:
            if action.get("action_type") == action_type:
                return Decimal(str(action.get("value", 0)))
        return None

    def pull_campaign(self, client_type: str, start_date: date = None, end_date: date = None) -> list[dict]:
        """Pull campaign-level metrics — all Meta clients.

        Maps to PDF: Meta Ads — Campaign Level
        """
        fields = [
            "campaign_name",
            "campaign_id",
            "impressions",
            "clicks",
            "spend",
            "ctr",
            "cpc",
            "reach",
            "frequency",
            "cpm",
            "cost_per_action_type",
            "actions",
            "action_values",
        ]
        params = {
            **self._date_params(start_date, end_date),
            "level": "campaign",
        }

        insights = self.account.get_insights(fields=fields, params=params)
        report_date = str(end_date or date.today())
        results = []

        for row in insights:
            spend = Decimal(row.get("spend", "0"))
            conversions = self._extract_action_value(row.get("actions"), "purchase")
            conv_value = self._extract_action_value(row.get("action_values"), "purchase")
            roas = (conv_value / spend) if (conv_value and spend) else None

            # Cost per result: find the primary action cost
            cost_per_result = None
            cpa_list = row.get("cost_per_action_type", [])
            if cpa_list:
                cost_per_result = Decimal(str(cpa_list[0].get("value", 0)))

            results.append({
                "report_date": report_date,
                "campaign_id": row.get("campaign_id"),
                "campaign_name": row.get("campaign_name"),
                "impressions": int(row.get("impressions", 0)),
                "clicks": int(row.get("clicks", 0)),
                "spend": spend,
                "ctr": Decimal(row.get("ctr", "0")),
                "cpc": Decimal(row.get("cpc", "0")),
                "reach": int(row.get("reach", 0)),
                "frequency": Decimal(row.get("frequency", "0")),
                "cpm": Decimal(row.get("cpm", "0")),
                "cost_per_result": cost_per_result,
                "conversions": conversions if client_type in ("ecomm_shopify", "ecomm_ga4") else None,
                "conv_value": conv_value if client_type in ("ecomm_shopify", "ecomm_ga4") else None,
                "roas": roas if client_type in ("ecomm_shopify", "ecomm_ga4") else None,
            })
        return results

    def pull_leadgen(self, start_date: date = None, end_date: date = None) -> list[dict]:
        """Pull lead gen metrics — Lead Gen clients ONLY.

        Maps to PDF: Meta Ads — Lead Gen Metrics
        """
        fields = [
            "campaign_name",
            "campaign_id",
            "spend",
            "actions",
            "cost_per_action_type",
            "inline_link_clicks",
            "landing_page_views",
        ]
        params = {
            **self._date_params(start_date, end_date),
            "level": "campaign",
        }

        insights = self.account.get_insights(fields=fields, params=params)
        report_date = str(end_date or date.today())
        results = []

        for row in insights:
            leads = self._extract_action_value(row.get("actions"), "lead")
            form_opens = self._extract_action_value(row.get("actions"), "leadgen_grouped")
            spend = Decimal(row.get("spend", "0"))

            cost_per_lead = (spend / leads) if (leads and leads > 0) else None
            form_completion = (leads / form_opens * 100) if (leads and form_opens and form_opens > 0) else None

            results.append({
                "report_date": str(date.today()),
                "campaign_id": row.get("campaign_id"),
                "campaign_name": row.get("campaign_name"),
                "leads": leads,
                "cost_per_lead": cost_per_lead,
                "lead_form_opens": form_opens,
                "form_completion_rate": form_completion,
                "link_clicks": int(row.get("inline_link_clicks", 0)),
                "landing_page_views": int(row.get("landing_page_views", 0)),
            })
        return results

    def pull_time_segments(self, start_date: date = None, end_date: date = None) -> list[dict]:
        """Pull day-of-week and hour-of-day breakdowns — All Meta clients.

        Maps to PDF: Meta Ads — Day of Week & Hour of Day
        """
        report_date = str(end_date) if end_date else str(date.today())
        results = []

        # Daily breakdown
        day_fields = ["impressions", "clicks", "spend"]
        day_params = {**self._date_params(start_date, end_date), "time_increment": 1}
        day_insights = self.account.get_insights(fields=day_fields, params=day_params)

        for row in day_insights:
            ds = row.get("date_start")
            dt = date.fromisoformat(ds) if ds else date.today()
            results.append({
                "report_date": ds or report_date,
                "segment_type": "day",
                "segment_value": str(dt.isoweekday()),  # 1=Mon, 7=Sun
                "impressions": int(row.get("impressions", 0)),
                "clicks": int(row.get("clicks", 0)),
                "spend": Decimal(row.get("spend", "0")),
            })

        # Hourly breakdown
        hour_fields = ["impressions", "clicks", "spend"]
        hour_params = {
            **self._date_params(start_date, end_date),
            "breakdowns": "hourly_stats_aggregated_by_audience_time_zone",
        }
        hour_insights = self.account.get_insights(fields=hour_fields, params=hour_params)

        for row in hour_insights:
            results.append({
                "report_date": report_date,
                "segment_type": "hour",
                "segment_value": row.get("hourly_stats_aggregated_by_audience_time_zone", ""),
                "impressions": int(row.get("impressions", 0)),
                "clicks": int(row.get("clicks", 0)),
                "spend": Decimal(row.get("spend", "0")),
            })

        return results

    def pull_demographics(self, start_date: date = None, end_date: date = None) -> list[dict]:
        """Pull gender & age breakdown — ALL Meta campaigns.

        Maps to PDF: Meta Ads — Gender & Age
        """
        fields = ["impressions", "clicks", "spend", "actions"]
        params = {
            **self._date_params(start_date, end_date),
            "breakdowns": "age,gender",
        }

        insights = self.account.get_insights(fields=fields, params=params)
        results = []

        for row in insights:
            conversions = self._extract_action_value(row.get("actions"), "purchase")
            results.append({
                "report_date": str(date.today()),
                "gender": row.get("gender"),
                "age_group": row.get("age"),
                "impressions": int(row.get("impressions", 0)),
                "clicks": int(row.get("clicks", 0)),
                "spend": Decimal(row.get("spend", "0")),
                "conversions": conversions,
            })

        return results
