# Low Level Design (LLD)
## SuperMatrix — Multi-Platform Ads Data Extractor
**Version:** 1.0 | **Date:** April 2026

---

## 1. Project File Structure

```
supermatrix/
│
├── frontend/                               # Next.js 14 (App Router)
│   ├── app/
│   │   ├── layout.tsx                      # Root layout, global nav
│   │   ├── page.tsx                        # Dashboard — all clients summary
│   │   ├── clients/
│   │   │   ├── page.tsx                    # Client list with status badges
│   │   │   └── [id]/
│   │   │       └── page.tsx                # Per-client detail: all metrics
│   │   └── pulls/
│   │       └── page.tsx                    # Pull job history + status
│   ├── components/
│   │   ├── ClientCard.tsx                  # Client summary card
│   │   ├── MetricsTable.tsx                # Generic metrics table
│   │   ├── DataSourceBadge.tsx             # Google/Meta/Shopify/GA4 badge
│   │   └── PullJobStatus.tsx               # Job status indicator
│   ├── lib/
│   │   └── api.ts                          # Axios wrapper → Python API
│   ├── types/
│   │   └── index.ts                        # TypeScript types for all entities
│   ├── next.config.js
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── main.py                         # FastAPI app, router registration
│   │   ├── database.py                     # SQLAlchemy engine, session factory
│   │   │
│   │   ├── models/                         # SQLAlchemy ORM models (DB tables)
│   │   │   ├── __init__.py
│   │   │   ├── client.py                   # clients, client_connections, pull_jobs
│   │   │   ├── google_ads.py               # 5 tables: campaign, search_terms,
│   │   │   │                               #   keywords, time_segments, demographics
│   │   │   ├── meta_ads.py                 # 4 tables: campaign, leadgen,
│   │   │   │                               #   time_segments, demographics
│   │   │   ├── shopify.py                  # 2 tables: orders, products
│   │   │   └── ga4.py                      # 3 tables: revenue, channel, device
│   │   │
│   │   ├── schemas/                        # Pydantic v2 models (API I/O)
│   │   │   ├── __init__.py
│   │   │   ├── client.py                   # ClientCreate, ClientRead, ConnectionCreate
│   │   │   ├── google_ads.py               # CampaignRow, SearchTermRow, etc.
│   │   │   ├── meta_ads.py                 # MetaCampaignRow, LeadGenRow, etc.
│   │   │   ├── shopify.py                  # OrderRow, ProductRow
│   │   │   └── ga4.py                      # RevenueRow, ChannelRow, DeviceRow
│   │   │
│   │   ├── routers/                        # FastAPI route handlers
│   │   │   ├── __init__.py
│   │   │   ├── clients.py                  # GET/POST/PUT/DELETE /clients
│   │   │   ├── pulls.py                    # POST /pulls/trigger, GET /pulls/{job_id}
│   │   │   ├── google_ads.py               # GET /data/google-ads/{client_id}
│   │   │   ├── meta_ads.py                 # GET /data/meta/{client_id}
│   │   │   ├── shopify.py                  # GET /data/shopify/{client_id}
│   │   │   └── ga4.py                      # GET /data/ga4/{client_id}
│   │   │
│   │   ├── connectors/                     # Raw API call implementations
│   │   │   ├── __init__.py
│   │   │   ├── google_ads.py               # 5 pull functions (GAQL queries)
│   │   │   ├── meta_ads.py                 # 4 pull functions (Graph API)
│   │   │   ├── shopify.py                  # orders + products with pagination
│   │   │   └── google_analytics.py         # GA4 runReport calls
│   │   │
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── extractor.py                # Orchestrator: routes client to connectors
│   │   │   └── calculator.py              # Derived metrics: ROAS, WoW, CTR, etc.
│   │   │
│   │   └── core/
│   │       └── config.py                   # Pydantic Settings, env vars
│   │
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/                       # Migration files (auto-generated)
│   ├── alembic.ini
│   └── requirements.txt
│
├── docker-compose.yml                      # PostgreSQL + Redis + backend + frontend
└── .env                                    # DB_URL, REDIS_URL, secret keys
```

---

## 2. API Endpoints Specification

### Clients
```
POST   /api/clients                     Create a new client
GET    /api/clients                     List all clients
GET    /api/clients/{id}                Get client detail
PUT    /api/clients/{id}                Update client
DELETE /api/clients/{id}                Deactivate client
POST   /api/clients/{id}/connect        Add credentials for a data source
GET    /api/clients/discover/google-ads Auto-discover from MCC
```

### Pull Jobs
```
POST   /api/pulls/trigger               Trigger pull for one or all clients
GET    /api/pulls                       List all pull jobs
GET    /api/pulls/{job_id}              Get job status + result
POST   /api/pulls/{job_id}/retry        Retry a failed job
```

### Data Read Endpoints
```
GET    /api/data/google-ads/{client_id}/campaign
GET    /api/data/google-ads/{client_id}/search-terms
GET    /api/data/google-ads/{client_id}/keywords
GET    /api/data/google-ads/{client_id}/time-segments
GET    /api/data/google-ads/{client_id}/demographics

GET    /api/data/meta/{client_id}/campaign
GET    /api/data/meta/{client_id}/leadgen
GET    /api/data/meta/{client_id}/time-segments
GET    /api/data/meta/{client_id}/demographics

GET    /api/data/shopify/{client_id}/orders
GET    /api/data/shopify/{client_id}/products

GET    /api/data/ga4/{client_id}/revenue
GET    /api/data/ga4/{client_id}/channels
GET    /api/data/ga4/{client_id}/devices
```

All read endpoints accept query params: `?start_date=2026-04-07&end_date=2026-04-13`

---

## 3. Connector Design — Google Ads

```python
# connectors/google_ads.py

class GoogleAdsConnector:
    def __init__(self, credentials: dict, mcc_id: str):
        # Builds GoogleAdsClient with login_customer_id = mcc_id

    def pull_campaign(self, customer_id: str, date_range: str) -> list[dict]:
        # GAQL: SELECT campaign metrics FROM campaign WHERE LAST_7_DAYS
        # Returns: list of campaign rows

    def pull_search_terms(self, customer_id: str) -> list[dict]:
        # GAQL: SELECT search_term_view metrics
        # Limit top 10 by clicks, last 7 days

    def pull_keywords(self, customer_id: str) -> list[dict]:
        # GAQL: SELECT ad_group_criterion.keyword metrics
        # Limit top 10 by impressions

    def pull_time_segments(self, customer_id: str) -> list[dict]:
        # Two queries: GROUP BY day_of_week + GROUP BY hour

    def pull_demographics(self, customer_id: str) -> list[dict]:
        # Display/YouTube only: GROUP BY gender, age_range

    def list_child_accounts(self) -> list[str]:
        # CustomerService.list_accessible_customers()
        # Returns all child customer IDs under the MCC
```

**GAQL Queries:**
```sql
-- Campaign Level
SELECT
  campaign.id, campaign.name,
  metrics.impressions, metrics.clicks, metrics.cost_micros,
  metrics.ctr, metrics.average_cpc, metrics.conversions,
  metrics.conversion_rate, metrics.conversions_value,
  metrics.cost_per_conversion, metrics.search_impression_share
FROM campaign
WHERE segments.date DURING LAST_7_DAYS

-- Search Terms (top 10 by clicks)
SELECT
  search_term_view.search_term,
  metrics.impressions, metrics.clicks, metrics.ctr,
  metrics.average_cpc, metrics.conversions, metrics.conversions_value
FROM search_term_view
WHERE segments.date DURING LAST_7_DAYS
ORDER BY metrics.clicks DESC
LIMIT 10

-- Keywords (top 10 by impressions)
SELECT
  ad_group_criterion.keyword.text,
  ad_group_criterion.keyword.match_type,
  ad_group_criterion.quality_info.quality_score,
  metrics.impressions, metrics.clicks, metrics.ctr,
  metrics.average_cpc, metrics.conversions
FROM keyword_view
WHERE segments.date DURING LAST_7_DAYS
ORDER BY metrics.impressions DESC
LIMIT 10
```

---

## 4. Connector Design — Meta Ads

```python
# connectors/meta_ads.py

class MetaAdsConnector:
    def __init__(self, access_token: str, ad_account_id: str):
        # FacebookAdsApi.init(access_token=access_token)

    def pull_campaign(self, client_type: str) -> list[dict]:
        # fields: impressions, clicks, spend, ctr, cpc, reach,
        #         frequency, cpm, cost_per_action_type, actions, action_values
        # date_preset: last_7_days

    def pull_leadgen(self) -> list[dict]:
        # Filter actions where action_type = lead | leadgen_grouped
        # Additional fields: inline_link_clicks, landing_page_views

    def pull_time_segments(self) -> list[dict]:
        # Two calls:
        # breakdowns: time_range (day)
        # breakdowns: hourly_stats_aggregated_by_audience_time_zone

    def pull_demographics(self) -> list[dict]:
        # breakdowns: gender, age
        # fields: impressions, clicks, spend, actions
```

---

## 5. Connector Design — Shopify

```python
# connectors/shopify.py

class ShopifyConnector:
    def __init__(self, shop_domain: str, access_token: str):
        # Base URL: https://{shop_domain}/admin/api/2024-01

    def pull_orders(self, since_date: str) -> list[dict]:
        # GET /orders.json?status=any&created_at_min={since_date}&limit=250
        # Paginate via Link header until no next page
        # Returns flat list of all orders

    def aggregate_products(self, orders: list[dict]) -> list[dict]:
        # Group line_items by product title
        # Sum quantity * price per product
        # Returns top products
```

---

## 6. Connector Design — GA4

```python
# connectors/google_analytics.py

class GA4Connector:
    def __init__(self, property_id: str, credentials_json: dict):
        # BetaAnalyticsDataClient with service account credentials

    def pull_revenue_report(self, date_range: tuple) -> dict:
        # runReport with:
        # metrics: purchaseRevenue, transactions, averagePurchaseRevenue,
        #          sessionConversionRate, activeUsers, sessions
        # date_range: last 7 days

    def pull_channel_breakdown(self, date_range: tuple) -> list[dict]:
        # dimension: sessionDefaultChannelGroup
        # metrics: purchaseRevenue, sessions

    def pull_device_breakdown(self, date_range: tuple) -> list[dict]:
        # dimension: deviceCategory
        # metrics: purchaseRevenue, sessions
```

---

## 7. Extractor Service (Orchestrator)

```python
# services/extractor.py

class Extractor:
    def run_for_client(self, client_id: str, pull_job_id: str):
        client = db.get_client(client_id)

        if client.type in [google_only, google_meta, ecomm_shopify, ecomm_ga4, leadgen]:
            creds = db.get_connection(client_id, "google_ads")
            connector = GoogleAdsConnector(creds, mcc_id)

            # Always pull for all Google clients
            campaign_data = connector.pull_campaign(client.google_customer_id)
            db.save(GoogleAdsCampaign, campaign_data)

            # Search clients only
            if client.has_search_campaigns:
                search_terms = connector.pull_search_terms(...)
                keywords     = connector.pull_keywords(...)

            # All Google clients
            time_segs = connector.pull_time_segments(...)

            # Display/YouTube only
            if client.has_display_campaigns:
                demographics = connector.pull_demographics(...)

        if client.type in [meta_only, google_meta, ecomm_shopify, ecomm_ga4, leadgen]:
            # same pattern for meta

        if client.type in [ecomm_shopify]:
            # shopify pull

        if client.type in [ecomm_ga4]:
            # ga4 pull

        db.update_pull_job(pull_job_id, status="success")
```

---

## 8. Rate Limit Handling

```python
# Per API rate limits and handling strategy

Google Ads:
  - Basic tier: 1,000 operations/day
  - Standard tier: 150,000 operations/day
  - Strategy: track daily op count, queue if approaching limit

Meta Ads:
  - ~200 calls/hour per token
  - Strategy: sleep(18) between calls = 200/hour max
  - Check X-App-Usage header for real-time usage

Shopify:
  - 2 req/sec (leaky bucket, 40 burst)
  - Strategy: check X-Shopify-Shop-Api-Call-Limit header
  - Sleep if bucket > 35/40

GA4:
  - 10 concurrent requests per property
  - Strategy: semaphore limit in async calls
```

---

## 9. Error Handling Strategy

```
Level 1 — Retry (transient errors)
  - HTTP 429 Too Many Requests → exponential backoff: 5s, 15s, 45s
  - HTTP 500/503 → retry up to 3x
  - Network timeout → retry up to 3x

Level 2 — Skip + Log (partial failures)
  - One client fails → log error, mark job failed, continue other clients
  - One section fails (e.g. demographics) → save partial data, note in job log

Level 3 — Alert (permanent failures)
  - Auth token expired → mark connection inactive, notify admin
  - API quota exceeded for day → pause, resume next day
```

---

## 10. Calculated Metrics (calculator.py)

```python
# Computed after raw pull, stored back in DB or computed on read

ROAS                = conv_value / spend
CTR                 = clicks / impressions * 100
CPC                 = spend / clicks
CPL                 = spend / leads
Conv_Rate           = conversions / clicks * 100
Avg_Order_Value     = revenue / orders
Form_Completion     = leads / form_opens * 100
Revenue_Per_Click   = revenue / ad_clicks
WoW_Growth          = (this_week - last_week) / last_week * 100
```

---

## 11. Environment Variables (.env)

```
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/supermatrix

# Redis
REDIS_URL=redis://localhost:6379/0

# Security
SECRET_KEY=your-jwt-secret-key
CREDENTIALS_ENCRYPTION_KEY=your-fernet-key

# Google Ads (MCC level)
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_MCC_ID=

# Meta
META_APP_ID=
META_APP_SECRET=

# App
ENVIRONMENT=development
```
