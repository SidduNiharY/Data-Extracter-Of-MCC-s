# Database Schema
## SuperMatrix — Multi-Platform Ads Data Extractor
**Version:** 1.0 | **Date:** April 2026 | **Database:** PostgreSQL 16

---

## Why PostgreSQL

| Requirement                        | PostgreSQL Feature Used              |
|------------------------------------|--------------------------------------|
| Store API credentials flexibly     | JSONB columns                        |
| Financial data precision           | NUMERIC(12,2) — no float rounding    |
| Multi-tenant client isolation      | Row-level filtering by client_id     |
| Time-series metric queries         | B-tree indexes on report_date        |
| Flexible client config             | JSONB for campaign_types             |
| Referential integrity              | Foreign key constraints              |
| Unique pull records                | Composite UNIQUE constraints         |
| Scalability (large metric tables)  | Table partitioning by date           |
| Credential encryption              | Store Fernet-encrypted JSONB         |
| Full history retention             | Append-only inserts, no overwrites   |

---

## Table Overview — 17 Tables

```
Core (3)
  clients
  client_connections
  pull_jobs

Google Ads (5)
  google_ads_campaign
  google_ads_search_terms
  google_ads_keywords
  google_ads_time_segments
  google_ads_demographics

Meta Ads (4)
  meta_campaign
  meta_leadgen
  meta_time_segments
  meta_demographics

Shopify (2)
  shopify_orders
  shopify_products

GA4 (3)
  ga4_revenue
  ga4_channel_breakdown
  ga4_device_breakdown
```

---

## Core Tables

```sql
-- ─────────────────────────────────────────────
-- clients
-- One row per client account managed by agency
-- ─────────────────────────────────────────────
CREATE TABLE clients (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    VARCHAR(255)    NOT NULL,
    type                    VARCHAR(50)     NOT NULL,
    -- Allowed: google_only | meta_only | google_meta |
    --          ecomm_shopify | ecomm_ga4 | leadgen
    google_ads_customer_id  VARCHAR(20),    -- child account ID under MCC
    meta_ad_account_id      VARCHAR(50),    -- act_XXXXXXXXX
    shopify_shop_domain     VARCHAR(255),   -- client.myshopify.com
    ga4_property_id         VARCHAR(50),    -- properties/XXXXXXXXX
    currency                VARCHAR(10)     DEFAULT 'USD',
    timezone                VARCHAR(50)     DEFAULT 'UTC',
    is_active               BOOLEAN         DEFAULT TRUE,
    created_at              TIMESTAMPTZ     DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX idx_clients_type     ON clients(type);
CREATE INDEX idx_clients_active   ON clients(is_active);


-- ─────────────────────────────────────────────────────────────────
-- client_connections
-- Encrypted API credentials per client per source (one row each)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE client_connections (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id    UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    source       VARCHAR(20) NOT NULL,
    -- Allowed: google_ads | meta_ads | shopify | ga4
    credentials  JSONB       NOT NULL,    -- Fernet-encrypted before insert
    is_active    BOOLEAN     DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, source)
);

CREATE INDEX idx_connections_client ON client_connections(client_id);
CREATE INDEX idx_connections_source ON client_connections(source);


-- ─────────────────────────────────────────────────────────
-- pull_jobs
-- Tracks every data pull attempt per client per source
-- ─────────────────────────────────────────────────────────
CREATE TABLE pull_jobs (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id        UUID        NOT NULL REFERENCES clients(id),
    source           VARCHAR(20) NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- Allowed: pending | running | success | failed | partial
    date_range_start DATE        NOT NULL,
    date_range_end   DATE        NOT NULL,
    rows_pulled      INTEGER,
    error_message    TEXT,
    started_at       TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pull_jobs_client    ON pull_jobs(client_id);
CREATE INDEX idx_pull_jobs_status    ON pull_jobs(status);
CREATE INDEX idx_pull_jobs_source    ON pull_jobs(source);
CREATE INDEX idx_pull_jobs_created   ON pull_jobs(created_at DESC);
```

---

## Google Ads Tables

```sql
-- ─────────────────────────────────────────────────────────────────
-- google_ads_campaign
-- Campaign-level metrics — pulled for ALL clients with Google Ads
-- Source: PDF Section "Google Ads — Campaign Level"
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE google_ads_campaign (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id         UUID        NOT NULL REFERENCES clients(id),
    pull_job_id       UUID        NOT NULL REFERENCES pull_jobs(id),
    report_date       DATE        NOT NULL,
    campaign_id       VARCHAR(50),
    campaign_name     VARCHAR(255),
    impressions       BIGINT,
    clicks            BIGINT,
    spend             NUMERIC(12,2),               -- cost_micros / 1,000,000
    ctr               NUMERIC(8,4),                -- clicks / impressions * 100
    avg_cpc           NUMERIC(10,4),               -- average_cpc / 1,000,000
    conversions       NUMERIC(10,2),
    conversion_rate   NUMERIC(8,4),                -- conversions / clicks * 100
    conv_value        NUMERIC(12,2),               -- ecomm only
    cost_per_conv     NUMERIC(10,4),               -- cost_per_conversion / 1,000,000
    roas              NUMERIC(10,4),               -- calculated: conv_value / spend
    impression_share  NUMERIC(8,4),                -- search_impression_share
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, campaign_id, report_date)
);

CREATE INDEX idx_gads_camp_client_date ON google_ads_campaign(client_id, report_date DESC);
CREATE INDEX idx_gads_camp_date        ON google_ads_campaign(report_date DESC);


-- ─────────────────────────────────────────────────────────────────────────
-- google_ads_search_terms
-- Top 10 search terms by clicks — Search Campaign clients only
-- Source: PDF Section "Google Ads — Search Terms"
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE google_ads_search_terms (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id    UUID        NOT NULL REFERENCES clients(id),
    pull_job_id  UUID        NOT NULL REFERENCES pull_jobs(id),
    report_date  DATE        NOT NULL,
    search_term  TEXT        NOT NULL,
    impressions  BIGINT,
    clicks       BIGINT,
    ctr          NUMERIC(8,4),
    avg_cpc      NUMERIC(10,4),
    conversions  NUMERIC(10,2),
    conv_value   NUMERIC(12,2),                    -- ecomm only
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gads_st_client_date ON google_ads_search_terms(client_id, report_date DESC);


-- ─────────────────────────────────────────────────────────────────────────
-- google_ads_keywords
-- Top 10 keywords by impressions — Search Campaign clients only
-- Source: PDF Section "Google Ads — Keywords"
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE google_ads_keywords (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id     UUID        NOT NULL REFERENCES clients(id),
    pull_job_id   UUID        NOT NULL REFERENCES pull_jobs(id),
    report_date   DATE        NOT NULL,
    keyword_text  VARCHAR(500),
    match_type    VARCHAR(20),                     -- BROAD | PHRASE | EXACT
    impressions   BIGINT,
    clicks        BIGINT,
    ctr           NUMERIC(8,4),
    avg_cpc       NUMERIC(10,4),
    quality_score SMALLINT,                        -- 1–10
    conversions   NUMERIC(10,2),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gads_kw_client_date ON google_ads_keywords(client_id, report_date DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- google_ads_time_segments
-- Day-of-week AND hour-of-day in one table — All Google Ads clients
-- Source: PDF Section "Google Ads — Day of Week & Hour of Day"
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE google_ads_time_segments (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id      UUID        NOT NULL REFERENCES clients(id),
    pull_job_id    UUID        NOT NULL REFERENCES pull_jobs(id),
    report_date    DATE        NOT NULL,
    segment_type   VARCHAR(15) NOT NULL,            -- day_of_week | hour_of_day
    segment_value  VARCHAR(20) NOT NULL,            -- MONDAY…SUNDAY | 0…23
    impressions    BIGINT,
    clicks         BIGINT,
    spend          NUMERIC(12,2),
    conversions    NUMERIC(10,2),
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, report_date, segment_type, segment_value)
);

CREATE INDEX idx_gads_ts_client_date ON google_ads_time_segments(client_id, report_date DESC);
CREATE INDEX idx_gads_ts_type        ON google_ads_time_segments(segment_type);


-- ───────────────────────────────────────────────────────────────────────────────
-- google_ads_demographics
-- Gender & Age breakdown — Display / YouTube campaign clients ONLY
-- Source: PDF Section "Google Ads — Gender & Age"
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE google_ads_demographics (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id    UUID        NOT NULL REFERENCES clients(id),
    pull_job_id  UUID        NOT NULL REFERENCES pull_jobs(id),
    report_date  DATE        NOT NULL,
    gender       VARCHAR(20),                       -- FEMALE | MALE | UNKNOWN
    age_range    VARCHAR(30),                       -- AGE_RANGE_18_24 … 65+
    impressions  BIGINT,
    clicks       BIGINT,
    spend        NUMERIC(12,2),
    conversions  NUMERIC(10,2),
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, report_date, gender, age_range)
);

CREATE INDEX idx_gads_demo_client_date ON google_ads_demographics(client_id, report_date DESC);
```

---

## Meta Ads Tables

```sql
-- ──────────────────────────────────────────────────────────────────
-- meta_campaign
-- Campaign-level metrics — pulled for ALL Meta clients
-- Source: PDF Section "Meta Ads — Campaign Level"
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE meta_campaign (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID        NOT NULL REFERENCES clients(id),
    pull_job_id     UUID        NOT NULL REFERENCES pull_jobs(id),
    report_date     DATE        NOT NULL,
    campaign_id     VARCHAR(50),
    campaign_name   VARCHAR(255),
    impressions     BIGINT,
    clicks          BIGINT,
    spend           NUMERIC(12,2),                  -- direct pull (currency)
    ctr             NUMERIC(8,4),
    cpc             NUMERIC(10,4),
    reach           BIGINT,
    frequency       NUMERIC(8,4),                   -- impressions / reach
    cpm             NUMERIC(10,4),
    cost_per_result NUMERIC(10,4),
    conversions     NUMERIC(10,2),                  -- ecomm only (action_type=purchase)
    conv_value      NUMERIC(12,2),                  -- ecomm only
    roas            NUMERIC(10,4),                  -- calculated: conv_value / spend
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, campaign_id, report_date)
);

CREATE INDEX idx_meta_camp_client_date ON meta_campaign(client_id, report_date DESC);


-- ────────────────────────────────────────────────────────────────────────────
-- meta_leadgen
-- Lead Gen specific metrics — Lead Gen clients ONLY
-- Source: PDF Section "Meta Ads — Lead Gen Metrics"
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE meta_leadgen (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id             UUID        NOT NULL REFERENCES clients(id),
    pull_job_id           UUID        NOT NULL REFERENCES pull_jobs(id),
    report_date           DATE        NOT NULL,
    campaign_id           VARCHAR(50),
    campaign_name         VARCHAR(255),
    leads                 NUMERIC(10,2),             -- action_type = lead
    cost_per_lead         NUMERIC(10,4),             -- spend / leads
    lead_form_opens       NUMERIC(10,2),             -- action_type = leadgen_grouped
    form_completion_rate  NUMERIC(8,4),              -- leads / form_opens * 100
    link_clicks           BIGINT,                    -- inline_link_clicks
    landing_page_views    BIGINT,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, campaign_id, report_date)
);

CREATE INDEX idx_meta_lg_client_date ON meta_leadgen(client_id, report_date DESC);


-- ────────────────────────────────────────────────────────────────────────────
-- meta_time_segments
-- Day-of-week AND hour-of-day — All Meta clients
-- Source: PDF Section "Meta Ads — Day of Week & Hour of Day"
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE meta_time_segments (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id      UUID        NOT NULL REFERENCES clients(id),
    pull_job_id    UUID        NOT NULL REFERENCES pull_jobs(id),
    report_date    DATE        NOT NULL,
    segment_type   VARCHAR(10) NOT NULL,             -- day | hour
    segment_value  VARCHAR(20) NOT NULL,             -- 1…7 (Mon-Sun) | 0…23
    impressions    BIGINT,
    clicks         BIGINT,
    spend          NUMERIC(12,2),
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, report_date, segment_type, segment_value)
);

CREATE INDEX idx_meta_ts_client_date ON meta_time_segments(client_id, report_date DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- meta_demographics
-- Gender & Age breakdown — ALL Meta campaigns
-- Source: PDF Section "Meta Ads — Gender & Age"
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE meta_demographics (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id    UUID        NOT NULL REFERENCES clients(id),
    pull_job_id  UUID        NOT NULL REFERENCES pull_jobs(id),
    report_date  DATE        NOT NULL,
    gender       VARCHAR(20),                        -- male | female | unknown
    age_group    VARCHAR(20),                        -- 13-17|18-24|25-34|35-44|45-54|55-64|65+
    impressions  BIGINT,
    clicks       BIGINT,
    spend        NUMERIC(12,2),
    conversions  NUMERIC(10,2),                      -- ecomm only
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, report_date, gender, age_group)
);

CREATE INDEX idx_meta_demo_client_date ON meta_demographics(client_id, report_date DESC);
```

---

## Shopify Tables

```sql
-- ────────────────────────────────────────────────────────────────────────
-- shopify_orders
-- Individual order records — Ecomm clients with Shopify
-- Source: PDF Section "Shopify — Revenue & Orders"
-- Filter: created_at >= today - 7 days
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE shopify_orders (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id             UUID        NOT NULL REFERENCES clients(id),
    pull_job_id           UUID        NOT NULL REFERENCES pull_jobs(id),
    shopify_order_id      VARCHAR(50) NOT NULL,
    order_date            DATE        NOT NULL,
    total_price           NUMERIC(12,2),
    customer_orders_count INTEGER,                   -- from customer.orders_count
    is_new_customer       BOOLEAN,                   -- orders_count = 1 → TRUE
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, shopify_order_id)
);

CREATE INDEX idx_shopify_orders_client_date ON shopify_orders(client_id, order_date DESC);
CREATE INDEX idx_shopify_orders_new         ON shopify_orders(client_id, is_new_customer);


-- ────────────────────────────────────────────────────────────────────────
-- shopify_products
-- Top products aggregated from line_items — Ecomm clients with Shopify
-- Source: PDF Section "Shopify — Revenue & Orders" (Top Products row)
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE shopify_products (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID        NOT NULL REFERENCES clients(id),
    pull_job_id     UUID        NOT NULL REFERENCES pull_jobs(id),
    report_date     DATE        NOT NULL,
    product_title   VARCHAR(500),
    total_quantity  INTEGER,
    total_revenue   NUMERIC(12,2),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, report_date, product_title)
);

CREATE INDEX idx_shopify_products_client_date ON shopify_products(client_id, report_date DESC);
```

---

## GA4 Tables

```sql
-- ──────────────────────────────────────────────────────────────
-- ga4_revenue
-- Overall revenue summary — Ecomm clients with GA4
-- Source: PDF Section "Google Analytics 4 — Revenue"
-- Method: runReport, last 7 days
-- ──────────────────────────────────────────────────────────────
CREATE TABLE ga4_revenue (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id               UUID        NOT NULL REFERENCES clients(id),
    pull_job_id             UUID        NOT NULL REFERENCES pull_jobs(id),
    report_date             DATE        NOT NULL,
    purchase_revenue        NUMERIC(12,2),
    transactions            INTEGER,
    avg_purchase_revenue    NUMERIC(10,4),           -- averagePurchaseRevenue
    session_conversion_rate NUMERIC(8,4),            -- sessionConversionRate
    active_users            INTEGER,
    sessions                INTEGER,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, report_date)
);

CREATE INDEX idx_ga4_rev_client_date ON ga4_revenue(client_id, report_date DESC);


-- ──────────────────────────────────────────────────────────────────────
-- ga4_channel_breakdown
-- Revenue broken down by channel — Ecomm clients with GA4
-- Source: PDF "Revenue by Channel" → dimension: sessionDefaultChannelGroup
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE ga4_channel_breakdown (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID        NOT NULL REFERENCES clients(id),
    pull_job_id     UUID        NOT NULL REFERENCES pull_jobs(id),
    report_date     DATE        NOT NULL,
    channel_group   VARCHAR(100),                    -- Organic Search | Paid Search | Direct…
    revenue         NUMERIC(12,2),
    sessions        INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, report_date, channel_group)
);

CREATE INDEX idx_ga4_ch_client_date ON ga4_channel_breakdown(client_id, report_date DESC);


-- ──────────────────────────────────────────────────────────────────────
-- ga4_device_breakdown
-- Revenue broken down by device — Ecomm clients with GA4
-- Source: PDF "Revenue by Device" → dimension: deviceCategory
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE ga4_device_breakdown (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID        NOT NULL REFERENCES clients(id),
    pull_job_id     UUID        NOT NULL REFERENCES pull_jobs(id),
    report_date     DATE        NOT NULL,
    device_category VARCHAR(50),                     -- desktop | mobile | tablet
    revenue         NUMERIC(12,2),
    sessions        INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, report_date, device_category)
);

CREATE INDEX idx_ga4_dev_client_date ON ga4_device_breakdown(client_id, report_date DESC);
```

---

## Entity Relationship Summary

```
clients
  │
  ├──── client_connections  (one per source: google_ads / meta / shopify / ga4)
  │
  └──── pull_jobs
           │
           ├──── google_ads_campaign
           ├──── google_ads_search_terms
           ├──── google_ads_keywords
           ├──── google_ads_time_segments
           ├──── google_ads_demographics
           ├──── meta_campaign
           ├──── meta_leadgen
           ├──── meta_time_segments
           ├──── meta_demographics
           ├──── shopify_orders
           ├──── shopify_products
           ├──── ga4_revenue
           ├──── ga4_channel_breakdown
           └──── ga4_device_breakdown
```

---

## Derived Metrics Reference (computed, not stored separately)

```sql
-- These are calculated at query time or in calculator.py

ROAS              = conv_value / NULLIF(spend, 0)
CTR               = clicks::NUMERIC / NULLIF(impressions, 0) * 100
CPC               = spend / NULLIF(clicks, 0)
CPL               = spend / NULLIF(leads, 0)
Conv_Rate         = conversions / NULLIF(clicks, 0) * 100
Avg_Order_Value   = total_revenue / NULLIF(total_orders, 0)
Form_Completion   = leads / NULLIF(lead_form_opens, 0) * 100
WoW_Growth        = (this_week - last_week) / NULLIF(last_week, 0) * 100
Revenue_Per_Click = purchase_revenue / NULLIF(ad_clicks, 0)
```
