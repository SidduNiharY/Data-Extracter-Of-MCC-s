# High Level Design (HLD)
## SuperMatrix — Multi-Platform Ads Data Extractor
**Version:** 1.0 | **Date:** April 2026

---

## 1. System Overview

SuperMatrix is a multi-tenant agency reporting tool that connects to Google Ads (via MCC),
Meta Ads, Shopify, and Google Analytics 4 to pull raw performance metrics per client on a
weekly schedule. The raw data is stored in PostgreSQL and exposed via a REST API to a
Next.js dashboard.

---

## 2. Goals

- Pull all metrics defined in the Metrics Specification PDF (April 2026) exactly as specified
- Support multiple client types: All, Ecomm, LeadGen, Search, Display
- One MCC credential pulls data for ALL Google Ads child accounts
- Weekly automated pulls with manual trigger option
- Store raw data per client per date — no data loss, full history
- Foundation for derived metrics and reporting in later phases

---

## 3. High Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        EXTERNAL APIs                            │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  ┌─────────┐  │
│  │ Google Ads  │  │  Meta Ads   │  │ Shopify  │  │   GA4   │  │
│  │  API (MCC)  │  │  Graph API  │  │ REST API │  │ Data API│  │
│  └──────┬──────┘  └──────┬──────┘  └────┬─────┘  └────┬────┘  │
└─────────│────────────────│──────────────│──────────────│───────┘
          │                │              │              │
┌─────────▼────────────────▼──────────────▼──────────────▼───────┐
│                      BACKEND (Python / FastAPI)                 │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Connectors Layer                       │   │
│  │  google_ads.py  meta_ads.py  shopify.py  google_analytics│   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │                                   │
│  ┌──────────────────────────▼───────────────────────────────┐   │
│  │                    Services Layer                         │   │
│  │         extractor.py (orchestrator)                       │   │
│  │         calculator.py (derived metrics)                   │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │                                   │
│  ┌──────────────────────────▼───────────────────────────────┐   │
│  │                     Routers Layer                         │   │
│  │   /clients  /pulls  /google-ads  /meta  /shopify  /ga4   │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │                                   │
│  ┌──────────────────────────▼───────────────────────────────┐   │
│  │                  Job Queue (Celery + Redis)                │   │
│  │         Async pull jobs  |  Weekly scheduler              │   │
│  └──────────────────────────┬───────────────────────────────┘   │
└─────────────────────────────│───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                        PostgreSQL Database                      │
│          17 tables  |  Per-client isolation  |  Full history    │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                    FRONTEND (Next.js 14)                        │
│                                                                 │
│   Dashboard  |  Client Manager  |  Pull Status  |  Data Views  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Data Flow

```
Step 1: Agency admin adds MCC credentials once in the app
Step 2: App calls list_accessible_customers() → auto-discovers all client accounts
Step 3: Scheduler triggers weekly pull job (every Monday, last 7 days)
Step 4: Extractor reads each client's type from DB
Step 5: Routes client to correct connectors based on type
Step 6: Each connector calls the respective external API
Step 7: Raw response is validated and stored in PostgreSQL
Step 8: Pull job status updated (success / failed)
Step 9: Frontend reads data via REST API and displays per client
```

---

## 5. Client Type → Data Source Routing

```
Client Type       Google Ads    Meta Ads    Shopify    GA4
─────────────────────────────────────────────────────────
google_only           ALL           -           -        -
meta_only              -           ALL          -        -
google_meta           ALL          ALL          -        -
ecomm_shopify         ALL+CV       ALL+CV      ALL       -
ecomm_ga4             ALL+CV       ALL+CV       -       ALL
leadgen               ALL+Lead     ALL+Lead     -        -
```

---

## 6. Technology Stack

| Layer            | Technology           | Reason                                      |
|------------------|----------------------|---------------------------------------------|
| Frontend         | Next.js 14 (App Router) | Server components, fast rendering        |
| Backend          | Python + FastAPI     | Best SDK support for all 4 APIs             |
| Database         | PostgreSQL 16        | JSONB, ACID, partitioning, time-series      |
| Job Queue        | Celery + Redis       | Async pulls, weekly scheduling              |
| ORM              | SQLAlchemy 2.0       | Async support, migration friendly           |
| Migrations       | Alembic              | Version-controlled DB changes               |
| Auth (Backend)   | JWT + python-jose    | Stateless, simple                           |
| Containerization | Docker + Compose     | Dev parity with production                  |

---

## 7. Google Ads MCC Connection

```
Agency has ONE MCC (Manager Account)
       │
       ├── Developer Token (applied at MCC, approved once)
       ├── OAuth2 Client ID + Secret (Google Cloud Console)
       └── Refresh Token (generated by MCC account holder)

App authenticates with MCC → login_customer_id = MCC ID
App pulls data per client  → customer_id = child account ID

One credential set covers ALL clients under the MCC.
```

---

## 8. Non-Functional Requirements

| Requirement     | Target                                          |
|-----------------|-------------------------------------------------|
| Pull reliability | Retry up to 3x with exponential backoff        |
| Rate limiting   | Respect per-API limits (see LLD)                |
| Data retention  | Full history, no overwrite                      |
| Credential security | Encrypted at rest (Fernet)                 |
| Multi-currency  | Store raw currency, normalize on display        |
| Timezone        | Store in UTC, convert on display                |
| Scalability     | Up to 100 clients with Standard API access tier |

---

## 9. Phase Roadmap

```
Phase 1 — Core (current focus)
  Full scaffold + DB + connectors + manual pull trigger + basic UI

Phase 2 — Auth & Connections
  OAuth flows per source + encrypted credentials + token refresh

Phase 3 — Production
  Celery async jobs + weekly scheduler + rate limit handling

Phase 4 — Supermatrix Operations
  Derived metrics + WoW growth + cross-platform aggregations + export
```
