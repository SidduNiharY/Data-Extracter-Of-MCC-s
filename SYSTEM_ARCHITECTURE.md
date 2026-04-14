# System Architecture
## SuperMatrix — Multi-Platform Ads Data Extractor
**Version:** 1.0 | **Date:** April 2026

---

## 1. Full System Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL APIs                                    │
│                                                                               │
│  ┌──────────────────┐  ┌────────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  Google Ads API  │  │ Meta Graph API │  │ Shopify REST │  │ GA4 Data   │  │
│  │  (GAQL / SOAP)   │  │   v20.0        │  │   API 2024   │  │ API v1beta │  │
│  │                  │  │                │  │              │  │            │  │
│  │ Auth: OAuth2+    │  │ Auth: System   │  │ Auth: Access │  │ Auth: SA   │  │
│  │ MCC Dev Token    │  │ User Token     │  │ Token        │  │ JSON Key   │  │
│  └────────┬─────────┘  └───────┬────────┘  └──────┬───────┘  └─────┬──────┘  │
└───────────│────────────────────│──────────────────│─────────────────│─────────┘
            │                    │                  │                 │
            │         HTTPS / Rate-limited calls    │                 │
            │                    │                  │                 │
┌───────────▼────────────────────▼──────────────────▼─────────────────▼─────────┐
│                         BACKEND LAYER (Python 3.11)                           │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                      FastAPI Application                                │  │
│  │                                                                         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │  │
│  │  │ /clients │  │ /pulls   │  │/google-  │  │  /meta   │  │/shopify  │ │  │
│  │  │  router  │  │  router  │  │  ads     │  │  router  │  │  /ga4    │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │  │
│  └─────────────────────────────────┬───────────────────────────────────────┘  │
│                                    │                                          │
│  ┌─────────────────────────────────▼───────────────────────────────────────┐  │
│  │                        Services Layer                                   │  │
│  │                                                                         │  │
│  │         extractor.py (Orchestrator)    calculator.py (Metrics)          │  │
│  └─────────────────────────────────┬───────────────────────────────────────┘  │
│                                    │                                          │
│  ┌─────────────────────────────────▼───────────────────────────────────────┐  │
│  │                       Connectors Layer                                  │  │
│  │                                                                         │  │
│  │  google_ads.py    meta_ads.py    shopify.py    google_analytics.py      │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                    Async Job Layer (Celery)                             │  │
│  │                                                                         │  │
│  │   Worker 1: google_ads_queue      Worker 2: meta_queue                 │  │
│  │   Worker 3: shopify_queue         Worker 4: ga4_queue                  │  │
│  │                                                                         │  │
│  │   Celery Beat Scheduler → triggers weekly pull every Monday 6AM        │  │
│  └──────────────────────┬──────────────────────────────────────────────────┘  │
└─────────────────────────│──────────────────────────────────────────────────────┘
                          │
          ┌───────────────┴────────────────┐
          │                                │
┌─────────▼──────────┐          ┌──────────▼──────────┐
│   PostgreSQL 16     │          │      Redis           │
│                     │          │                      │
│  17 tables          │          │  Celery broker       │
│  Full history       │          │  Job results         │
│  Indexed by date    │          │  Session cache       │
└─────────────────────┘          └──────────────────────┘
          │
          │  SQLAlchemy ORM + Alembic migrations
          │
┌─────────▼──────────────────────────────────────────────┐
│                  FRONTEND LAYER (Next.js 14)            │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Dashboard  │  │   Clients    │  │  Pull History │  │
│  │  /           │  │  /clients   │  │  /pulls       │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
│                                                         │
│  lib/api.ts → Axios calls to FastAPI                    │
└─────────────────────────────────────────────────────────┘
```

---

## 2. MCC Account Architecture

```
Google Ads MCC (Agency Manager Account)
    │
    │  One Developer Token (applied at MCC)
    │  One OAuth2 Credential (MCC Google account)
    │  One Refresh Token
    │
    ├── Client A Account (ID: 111-111-1111)  ─── ecomm_shopify
    ├── Client B Account (ID: 222-222-2222)  ─── leadgen
    ├── Client C Account (ID: 333-333-3333)  ─── google_only
    └── Client D Account (ID: 444-444-4444)  ─── google_meta

API call per client:
  login_customer_id = MCC ID       (authenticating as)
  customer_id       = Client ID    (pulling data for)

Auto-discovery:
  CustomerService.list_accessible_customers()
  → returns all child IDs → auto-populates clients table
```

---

## 3. Data Pull Flow (Per Client, Per Week)

```
Trigger (manual or Celery Beat scheduler)
    │
    ▼
create pull_job record (status=pending)
    │
    ▼
Read client from DB
  - client.type
  - client.google_ads_customer_id
  - client.meta_ad_account_id
  - client.shopify_shop_domain
  - client.ga4_property_id
    │
    ▼
Decrypt credentials from client_connections
    │
    ├──► IF google_ads client:
    │       pull_campaign()          → store in google_ads_campaign
    │       pull_search_terms()      → store in google_ads_search_terms  [search only]
    │       pull_keywords()          → store in google_ads_keywords       [search only]
    │       pull_time_segments()     → store in google_ads_time_segments
    │       pull_demographics()      → store in google_ads_demographics   [display only]
    │
    ├──► IF meta client:
    │       pull_campaign()          → store in meta_campaign
    │       pull_leadgen()           → store in meta_leadgen               [leadgen only]
    │       pull_time_segments()     → store in meta_time_segments
    │       pull_demographics()      → store in meta_demographics
    │
    ├──► IF shopify client:
    │       pull_orders()            → store in shopify_orders
    │       aggregate_products()     → store in shopify_products
    │
    └──► IF ga4 client:
            pull_revenue_report()   → store in ga4_revenue
            pull_channel_breakdown()→ store in ga4_channel_breakdown
            pull_device_breakdown() → store in ga4_device_breakdown
    │
    ▼
update pull_job (status=success, rows_pulled=N, completed_at=NOW())
```

---

## 4. API Security Architecture

```
┌──────────────────────────────────────────────┐
│              Security Layers                 │
│                                              │
│  1. JWT Authentication                       │
│     All FastAPI endpoints require            │
│     Authorization: Bearer <token>            │
│                                              │
│  2. Credential Encryption                    │
│     API keys stored as Fernet-encrypted      │
│     JSONB in client_connections table        │
│     Decrypted only in memory during pull     │
│                                              │
│  3. HTTPS Only                               │
│     All external API calls over TLS          │
│     Frontend → Backend over HTTPS            │
│                                              │
│  4. Environment Variables                    │
│     No secrets in code — all via .env        │
│     Docker secrets in production             │
└──────────────────────────────────────────────┘
```

---

## 5. Docker Compose Architecture

```yaml
# docker-compose.yml — 4 services

services:
  postgres:
    image: postgres:16
    ports: 5432
    volumes: postgres_data

  redis:
    image: redis:7-alpine
    ports: 6379

  backend:
    build: ./backend
    ports: 8000
    depends_on: postgres, redis
    env_file: .env

  frontend:
    build: ./frontend
    ports: 3000
    depends_on: backend

  celery_worker:
    build: ./backend
    command: celery -A app.celery worker
    depends_on: redis, postgres

  celery_beat:
    build: ./backend
    command: celery -A app.celery beat
    depends_on: redis
```

---

## 6. Deployment Architecture (Production)

```
                        ┌──────────────────┐
                        │   Cloudflare     │  DNS + DDoS protection
                        └────────┬─────────┘
                                 │ HTTPS
                        ┌────────▼─────────┐
                        │   Load Balancer  │
                        └────────┬─────────┘
                                 │
               ┌─────────────────┼─────────────────┐
               │                 │                 │
     ┌─────────▼──────┐ ┌────────▼──────┐ ┌────────▼──────┐
     │  Next.js        │ │  FastAPI      │ │  Celery       │
     │  (Vercel or     │ │  (Railway /   │ │  Workers      │
     │   AWS ECS)      │ │   Render)     │ │  (same host)  │
     └─────────────────┘ └───────┬───────┘ └───────┬───────┘
                                 │                 │
                    ┌────────────▼─────────────────▼────────┐
                    │          PostgreSQL                    │
                    │    (Supabase / Neon / AWS RDS)         │
                    └───────────────────────────────────────┘
                                 │
                    ┌────────────▼───────────────────────────┐
                    │              Redis                     │
                    │    (Upstash / Railway / AWS ElastiCache)│
                    └────────────────────────────────────────┘
```

---

## 7. Weekly Pull Schedule

```
Every Monday at 6:00 AM UTC (Celery Beat)
    │
    ▼
For each active client in DB:
    date_range = last Monday → last Sunday (7 days)
    │
    ▼
Enqueue pull job per source per client
(up to 4 jobs per client: google_ads, meta, shopify, ga4)
    │
    ▼
Celery workers pick up jobs from Redis queue
    │
    ▼
Results stored in PostgreSQL
    │
    ▼
Dashboard shows fresh data by Monday 7:00 AM
```

---

## 8. Database Choice — PostgreSQL vs Alternatives

```
PostgreSQL 16  ← CHOSEN
  + JSONB for encrypted credential storage
  + NUMERIC(12,2) for accurate financial data (no float errors)
  + UUID primary keys natively
  + Composite UNIQUE constraints (prevents duplicate pulls)
  + B-tree indexes for fast date-range queries
  + Row-level filtering for multi-tenant isolation
  + Alembic migration support
  + Hosted cheaply: Supabase (free tier), Neon, Railway

MongoDB        ← NOT chosen
  - No referential integrity (FK constraints)
  - Inconsistent financial data (BSON float)
  - Harder to do cross-collection joins for reporting

MySQL          ← NOT chosen
  - No native JSONB (JSON but slower)
  - Weaker UUID support
  - Less expressive for analytical queries

Snowflake/BigQuery ← NOT chosen (Phase 4 option)
  - Overkill for current scale
  - High cost for small agency data volumes
  - No free tier for development
  - Suitable ONLY if 500+ clients / data warehouse needed
```

---

## 9. Scale Limits & Upgrade Path

```
Phase 1-2 (1-30 clients):
  Single PostgreSQL instance
  Single Celery worker
  Basic API tier for all sources
  → Handles easily

Phase 3 (30-100 clients):
  PostgreSQL with connection pooling (PgBouncer)
  Multiple Celery workers (one per source)
  Google Ads Standard Access tier required
  → Handles comfortably

Phase 4 (100+ clients):
  Read replica for dashboard queries
  Partition large metric tables by month
  Consider TimescaleDB extension for hypertables
  Consider Redis caching for repeated dashboard queries
  → Requires architecture review
```
