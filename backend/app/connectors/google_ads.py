from __future__ import annotations
from datetime import date
from decimal import Decimal
import logging

from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

from app.core.config import settings

logger = logging.getLogger(__name__)


def _google_ads_error_code(e: Exception) -> str:
    """Extract the primary error code string from a GoogleAdsException.

    ErrorCode uses a protobuf oneof group — use WhichOneof, not HasField.
    Falls back to string scanning for robustness across library versions.
    """
    if isinstance(e, GoogleAdsException):
        for err in e.failure.errors:
            try:
                which = err.error_code.WhichOneof("error_code")
                if which:
                    return getattr(err.error_code, which).name
            except Exception:
                pass
    # String fallback — stable regardless of proto/library version
    s = str(e)
    for known in (
        "DEVELOPER_TOKEN_NOT_APPROVED",
        "USER_PERMISSION_DENIED",
        "CUSTOMER_NOT_ENABLED",
    ):
        if known in s:
            return known
    return "UNKNOWN_ERROR"


def _format_customer_id(raw_id: str) -> str:
    """Format a 10-digit customer ID as XXX-XXX-XXXX."""
    digits = raw_id.replace("-", "")
    if len(digits) == 10:
        return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}"
    return raw_id


class GoogleAdsConnector:
    """Pulls data from Google Ads API via MCC (Manager Account).

    Authentication: One MCC credential pulls data for all child accounts.
    - login_customer_id = MCC ID (who is authenticating)
    - customer_id = child client ID (whose data to pull)
    """

    def __init__(self, mcc_id: Optional[str] = None):
        login_id = (mcc_id or settings.GOOGLE_ADS_MCC_ID).replace("-", "")
        self.client = GoogleAdsClient.load_from_dict({
            "developer_token": settings.GOOGLE_ADS_DEVELOPER_TOKEN,
            "client_id": settings.GOOGLE_ADS_CLIENT_ID,
            "client_secret": settings.GOOGLE_ADS_CLIENT_SECRET,
            "refresh_token": settings.GOOGLE_ADS_REFRESH_TOKEN,
            "login_customer_id": login_id,
            "use_proto_plus": True,
        })
        self.ga_service = self.client.get_service("GoogleAdsService")

    def _query(self, customer_id: str, query: str) -> list[dict]:
        """Execute a GAQL query and return rows as dicts."""
        clean_id = customer_id.replace("-", "")
        response = self.ga_service.search(customer_id=clean_id, query=query)
        rows = []
        for row in response:
            rows.append(row)
        return rows

    @staticmethod
    def _micros_to_currency(micros: int) -> Decimal:
        """Convert micros (e.g. cost_micros) to currency (divide by 1,000,000)."""
        if micros is None:
            return Decimal("0")
        return Decimal(str(micros)) / Decimal("1000000")

    def list_child_accounts(self) -> list[dict]:
        """Auto-discover all client accounts under the MCC.

        Returns a list of dicts with keys:
          customer_id, name, token_limited (bool)

        token_limited=True means the account is real but the developer token
        is in Test Mode, so the name could not be retrieved.
        Accounts that do NOT belong to this MCC (USER_PERMISSION_DENIED) or
        are deactivated (CUSTOMER_NOT_ENABLED) are silently skipped.
        """
        mcc_id = settings.GOOGLE_ADS_MCC_ID.replace("-", "")
        accounts = []
        token_limited = False

        # ── Method 1: GAQL on customer_client resource ──────────────────────
        # Works when the developer token has Basic/Standard access.
        try:
            query = """
                SELECT
                    customer_client.client_customer,
                    customer_client.descriptive_name,
                    customer_client.id,
                    customer_client.manager,
                    customer_client.status
                FROM customer_client
                WHERE customer_client.level <= 1
            """
            response = self.ga_service.search(customer_id=mcc_id, query=query)
            for row in response:
                if row.customer_client.manager:
                    continue
                accounts.append({
                    "customer_id": str(row.customer_client.id),
                    "name": row.customer_client.descriptive_name or "Unnamed Account",
                    "token_limited": False,
                })
            logger.info("customer_client query: found %d child accounts", len(accounts))
            return accounts

        except Exception as e:
            code = _google_ads_error_code(e)
            logger.warning("customer_client query failed (%s), falling back to list_accessible_customers", code)
            if code == "DEVELOPER_TOKEN_NOT_APPROVED":
                token_limited = True

        # ── Method 2: list_accessible_customers fallback ─────────────────────
        # This API returns every account the OAuth user can touch across ALL
        # manager accounts — not just this MCC.  We use the error codes to
        # filter out accounts that don't belong here.
        try:
            customer_service = self.client.get_service("CustomerService")
            response = customer_service.list_accessible_customers()
        except Exception as fallback_e:
            logger.error("list_accessible_customers also failed: %s", fallback_e)
            return accounts

        for resource_name in response.resource_names:
            customer_id = resource_name.split("/")[-1]
            if customer_id == mcc_id:
                continue

            try:
                name_query = "SELECT customer.descriptive_name, customer.id FROM customer LIMIT 1"
                result = self.ga_service.search(customer_id=customer_id, query=name_query)
                for row in result:
                    accounts.append({
                        "customer_id": str(row.customer.id),
                        "name": row.customer.descriptive_name or "Unnamed Account",
                        "token_limited": False,
                    })

            except Exception as inner_e:
                code = _google_ads_error_code(inner_e)

                if code == "USER_PERMISSION_DENIED":
                    # Not under this MCC — irrelevant noise, skip silently
                    logger.debug("Skipping %s: USER_PERMISSION_DENIED (not in this MCC)", customer_id)
                    continue

                if code == "CUSTOMER_NOT_ENABLED":
                    # Deactivated/cancelled account, skip
                    logger.debug("Skipping %s: CUSTOMER_NOT_ENABLED (deactivated)", customer_id)
                    continue

                if code == "DEVELOPER_TOKEN_NOT_APPROVED" or token_limited:
                    # Token is in Test Mode — account belongs to MCC but name
                    # can't be queried.  Show a formatted ID so users can still
                    # identify and import it.
                    logger.info("Account %s: token limited, showing formatted ID", customer_id)
                    accounts.append({
                        "customer_id": customer_id,
                        "name": f"Account {_format_customer_id(customer_id)}",
                        "token_limited": True,
                    })
                else:
                    logger.warning("Could not query account %s (%s)", customer_id, code)
                    accounts.append({
                        "customer_id": customer_id,
                        "name": f"Account {_format_customer_id(customer_id)}",
                        "token_limited": True,
                    })

        logger.info("list_accessible_customers fallback: returning %d accounts", len(accounts))
        return accounts

    @staticmethod
    def _date_filter(start_date: date = None, end_date: date = None) -> str:
        """Build a GAQL date filter. Defaults to LAST_7_DAYS if no dates given."""
        if start_date and end_date:
            return f"segments.date BETWEEN '{start_date}' AND '{end_date}'"
        return "segments.date DURING LAST_7_DAYS"

    def pull_campaign(self, customer_id: str, start_date: date = None, end_date: date = None) -> list[dict]:
        """Pull campaign-level metrics — all clients with Google Ads.

        Maps to PDF: Google Ads — Campaign Level
        """
        date_filter = self._date_filter(start_date, end_date)
        query = f"""
            SELECT
                campaign.id,
                campaign.name,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.ctr,
                metrics.average_cpc,
                metrics.conversions,
                metrics.all_conversions,
                metrics.conversions_value,
                metrics.cost_per_conversion,
                metrics.search_impression_share,
                segments.date
            FROM campaign
            WHERE {date_filter}
                AND campaign.status = 'ENABLED'
            ORDER BY metrics.impressions DESC
        """
        raw_rows = self._query(customer_id, query)
        results = []
        for row in raw_rows:
            spend = self._micros_to_currency(row.metrics.cost_micros)
            conv_value = Decimal(str(row.metrics.conversions_value)) if row.metrics.conversions_value else None
            roas = (conv_value / spend) if (conv_value and spend) else None
            results.append({
                "report_date": row.segments.date,
                "campaign_id": str(row.campaign.id),
                "campaign_name": row.campaign.name,
                "impressions": row.metrics.impressions,
                "clicks": row.metrics.clicks,
                "spend": spend,
                "ctr": (Decimal(str(row.metrics.ctr)) * 100) if row.metrics.ctr else None,
                "avg_cpc": self._micros_to_currency(row.metrics.average_cpc),
                "conversions": Decimal(str(row.metrics.conversions)),
                "conversion_rate": (
                    Decimal(str(row.metrics.conversions)) / Decimal(str(row.metrics.clicks)) * 100
                    if row.metrics.clicks else None
                ),
                "conv_value": conv_value,
                "cost_per_conv": self._micros_to_currency(row.metrics.cost_per_conversion),
                "roas": roas,
                "impression_share": (
                    Decimal(str(row.metrics.search_impression_share)) * 100
                    if row.metrics.search_impression_share else None
                ),
            })
        return results

    def pull_search_terms(self, customer_id: str, start_date: date = None, end_date: date = None) -> list[dict]:
        """Pull top 10 search terms by clicks — Search Campaign clients only.

        Maps to PDF: Google Ads — Search Terms
        Filter: top 10 by clicks.
        """
        date_filter = self._date_filter(start_date, end_date)
        query = f"""
            SELECT
                search_term_view.search_term,
                metrics.impressions,
                metrics.clicks,
                metrics.ctr,
                metrics.average_cpc,
                metrics.conversions,
                metrics.conversions_value,
                segments.date
            FROM search_term_view
            WHERE {date_filter}
            ORDER BY metrics.clicks DESC
            LIMIT 10
        """
        raw_rows = self._query(customer_id, query)
        today = date.today()
        results = []
        for row in raw_rows:
            results.append({
                "report_date": row.segments.date if hasattr(row.segments, "date") else str(today),
                "search_term": row.search_term_view.search_term,
                "impressions": row.metrics.impressions,
                "clicks": row.metrics.clicks,
                "ctr": (Decimal(str(row.metrics.ctr)) * 100) if row.metrics.ctr else None,
                "avg_cpc": self._micros_to_currency(row.metrics.average_cpc),
                "conversions": Decimal(str(row.metrics.conversions)),
                "conv_value": (
                    Decimal(str(row.metrics.conversions_value))
                    if row.metrics.conversions_value else None
                ),
            })
        return results

    def pull_keywords(self, customer_id: str, start_date: date = None, end_date: date = None) -> list[dict]:
        """Pull top 10 keywords by impressions — Search Campaign clients only.

        Maps to PDF: Google Ads — Keywords
        """
        date_filter = self._date_filter(start_date, end_date)
        query = f"""
            SELECT
                ad_group_criterion.keyword.text,
                ad_group_criterion.keyword.match_type,
                ad_group_criterion.quality_info.quality_score,
                metrics.impressions,
                metrics.clicks,
                metrics.ctr,
                metrics.average_cpc,
                metrics.conversions,
                segments.date
            FROM keyword_view
            WHERE {date_filter}
            ORDER BY metrics.impressions DESC
            LIMIT 10
        """
        raw_rows = self._query(customer_id, query)
        today = date.today()
        results = []
        for row in raw_rows:
            results.append({
                "report_date": row.segments.date if hasattr(row.segments, "date") else str(today),
                "keyword_text": row.ad_group_criterion.keyword.text,
                "match_type": str(row.ad_group_criterion.keyword.match_type.name),
                "impressions": row.metrics.impressions,
                "clicks": row.metrics.clicks,
                "ctr": (Decimal(str(row.metrics.ctr)) * 100) if row.metrics.ctr else None,
                "avg_cpc": self._micros_to_currency(row.metrics.average_cpc),
                "quality_score": row.ad_group_criterion.quality_info.quality_score or None,
                "conversions": Decimal(str(row.metrics.conversions)),
            })
        return results

    def pull_time_segments(self, customer_id: str, start_date: date = None, end_date: date = None) -> list[dict]:
        """Pull day-of-week and hour-of-day breakdowns — All Google Ads clients.

        Maps to PDF: Google Ads — Day of Week & Hour of Day
        """
        date_filter = self._date_filter(start_date, end_date)
        day_query = f"""
            SELECT
                segments.day_of_week,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions
            FROM campaign
            WHERE {date_filter}
                AND campaign.status = 'ENABLED'
        """
        hour_query = f"""
            SELECT
                segments.hour,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions
            FROM campaign
            WHERE {date_filter}
                AND campaign.status = 'ENABLED'
        """
        report_date = str(end_date) if end_date else str(date.today())
        results = []

        for row in self._query(customer_id, day_query):
            results.append({
                "report_date": report_date,
                "segment_type": "day_of_week",
                "segment_value": str(row.segments.day_of_week.name),
                "impressions": row.metrics.impressions,
                "clicks": row.metrics.clicks,
                "spend": self._micros_to_currency(row.metrics.cost_micros),
                "conversions": Decimal(str(row.metrics.conversions)),
            })

        for row in self._query(customer_id, hour_query):
            results.append({
                "report_date": report_date,
                "segment_type": "hour_of_day",
                "segment_value": str(row.segments.hour),
                "impressions": row.metrics.impressions,
                "clicks": row.metrics.clicks,
                "spend": self._micros_to_currency(row.metrics.cost_micros),
                "conversions": Decimal(str(row.metrics.conversions)),
            })

        return results

    def pull_demographics(self, customer_id: str, start_date: date = None, end_date: date = None) -> list[dict]:
        """Pull gender & age breakdown — Display / YouTube campaigns only.

        Maps to PDF: Google Ads — Gender & Age
        """
        date_filter = self._date_filter(start_date, end_date)
        query = f"""
            SELECT
                ad_group_criterion.gender.type,
                ad_group_criterion.age_range.type,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions,
                segments.date
            FROM gender_view
            WHERE {date_filter}
        """
        raw_rows = self._query(customer_id, query)
        today = date.today()
        results = []
        for row in raw_rows:
            results.append({
                "report_date": row.segments.date if hasattr(row.segments, "date") else str(today),
                "gender": str(row.ad_group_criterion.gender.type.name) if row.ad_group_criterion.gender.type else None,
                "age_range": str(row.ad_group_criterion.age_range.type.name) if row.ad_group_criterion.age_range.type else None,
                "impressions": row.metrics.impressions,
                "clicks": row.metrics.clicks,
                "spend": self._micros_to_currency(row.metrics.cost_micros),
                "conversions": Decimal(str(row.metrics.conversions)),
            })
        return results
