"""
CSV template definitions for all platforms and tables.
Matches exactly: Ads Reporting — Metrics Specification (April 2026).
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ColumnDef:
    name: str
    dtype: str                        # "str" | "int" | "decimal" | "date" | "bool"
    required: bool = True
    allowed: list[str] | None = None  # Enumerated values (shown in template notes)
    sample: Any = ""                  # Sample value written into the template CSV


@dataclass
class CsvTemplate:
    source: str             # google_ads | meta_ads | shopify | ga4
    table: str              # campaign | search_terms | keywords | …
    label: str              # Human-readable heading
    client_types: list[str] # Which client types this template applies to
    columns: list[ColumnDef]

    def headers(self) -> list[str]:
        return [c.name for c in self.columns]

    def sample_row(self) -> dict:
        return {c.name: c.sample for c in self.columns}

    def to_dict(self) -> dict:
        return {
            "source": self.source,
            "table": self.table,
            "label": self.label,
            "client_types": self.client_types,
            "columns": [
                {
                    "name": c.name,
                    "dtype": c.dtype,
                    "required": c.required,
                    "allowed": c.allowed,
                }
                for c in self.columns
            ],
        }


# ─────────────────────────────────────────────────────────────
# GOOGLE ADS
# ─────────────────────────────────────────────────────────────

GOOGLE_CAMPAIGN = CsvTemplate(
    source="google_ads",
    table="campaign",
    label="Google Ads — Campaign Level",
    client_types=["google_only", "google_meta", "ecomm_shopify", "ecomm_ga4", "leadgen"],
    columns=[
        ColumnDef("report_date",      "date",    sample="2024-04-08"),
        ColumnDef("campaign_id",      "str",     required=False, sample="12345678"),
        ColumnDef("campaign_name",    "str",     sample="Brand Search"),
        ColumnDef("impressions",      "int",     sample=10000),
        ColumnDef("clicks",           "int",     sample=850),
        ColumnDef("spend",            "decimal", sample="142.50"),
        ColumnDef("ctr",              "decimal", required=False, sample="8.50"),
        ColumnDef("avg_cpc",          "decimal", required=False, sample="0.17"),
        ColumnDef("conversions",      "decimal", sample="32"),
        ColumnDef("conversion_rate",  "decimal", required=False, sample="3.76"),
        ColumnDef("conv_value",       "decimal", required=False, sample="960.00"),
        ColumnDef("cost_per_conv",    "decimal", required=False, sample="4.45"),
        ColumnDef("roas",             "decimal", required=False, sample="6.74"),
        ColumnDef("impression_share", "decimal", required=False, sample="0.72"),
    ],
)

GOOGLE_SEARCH_TERMS = CsvTemplate(
    source="google_ads",
    table="search_terms",
    label="Google Ads — Search Terms (top 10 by clicks)",
    client_types=["google_only", "google_meta", "ecomm_shopify", "ecomm_ga4", "leadgen"],
    columns=[
        ColumnDef("report_date",  "date",    sample="2024-04-08"),
        ColumnDef("search_term",  "str",     sample="buy running shoes online"),
        ColumnDef("impressions",  "int",     sample=540),
        ColumnDef("clicks",       "int",     sample=45),
        ColumnDef("ctr",          "decimal", required=False, sample="8.33"),
        ColumnDef("avg_cpc",      "decimal", required=False, sample="0.21"),
        ColumnDef("conversions",  "decimal", sample="3"),
        ColumnDef("conv_value",   "decimal", required=False, sample="90.00"),
    ],
)

GOOGLE_KEYWORDS = CsvTemplate(
    source="google_ads",
    table="keywords",
    label="Google Ads — Keywords (top 10 by impressions)",
    client_types=["google_only", "google_meta", "ecomm_shopify", "ecomm_ga4", "leadgen"],
    columns=[
        ColumnDef("report_date",   "date",    sample="2024-04-08"),
        ColumnDef("keyword_text",  "str",     sample="running shoes"),
        ColumnDef("match_type",    "str",
                  allowed=["EXACT", "PHRASE", "BROAD"], sample="EXACT"),
        ColumnDef("impressions",   "int",     sample=2200),
        ColumnDef("clicks",        "int",     sample=180),
        ColumnDef("ctr",           "decimal", required=False, sample="8.18"),
        ColumnDef("avg_cpc",       "decimal", required=False, sample="0.19"),
        ColumnDef("quality_score", "int",     required=False, sample="8"),
        ColumnDef("conversions",   "decimal", sample="12"),
    ],
)

GOOGLE_TIME_SEGMENTS = CsvTemplate(
    source="google_ads",
    table="time_segments",
    label="Google Ads — Day of Week & Hour of Day",
    client_types=["google_only", "google_meta", "ecomm_shopify", "ecomm_ga4", "leadgen"],
    columns=[
        ColumnDef("report_date",    "date",    sample="2024-04-08"),
        ColumnDef("segment_type",   "str",
                  allowed=["day_of_week", "hour"], sample="day_of_week"),
        ColumnDef("segment_value",  "str",     sample="MONDAY"),
        ColumnDef("impressions",    "int",     sample=1800),
        ColumnDef("clicks",         "int",     sample=145),
        ColumnDef("spend",          "decimal", sample="28.50"),
        ColumnDef("conversions",    "decimal", sample="5"),
    ],
)

GOOGLE_DEMOGRAPHICS = CsvTemplate(
    source="google_ads",
    table="demographics",
    label="Google Ads — Gender & Age (Display / YouTube only)",
    client_types=["google_only", "google_meta", "ecomm_shopify", "ecomm_ga4"],
    columns=[
        ColumnDef("report_date", "date",    sample="2024-04-08"),
        ColumnDef("gender",      "str",
                  allowed=["FEMALE", "MALE", "UNKNOWN"], sample="FEMALE"),
        ColumnDef("age_range",   "str",
                  allowed=["AGE_RANGE_18_24", "AGE_RANGE_25_34", "AGE_RANGE_35_44",
                            "AGE_RANGE_45_54", "AGE_RANGE_55_64", "AGE_RANGE_65_UP",
                            "UNKNOWN"],
                  sample="AGE_RANGE_25_34"),
        ColumnDef("impressions", "int",     sample=3200),
        ColumnDef("clicks",      "int",     sample=260),
        ColumnDef("spend",       "decimal", sample="48.00"),
        ColumnDef("conversions", "decimal", sample="9"),
    ],
)


# ─────────────────────────────────────────────────────────────
# META ADS
# ─────────────────────────────────────────────────────────────

META_CAMPAIGN = CsvTemplate(
    source="meta_ads",
    table="campaign",
    label="Meta Ads — Campaign Level",
    client_types=["meta_only", "google_meta", "ecomm_shopify", "ecomm_ga4", "leadgen"],
    columns=[
        ColumnDef("report_date",      "date",    sample="2024-04-08"),
        ColumnDef("campaign_id",      "str",     required=False, sample="23849123456"),
        ColumnDef("campaign_name",    "str",     sample="Spring Sale - Retargeting"),
        ColumnDef("impressions",      "int",     sample=45000),
        ColumnDef("clicks",           "int",     sample=1200),
        ColumnDef("spend",            "decimal", sample="320.00"),
        ColumnDef("ctr",              "decimal", required=False, sample="2.67"),
        ColumnDef("cpc",              "decimal", required=False, sample="0.27"),
        ColumnDef("reach",            "int",     sample=28000),
        ColumnDef("frequency",        "decimal", required=False, sample="1.61"),
        ColumnDef("cpm",              "decimal", required=False, sample="7.11"),
        ColumnDef("cost_per_result",  "decimal", required=False, sample="8.00"),
        ColumnDef("conversions",      "decimal", required=False, sample="40"),
        ColumnDef("conv_value",       "decimal", required=False, sample="1200.00"),
        ColumnDef("roas",             "decimal", required=False, sample="3.75"),
    ],
)

META_LEADGEN = CsvTemplate(
    source="meta_ads",
    table="leadgen",
    label="Meta Ads — Lead Gen Metrics (LeadGen clients only)",
    client_types=["leadgen"],
    columns=[
        ColumnDef("report_date",          "date",    sample="2024-04-08"),
        ColumnDef("campaign_id",          "str",     required=False, sample="23849123456"),
        ColumnDef("campaign_name",        "str",     sample="Lead Form Campaign"),
        ColumnDef("leads",                "int",     sample=85),
        ColumnDef("cost_per_lead",        "decimal", required=False, sample="3.76"),
        ColumnDef("lead_form_opens",      "int",     sample=120),
        ColumnDef("form_completion_rate", "decimal", required=False, sample="70.83"),
        ColumnDef("link_clicks",          "int",     sample=210),
        ColumnDef("landing_page_views",   "int",     sample=195),
    ],
)

META_TIME_SEGMENTS = CsvTemplate(
    source="meta_ads",
    table="time_segments",
    label="Meta Ads — Day of Week & Hour of Day",
    client_types=["meta_only", "google_meta", "ecomm_shopify", "ecomm_ga4", "leadgen"],
    columns=[
        ColumnDef("report_date",   "date",    sample="2024-04-08"),
        ColumnDef("segment_type",  "str",
                  allowed=["day_of_week", "hour"], sample="day_of_week"),
        ColumnDef("segment_value", "str",     sample="Monday"),
        ColumnDef("impressions",   "int",     sample=6500),
        ColumnDef("clicks",        "int",     sample=175),
        ColumnDef("spend",         "decimal", sample="46.00"),
    ],
)

META_DEMOGRAPHICS = CsvTemplate(
    source="meta_ads",
    table="demographics",
    label="Meta Ads — Gender & Age",
    client_types=["meta_only", "google_meta", "ecomm_shopify", "ecomm_ga4", "leadgen"],
    columns=[
        ColumnDef("report_date",  "date",    sample="2024-04-08"),
        ColumnDef("gender",       "str",
                  allowed=["male", "female", "unknown"], sample="female"),
        ColumnDef("age_group",    "str",
                  allowed=["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"],
                  sample="25-34"),
        ColumnDef("impressions",  "int",     sample=9200),
        ColumnDef("clicks",       "int",     sample=310),
        ColumnDef("spend",        "decimal", sample="85.00"),
        ColumnDef("conversions",  "decimal", required=False, sample="18"),
    ],
)


# ─────────────────────────────────────────────────────────────
# SHOPIFY
# ─────────────────────────────────────────────────────────────

SHOPIFY_ORDERS = CsvTemplate(
    source="shopify",
    table="orders",
    label="Shopify — Revenue & Orders",
    client_types=["ecomm_shopify"],
    columns=[
        ColumnDef("shopify_order_id",      "str",     sample="GID-1001"),
        ColumnDef("order_date",            "date",    sample="2024-04-08"),
        ColumnDef("total_price",           "decimal", sample="149.99"),
        ColumnDef("customer_orders_count", "int",     required=False, sample="1"),
        ColumnDef("is_new_customer",       "bool",    required=False, sample="true"),
    ],
)

SHOPIFY_PRODUCTS = CsvTemplate(
    source="shopify",
    table="products",
    label="Shopify — Top Products",
    client_types=["ecomm_shopify"],
    columns=[
        ColumnDef("report_date",    "date",    sample="2024-04-08"),
        ColumnDef("product_title",  "str",     sample="Running Shoes - Size 10"),
        ColumnDef("total_quantity", "int",     sample=12),
        ColumnDef("total_revenue",  "decimal", sample="1799.88"),
    ],
)


# ─────────────────────────────────────────────────────────────
# GOOGLE ANALYTICS 4
# ─────────────────────────────────────────────────────────────

GA4_REVENUE = CsvTemplate(
    source="ga4",
    table="revenue",
    label="Google Analytics 4 — Revenue Summary",
    client_types=["ecomm_ga4"],
    columns=[
        ColumnDef("report_date",             "date",    sample="2024-04-08"),
        ColumnDef("purchase_revenue",        "decimal", sample="4250.00"),
        ColumnDef("transactions",            "int",     sample="38"),
        ColumnDef("avg_purchase_revenue",    "decimal", required=False, sample="111.84"),
        ColumnDef("session_conversion_rate", "decimal", required=False, sample="3.20"),
        ColumnDef("active_users",            "int",     sample="1180"),
        ColumnDef("sessions",                "int",     sample="1560"),
    ],
)

GA4_CHANNELS = CsvTemplate(
    source="ga4",
    table="channels",
    label="Google Analytics 4 — Revenue by Channel",
    client_types=["ecomm_ga4"],
    columns=[
        ColumnDef("report_date",    "date",    sample="2024-04-08"),
        ColumnDef("channel_group",  "str",     sample="Organic Search"),
        ColumnDef("revenue",        "decimal", sample="1820.00"),
        ColumnDef("sessions",       "int",     sample="620"),
    ],
)

GA4_DEVICES = CsvTemplate(
    source="ga4",
    table="devices",
    label="Google Analytics 4 — Revenue by Device",
    client_types=["ecomm_ga4"],
    columns=[
        ColumnDef("report_date",     "date",    sample="2024-04-08"),
        ColumnDef("device_category", "str",
                  allowed=["desktop", "mobile", "tablet"], sample="mobile"),
        ColumnDef("revenue",         "decimal", sample="2100.00"),
        ColumnDef("sessions",        "int",     sample="890"),
    ],
)


# ─────────────────────────────────────────────────────────────
# GOOGLE ADS — RAW UI EXPORT (exact Google Ads UI column names)
# ─────────────────────────────────────────────────────────────
# This template uses the EXACT headers from the Google Ads UI CSV export so
# users can upload the file without renaming any columns.
# The parser (google_ads_csv_parser.py) handles all aliasing & transformation.

GOOGLE_CAMPAIGN_RAW = CsvTemplate(
    source="google_ads",
    table="campaign_raw",
    label="Google Ads — Campaign Raw (UI Export)",
    client_types=["google_only", "google_meta", "ecomm_shopify", "ecomm_ga4", "leadgen"],
    columns=[
        ColumnDef("Day",                 "date",    required=True,  sample="2024-04-15"),
        ColumnDef("Campaign",            "str",     required=True,  sample="My Campaign"),
        ColumnDef("Impr.",               "int",     required=True,  sample="1000"),
        ColumnDef("Clicks",              "int",     required=True,  sample="50"),
        ColumnDef("CTR",                 "str",     required=False, sample="5.00%"),
        ColumnDef("Currency code",       "str",     required=False, sample="AUD"),
        ColumnDef("Cost",                "decimal", required=True,  sample="97.50"),
        ColumnDef("Avg. CPC",            "decimal", required=False, sample="1.95"),
        ColumnDef("Conversions",         "decimal", required=False, sample="3.00"),
        ColumnDef("Cost / conv.",        "decimal", required=False, sample="32.50"),
        ColumnDef("Conv. value / cost",  "decimal", required=False, sample="1.23"),
        ColumnDef("Conv. value",         "decimal", required=False, sample="97.50"),
        ColumnDef("Conv. rate",          "str",     required=False, sample="6.00%"),
        ColumnDef("Avg. order value",    "decimal", required=False, sample="32.50"),
    ],
)


# ─────────────────────────────────────────────────────────────
# Registry
# ─────────────────────────────────────────────────────────────

ALL_TEMPLATES: dict[tuple[str, str], CsvTemplate] = {
    ("google_ads", "campaign_raw"):   GOOGLE_CAMPAIGN_RAW,   # UI export — exact headers
    ("google_ads", "campaign"):       GOOGLE_CAMPAIGN,
    ("google_ads", "search_terms"):   GOOGLE_SEARCH_TERMS,
    ("google_ads", "keywords"):       GOOGLE_KEYWORDS,
    ("google_ads", "time_segments"):  GOOGLE_TIME_SEGMENTS,
    ("google_ads", "demographics"):   GOOGLE_DEMOGRAPHICS,
    ("meta_ads",   "campaign"):       META_CAMPAIGN,
    ("meta_ads",   "leadgen"):        META_LEADGEN,
    ("meta_ads",   "time_segments"):  META_TIME_SEGMENTS,
    ("meta_ads",   "demographics"):   META_DEMOGRAPHICS,
    ("shopify",    "orders"):         SHOPIFY_ORDERS,
    ("shopify",    "products"):       SHOPIFY_PRODUCTS,
    ("ga4",        "revenue"):        GA4_REVENUE,
    ("ga4",        "channels"):       GA4_CHANNELS,
    ("ga4",        "devices"):        GA4_DEVICES,
}

# Ordered list of templates per client type
CLIENT_TYPE_TEMPLATES: dict[str, list[tuple[str, str]]] = {
    # Google Ads: one upload format only — exact Google Ads UI export CSV
    # Headers: Day | Campaign | Impr. | Clicks | CTR | Currency code | Cost |
    #          Avg. CPC | Conversions | Cost / conv. | Conv. value / cost |
    #          Conv. value | Conv. rate | Avg. order value
    "google_only": [
        ("google_ads", "campaign_raw"),
    ],
    "meta_only": [
        ("meta_ads", "campaign"),
        ("meta_ads", "time_segments"),
        ("meta_ads", "demographics"),
    ],
    "google_meta": [
        ("google_ads", "campaign_raw"),
        ("meta_ads",  "campaign"),
        ("meta_ads",  "time_segments"),
        ("meta_ads",  "demographics"),
    ],
    "ecomm_shopify": [
        ("google_ads", "campaign_raw"),
        ("meta_ads",  "campaign"),
        ("meta_ads",  "time_segments"),
        ("meta_ads",  "demographics"),
        ("shopify",   "orders"),
        ("shopify",   "products"),
    ],
    "ecomm_ga4": [
        ("google_ads", "campaign_raw"),
        ("meta_ads",  "campaign"),
        ("meta_ads",  "time_segments"),
        ("meta_ads",  "demographics"),
        ("ga4",       "revenue"),
        ("ga4",       "channels"),
        ("ga4",       "devices"),
    ],
    "leadgen": [
        ("google_ads", "campaign_raw"),
        ("meta_ads",  "campaign"),
        ("meta_ads",  "leadgen"),
        ("meta_ads",  "time_segments"),
        ("meta_ads",  "demographics"),
    ],
}


def get_template(source: str, table: str) -> CsvTemplate | None:
    return ALL_TEMPLATES.get((source, table))


def get_templates_for_client_type(client_type: str) -> list[CsvTemplate]:
    keys = CLIENT_TYPE_TEMPLATES.get(client_type, [])
    return [ALL_TEMPLATES[k] for k in keys if k in ALL_TEMPLATES]


def derive_client_type(platforms: list[str], is_leadgen: bool = False) -> str:
    """Derive the client.type string from a list of selected platform keys."""
    has_google  = "google_ads" in platforms
    has_meta    = "meta_ads"   in platforms
    has_shopify = "shopify"    in platforms
    has_ga4     = "ga4"        in platforms

    if has_google and has_meta and has_shopify:
        return "ecomm_shopify"
    if has_google and has_meta and has_ga4:
        return "ecomm_ga4"
    if has_google and has_meta and is_leadgen:
        return "leadgen"
    if has_google and has_meta:
        return "google_meta"
    if has_google:
        return "google_only"
    if has_meta:
        return "meta_only"
    # Fallback — single GA4 or Shopify only (treat as ecomm)
    if has_shopify:
        return "ecomm_shopify"
    if has_ga4:
        return "ecomm_ga4"
    return "google_only"
