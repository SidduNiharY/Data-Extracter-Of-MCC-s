# Performance Dashboard — Design Spec
**Date:** 2026-04-19  
**Status:** Approved  

---

## Overview

A new cross-client Performance Dashboard that shows aggregated ad metrics for all active clients in a single sortable, filterable table. Metrics span Google Ads, Shopify, and GA4. Users can select any date range (Google Ads-style picker), apply multiple filters, assign a manual priority rank per client, and configure red/green colorization thresholds globally or per client.

---

## 1. Architecture & Data Flow

```
User selects date range
        ↓
GET /api/dashboard/performance?date_from=&date_to=
        ↓
Backend: for each active client (parallel async queries) →
  ├── Query google_ads_campaigns  → impressions, clicks, cost, CPC
  ├── Query shopify_orders        → orders, revenue
  └── Query ga4_sessions          → orders, revenue, ROAS
        ↓
Merge into one DashboardRow per client, compute:
  R/C = revenue / cost
  ROAS (Shopify) = shopify_revenue / cost
  ROAS (GA4)     = ga4_revenue / cost
        ↓
Return: list[DashboardRow]
        ↓
Frontend table renders with date range picker, filters,
inline priority editing, and threshold-based colorization
```

---

## 2. Backend

### 2.1 New API Endpoint

```
GET /api/dashboard/performance
  ?date_from=YYYY-MM-DD   (required)
  &date_to=YYYY-MM-DD     (required)
  &client_ids=uuid,...    (optional — filter to specific clients)
```

### 2.2 Response Shape — `DashboardRow`

```json
{
  "client_id": "uuid",
  "client_name": "Acme Store",
  "priority": 1,
  "connected_sources": ["google_ads", "shopify"],

  "impressions": 120000,
  "clicks": 3400,
  "cost": 5200.00,
  "cpc": 1.53,

  "orders": 210,        // sum of shopify_orders + ga4_orders (deduped where possible, otherwise additive)
  "revenue": 18900.00,  // shopify_revenue if available, else ga4_revenue, else null
  "rc_ratio": 3.63,     // revenue / cost

  "shopify_orders": 180,
  "shopify_revenue": 16200.00,
  "shopify_roas": 3.12,

  "ga4_orders": 190,
  "ga4_revenue": 17100.00,
  "ga4_roas": 3.29
}
```

Null values are returned for metrics where the source is not connected for that client.

### 2.3 Schema Migrations

**Migration 1 — `clients` table:**
```sql
ALTER TABLE clients ADD COLUMN priority INTEGER NULL;
```

**Migration 2 — `dashboard_thresholds` table:**
```sql
CREATE TABLE dashboard_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name VARCHAR(50) NOT NULL UNIQUE,
  red_below NUMERIC(18,4) NULL,     -- NULL means no lower red bound
  green_above NUMERIC(18,4) NULL,   -- NULL means no upper green bound
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Default seed rows:
| metric_name | red_below | green_above |
|---|---|---|
| roas | 2.0 | 4.0 |
| cpc | — | 1.00 |
| rc_ratio | 2.0 | 5.0 |
| orders | 10 | 100 |
| revenue | 1000 | 10000 |

**Migration 3 — `report_settings` JSONB on `clients`:**  
Extend existing JSONB field with threshold overrides (no new column needed):
```json
{
  "threshold_overrides": {
    "roas":  { "red_below": 1.5, "green_above": 3.0 },
    "cpc":   { "red_below": null, "green_above": 0.8 }
  }
}
```

### 2.4 New Files

| File | Purpose |
|---|---|
| `app/routers/dashboard.py` | All dashboard endpoints, registered at `/api/dashboard` |
| `app/services/dashboard_aggregator.py` | Parallel async queries per client, merges into `DashboardRow` |
| `app/schemas/dashboard.py` | Pydantic schemas: `DashboardRow`, `ThresholdConfig`, `ThresholdUpdate` |
| `app/models/dashboard.py` | SQLAlchemy model for `dashboard_thresholds` table |
| `alembic/versions/<hash>_add_dashboard.py` | Migration: priority column + dashboard_thresholds table |

### 2.5 Threshold Endpoints

```
GET  /api/dashboard/thresholds         ← fetch all global defaults
PUT  /api/dashboard/thresholds         ← save global defaults (bulk)
PATCH /api/clients/{id}/thresholds     ← save per-client overrides
GET  /api/clients/{id}/thresholds      ← fetch merged thresholds (global + override)
```

### 2.6 Priority Endpoint

```
PATCH /api/clients/{id}/priority       ← body: { "priority": 3 }
```

---

## 3. Frontend

### 3.1 New Page

`/frontend/src/app/dashboard/page.tsx` — added to sidebar nav.

### 3.2 New Components

| File | Purpose |
|---|---|
| `components/dashboard/DashboardTable.tsx` | Main sortable data table |
| `components/dashboard/DateRangePicker.tsx` | Google Ads-style date range picker |
| `components/dashboard/DashboardFilters.tsx` | Filter bar (search, source, performance, priority) |
| `components/dashboard/MetricCell.tsx` | Single cell with threshold-based red/green colorization |
| `components/dashboard/PriorityCell.tsx` | Inline editable priority rank number |
| `components/dashboard/ThresholdEditor.tsx` | Modal to edit global thresholds |

### 3.3 Page Layout

```
┌─────────────────────────────────────────────────────┐
│  Performance Dashboard          [Date Range Picker]  │
├─────────────────────────────────────────────────────┤
│  [Search: client name] [Source ▾] [Performance ▾]   │
│  [Priority ▾]          [⚙ Thresholds]               │
├──────┬──────────────┬───────────────┬───────────────┤
│ Pri  │ Account Name │ Google Ads    │ Shopify / GA4  │
│      │              │ Imp Clk Cost  │ Ord Rev ROAS   │
├──────┼──────────────┼───────────────┼───────────────┤
│  1   │ Acme Store   │ 🟢  🔴  🟢   │ 🟢  🟢  🔴    │
│  2   │ Beta Brand   │ 🟢  🟢  🟢   │ 🔴  🔴  🔴    │
└──────┴──────────────┴───────────────┴───────────────┘
```

### 3.4 Date Range Picker Presets

Today, Yesterday, Last 7 days, Last 14 days, Last 30 days, This month, Last month, Custom range (calendar date picker)

### 3.5 Filter Capabilities

| Filter | Behaviour |
|---|---|
| Search | Filter rows by client name (client-side, instant) |
| Source | Show only clients with specific source connected (google_ads / shopify / ga4 / meta) |
| Performance | Show only clients with ≥1 metric in red |
| Priority | Show only clients with priority ≤ N (e.g. top 5) |
| Date range | Triggers API refetch for all rows |

### 3.6 Colorization Logic (`MetricCell.tsx`)

Threshold resolution order:
```
client.report_settings.threshold_overrides[metric]
  ?? global dashboard_thresholds[metric]
  ?? no colorization
```

Rules:
- `value < red_below` → red cell background + red text
- `value > green_above` → green cell background + green text  
- Between thresholds → neutral (no color)
- Source not connected / no data → grey "—"

### 3.7 Priority Cell (`PriorityCell.tsx`)

- Displays current priority number (or "—" if unset)
- Click to activate inline input — type a number, press Enter or blur to save
- Calls `PATCH /api/clients/{id}/priority` on save
- Table re-sorts by priority column after save

### 3.8 API additions to `api.ts`

```ts
getDashboardPerformance(dateFrom: string, dateTo: string): Promise<DashboardRow[]>
updateClientPriority(clientId: string, priority: number | null): Promise<void>
getDashboardThresholds(): Promise<ThresholdConfig[]>
saveDashboardThresholds(thresholds: ThresholdConfig[]): Promise<void>
getClientThresholds(clientId: string): Promise<ThresholdConfig[]>
saveClientThresholdOverrides(clientId: string, overrides: Record<string, ThresholdOverride>): Promise<void>
```

### 3.9 New Types (`types/index.ts` additions)

```ts
export interface DashboardRow {
  client_id: string;
  client_name: string;
  priority: number | null;
  connected_sources: DataSource[];
  impressions: number | null;
  clicks: number | null;
  cost: number | null;
  cpc: number | null;
  orders: number | null;
  revenue: number | null;
  rc_ratio: number | null;
  shopify_orders: number | null;
  shopify_revenue: number | null;
  shopify_roas: number | null;
  ga4_orders: number | null;
  ga4_revenue: number | null;
  ga4_roas: number | null;
}

export interface ThresholdConfig {
  metric_name: string;
  red_below: number | null;
  green_above: number | null;
}

export interface ThresholdOverride {
  red_below: number | null;
  green_above: number | null;
}
```

---

## 4. Threshold Configuration UI

### 4.1 Global Thresholds — Settings Page (`/settings`)

New "Dashboard Thresholds" card on the settings page. Editable table with Save button.

```
┌─────────────────────────────────────────────────┐
│  Dashboard Thresholds              [Save Changes]│
├────────────┬──────────────┬─────────────────────┤
│ Metric     │ 🔴 Red below │ 🟢 Green above       │
├────────────┼──────────────┼─────────────────────┤
│ ROAS       │     2.0      │       4.0            │
│ CPC        │      —       │       1.00           │
│ R/C Ratio  │     2.0      │       5.0            │
│ Revenue    │   1,000      │      10,000          │
│ Orders     │     10       │       100            │
└────────────┴──────────────┴─────────────────────┘
```

### 4.2 Per-Client Overrides — Client Detail Page (`/clients/[id]`)

New expandable "Threshold Overrides" section. Only shows metrics where client differs from global. Empty = inherits global.

```
┌─────────────────────────────────────────────────┐
│  Threshold Overrides  (inherits global defaults) │
├────────────┬──────────────┬─────────────────────┤
│ ROAS       │ 🔴  1.5      │ 🟢  3.0  [reset]    │
│ CPC        │ 🔴  —        │ 🟢  0.80 [reset]    │
└────────────┴──────────────┴─────────────────────┘
                              [+ Add override]
```

"Reset" removes the override and falls back to global default.

---

## 5. Out of Scope

- Export to CSV / PDF from the dashboard table (future)
- Real-time auto-refresh (future)
- Meta Ads columns in the table (can be added later — same pattern)
- Chart/graph view (future)
