# SuperMatrix — Changelog

All notable changes to this project are documented in this file.

---

## [2026-04-14] v2.0 — Report Generation Engine & Reports Dashboard

### Summary

This session introduced the **complete report generation system** for the SuperMatrix platform. Clients connected to any combination of Google Ads, Meta Ads, Shopify, and/or GA4 can now have **weekly and monthly performance reports** automatically generated, stored, and viewed in a rich interactive dashboard.

The system aggregates raw daily metrics from all platform tables, computes derived KPIs (ROAS, CTR, CPC, CPL, conversion rates, WoW/MoM growth), and stores structured report data as JSONB sections. An automated scheduler runs weekly pulls and report generation on a cron schedule.

---

### 🔧 Backend — New Files

#### `backend/app/models/reports.py` *(NEW)*
- **`Report` model** — Master report record (one per client per period per type)
  - Fields: `client_id`, `report_type` (weekly/monthly), `period_start`, `period_end`, `status` (generating/ready/failed)
  - Unique constraint on `(client_id, report_type, period_start)`
  - Indexes on `client_id`, `report_type`, `period_start`, `status`
- **`ReportSection` model** — One section per platform per report
  - Fields: `report_id`, `source` (google_ads/meta_ads/shopify/ga4/cross_platform), `section_type`, `data` (JSONB)
  - Section types: summary, campaign_breakdown, search_terms, keywords, time_segments, demographics, leadgen, orders, products, channel_breakdown, device_breakdown

#### `backend/app/services/calculator.py` *(NEW)*
- **Derived Metrics Calculator** — All KPI formulas with null-safe arithmetic:

| Function | Formula |
|----------|---------|
| `roas()` | conv_value / spend |
| `ctr()` | clicks / impressions × 100 |
| `cpc()` | spend / clicks |
| `cpl()` | spend / leads |
| `conversion_rate()` | conversions / clicks × 100 |
| `avg_order_value()` | revenue / orders |
| `form_completion_rate()` | leads / form_opens × 100 |
| `wow_growth()` | (current − previous) / previous × 100 |
| `mom_growth()` | Same as WoW formula |
| `revenue_per_click()` | purchase_revenue / ad_clicks |

- Aggregation helpers: `safe_sum()`, `safe_avg()`, `aggregate_metrics()`, `build_summary_with_derived()`

#### `backend/app/services/report_generator.py` *(NEW)*
- **`ReportGenerator` class** — Orchestrates report generation:
  - `generate_weekly(client_id, week_start, week_end)` — defaults to previous Mon-Sun
  - `generate_monthly(client_id, year, month)` — defaults to previous calendar month
  - `generate_all_weekly()` / `generate_all_monthly()` — batch for all active clients
- Platform-specific section builders:
  - **Google Ads**: summary, campaign_breakdown, search_terms, keywords, time_segments, demographics
  - **Meta Ads**: summary, campaign_breakdown, leadgen, time_segments, demographics
  - **Shopify**: summary (revenue, orders, AOV, new vs returning), top_products
  - **GA4**: summary (revenue, transactions, sessions), channel_breakdown, device_breakdown
  - **Cross-Platform**: total spend, total revenue, blended ROAS, platform list
- Each section includes **WoW/MoM growth** by comparing against the previous period

#### `backend/app/schemas/reports.py` *(NEW)*
- Pydantic models: `ReportRead`, `ReportSectionRead`, `ReportSummary`, `GenerateReportRequest`
- Enums: `ReportType` (weekly/monthly), `ReportStatus` (generating/ready/failed)

#### `backend/app/routers/reports.py` *(NEW)*
- **6 new API endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/reports` | List reports (filterable by `client_id`, `report_type`, `status`) |
| `GET` | `/api/reports/{report_id}` | Full report with all sections |
| `GET` | `/api/reports/client/{client_id}/latest` | Latest weekly + monthly for a client |
| `POST` | `/api/reports/generate` | Trigger report generation (runs in background) |
| `POST` | `/api/reports/generate-all` | Generate reports for ALL active clients |

#### `backend/app/scheduler.py` *(NEW)*
- **APScheduler** integration with FastAPI's lifespan context manager
- Three cron jobs:

| Job | Schedule | Action |
|-----|----------|--------|
| Weekly Data Pull | Monday 06:00 UTC | Pulls last 7 days data for all clients |
| Weekly Reports | Monday 08:00 UTC | Generates weekly reports (after pull completes) |
| Monthly Reports | 1st of month 09:00 UTC | Generates monthly reports |

---

### 🔧 Backend — Modified Files

#### `backend/app/main.py`
- Imported and registered `reports` router at `/api/reports`
- Integrated APScheduler `lifespan` for automatic start/stop
- Bumped version to `2.0.0`

#### `backend/app/models/__init__.py`
- Exported `Report` and `ReportSection` for Alembic auto-discovery

#### `backend/app/routers/__init__.py`
- Exported `reports_router`

#### `backend/app/routers/clients.py`
- **Added `POST /api/clients/{client_id}/connect` endpoint**
  - Accepts `{ source, credentials }` to attach API credentials for any data source
  - Creates or updates `ClientConnection` record
  - Supports: `google_ads`, `meta_ads`, `shopify`, `ga4`

#### `backend/requirements.txt`
- Added `apscheduler==3.10.4` (scheduler)
- Added `openpyxl==3.1.5` (future Excel export)

---

### 🎨 Frontend — New Files

#### `frontend/src/components/KPICard.tsx` *(NEW)*
- Reusable KPI metric card with:
  - Accent-colored top glow line
  - Label, value, prefix/suffix
  - WoW/MoM growth badge with TrendingUp/TrendingDown icon
  - Color-coded: green (positive), red (negative), gray (neutral)
  - Optional icon in top-right corner

#### `frontend/src/components/ReportCard.tsx` *(NEW)*
- Glassmorphism card for report list items:
  - Accent color by type (blue for weekly, purple for monthly)
  - Status badge with icon (CheckCircle/AlertCircle/Loader2)
  - Period date range display
  - Section count footer
  - Click to navigate to full report view

#### `frontend/src/app/reports/page.tsx` *(NEW)*
- **Reports listing page:**
  - Header with "Generate Weekly" and "Generate Monthly" buttons
  - Stats row: Total Reports, Ready, Weekly, Monthly counts
  - Filter bar: Type dropdown, Client dropdown, Status dropdown, Refresh button
  - Report card grid with staggered fade-in animations
  - Empty state with CTA
  - Loading shimmer skeletons

#### `frontend/src/app/reports/[id]/page.tsx` *(NEW)*
- **Full report view page:**
  - Header with report type, status badge, client name, date range
  - **Tab navigation** per platform source (Google Ads | Meta Ads | Shopify | GA4 | Cross-Platform)
  - **Section renderers** for each section type:
    - `SummarySection` — KPI cards grid with growth badges
    - `CampaignBreakdownSection` — Sortable table with campaign metrics
    - `TableSection` — Generic table for search terms, keywords
    - `TimeSegmentsSection` — Bar chart (day-of-week) + Line chart (hour-of-day)
    - `DemographicsSection` — Pie chart (gender) + Bar chart (age)
    - `LeadgenSection` — KPI cards + table
    - `ProductsSection` — Horizontal bar chart (top products by revenue)
    - `ChannelBreakdownSection` — Donut pie chart + data table
    - `DeviceBreakdownSection` — Device stat cards with icons
  - **Charts** powered by Recharts (Bar, Line, Pie with custom dark-mode tooltips)
  - Back button, shimmer loading state, 404 empty state

---

### 🎨 Frontend — Modified Files

#### `frontend/src/components/Sidebar.tsx`
- Added "Reports" nav item with `FileBarChart` icon (between Pull Jobs and Settings)

#### `frontend/src/lib/api.ts`
- Added 5 new report API methods:
  - `getReports(params?)` — List with filters
  - `getReport(id)` — Full report with sections
  - `getLatestReports(clientId)` — Latest weekly + monthly
  - `generateReport(req)` — Trigger single client report
  - `generateAllReports(type)` — Trigger all clients

#### `frontend/src/types/index.ts`
- Added `Report`, `ReportSection`, `ReportSummary`, `GenerateReportRequest` interfaces

#### `frontend/package.json`
- Added `recharts` dependency for chart visualizations

---

### 📁 Files Changed (Summary)

| File | Action |
|---|---|
| `backend/app/models/reports.py` | **New** — Report + ReportSection models |
| `backend/app/services/calculator.py` | **New** — Derived metrics calculator |
| `backend/app/services/report_generator.py` | **New** — Report generation orchestrator |
| `backend/app/schemas/reports.py` | **New** — Pydantic schemas |
| `backend/app/routers/reports.py` | **New** — Reports REST API |
| `backend/app/scheduler.py` | **New** — APScheduler cron jobs |
| `backend/app/main.py` | Modified — added reports router + scheduler lifespan |
| `backend/app/models/__init__.py` | Modified — exported new models |
| `backend/app/routers/__init__.py` | Modified — exported reports_router |
| `backend/app/routers/clients.py` | Modified — added `/connect` endpoint |
| `backend/requirements.txt` | Modified — added apscheduler, openpyxl |
| `frontend/src/components/KPICard.tsx` | **New** — KPI metric card |
| `frontend/src/components/ReportCard.tsx` | **New** — Report list card |
| `frontend/src/app/reports/page.tsx` | **New** — Reports listing page |
| `frontend/src/app/reports/[id]/page.tsx` | **New** — Full report view page |
| `frontend/src/components/Sidebar.tsx` | Modified — added Reports nav |
| `frontend/src/lib/api.ts` | Modified — added 5 report API methods |
| `frontend/src/types/index.ts` | Modified — added 4 report interfaces |
| `frontend/package.json` | Modified — added recharts |

---

### 🏗️ Remaining Work

1. **Phase 1 — Data Source Onboarding:** Meta Business Manager connector, Shopify/GA4 credential entry UI
2. **Phase 3 — DB Migration:** Run `alembic revision --autogenerate` and `alembic upgrade head` for reports tables
3. **Phase 6 — Export:** PDF/Excel report export service and download endpoints

---

## [2026-04-13] Google Ads MCC Integration & UI Overhaul

### Summary

This session introduced **live Google Ads MCC (Manager Account) integration** to the SuperMatrix Data Extractor platform. Previously, client accounts had to be manually entered into the database. Now, the application can automatically discover all child accounts linked to the configured MCC and import them with a single click from the frontend.

Additionally, the entire frontend UI was **redesigned from scratch** with a premium dark-mode aesthetic including glassmorphism cards, gradient accents, stat panels, and micro-animations.

---

### 🔑 Google Ads Authentication Setup

The application uses **OAuth 2.0 (Desktop App flow)** to authenticate with the Google Ads API at the MCC level. Five environment variables were added to `backend/.env`:

| Variable | Source | Purpose |
|---|---|---|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads MCC → Admin → API Center | Authorizes API access |
| `GOOGLE_ADS_CLIENT_ID` | Google Cloud Console → Credentials → OAuth 2.0 | OAuth client identity |
| `GOOGLE_ADS_CLIENT_SECRET` | Google Cloud Console → Credentials → OAuth 2.0 | OAuth client secret |
| `GOOGLE_ADS_REFRESH_TOKEN` | Generated via `google-oauthlib-tool` CLI script | Long-lived token for background access |
| `GOOGLE_ADS_MCC_ID` | Top-right corner of Google Ads Manager dashboard | Your 10-digit Manager Account ID |

> **How the auth flow works:** The MCC credential (`login_customer_id`) authenticates as the Manager Account, and then individual child account data is fetched by passing each child's `customer_id` to the Google Ads Query Language (GAQL) queries. This means one set of credentials pulls data for ALL linked accounts.

---

### 🔧 Backend Changes

#### `backend/.env`
- Added 5 new Google Ads MCC environment variables (listed above).

#### `backend/app/connectors/google_ads.py`
- **Rewrote `list_child_accounts()` method.** 
  - Now uses the `customer_client` GAQL resource to directly query the MCC for all linked child accounts (non-manager only).
  - Added a fallback to `list_accessible_customers()` if the primary method fails.
  - Added logging throughout for easier debugging.

#### `backend/app/routers/google_ads.py`
- **Added `GET /api/data/google-ads/mcc-accounts` endpoint.**
  - Initializes `GoogleAdsConnector` and calls `list_child_accounts()`.
  - Cross-references results with the local `clients` database table to flag already-imported accounts (`is_imported: true/false`).
  - Returns a JSON array of `{ customer_id, name, is_imported }`.

#### `backend/app/routers/clients.py`
- **Added `POST /api/clients/import-mcc` endpoint.**
  - Accepts `{ customer_id, name }` in the request body.
  - If the `customer_id` already exists in the database, returns a `400` error.
  - If a client with the same `name` already exists (e.g., as a Meta-only client), it **upgrades** the client type to `google_meta` and attaches the Google Ads Customer ID — this fixes the "dual-platform type error" that existed previously.
  - If the client is completely new, creates a `Client` record with `type = "google_only"`.

#### `google-ads` library upgrade
- Upgraded from `25.1.0` → `30.0.0` to fix a `GRPC target method can't be resolved` error caused by Google sunsetting API `v18`.

---

### 🎨 Frontend Changes

#### Design System — `frontend/src/app/globals.css`
Complete overhaul of the CSS design system:
- New CSS variables: `--shadow-*`, `--accent-cyan`, `--accent-gradient-subtle`, `--radius-xl`, `--radius-2xl`, `--space-5`, `--space-10`
- New utility classes:
  - `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-sm` — Gradient buttons with hover glow
  - `.stat-card`, `.stat-card-label`, `.stat-card-value` — KPI stat panels
  - `.data-table` — Styled table with hover rows and uppercase headers
  - `.badge`, `.badge-imported`, `.badge-google`, `.badge-meta` — Status/platform pills
  - `.empty-state` — Centered empty content with icon
  - `.shimmer`, `.animate-spin` — Loading animations
- Enhanced `.glass-card` with top highlight line (`::before` pseudo-element) and blue glow on hover

#### Sidebar — `frontend/src/components/Sidebar.tsx`
- Gradient logo icon with box-shadow
- "DATA PLATFORM" subtitle label
- "NAVIGATION" section header
- Active link indicator bar (left edge, gradient)
- Redesigned system status card with green glow dot

#### Client Card — `frontend/src/components/ClientCard.tsx`
- Accent-colored top line per client type (blue for Search, purple for Social, cyan for Multi-Platform, etc.)
- Human-readable type labels (Search, Social, Multi-Platform, E-Commerce, Lead Gen)
- Active/Inactive status dot indicator
- Arrow icon (top-right) for visual affordance
- Footer showing Google Ads Customer ID and creation date

#### Data Source Badge — `frontend/src/components/DataSourceBadge.tsx`
- Added colored dot indicator before label text
- Softer background colors with matching border
- Consistent sizing across all platforms

#### Pull Job Status — `frontend/src/components/PullJobStatus.tsx`
- Added Lucide icons per status (Clock, Loader2, Check, X, AlertTriangle)
- Spinning animation for "running" state
- Pill badge with icon + text

#### Clients List Page — `frontend/src/app/clients/page.tsx`
- Active client count in subtitle
- "Import from MCC" gradient button with upload icon
- Staggered card entrance animations (50ms delay per card)
- Empty state with CTA when no clients exist

#### MCC Import Page — `frontend/src/app/clients/mcc-import/page.tsx` *(NEW)*
- "Back to Clients" ghost button
- Stats row: Discovered / Imported / Available counts
- Search bar with clear button (filters by name or customer ID)
- Premium `data-table` with:
  - Cloud/Check icon per row
  - Monospaced customer ID
  - "Available" / "Synced" status badges
  - "Add to App" gradient button with loading spinner
  - Staggered row entrance animations
- Empty states for loading, no accounts found, and no search results

#### Executive Dashboard — `frontend/src/app/page.tsx`
- Stat cards with Lucide icons (TrendingUp, Layers, AlertTriangle)
- Conditional color for Failed Pulls (red if > 0, green if 0)
- Staggered client card animations
- Styled job activity panel with uppercase source labels

#### Types — `frontend/src/types/index.ts`
- Added `MCCAccount` interface (`customer_id`, `name`, `is_imported`)

#### API Layer — `frontend/src/lib/api.ts`
- Added `getMccAccounts()` → `GET /api/data/google-ads/mcc-accounts`
- Added `importMccAccount(customer_id, name)` → `POST /api/clients/import-mcc`

---

### 📁 Files Changed (Summary)

| File | Action |
|---|---|
| `backend/.env` | Modified — added 5 Google Ads keys |
| `backend/app/connectors/google_ads.py` | Modified — rewrote `list_child_accounts()` |
| `backend/app/routers/google_ads.py` | Modified — added `/mcc-accounts` endpoint |
| `backend/app/routers/clients.py` | Modified — added `/import-mcc` endpoint |
| `frontend/src/app/globals.css` | Modified — complete design system overhaul |
| `frontend/src/app/layout.tsx` | Unchanged |
| `frontend/src/app/page.tsx` | Modified — redesigned dashboard |
| `frontend/src/app/clients/page.tsx` | Modified — redesigned clients list |
| `frontend/src/app/clients/mcc-import/page.tsx` | **New** — MCC import page |
| `frontend/src/app/clients/[id]/page.tsx` | Unchanged |
| `frontend/src/components/Sidebar.tsx` | Modified — redesigned sidebar |
| `frontend/src/components/ClientCard.tsx` | Modified — redesigned client card |
| `frontend/src/components/DataSourceBadge.tsx` | Modified — added dot indicator |
| `frontend/src/components/PullJobStatus.tsx` | Modified — added icons |
| `frontend/src/types/index.ts` | Modified — added `MCCAccount` |
| `frontend/src/lib/api.ts` | Modified — added 2 new API methods |

---

### ⚠️ Known Limitations

1. **Developer Token Pending:** The Google Ads Developer Token is currently in "Pending Approval" status. Account names show as "Unknown" until Google grants full access. Real campaign data cannot be pulled until the token is approved.
2. **Google Ads Only:** This session focused exclusively on Google Ads MCC. Meta Ads MCC and Shopify store-level imports are planned for future sessions.
3. **No automated tests:** Backend changes are verified through manual API testing and frontend interaction.
