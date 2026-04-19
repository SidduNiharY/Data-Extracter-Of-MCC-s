"""
google_ads_csv_parser.py
========================
Parses, transforms, validates, and normalises Google Ads UI-export CSV files
into rows ready for insertion into google_ads_campaign_raw.

Supported export format
-----------------------
The standard Google Ads UI export produces tab-separated or comma-separated
files with these column headers:

    Day | Campaign | Impr. | Clicks | CTR | Currency code | Cost |
    Avg. CPC | Conversions | Cost / conv. | Conv. value / cost |
    Conv. value | Conv. rate | Avg. order value

Field-by-field rules
--------------------
- CTR, Conv. rate  →  strip "%" suffix, parse float (stored as 0–100)
- Cost, Avg. CPC, Cost / conv.  →  already in currency (NOT micros); parse float
- Conv. value / cost  →  this IS ROAS; store directly
- Avg. order value = 0  →  stored as NULL (meaningless when no conversions)
- Cost / conv. = 0  →  stored as NULL
- All negatives are rejected and replaced with 0

Derived / recalculated metrics (authoritative versions)
-------------------------------------------------------
Even though CTR / Conv. rate / ROAS are present in the export we
recalculate them from first principles so the stored values are always
internally consistent:

    ctr             = clicks / impressions * 100   (0 if impressions = 0)
    conversion_rate = conversions / clicks * 100   (0 if clicks = 0)
    roas            = conversion_value / spend      (NULL if spend = 0 or no conv. value)
    cost_per_conv   = spend / conversions           (NULL if conversions = 0)

Client-type handling
--------------------
For non-ecomm clients (is_ecomm=False):
    conversion_value = NULL
    roas             = NULL
    avg_order_value  = NULL
"""
from __future__ import annotations

import csv
import io
import logging
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Column header aliases
# Each entry: (canonical_key, [list of accepted header strings])
# ─────────────────────────────────────────────────────────────────────────────

HEADER_ALIASES: List[Tuple[str, List[str]]] = [
    ("report_date",       ["day", "date", "report_date"]),
    ("campaign_name",     ["campaign", "campaign name", "campaign_name"]),
    ("impressions",       ["impr.", "impressions", "impr"]),
    ("clicks",            ["clicks"]),
    ("ctr_raw",           ["ctr"]),                           # % string — recalculated
    ("currency",          ["currency code", "currency"]),
    ("spend",             ["cost", "spend"]),
    ("avg_cpc",           ["avg. cpc", "avg cpc", "avg_cpc"]),
    ("conversions",       ["conversions"]),
    ("cost_per_conv_raw", ["cost / conv.", "cost/conv.", "cost per conv", "cost_per_conv"]),
    ("roas_raw",          ["conv. value / cost", "conv value/cost", "roas"]),
    ("conversion_value",  ["conv. value", "conv value", "conversion_value", "conv_value"]),
    ("conv_rate_raw",     ["conv. rate", "conv rate", "conversion rate", "conversion_rate"]),
    ("avg_order_value",   ["avg. order value", "avg order value", "avg_order_value"]),
]


# ─────────────────────────────────────────────────────────────────────────────
# Parsed row dataclass
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ParsedCampaignRow:
    """One fully-validated, normalised campaign row ready for DB insertion."""
    report_date:         date
    campaign_name:       str
    currency:            str
    impressions:         int
    clicks:              int
    spend:               Decimal
    avg_cpc:             Decimal
    ctr:                 Decimal              # recalculated, 0–100
    conversions:         Decimal
    conversion_rate:     Decimal              # recalculated, 0–100
    cost_per_conversion: Optional[Decimal]   # NULL when conversions = 0
    conversion_value:    Optional[Decimal]   # NULL for non-ecomm
    roas:                Optional[Decimal]   # NULL for non-ecomm or spend=0
    avg_order_value:     Optional[Decimal]   # NULL for non-ecomm or no conversions
    ingestion_source:    str = "csv"


@dataclass
class ParseResult:
    """Return value of parse_google_ads_csv()."""
    rows:    List[ParsedCampaignRow] = field(default_factory=list)
    skipped: int = 0
    errors:  List[str] = field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _normalise_header(h: str) -> str:
    return h.strip().lower().replace("\ufeff", "")   # strip BOM if present


# Known first-column values that identify the real header row
_HEADER_FIRST_CELL = {"day", "date", "report_date"}

# Minimum set of canonical keys that must map for the row to be a valid header
_HEADER_REQUIRED_ALIASES = {
    alias
    for canonical, aliases in HEADER_ALIASES
    for alias in aliases
    if canonical in {"report_date", "campaign_name", "impressions", "clicks", "spend"}
}


def _find_header_row(lines: list[str], delimiter: str) -> int:
    """
    Scan lines from the top and return the index of the line that contains
    the real column headers (skipping Google Ads preamble rows like the
    report title and date-range string).

    Strategy: the header row is the first line whose first cell (after
    normalisation) is one of the known date/day column names, OR whose
    cells collectively contain at least 3 of our known aliases.
    """
    for i, line in enumerate(lines):
        if not line.strip():
            continue
        cells = [_normalise_header(c) for c in line.split(delimiter)]
        if not cells:
            continue
        # Fast path: first cell is "day" or "date"
        if cells[0] in _HEADER_FIRST_CELL:
            return i
        # Slower path: count how many known aliases appear in this line
        matched = sum(1 for c in cells if c in _HEADER_REQUIRED_ALIASES)
        if matched >= 3:
            return i
    return 0   # fallback — use first line


def _build_header_map(raw_headers: List[str]) -> dict[str, str]:
    """
    Map raw CSV header strings to canonical keys.
    Returns {canonical_key: actual_column_header}.
    """
    normalised = {_normalise_header(h): h for h in raw_headers}
    result: dict[str, str] = {}
    for canonical, aliases in HEADER_ALIASES:
        for alias in aliases:
            if alias in normalised:
                result[canonical] = normalised[alias]
                break
    return result


def _parse_pct(value: str) -> Decimal:
    """'10.51%' → Decimal('10.51').  Already-numeric strings pass through."""
    v = str(value).strip().replace("%", "").replace(",", "")
    try:
        return Decimal(v)
    except InvalidOperation:
        return Decimal("0")


def _parse_dec(value: str | None, default: str = "0") -> Decimal:
    if not value:
        return Decimal(default)
    v = str(value).strip().replace(",", "").replace("$", "")
    try:
        return Decimal(v)
    except InvalidOperation:
        return Decimal(default)


def _parse_int(value: str | None) -> int:
    if not value:
        return 0
    v = str(value).strip().replace(",", "")
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return 0


def _parse_date(value: str) -> Optional[date]:
    v = str(value).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(v, fmt).date()
        except ValueError:
            continue
    return None


def _null_if_zero(v: Decimal) -> Optional[Decimal]:
    """Return None when the value is zero (meaningless sentinel from export)."""
    return None if v == Decimal("0") else v


def _clamp_pct(v: Decimal) -> Decimal:
    """Clamp to [0, 100]."""
    return max(Decimal("0"), min(Decimal("100"), v))


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def parse_google_ads_csv(
    content: bytes,
    *,
    is_ecomm: bool = False,
    default_currency: str = "AUD",
) -> ParseResult:
    """
    Parse raw CSV bytes from a Google Ads UI export.

    Parameters
    ----------
    content         : Raw bytes of the uploaded CSV/TSV file.
    is_ecomm        : If False, conversion_value / roas / avg_order_value are
                      forced to NULL regardless of what the CSV contains.
    default_currency: Fallback when 'Currency code' column is missing.

    Returns
    -------
    ParseResult with .rows (List[ParsedCampaignRow]), .skipped, .errors.
    """
    result = ParseResult()

    # ── Decode & detect delimiter ─────────────────────────────────────────────
    text = content.decode("utf-8-sig", errors="replace")   # utf-8-sig strips BOM
    delimiter = "\t" if text.count("\t") > text.count(",") else ","

    # ── Skip Google Ads preamble rows ─────────────────────────────────────────
    # Google Ads UI exports prepend 1–3 metadata rows before the real headers:
    #   Row 1: "Untitled report"
    #   Row 2: "15 April 2024 - 15 April 2026"
    #   Row 3: Day,Campaign,Impr.,Clicks,...   ← real headers start here
    lines = text.splitlines()
    header_idx = _find_header_row(lines, delimiter)
    if header_idx > 0:
        logger.info(f"Skipping {header_idx} preamble row(s) before header line")
        result.skipped += header_idx   # count preamble rows as skipped

    # Rebuild text starting from the real header line
    clean_text = "\n".join(lines[header_idx:])

    reader = csv.DictReader(io.StringIO(clean_text), delimiter=delimiter)

    if not reader.fieldnames:
        result.errors.append("CSV has no headers — empty file?")
        return result

    header_map = _build_header_map(list(reader.fieldnames))

    # Minimum required columns
    required = {"report_date", "campaign_name", "impressions", "clicks", "spend"}
    missing = required - set(header_map.keys())
    if missing:
        result.errors.append(
            f"Missing required columns: {missing}. "
            f"Got headers: {list(reader.fieldnames)}"
        )
        return result

    def _get(row: dict, key: str, default: str = "") -> str:
        col = header_map.get(key)
        return str(row.get(col, default)) if col else default

    # ── Process rows ──────────────────────────────────────────────────────────
    for line_num, row in enumerate(reader, start=2):

        # Skip Google Ads totals/summary rows (they have no campaign name or date)
        raw_date     = _get(row, "report_date")
        raw_campaign = _get(row, "campaign_name")
        if not raw_date.strip() or raw_campaign.strip().lower() in ("", "total", "totals"):
            result.skipped += 1
            continue

        # ── Parse date ────────────────────────────────────────────────────────
        report_date = _parse_date(raw_date)
        if report_date is None:
            result.errors.append(f"Row {line_num}: unparseable date '{raw_date}' — skipped")
            result.skipped += 1
            continue

        # ── Parse raw numerics ────────────────────────────────────────────────
        currency     = _get(row, "currency", default_currency).strip() or default_currency
        impressions  = max(0, _parse_int(_get(row, "impressions")))
        clicks       = max(0, _parse_int(_get(row, "clicks")))
        spend        = max(Decimal("0"), _parse_dec(_get(row, "spend")))
        avg_cpc      = max(Decimal("0"), _parse_dec(_get(row, "avg_cpc")))
        conversions  = max(Decimal("0"), _parse_dec(_get(row, "conversions")))

        conv_value_raw = max(Decimal("0"), _parse_dec(_get(row, "conversion_value")))
        aov_raw        = max(Decimal("0"), _parse_dec(_get(row, "avg_order_value")))

        # ── Recalculate derived metrics (authoritative) ───────────────────────

        # CTR: clicks / impressions * 100
        if impressions > 0:
            ctr = _clamp_pct((Decimal(clicks) / Decimal(impressions)) * Decimal("100"))
        else:
            ctr = Decimal("0")

        # Conversion Rate: conversions / clicks * 100
        if clicks > 0:
            conversion_rate = _clamp_pct((conversions / Decimal(clicks)) * Decimal("100"))
        else:
            conversion_rate = Decimal("0")

        # Cost per conversion: spend / conversions
        if conversions > Decimal("0"):
            cost_per_conversion: Optional[Decimal] = spend / conversions
        else:
            cost_per_conversion = None

        # ROAS: conversion_value / spend
        if is_ecomm and conv_value_raw > Decimal("0") and spend > Decimal("0"):
            roas: Optional[Decimal] = conv_value_raw / spend
        else:
            roas = None

        # ── Client-type masking ───────────────────────────────────────────────
        if is_ecomm:
            conversion_value: Optional[Decimal] = _null_if_zero(conv_value_raw)
            avg_order_value:  Optional[Decimal] = _null_if_zero(aov_raw)
        else:
            conversion_value = None
            roas             = None
            avg_order_value  = None

        # ── Validation ────────────────────────────────────────────────────────
        warnings: list[str] = []
        if ctr > Decimal("100"):
            warnings.append(f"CTR {ctr} > 100% on row {line_num} — clamped")
            ctr = Decimal("100")
        if conversion_rate > Decimal("100"):
            warnings.append(f"Conv. rate {conversion_rate} > 100% on row {line_num} — clamped")
            conversion_rate = Decimal("100")

        for w in warnings:
            logger.warning(w)
            result.errors.append(w)

        # ── Build output row ──────────────────────────────────────────────────
        result.rows.append(ParsedCampaignRow(
            report_date         = report_date,
            campaign_name       = raw_campaign.strip(),
            currency            = currency,
            impressions         = impressions,
            clicks              = clicks,
            spend               = spend,
            avg_cpc             = avg_cpc,
            ctr                 = ctr,
            conversions         = conversions,
            conversion_rate     = conversion_rate,
            cost_per_conversion = cost_per_conversion,
            conversion_value    = conversion_value,
            roas                = roas,
            avg_order_value     = avg_order_value,
            ingestion_source    = "csv",
        ))

    logger.info(
        f"parse_google_ads_csv: {len(result.rows)} rows parsed, "
        f"{result.skipped} skipped, {len(result.errors)} warnings/errors"
    )
    return result


def generate_csv_template() -> str:
    """
    Return a CSV string with the exact Google Ads UI export headers
    plus one sample row so users know the expected format.
    """
    headers = [
        "Day", "Campaign", "Impr.", "Clicks", "CTR",
        "Currency code", "Cost", "Avg. CPC", "Conversions",
        "Cost / conv.", "Conv. value / cost", "Conv. value",
        "Conv. rate", "Avg. order value",
    ]
    sample = [
        "2024-04-15", "My Campaign", "1000", "50", "5.00%",
        "AUD", "97.50", "1.95", "3.00",
        "32.50", "1.23", "97.50",
        "6.00%", "32.50",
    ]
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(headers)
    writer.writerow(sample)
    return buf.getvalue()
