"""Derived Metrics Calculator.

Computes all KPIs from raw aggregated data.  Every function accepts nullable
inputs and returns None when the computation is not possible (division by zero
or missing data).
"""

from __future__ import annotations
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from typing import Optional


def _safe_decimal(value) -> Optional[Decimal]:
    """Coerce any value to Decimal, returning None on failure."""
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _safe_divide(numerator, denominator, scale: int = 4) -> Optional[Decimal]:
    """Divide two values, returning None if denominator is zero/None."""
    n = _safe_decimal(numerator)
    d = _safe_decimal(denominator)
    if n is None or d is None or d == 0:
        return None
    return (n / d).quantize(Decimal(10) ** -scale, rounding=ROUND_HALF_UP)


# ── Core Metrics ─────────────────────────────────────────────────────────────


def roas(conv_value, spend) -> Optional[Decimal]:
    """Return on Ad Spend = conversion_value / spend."""
    return _safe_divide(conv_value, spend)


def ctr(clicks, impressions) -> Optional[Decimal]:
    """Click-Through Rate (%) = clicks / impressions × 100."""
    r = _safe_divide(clicks, impressions)
    return (r * 100).quantize(Decimal("0.0001")) if r is not None else None


def cpc(spend, clicks) -> Optional[Decimal]:
    """Cost Per Click = spend / clicks."""
    return _safe_divide(spend, clicks)


def cpl(spend, leads) -> Optional[Decimal]:
    """Cost Per Lead = spend / leads."""
    return _safe_divide(spend, leads)


def conversion_rate(conversions, clicks) -> Optional[Decimal]:
    """Conversion Rate (%) = conversions / clicks × 100."""
    r = _safe_divide(conversions, clicks)
    return (r * 100).quantize(Decimal("0.0001")) if r is not None else None


def avg_order_value(revenue, orders) -> Optional[Decimal]:
    """Average Order Value = revenue / orders."""
    return _safe_divide(revenue, orders, scale=2)


def form_completion_rate(leads, form_opens) -> Optional[Decimal]:
    """Form Completion Rate (%) = leads / form_opens × 100."""
    r = _safe_divide(leads, form_opens)
    return (r * 100).quantize(Decimal("0.0001")) if r is not None else None


def revenue_per_click(purchase_revenue, ad_clicks) -> Optional[Decimal]:
    """Revenue Per Click = purchase_revenue / ad_clicks."""
    return _safe_divide(purchase_revenue, ad_clicks)


# ── Growth Metrics ───────────────────────────────────────────────────────────


def wow_growth(current_value, previous_value) -> Optional[Decimal]:
    """Week-over-Week Growth (%) = (current - previous) / previous × 100."""
    c = _safe_decimal(current_value)
    p = _safe_decimal(previous_value)
    if c is None or p is None or p == 0:
        return None
    return ((c - p) / p * 100).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def mom_growth(current_value, previous_value) -> Optional[Decimal]:
    """Month-over-Month Growth (%) = (current - previous) / previous × 100."""
    return wow_growth(current_value, previous_value)  # Same formula


# ── Aggregation Helpers ──────────────────────────────────────────────────────


def safe_sum(values: list) -> Decimal:
    """Sum a list of values, treating None as 0."""
    total = Decimal("0")
    for v in values:
        d = _safe_decimal(v)
        if d is not None:
            total += d
    return total


def safe_avg(values: list) -> Optional[Decimal]:
    """Average a list of values, skipping None."""
    cleaned = [_safe_decimal(v) for v in values if _safe_decimal(v) is not None]
    if not cleaned:
        return None
    return (sum(cleaned) / len(cleaned)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def aggregate_metrics(rows: list[dict], metric_keys: list[str]) -> dict:
    """Aggregate a list of metric dicts — sums numeric fields.

    Returns a single dict with summed values for each key.
    """
    result = {}
    for key in metric_keys:
        result[key] = safe_sum([row.get(key) for row in rows])
    return result


def build_summary_with_derived(
    totals: dict,
    previous_totals: Optional[dict] = None,
) -> dict:
    """Build a full summary dict from aggregated totals.

    Includes computed metrics: CTR, CPC, ROAS, Conversion Rate, and
    growth percentages if previous_totals is supplied.
    """
    summary = dict(totals)

    # Derived metrics
    summary["ctr"] = ctr(totals.get("clicks"), totals.get("impressions"))
    summary["cpc"] = cpc(totals.get("spend"), totals.get("clicks"))
    summary["roas"] = roas(totals.get("conv_value"), totals.get("spend"))
    summary["conversion_rate"] = conversion_rate(
        totals.get("conversions"), totals.get("clicks")
    )

    # Stringify Decimals for JSON serialisation
    for k, v in summary.items():
        if isinstance(v, Decimal):
            summary[k] = str(v)

    # Growth metrics
    if previous_totals:
        growth = {}
        growth_keys = [
            "impressions", "clicks", "spend", "conversions", "conv_value",
            "ctr", "cpc", "roas", "conversion_rate",
            "reach",  # Meta-specific — summed directly
        ]
        for key in growth_keys:
            current = summary.get(key)
            prev = previous_totals.get(key)
            # If KPI is not in previous_totals, try to compute it
            if key in ["ctr", "cpc", "roas", "conversion_rate"] and prev is None:
                if key == "ctr": prev = ctr(previous_totals.get("clicks"), previous_totals.get("impressions"))
                if key == "cpc": prev = cpc(previous_totals.get("spend"), previous_totals.get("clicks"))
                if key == "roas": prev = roas(previous_totals.get("conv_value"), previous_totals.get("spend"))
                if key == "conversion_rate": prev = conversion_rate(previous_totals.get("conversions"), previous_totals.get("clicks"))

            growth[f"{key}_growth"] = str(
                wow_growth(current, prev) or "0"
            )
        summary["growth"] = growth

    return summary
