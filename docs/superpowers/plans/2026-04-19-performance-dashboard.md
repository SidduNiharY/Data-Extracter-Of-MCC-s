# Performance Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-client Performance Dashboard page with a Google Ads-style date range picker, threshold-based red/green cell colorization, manual priority ranking, and multi-facet filtering. Metrics are aggregated live per client across Google Ads, Shopify, and GA4 for any chosen date range.

**Architecture:** A new FastAPI router (`/api/dashboard`) exposes an aggregation endpoint that runs parallel async queries over existing raw tables (`google_ads_campaign`, `shopify_orders`, `ga4_revenue`) per client, merges into `DashboardRow` objects, and returns a single list. Threshold config (global) lives in a new `dashboard_thresholds` table; per-client overrides live in the existing `clients.report_settings` JSONB. Frontend is a new `/dashboard` Next.js page with isolated components for table, date picker, filters, metric cells, priority editing, and threshold editing.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 async + Alembic + PostgreSQL (backend); Next.js 14 App Router + React 18 + TypeScript + axios + lucide-react (frontend). No pytest infrastructure exists — verify with curl/smoke scripts matching existing codebase conventions.

**Spec reference:** `docs/superpowers/specs/2026-04-19-performance-dashboard-design.md`

---

## File Map

**Backend (create):**
- `backend/app/models/dashboard.py` — SQLAlchemy model for `dashboard_thresholds`
- `backend/app/schemas/dashboard.py` — Pydantic schemas
- `backend/app/services/dashboard_aggregator.py` — Per-client parallel query logic
- `backend/app/routers/dashboard.py` — All `/api/dashboard/*` endpoints
- `backend/alembic/versions/g5d8f1e34a72_add_dashboard.py` — Migration (filename hash will be alembic-generated)
- `backend/smoke_dashboard.py` — Smoke script for manual verification

**Backend (modify):**
- `backend/app/models/client.py` — add `priority` column
- `backend/app/models/__init__.py` — export `DashboardThreshold`
- `backend/app/schemas/client.py` — add `priority` to ClientRead/ClientUpdate
- `backend/app/routers/clients.py` — add priority + threshold override endpoints
- `backend/app/routers/__init__.py` — export `dashboard_router`
- `backend/app/main.py` — register `dashboard_router`

**Frontend (create):**
- `frontend/src/app/dashboard/page.tsx` — Main dashboard page
- `frontend/src/components/dashboard/DashboardTable.tsx`
- `frontend/src/components/dashboard/DateRangePicker.tsx`
- `frontend/src/components/dashboard/DashboardFilters.tsx`
- `frontend/src/components/dashboard/MetricCell.tsx`
- `frontend/src/components/dashboard/PriorityCell.tsx`
- `frontend/src/components/dashboard/ThresholdEditor.tsx`
- `frontend/src/components/dashboard/ClientThresholdOverrides.tsx`

**Frontend (modify):**
- `frontend/src/types/index.ts` — add `DashboardRow`, `ThresholdConfig`, `ThresholdOverride`
- `frontend/src/lib/api.ts` — add 6 new API methods
- `frontend/src/components/Sidebar.tsx` — add Dashboard nav link
- `frontend/src/app/settings/page.tsx` — add ThresholdEditor card (convert to client component section)
- `frontend/src/app/clients/[id]/page.tsx` — add ClientThresholdOverrides panel

---

## Phase A — Backend Foundation

### Task A1: Add `priority` column to Client model

**Files:**
- Modify: `backend/app/models/client.py`

- [ ] **Step 1: Add `priority` field to the Client class**

In `backend/app/models/client.py`, inside the `Client` class, directly after the line `is_active: Mapped[bool] = mapped_column(Boolean, default=True)`, add:

```python
    priority: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
```

The file already imports `Integer` — verify: `grep "Integer" backend/app/models/client.py` should show the existing import line.

- [ ] **Step 2: Commit**

```bash
cd "/Users/siddumanju/Desktop/MatrixFerm/Data Extracter of MCC's"
git add backend/app/models/client.py
git commit -m "feat(backend): add priority column to Client model"
```

---

### Task A2: Create DashboardThreshold SQLAlchemy model

**Files:**
- Create: `backend/app/models/dashboard.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Create the model file**

Create `backend/app/models/dashboard.py` with:

```python
from __future__ import annotations
from typing import Optional
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class DashboardThreshold(Base):
    """Global threshold configuration for dashboard metric colorization.

    One row per metric_name. Per-client overrides live in
    clients.report_settings['threshold_overrides'].
    """
    __tablename__ = "dashboard_thresholds"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    metric_name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    red_below: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    green_above: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
```

- [ ] **Step 2: Export from models package**

In `backend/app/models/__init__.py`, add the import at the end of imports and in `__all__`.

Add this line after `from app.models.report_metrics import ReportMetric`:

```python
from app.models.dashboard import DashboardThreshold
```

Add `"DashboardThreshold"` as the last item inside the `__all__` list.

- [ ] **Step 3: Verify imports**

Run: `cd "/Users/siddumanju/Desktop/MatrixFerm/Data Extracter of MCC's/backend" && source venv/bin/activate && python -c "from app.models import DashboardThreshold; print(DashboardThreshold.__tablename__)"`
Expected output: `dashboard_thresholds`

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/dashboard.py backend/app/models/__init__.py
git commit -m "feat(backend): add DashboardThreshold model"
```

---

### Task A3: Generate Alembic migration

**Files:**
- Create: `backend/alembic/versions/<auto-hash>_add_dashboard.py`

- [ ] **Step 1: Auto-generate migration**

Run:
```bash
cd "/Users/siddumanju/Desktop/MatrixFerm/Data Extracter of MCC's/backend"
source venv/bin/activate
alembic revision --autogenerate -m "add_dashboard"
```

Alembic will create a file named like `alembic/versions/<hash>_add_dashboard.py`. Note the path.

- [ ] **Step 2: Review the generated file**

Open the generated file. Confirm its `upgrade()` contains:
- `op.add_column('clients', sa.Column('priority', sa.Integer(), nullable=True))`
- `op.create_table('dashboard_thresholds', ...)` with columns `id`, `metric_name`, `red_below`, `green_above`, `created_at`, `updated_at`

If alembic also pulled in unrelated auto-detected changes (e.g. `alter_column` on other tables), remove those lines from both `upgrade()` and `downgrade()` — keep only the two intended changes.

- [ ] **Step 3: Append default threshold seed to upgrade()**

At the end of the `upgrade()` function in the generated migration file, add:

```python
    # Seed default global thresholds
    op.execute("""
        INSERT INTO dashboard_thresholds (id, metric_name, red_below, green_above)
        VALUES
          (gen_random_uuid(), 'roas',     2.0,  4.0),
          (gen_random_uuid(), 'cpc',      NULL, 1.0),
          (gen_random_uuid(), 'rc_ratio', 2.0,  5.0),
          (gen_random_uuid(), 'orders',   10,   100),
          (gen_random_uuid(), 'revenue',  1000, 10000),
          (gen_random_uuid(), 'impressions', NULL, NULL),
          (gen_random_uuid(), 'clicks',   NULL, NULL),
          (gen_random_uuid(), 'cost',     NULL, NULL)
        ON CONFLICT (metric_name) DO NOTHING
    """)
```

- [ ] **Step 4: Run migration**

```bash
cd "/Users/siddumanju/Desktop/MatrixFerm/Data Extracter of MCC's/backend"
source venv/bin/activate
alembic upgrade head
```

Expected: two new changes applied, no errors.

- [ ] **Step 5: Verify DB state**

```bash
psql postgresql://postgres:postgres@127.0.0.1:55432/supermatrix -c "\d clients" | grep priority
psql postgresql://postgres:postgres@127.0.0.1:55432/supermatrix -c "SELECT metric_name, red_below, green_above FROM dashboard_thresholds ORDER BY metric_name;"
```
Expected: `priority | integer` appears; 8 seed rows returned.

- [ ] **Step 6: Commit**

```bash
git add backend/alembic/versions/*_add_dashboard.py
git commit -m "feat(backend): alembic migration for dashboard tables and priority column"
```

---

### Task A4: Create Pydantic schemas

**Files:**
- Create: `backend/app/schemas/dashboard.py`
- Modify: `backend/app/schemas/client.py`

- [ ] **Step 1: Create dashboard schemas**

Create `backend/app/schemas/dashboard.py`:

```python
from __future__ import annotations
from typing import Optional
from datetime import date
from uuid import UUID

from pydantic import BaseModel


class DashboardRow(BaseModel):
    """One row per client in the performance dashboard."""
    client_id: UUID
    client_name: str
    priority: Optional[int] = None
    connected_sources: list[str] = []

    # Google Ads
    impressions: Optional[int] = None
    clicks: Optional[int] = None
    cost: Optional[float] = None
    cpc: Optional[float] = None

    # Cross-platform (derived)
    orders: Optional[int] = None
    revenue: Optional[float] = None
    rc_ratio: Optional[float] = None

    # Shopify
    shopify_orders: Optional[int] = None
    shopify_revenue: Optional[float] = None
    shopify_roas: Optional[float] = None

    # GA4
    ga4_orders: Optional[int] = None
    ga4_revenue: Optional[float] = None
    ga4_roas: Optional[float] = None


class ThresholdConfig(BaseModel):
    """One threshold rule for a metric."""
    metric_name: str
    red_below: Optional[float] = None
    green_above: Optional[float] = None

    model_config = {"from_attributes": True}


class ThresholdConfigUpdate(BaseModel):
    """Bulk update payload for global thresholds."""
    thresholds: list[ThresholdConfig]


class ThresholdOverride(BaseModel):
    """Single-metric per-client override (matches JSONB shape)."""
    red_below: Optional[float] = None
    green_above: Optional[float] = None


class ClientThresholdOverrideUpdate(BaseModel):
    """Write payload for PATCH /api/clients/{id}/thresholds."""
    overrides: dict[str, ThresholdOverride]


class PriorityUpdate(BaseModel):
    priority: Optional[int] = None


class DashboardPerformanceQuery(BaseModel):
    date_from: date
    date_to: date
    client_ids: Optional[list[UUID]] = None
```

- [ ] **Step 2: Add priority to ClientRead and ClientUpdate**

In `backend/app/schemas/client.py`, inside `ClientUpdate`, after `is_active: Optional[bool] = None`, add:

```python
    priority: Optional[int] = None
```

Inside `ClientRead`, after `is_active: bool`, add:

```python
    priority: Optional[int] = None
```

- [ ] **Step 3: Verify schema load**

```bash
cd "/Users/siddumanju/Desktop/MatrixFerm/Data Extracter of MCC's/backend"
source venv/bin/activate
python -c "from app.schemas.dashboard import DashboardRow, ThresholdConfig; print(DashboardRow.model_fields.keys())"
```
Expected: dict_keys showing all 16 DashboardRow field names.

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/dashboard.py backend/app/schemas/client.py
git commit -m "feat(backend): Pydantic schemas for dashboard + priority on Client"
```

---

## Phase B — Backend Aggregation Service

### Task B1: Create DashboardAggregator service (Google Ads branch)

**Files:**
- Create: `backend/app/services/dashboard_aggregator.py`

- [ ] **Step 1: Create service file with class skeleton and Google Ads aggregation**

Create `backend/app/services/dashboard_aggregator.py`:

```python
from __future__ import annotations
import asyncio
from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client, ClientConnection
from app.models.google_ads import GoogleAdsCampaign
from app.models.shopify import ShopifyOrder
from app.models.ga4 import GA4Revenue
from app.schemas.dashboard import DashboardRow


class DashboardAggregator:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def aggregate_for_client(
        self,
        client: Client,
        connected_sources: list[str],
        date_from: date,
        date_to: date,
    ) -> DashboardRow:
        """Build a single DashboardRow for one client by querying each source."""
        gads_task = self._query_google_ads(client.id, date_from, date_to)
        shopify_task = self._query_shopify(client.id, date_from, date_to)
        ga4_task = self._query_ga4(client.id, date_from, date_to)

        gads, shopify, ga4 = await asyncio.gather(gads_task, shopify_task, ga4_task)

        # Cross-platform derived
        cost = gads["cost"]
        shopify_revenue = shopify["revenue"]
        ga4_revenue = ga4["revenue"]
        revenue = shopify_revenue if shopify_revenue is not None else ga4_revenue

        shopify_orders = shopify["orders"]
        ga4_orders = ga4["orders"]
        # Prefer shopify order count; fallback to ga4 transactions
        orders = shopify_orders if shopify_orders is not None else ga4_orders

        rc_ratio = (revenue / cost) if (revenue is not None and cost and cost > 0) else None
        shopify_roas = (shopify_revenue / cost) if (shopify_revenue is not None and cost and cost > 0) else None
        ga4_roas = (ga4_revenue / cost) if (ga4_revenue is not None and cost and cost > 0) else None

        return DashboardRow(
            client_id=client.id,
            client_name=client.name,
            priority=client.priority,
            connected_sources=connected_sources,
            impressions=gads["impressions"],
            clicks=gads["clicks"],
            cost=_f(cost),
            cpc=_f(gads["cpc"]),
            orders=orders,
            revenue=_f(revenue),
            rc_ratio=_f(rc_ratio),
            shopify_orders=shopify_orders,
            shopify_revenue=_f(shopify_revenue),
            shopify_roas=_f(shopify_roas),
            ga4_orders=ga4_orders,
            ga4_revenue=_f(ga4_revenue),
            ga4_roas=_f(ga4_roas),
        )

    async def _query_google_ads(self, client_id: UUID, date_from: date, date_to: date) -> dict:
        stmt = select(
            sa_func.coalesce(sa_func.sum(GoogleAdsCampaign.impressions), 0).label("impressions"),
            sa_func.coalesce(sa_func.sum(GoogleAdsCampaign.clicks), 0).label("clicks"),
            sa_func.coalesce(sa_func.sum(GoogleAdsCampaign.spend), 0).label("cost"),
        ).where(
            GoogleAdsCampaign.client_id == client_id,
            GoogleAdsCampaign.report_date >= date_from,
            GoogleAdsCampaign.report_date <= date_to,
        )
        result = await self.db.execute(stmt)
        row = result.one()
        impressions = int(row.impressions) if row.impressions else None
        clicks = int(row.clicks) if row.clicks else None
        cost = Decimal(row.cost) if row.cost else None
        cpc = (cost / clicks) if (cost is not None and clicks and clicks > 0) else None
        # Null-out the bucket if nothing was pulled (all zeros)
        if not impressions and not clicks and not cost:
            return {"impressions": None, "clicks": None, "cost": None, "cpc": None}
        return {"impressions": impressions, "clicks": clicks, "cost": cost, "cpc": cpc}

    async def _query_shopify(self, client_id: UUID, date_from: date, date_to: date) -> dict:
        stmt = select(
            sa_func.count(ShopifyOrder.id).label("orders"),
            sa_func.coalesce(sa_func.sum(ShopifyOrder.total_price), 0).label("revenue"),
        ).where(
            ShopifyOrder.client_id == client_id,
            ShopifyOrder.order_date >= date_from,
            ShopifyOrder.order_date <= date_to,
        )
        result = await self.db.execute(stmt)
        row = result.one()
        orders = int(row.orders) if row.orders else None
        revenue = Decimal(row.revenue) if row.revenue else None
        if not orders and not revenue:
            return {"orders": None, "revenue": None}
        return {"orders": orders, "revenue": revenue}

    async def _query_ga4(self, client_id: UUID, date_from: date, date_to: date) -> dict:
        stmt = select(
            sa_func.coalesce(sa_func.sum(GA4Revenue.transactions), 0).label("orders"),
            sa_func.coalesce(sa_func.sum(GA4Revenue.purchase_revenue), 0).label("revenue"),
        ).where(
            GA4Revenue.client_id == client_id,
            GA4Revenue.report_date >= date_from,
            GA4Revenue.report_date <= date_to,
        )
        result = await self.db.execute(stmt)
        row = result.one()
        orders = int(row.orders) if row.orders else None
        revenue = Decimal(row.revenue) if row.revenue else None
        if not orders and not revenue:
            return {"orders": None, "revenue": None}
        return {"orders": orders, "revenue": revenue}

    async def aggregate_all(
        self,
        date_from: date,
        date_to: date,
        client_ids: Optional[list[UUID]] = None,
    ) -> list[DashboardRow]:
        """Fetch all active clients and build one row per client."""
        stmt = select(Client).where(Client.is_active == True)
        if client_ids:
            stmt = stmt.where(Client.id.in_(client_ids))
        result = await self.db.execute(stmt)
        clients = result.scalars().all()

        # Pre-fetch connections per client
        conn_stmt = select(ClientConnection).where(
            ClientConnection.is_active == True,
            ClientConnection.client_id.in_([c.id for c in clients] or [None]),
        )
        conn_result = await self.db.execute(conn_stmt)
        connections = conn_result.scalars().all()
        conns_by_client: dict[UUID, list[str]] = {}
        for conn in connections:
            conns_by_client.setdefault(conn.client_id, []).append(conn.source)

        # Build rows sequentially (each row runs 3 queries in parallel internally)
        rows: list[DashboardRow] = []
        for client in clients:
            row = await self.aggregate_for_client(
                client,
                conns_by_client.get(client.id, []),
                date_from,
                date_to,
            )
            rows.append(row)
        return rows


def _f(v) -> Optional[float]:
    """Convert Decimal/int to float, preserve None."""
    return float(v) if v is not None else None
```

- [ ] **Step 2: Smoke-test the service**

Create `backend/smoke_dashboard.py`:

```python
"""Smoke test for DashboardAggregator — run manually."""
import asyncio
from datetime import date, timedelta

from app.database import async_session
from app.services.dashboard_aggregator import DashboardAggregator


async def main():
    async with async_session() as db:
        agg = DashboardAggregator(db)
        today = date.today()
        rows = await agg.aggregate_all(today - timedelta(days=30), today)
        print(f"Got {len(rows)} rows")
        for r in rows[:5]:
            print(f"  {r.client_name}: cost={r.cost} revenue={r.revenue} roas={r.shopify_roas or r.ga4_roas}")


if __name__ == "__main__":
    asyncio.run(main())
```

Run: `cd backend && source venv/bin/activate && python smoke_dashboard.py`
Expected: prints `Got N rows` where N = number of active clients, no exceptions.

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/dashboard_aggregator.py backend/smoke_dashboard.py
git commit -m "feat(backend): DashboardAggregator service with parallel per-source queries"
```

---

## Phase C — Backend Routes

### Task C1: Create dashboard router with performance endpoint

**Files:**
- Create: `backend/app/routers/dashboard.py`

- [ ] **Step 1: Write the router**

Create `backend/app/routers/dashboard.py`:

```python
from __future__ import annotations
import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.dashboard import DashboardThreshold
from app.schemas.dashboard import (
    DashboardRow,
    ThresholdConfig,
    ThresholdConfigUpdate,
)
from app.services.dashboard_aggregator import DashboardAggregator

router = APIRouter()


@router.get("/performance", response_model=list[DashboardRow])
async def get_performance(
    date_from: date = Query(..., description="YYYY-MM-DD inclusive"),
    date_to: date = Query(..., description="YYYY-MM-DD inclusive"),
    client_ids: Optional[str] = Query(None, description="Comma-separated UUIDs"),
    db: AsyncSession = Depends(get_db),
):
    """Aggregate metrics for all active clients in the given date range."""
    if date_from > date_to:
        raise HTTPException(status_code=400, detail="date_from must be <= date_to")

    parsed_ids: Optional[list[uuid.UUID]] = None
    if client_ids:
        try:
            parsed_ids = [uuid.UUID(x.strip()) for x in client_ids.split(",") if x.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid UUID in client_ids")

    agg = DashboardAggregator(db)
    return await agg.aggregate_all(date_from, date_to, parsed_ids)


@router.get("/thresholds", response_model=list[ThresholdConfig])
async def list_thresholds(db: AsyncSession = Depends(get_db)):
    """Return all global threshold rows."""
    result = await db.execute(select(DashboardThreshold).order_by(DashboardThreshold.metric_name))
    return result.scalars().all()


@router.put("/thresholds", response_model=list[ThresholdConfig])
async def save_thresholds(
    payload: ThresholdConfigUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Upsert threshold rows by metric_name. Missing metrics are left untouched."""
    for t in payload.thresholds:
        result = await db.execute(
            select(DashboardThreshold).where(DashboardThreshold.metric_name == t.metric_name)
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.red_below = t.red_below
            existing.green_above = t.green_above
        else:
            db.add(DashboardThreshold(
                metric_name=t.metric_name,
                red_below=t.red_below,
                green_above=t.green_above,
            ))
    await db.commit()
    # Return the full current set
    result = await db.execute(select(DashboardThreshold).order_by(DashboardThreshold.metric_name))
    return result.scalars().all()
```

- [ ] **Step 2: Register router exports**

In `backend/app/routers/__init__.py`, add at the end of the imports:

```python
from .dashboard import router as dashboard_router
```

Add `"dashboard_router"` as the last item in `__all__`.

- [ ] **Step 3: Register route in main.py**

In `backend/app/main.py`:

1. In the `from app.routers import (...)` block, add `dashboard_router,` as the last item before the closing `)`.

2. After the last `app.include_router(...)` line (currently for `manual_entry`), add:

```python
app.include_router(dashboard_router, prefix="/api/dashboard", tags=["Dashboard"])
```

- [ ] **Step 4: Start server and verify endpoints**

```bash
cd "/Users/siddumanju/Desktop/MatrixFerm/Data Extracter of MCC's/backend"
source venv/bin/activate
uvicorn app.main:app --reload --port 8000 &
sleep 3
curl -s "http://localhost:8000/api/dashboard/thresholds" | python -m json.tool
curl -s "http://localhost:8000/api/dashboard/performance?date_from=2026-03-01&date_to=2026-04-19" | python -m json.tool | head -40
```
Expected: thresholds returns the 8 seeded rows; performance returns a JSON list (possibly empty if no data).

Stop server: `kill %1` (or Ctrl+C).

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/dashboard.py backend/app/routers/__init__.py backend/app/main.py
git commit -m "feat(backend): register dashboard router with performance + thresholds endpoints"
```

---

### Task C2: Add priority + per-client threshold endpoints to clients router

**Files:**
- Modify: `backend/app/routers/clients.py`

- [ ] **Step 1: Add imports and new endpoints**

At the top of `backend/app/routers/clients.py`, after the existing imports, add these new ones (`select` is already imported in this file, so do NOT re-import it):

```python
from app.schemas.dashboard import (
    ThresholdConfig,
    ClientThresholdOverrideUpdate,
    PriorityUpdate,
)
from app.models.dashboard import DashboardThreshold
```

At the **end** of `backend/app/routers/clients.py`, append:

```python
# ── Priority ─────────────────────────────────────────────────────


@router.patch("/{client_id}/priority", response_model=ClientRead)
async def update_client_priority(
    client_id: uuid.UUID,
    payload: PriorityUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client.priority = payload.priority
    await db.commit()
    await db.refresh(client)
    return client


# ── Per-Client Threshold Overrides ──────────────────────────────


@router.get("/{client_id}/thresholds", response_model=list[ThresholdConfig])
async def get_client_thresholds(
    client_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Return merged thresholds: global defaults overlaid with per-client overrides."""
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Load globals
    gres = await db.execute(select(DashboardThreshold).order_by(DashboardThreshold.metric_name))
    globals_map = {g.metric_name: g for g in gres.scalars().all()}

    overrides = (client.report_settings or {}).get("threshold_overrides") or {}

    merged: list[ThresholdConfig] = []
    for metric_name, g in globals_map.items():
        ov = overrides.get(metric_name) or {}
        merged.append(ThresholdConfig(
            metric_name=metric_name,
            red_below=ov.get("red_below", float(g.red_below) if g.red_below is not None else None),
            green_above=ov.get("green_above", float(g.green_above) if g.green_above is not None else None),
        ))
    return merged


@router.patch("/{client_id}/thresholds", response_model=ClientRead)
async def save_client_threshold_overrides(
    client_id: uuid.UUID,
    payload: ClientThresholdOverrideUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Replace the full threshold_overrides dict on the client."""
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    settings = dict(client.report_settings or {})
    settings["threshold_overrides"] = {
        metric: ov.model_dump() for metric, ov in payload.overrides.items()
    }
    client.report_settings = settings
    await db.commit()
    await db.refresh(client)
    return client
```

- [ ] **Step 2: Verify routes show up**

Start the server (as in C1 step 4), then:

```bash
curl -s "http://localhost:8000/openapi.json" | python -c "import json,sys; d=json.load(sys.stdin); print('\n'.join(sorted(d['paths'].keys())))" | grep -E "(priority|thresholds)"
```

Expected output (order may vary):
```
/api/clients/{client_id}/priority
/api/clients/{client_id}/thresholds
/api/dashboard/thresholds
```

Stop server.

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/clients.py
git commit -m "feat(backend): client priority and threshold override endpoints"
```

---

## Phase D — Frontend Types & API Client

### Task D1: Add TypeScript types

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Append new types**

At the **end** of `frontend/src/types/index.ts`, append:

```typescript
// ── Performance Dashboard ──

export interface DashboardRow {
  client_id: string;
  client_name: string;
  priority: number | null;
  connected_sources: DataSource[];

  // Google Ads
  impressions: number | null;
  clicks: number | null;
  cost: number | null;
  cpc: number | null;

  // Cross-platform
  orders: number | null;
  revenue: number | null;
  rc_ratio: number | null;

  // Shopify
  shopify_orders: number | null;
  shopify_revenue: number | null;
  shopify_roas: number | null;

  // GA4
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

Also extend `ReportSettings` (around line 55) with an optional override map. Replace the existing `ReportSettings` interface:

```typescript
export interface ReportSettings {
  kpi_targets?: KpiTargets;
  enabled_sections?: string[];
  threshold_overrides?: Record<string, ThresholdOverride>;
}
```

- [ ] **Step 2: Typecheck**

```bash
cd "/Users/siddumanju/Desktop/MatrixFerm/Data Extracter of MCC's/frontend"
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat(frontend): types for DashboardRow, ThresholdConfig, ThresholdOverride"
```

---

### Task D2: Add API client methods

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Update imports and add methods**

At the top of `frontend/src/lib/api.ts`, extend the existing import from `../types`:

Find the line starting with `import { Client, PullJob, ...` and add `DashboardRow, ThresholdConfig, ThresholdOverride` to the end of the destructured list.

- [ ] **Step 2: Add six new methods to the `api` export**

Find the closing `};` of the `export const api = {` object. **Immediately before** that closing `};`, add:

```typescript
  // ── Performance Dashboard ──
  getDashboardPerformance: async (dateFrom: string, dateTo: string, clientIds?: string[]): Promise<DashboardRow[]> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/dashboard/performance`, {
        params: {
          date_from: dateFrom,
          date_to: dateTo,
          ...(clientIds && clientIds.length ? { client_ids: clientIds.join(',') } : {}),
        },
      });
      return response.data;
    } catch (e) {
      console.error('Failed to load dashboard performance', e);
      return [];
    }
  },

  getDashboardThresholds: async (): Promise<ThresholdConfig[]> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/dashboard/thresholds`);
      return response.data;
    } catch (e) {
      console.error('Failed to load global thresholds', e);
      return [];
    }
  },

  saveDashboardThresholds: async (thresholds: ThresholdConfig[]): Promise<ThresholdConfig[]> => {
    try {
      const response = await axios.put(`${API_BASE_URL}/dashboard/thresholds`, { thresholds });
      return response.data;
    } catch (e) {
      console.error('Failed to save global thresholds', e);
      return [];
    }
  },

  getClientThresholds: async (clientId: string): Promise<ThresholdConfig[]> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/clients/${clientId}/thresholds`);
      return response.data;
    } catch (e) {
      console.error('Failed to load client thresholds', e);
      return [];
    }
  },

  saveClientThresholdOverrides: async (
    clientId: string,
    overrides: Record<string, ThresholdOverride>,
  ): Promise<Client | undefined> => {
    try {
      const response = await axios.patch(`${API_BASE_URL}/clients/${clientId}/thresholds`, { overrides });
      return response.data;
    } catch (e) {
      console.error('Failed to save client thresholds', e);
      return undefined;
    }
  },

  updateClientPriority: async (clientId: string, priority: number | null): Promise<Client | undefined> => {
    try {
      const response = await axios.patch(`${API_BASE_URL}/clients/${clientId}/priority`, { priority });
      return response.data;
    } catch (e) {
      console.error('Failed to update client priority', e);
      return undefined;
    }
  },
```

- [ ] **Step 3: Typecheck**

```bash
cd "/Users/siddumanju/Desktop/MatrixFerm/Data Extracter of MCC's/frontend"
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(frontend): api client methods for dashboard performance, thresholds, priority"
```

---

## Phase E — Frontend Components (Reusable)

### Task E1: MetricCell component

**Files:**
- Create: `frontend/src/components/dashboard/MetricCell.tsx`

- [ ] **Step 1: Create the component**

```bash
mkdir -p "/Users/siddumanju/Desktop/MatrixFerm/Data Extracter of MCC's/frontend/src/components/dashboard"
```

Create `frontend/src/components/dashboard/MetricCell.tsx`:

```typescript
'use client';
import React from 'react';
import { ThresholdConfig } from '@/types';

interface MetricCellProps {
  value: number | null;
  metricName: string;
  thresholds: ThresholdConfig[];              // merged thresholds for this client
  format?: 'number' | 'currency' | 'percent' | 'ratio';
  currency?: string;
}

function formatValue(
  value: number | null,
  format: 'number' | 'currency' | 'percent' | 'ratio',
  currency: string,
): string {
  if (value === null || value === undefined) return '—';
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency', currency, maximumFractionDigits: 2,
      }).format(value);
    case 'percent':
      return `${value.toFixed(2)}%`;
    case 'ratio':
      return `${value.toFixed(2)}x`;
    case 'number':
    default:
      return new Intl.NumberFormat('en-US').format(value);
  }
}

function getBandColor(
  value: number | null,
  threshold: ThresholdConfig | undefined,
): 'red' | 'green' | 'neutral' {
  if (value === null || !threshold) return 'neutral';
  if (threshold.red_below !== null && value < threshold.red_below) return 'red';
  if (threshold.green_above !== null && value > threshold.green_above) return 'green';
  return 'neutral';
}

export default function MetricCell({
  value,
  metricName,
  thresholds,
  format = 'number',
  currency = 'USD',
}: MetricCellProps) {
  const threshold = thresholds.find(t => t.metric_name === metricName);
  const band = getBandColor(value, threshold);

  const colors = {
    red: { bg: 'rgba(239,68,68,0.12)', fg: '#ef4444' },
    green: { bg: 'rgba(16,185,129,0.12)', fg: '#10b981' },
    neutral: { bg: 'transparent', fg: 'var(--text-primary)' },
  }[band];

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.25rem 0.5rem',
        borderRadius: '4px',
        background: colors.bg,
        color: colors.fg,
        fontWeight: band === 'neutral' ? 400 : 600,
        fontSize: '0.875rem',
        fontVariantNumeric: 'tabular-nums',
        minWidth: '60px',
        textAlign: 'right',
      }}
    >
      {formatValue(value, format, currency)}
    </span>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/dashboard/MetricCell.tsx
git commit -m "feat(frontend): MetricCell component with threshold-based colorization"
```

---

### Task E2: PriorityCell component

**Files:**
- Create: `frontend/src/components/dashboard/PriorityCell.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/dashboard/PriorityCell.tsx`:

```typescript
'use client';
import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';

interface PriorityCellProps {
  clientId: string;
  priority: number | null;
  onSaved: (newPriority: number | null) => void;
}

export default function PriorityCell({ clientId, priority, onSaved }: PriorityCellProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(priority !== null ? String(priority) : '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = async () => {
    const trimmed = value.trim();
    const parsed = trimmed === '' ? null : Number(trimmed);
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) {
      setValue(priority !== null ? String(priority) : '');
      setEditing(false);
      return;
    }
    setSaving(true);
    const updated = await api.updateClientPriority(clientId, parsed);
    setSaving(false);
    setEditing(false);
    if (updated) onSaved(parsed);
    else setValue(priority !== null ? String(priority) : '');
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={0}
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setValue(priority !== null ? String(priority) : '');
            setEditing(false);
          }
        }}
        disabled={saving}
        style={{
          width: '60px',
          padding: '0.25rem 0.5rem',
          background: 'var(--surface)',
          border: '1px solid var(--accent-blue)',
          borderRadius: '4px',
          color: 'var(--text-primary)',
          fontSize: '0.875rem',
          textAlign: 'center',
        }}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      style={{
        width: '60px',
        padding: '0.25rem 0.5rem',
        background: priority !== null ? 'rgba(59,130,246,0.12)' : 'transparent',
        color: priority !== null ? 'var(--accent-blue)' : 'var(--text-muted)',
        border: '1px dashed var(--surface-border)',
        borderRadius: '4px',
        fontSize: '0.875rem',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {priority !== null ? priority : '—'}
    </button>
  );
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/dashboard/PriorityCell.tsx
git commit -m "feat(frontend): PriorityCell inline-editable component"
```

---

### Task E3: DateRangePicker component

**Files:**
- Create: `frontend/src/components/dashboard/DateRangePicker.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/dashboard/DateRangePicker.tsx`:

```typescript
'use client';
import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  label: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function makePresets(): DateRange[] {
  const today = new Date();
  const yday = new Date(today); yday.setDate(today.getDate() - 1);
  const last7 = new Date(today); last7.setDate(today.getDate() - 6);
  const last14 = new Date(today); last14.setDate(today.getDate() - 13);
  const last30 = new Date(today); last30.setDate(today.getDate() - 29);
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  return [
    { from: iso(today), to: iso(today), label: 'Today' },
    { from: iso(yday), to: iso(yday), label: 'Yesterday' },
    { from: iso(last7), to: iso(today), label: 'Last 7 days' },
    { from: iso(last14), to: iso(today), label: 'Last 14 days' },
    { from: iso(last30), to: iso(today), label: 'Last 30 days' },
    { from: iso(thisMonthStart), to: iso(today), label: 'This month' },
    { from: iso(lastMonthStart), to: iso(lastMonthEnd), label: 'Last month' },
  ];
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(value.from);
  const [customTo, setCustomTo] = useState(value.to);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const presets = makePresets();

  const applyCustom = () => {
    if (customFrom && customTo && customFrom <= customTo) {
      onChange({ from: customFrom, to: customTo, label: `${customFrom} → ${customTo}` });
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="btn btn-secondary"
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
      >
        <Calendar size={14} />
        {value.label}
        <ChevronDown size={14} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 100,
          background: 'var(--bg-secondary)', border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)', minWidth: '320px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: 'var(--space-4)' }}>
            {presets.map(p => (
              <button
                key={p.label}
                onClick={() => { onChange(p); setOpen(false); }}
                style={{
                  textAlign: 'left', padding: '0.5rem 0.75rem',
                  background: value.label === p.label ? 'rgba(59,130,246,0.12)' : 'transparent',
                  color: value.label === p.label ? 'var(--accent-blue)' : 'var(--text-primary)',
                  border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: 'var(--space-4)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'var(--space-2)', fontWeight: 600 }}>
              CUSTOM RANGE
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="form-input"
                style={{ flex: 1 }}
              />
              <span>→</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="form-input"
                style={{ flex: 1 }}
              />
            </div>
            <button
              onClick={applyCustom}
              className="btn btn-primary btn-sm"
              style={{ marginTop: 'var(--space-3)', width: '100%' }}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/dashboard/DateRangePicker.tsx
git commit -m "feat(frontend): DateRangePicker with Google Ads-style presets"
```

---

### Task E4: DashboardFilters component

**Files:**
- Create: `frontend/src/components/dashboard/DashboardFilters.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/dashboard/DashboardFilters.tsx`:

```typescript
'use client';
import { Search } from 'lucide-react';
import { DataSource } from '@/types';

export interface FilterState {
  search: string;
  source: DataSource | 'all';
  performance: 'all' | 'has_red';
  priorityMax: number | null;
}

interface DashboardFiltersProps {
  value: FilterState;
  onChange: (next: FilterState) => void;
  onOpenThresholdEditor: () => void;
}

export default function DashboardFilters({ value, onChange, onOpenThresholdEditor }: DashboardFiltersProps) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', flexWrap: 'wrap', alignItems: 'center' }}>
      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        background: 'var(--surface)', border: '1px solid var(--surface-border)',
        borderRadius: 'var(--radius-md)', padding: '0.5rem var(--space-3)', flex: 1, minWidth: '240px',
      }}>
        <Search size={14} color="var(--text-muted)" />
        <input
          type="text"
          placeholder="Search client name..."
          value={value.search}
          onChange={e => onChange({ ...value, search: e.target.value })}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontSize: '0.875rem',
          }}
        />
      </div>

      {/* Source */}
      <select
        value={value.source}
        onChange={e => onChange({ ...value, source: e.target.value as FilterState['source'] })}
        className="form-input"
        style={{ minWidth: '160px' }}
      >
        <option value="all">All sources</option>
        <option value="google_ads">Google Ads</option>
        <option value="meta_ads">Meta Ads</option>
        <option value="shopify">Shopify</option>
        <option value="ga4">GA4</option>
      </select>

      {/* Performance */}
      <select
        value={value.performance}
        onChange={e => onChange({ ...value, performance: e.target.value as FilterState['performance'] })}
        className="form-input"
        style={{ minWidth: '180px' }}
      >
        <option value="all">All performance</option>
        <option value="has_red">Has red metrics</option>
      </select>

      {/* Priority */}
      <select
        value={value.priorityMax === null ? 'all' : String(value.priorityMax)}
        onChange={e => onChange({
          ...value,
          priorityMax: e.target.value === 'all' ? null : Number(e.target.value),
        })}
        className="form-input"
        style={{ minWidth: '140px' }}
      >
        <option value="all">All priorities</option>
        <option value="3">Top 3</option>
        <option value="5">Top 5</option>
        <option value="10">Top 10</option>
      </select>

      <button onClick={onOpenThresholdEditor} className="btn btn-secondary btn-sm">
        ⚙ Thresholds
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/dashboard/DashboardFilters.tsx
git commit -m "feat(frontend): DashboardFilters bar"
```

---

### Task E5: ThresholdEditor modal

**Files:**
- Create: `frontend/src/components/dashboard/ThresholdEditor.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/dashboard/ThresholdEditor.tsx`:

```typescript
'use client';
import { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { ThresholdConfig } from '@/types';
import { api } from '@/lib/api';

interface ThresholdEditorProps {
  open: boolean;
  onClose: () => void;
  onSaved?: (thresholds: ThresholdConfig[]) => void;
}

const METRIC_LABELS: Record<string, string> = {
  roas: 'ROAS',
  cpc: 'CPC',
  rc_ratio: 'R/C Ratio',
  orders: 'Orders',
  revenue: 'Revenue',
  impressions: 'Impressions',
  clicks: 'Clicks',
  cost: 'Cost',
};

export default function ThresholdEditor({ open, onClose, onSaved }: ThresholdEditorProps) {
  const [thresholds, setThresholds] = useState<ThresholdConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.getDashboardThresholds().then(ts => {
      setThresholds(ts);
      setLoading(false);
    });
  }, [open]);

  if (!open) return null;

  const update = (metric: string, field: 'red_below' | 'green_above', raw: string) => {
    const n = raw.trim() === '' ? null : Number(raw);
    setThresholds(prev => prev.map(t =>
      t.metric_name === metric ? { ...t, [field]: isNaN(n as number) ? null : n } : t,
    ));
  };

  const save = async () => {
    setSaving(true);
    const saved = await api.saveDashboardThresholds(thresholds);
    setSaving(false);
    if (saved.length) {
      onSaved?.(saved);
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div className="glass-panel" style={{
        width: '560px', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        padding: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--space-5)', borderBottom: '1px solid var(--surface-border)',
        }}>
          <h2 className="heading-3" style={{ margin: 0 }}>Dashboard Thresholds</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm"><X size={16} /></button>
        </div>

        <div style={{ padding: 'var(--space-5)', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : (
            <table style={{ width: '100%', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <th style={{ textAlign: 'left', padding: 'var(--space-2)' }}>Metric</th>
                  <th style={{ textAlign: 'left', padding: 'var(--space-2)' }}>🔴 Red below</th>
                  <th style={{ textAlign: 'left', padding: 'var(--space-2)' }}>🟢 Green above</th>
                </tr>
              </thead>
              <tbody>
                {thresholds.map(t => (
                  <tr key={t.metric_name} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    <td style={{ padding: 'var(--space-2)', fontWeight: 500 }}>
                      {METRIC_LABELS[t.metric_name] ?? t.metric_name}
                    </td>
                    <td style={{ padding: 'var(--space-2)' }}>
                      <input
                        type="number"
                        step="any"
                        value={t.red_below === null ? '' : t.red_below}
                        onChange={e => update(t.metric_name, 'red_below', e.target.value)}
                        placeholder="—"
                        className="form-input"
                        style={{ width: '100px' }}
                      />
                    </td>
                    <td style={{ padding: 'var(--space-2)' }}>
                      <input
                        type="number"
                        step="any"
                        value={t.green_above === null ? '' : t.green_above}
                        onChange={e => update(t.metric_name, 'green_above', e.target.value)}
                        placeholder="—"
                        className="form-input"
                        style={{ width: '100px' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)',
          padding: 'var(--space-5)', borderTop: '1px solid var(--surface-border)',
        }}>
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving || loading} className="btn btn-primary">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Save size={14} /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/dashboard/ThresholdEditor.tsx
git commit -m "feat(frontend): ThresholdEditor modal for global thresholds"
```

---

### Task E6: ClientThresholdOverrides component

**Files:**
- Create: `frontend/src/components/dashboard/ClientThresholdOverrides.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/dashboard/ClientThresholdOverrides.tsx`:

```typescript
'use client';
import { useEffect, useState } from 'react';
import { Loader2, Save, RotateCcw, Plus } from 'lucide-react';
import { ThresholdConfig, ThresholdOverride } from '@/types';
import { api } from '@/lib/api';

interface Props {
  clientId: string;
  existingOverrides: Record<string, ThresholdOverride>;
  onSaved: (newOverrides: Record<string, ThresholdOverride>) => void;
}

const METRIC_LABELS: Record<string, string> = {
  roas: 'ROAS', cpc: 'CPC', rc_ratio: 'R/C Ratio', orders: 'Orders',
  revenue: 'Revenue', impressions: 'Impressions', clicks: 'Clicks', cost: 'Cost',
};

export default function ClientThresholdOverrides({ clientId, existingOverrides, onSaved }: Props) {
  const [globals, setGlobals] = useState<ThresholdConfig[]>([]);
  const [overrides, setOverrides] = useState<Record<string, ThresholdOverride>>(existingOverrides || {});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api.getDashboardThresholds().then(g => { setGlobals(g); setLoading(false); });
  }, []);

  const overrideMetrics = Object.keys(overrides);
  const availableMetrics = globals.map(g => g.metric_name).filter(m => !overrideMetrics.includes(m));

  const addOverride = (metric: string) => {
    const g = globals.find(x => x.metric_name === metric);
    setOverrides({
      ...overrides,
      [metric]: {
        red_below: g?.red_below ?? null,
        green_above: g?.green_above ?? null,
      },
    });
    setAdding(false);
  };

  const updateField = (metric: string, field: 'red_below' | 'green_above', raw: string) => {
    const n = raw.trim() === '' ? null : Number(raw);
    setOverrides({
      ...overrides,
      [metric]: { ...overrides[metric], [field]: isNaN(n as number) ? null : n },
    });
  };

  const reset = (metric: string) => {
    const next = { ...overrides };
    delete next[metric];
    setOverrides(next);
  };

  const save = async () => {
    setSaving(true);
    const updated = await api.saveClientThresholdOverrides(clientId, overrides);
    setSaving(false);
    if (updated) onSaved(overrides);
  };

  if (loading) {
    return <div style={{ padding: 'var(--space-4)' }}><Loader2 size={20} className="animate-spin" /></div>;
  }

  return (
    <div className="glass-panel" style={{ padding: 'var(--space-5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div>
          <h3 className="heading-3" style={{ marginBottom: '0.25rem' }}>Threshold Overrides</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            {overrideMetrics.length === 0 ? 'Inherits global defaults' : `${overrideMetrics.length} metric(s) overridden`}
          </p>
        </div>
        <button onClick={save} disabled={saving} className="btn btn-primary btn-sm">
          {saving ? <><Loader2 size={12} className="animate-spin" /> Saving...</> : <><Save size={12} /> Save</>}
        </button>
      </div>

      {overrideMetrics.length > 0 && (
        <table style={{ width: '100%', fontSize: '0.875rem', marginBottom: 'var(--space-4)' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <th style={{ textAlign: 'left', padding: 'var(--space-2)' }}>Metric</th>
              <th style={{ textAlign: 'left', padding: 'var(--space-2)' }}>🔴 Red below</th>
              <th style={{ textAlign: 'left', padding: 'var(--space-2)' }}>🟢 Green above</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {overrideMetrics.map(metric => (
              <tr key={metric} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                <td style={{ padding: 'var(--space-2)', fontWeight: 500 }}>
                  {METRIC_LABELS[metric] ?? metric}
                </td>
                <td style={{ padding: 'var(--space-2)' }}>
                  <input
                    type="number"
                    step="any"
                    value={overrides[metric].red_below === null ? '' : overrides[metric].red_below ?? ''}
                    onChange={e => updateField(metric, 'red_below', e.target.value)}
                    className="form-input"
                    style={{ width: '100px' }}
                  />
                </td>
                <td style={{ padding: 'var(--space-2)' }}>
                  <input
                    type="number"
                    step="any"
                    value={overrides[metric].green_above === null ? '' : overrides[metric].green_above ?? ''}
                    onChange={e => updateField(metric, 'green_above', e.target.value)}
                    className="form-input"
                    style={{ width: '100px' }}
                  />
                </td>
                <td style={{ padding: 'var(--space-2)', textAlign: 'right' }}>
                  <button onClick={() => reset(metric)} className="btn btn-ghost btn-sm" title="Reset to global">
                    <RotateCcw size={12} /> Reset
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {availableMetrics.length > 0 && (
        adding ? (
          <select
            onChange={e => { if (e.target.value) addOverride(e.target.value); }}
            defaultValue=""
            className="form-input"
            style={{ width: '200px' }}
          >
            <option value="" disabled>Pick a metric...</option>
            {availableMetrics.map(m => (
              <option key={m} value={m}>{METRIC_LABELS[m] ?? m}</option>
            ))}
          </select>
        ) : (
          <button onClick={() => setAdding(true)} className="btn btn-ghost btn-sm">
            <Plus size={12} /> Add override
          </button>
        )
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/dashboard/ClientThresholdOverrides.tsx
git commit -m "feat(frontend): ClientThresholdOverrides per-client config"
```

---

### Task E7: DashboardTable component

**Files:**
- Create: `frontend/src/components/dashboard/DashboardTable.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/dashboard/DashboardTable.tsx`:

```typescript
'use client';
import React from 'react';
import { DashboardRow, ThresholdConfig } from '@/types';
import MetricCell from './MetricCell';
import PriorityCell from './PriorityCell';

interface DashboardTableProps {
  rows: DashboardRow[];
  thresholds: ThresholdConfig[];
  onPriorityChanged: (clientId: string, newPriority: number | null) => void;
}

export default function DashboardTable({ rows, thresholds, onPriorityChanged }: DashboardTableProps) {
  return (
    <div className="glass-panel" style={{ overflow: 'auto' }}>
      <table className="data-table" style={{ minWidth: '1200px' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'center', width: '80px' }}>Priority</th>
            <th>Account Name</th>
            <th style={{ textAlign: 'right' }}>Impressions</th>
            <th style={{ textAlign: 'right' }}>Clicks</th>
            <th style={{ textAlign: 'right' }}>Cost</th>
            <th style={{ textAlign: 'right' }}>CPC</th>
            <th style={{ textAlign: 'right' }}>Orders</th>
            <th style={{ textAlign: 'right' }}>Revenue</th>
            <th style={{ textAlign: 'right' }}>R/C</th>
            <th style={{ textAlign: 'right' }}>Orders (Shopify)</th>
            <th style={{ textAlign: 'right' }}>Revenue (Shopify)</th>
            <th style={{ textAlign: 'right' }}>ROAS (Shopify)</th>
            <th style={{ textAlign: 'right' }}>Orders (GA4)</th>
            <th style={{ textAlign: 'right' }}>Revenue (GA4)</th>
            <th style={{ textAlign: 'right' }}>ROAS (GA4)</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={15} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
                No clients match the current filters.
              </td>
            </tr>
          ) : (
            rows.map(r => (
              <tr key={r.client_id}>
                <td style={{ textAlign: 'center' }}>
                  <PriorityCell
                    clientId={r.client_id}
                    priority={r.priority}
                    onSaved={p => onPriorityChanged(r.client_id, p)}
                  />
                </td>
                <td style={{ fontWeight: 500 }}>{r.client_name}</td>
                <td style={{ textAlign: 'right' }}>
                  <MetricCell value={r.impressions} metricName="impressions" thresholds={thresholds} />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MetricCell value={r.clicks} metricName="clicks" thresholds={thresholds} />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MetricCell value={r.cost} metricName="cost" thresholds={thresholds} format="currency" />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MetricCell value={r.cpc} metricName="cpc" thresholds={thresholds} format="currency" />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MetricCell value={r.orders} metricName="orders" thresholds={thresholds} />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MetricCell value={r.revenue} metricName="revenue" thresholds={thresholds} format="currency" />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MetricCell value={r.rc_ratio} metricName="rc_ratio" thresholds={thresholds} format="ratio" />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MetricCell value={r.shopify_orders} metricName="orders" thresholds={thresholds} />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MetricCell value={r.shopify_revenue} metricName="revenue" thresholds={thresholds} format="currency" />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MetricCell value={r.shopify_roas} metricName="roas" thresholds={thresholds} format="ratio" />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MetricCell value={r.ga4_orders} metricName="orders" thresholds={thresholds} />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MetricCell value={r.ga4_revenue} metricName="revenue" thresholds={thresholds} format="currency" />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MetricCell value={r.ga4_roas} metricName="roas" thresholds={thresholds} format="ratio" />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/dashboard/DashboardTable.tsx
git commit -m "feat(frontend): DashboardTable assembling MetricCell + PriorityCell"
```

---

## Phase F — Dashboard Page Assembly

### Task F1: Build the /dashboard page

**Files:**
- Create: `frontend/src/app/dashboard/page.tsx`

- [ ] **Step 1: Create the page**

```bash
mkdir -p "/Users/siddumanju/Desktop/MatrixFerm/Data Extracter of MCC's/frontend/src/app/dashboard"
```

Create `frontend/src/app/dashboard/page.tsx`:

```typescript
'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { DashboardRow, ThresholdConfig } from '@/types';
import { api } from '@/lib/api';
import DashboardTable from '@/components/dashboard/DashboardTable';
import DateRangePicker, { DateRange } from '@/components/dashboard/DateRangePicker';
import DashboardFilters, { FilterState } from '@/components/dashboard/DashboardFilters';
import ThresholdEditor from '@/components/dashboard/ThresholdEditor';

function defaultRange(): DateRange {
  const today = new Date();
  const from = new Date(today); from.setDate(today.getDate() - 29);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(today), label: 'Last 30 days' };
}

export default function DashboardPage() {
  const [range, setRange] = useState<DateRange>(defaultRange());
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [thresholds, setThresholds] = useState<ThresholdConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    source: 'all',
    performance: 'all',
    priorityMax: null,
  });

  // Load rows when range changes
  useEffect(() => {
    setLoading(true);
    api.getDashboardPerformance(range.from, range.to).then(data => {
      setRows(data);
      setLoading(false);
    });
  }, [range.from, range.to]);

  // Load thresholds once on mount
  useEffect(() => {
    api.getDashboardThresholds().then(setThresholds);
  }, []);

  const handlePriorityChanged = (clientId: string, newPriority: number | null) => {
    setRows(prev => prev.map(r => r.client_id === clientId ? { ...r, priority: newPriority } : r));
  };

  // Apply filters
  const filteredRows = useMemo(() => {
    let out = rows;

    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      out = out.filter(r => r.client_name.toLowerCase().includes(q));
    }

    if (filters.source !== 'all') {
      out = out.filter(r => r.connected_sources.includes(filters.source));
    }

    if (filters.priorityMax !== null) {
      out = out.filter(r => r.priority !== null && r.priority <= filters.priorityMax!);
    }

    if (filters.performance === 'has_red') {
      out = out.filter(r => hasRedMetric(r, thresholds));
    }

    // Sort by priority asc (nulls last), then by name
    out = [...out].sort((a, b) => {
      if (a.priority === null && b.priority === null) return a.client_name.localeCompare(b.client_name);
      if (a.priority === null) return 1;
      if (b.priority === null) return -1;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.client_name.localeCompare(b.client_name);
    });

    return out;
  }, [rows, filters, thresholds]);

  return (
    <div className="fade-in">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-8)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <BarChart3 size={24} color="var(--accent-primary)" />
            <h1 className="heading-1" style={{ marginBottom: 0 }}>Performance Dashboard</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
            Cross-client performance overview with threshold-based colorization.
          </p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </header>

      <DashboardFilters
        value={filters}
        onChange={setFilters}
        onOpenThresholdEditor={() => setEditorOpen(true)}
      />

      {loading ? (
        <div className="empty-state" style={{ minHeight: '280px' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent-blue)' }} />
          <p style={{ fontSize: '0.9375rem' }}>Loading performance data...</p>
        </div>
      ) : (
        <DashboardTable
          rows={filteredRows}
          thresholds={thresholds}
          onPriorityChanged={handlePriorityChanged}
        />
      )}

      <ThresholdEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={ts => setThresholds(ts)}
      />
    </div>
  );
}

function hasRedMetric(row: DashboardRow, thresholds: ThresholdConfig[]): boolean {
  const checks: Array<[number | null, string]> = [
    [row.impressions, 'impressions'], [row.clicks, 'clicks'],
    [row.cost, 'cost'], [row.cpc, 'cpc'],
    [row.orders, 'orders'], [row.revenue, 'revenue'], [row.rc_ratio, 'rc_ratio'],
    [row.shopify_orders, 'orders'], [row.shopify_revenue, 'revenue'], [row.shopify_roas, 'roas'],
    [row.ga4_orders, 'orders'], [row.ga4_revenue, 'revenue'], [row.ga4_roas, 'roas'],
  ];
  for (const [val, name] of checks) {
    if (val === null) continue;
    const t = thresholds.find(x => x.metric_name === name);
    if (t && t.red_below !== null && val < t.red_below) return true;
  }
  return false;
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/app/dashboard/page.tsx
git commit -m "feat(frontend): /dashboard page wiring all components together"
```

---

### Task F2: Add Dashboard link to sidebar

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Add nav link**

In `frontend/src/components/Sidebar.tsx`:

1. Update the `lucide-react` import line to include `BarChart3`:

```typescript
import { LayoutDashboard, Users, Activity, FileBarChart, Settings, Zap, TrendingUp, BarChart3 } from 'lucide-react';
```

2. In the `links` array, add a new entry **immediately after** `{ name: 'Overview', href: '/', icon: LayoutDashboard }`:

```typescript
    { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
```

- [ ] **Step 2: Verify page loads**

Start both servers:

```bash
cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000 &
cd "/Users/siddumanju/Desktop/MatrixFerm/Data Extracter of MCC's/frontend" && npm run dev &
sleep 5
```

Open browser: http://localhost:3000/dashboard

Expected: Page loads with date picker, filter bar, and table (possibly empty if no data exists for the default last-30-days range). Sidebar shows "Dashboard" link between Overview and Clients.

Stop both servers.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Sidebar.tsx
git commit -m "feat(frontend): add Dashboard nav link to sidebar"
```

---

## Phase G — Settings Integration (Global Thresholds)

### Task G1: Add threshold editor card to Settings page

**Files:**
- Create: `frontend/src/components/dashboard/GlobalThresholdsCard.tsx`
- Modify: `frontend/src/app/settings/page.tsx`

The existing settings page is a server component. Rather than converting it, we'll add a client-component card that can be dropped in.

- [ ] **Step 1: Create the client-only card wrapper**

Create `frontend/src/components/dashboard/GlobalThresholdsCard.tsx`:

```typescript
'use client';
import { useState } from 'react';
import { Sliders } from 'lucide-react';
import ThresholdEditor from './ThresholdEditor';

export default function GlobalThresholdsCard() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="glass-panel" style={{ padding: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <Sliders size={18} color="var(--accent-primary)" />
          <h3 className="heading-3" style={{ marginBottom: 0 }}>Dashboard Thresholds</h3>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 'var(--space-4)' }}>
          Set global red/green color thresholds for each metric on the Performance Dashboard.
          Per-client overrides can be set on each client's detail page.
        </p>
        <button onClick={() => setOpen(true)} className="btn btn-primary btn-sm">
          Edit Thresholds
        </button>
      </div>

      <ThresholdEditor open={open} onClose={() => setOpen(false)} />
    </>
  );
}
```

- [ ] **Step 2: Import and render it on the Settings page**

In `frontend/src/app/settings/page.tsx`, at the top of the file (after the `lucide-react` import), add:

```typescript
import GlobalThresholdsCard from '@/components/dashboard/GlobalThresholdsCard';
```

Then, inside the main `<div className="fade-in" ...>` wrapper, **immediately after** the `<header>` block (before the Platform Credentials section), add:

```typescript
      <section style={{ marginBottom: 'var(--space-10)' }}>
        <GlobalThresholdsCard />
      </section>
```

- [ ] **Step 3: Verify**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors. Load `/settings` in the browser and confirm the "Dashboard Thresholds" card appears at the top, the "Edit Thresholds" button opens the modal, and saving updates threshold values.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dashboard/GlobalThresholdsCard.tsx frontend/src/app/settings/page.tsx
git commit -m "feat(frontend): global threshold editor on settings page"
```

---

## Phase H — Client Detail Integration (Per-Client Overrides)

### Task H1: Add ClientThresholdOverrides to client detail page

**Files:**
- Modify: `frontend/src/app/clients/[id]/page.tsx`

- [ ] **Step 1: Inspect the client detail page**

Read the file to find a good place to insert the overrides panel (typically after data-source connection status, before reports/metrics):

```bash
grep -n "ClientDetailContent\|report_settings\|Reports" "/Users/siddumanju/Desktop/MatrixFerm/Data Extracter of MCC's/frontend/src/app/clients/[id]/page.tsx" | head -20
```

- [ ] **Step 2: Wire the component**

The client detail page already loads the client. Locate the section that renders the main body and add the overrides panel.

In `frontend/src/app/clients/[id]/page.tsx`, at the top of the file in the imports, add:

```typescript
import ClientThresholdOverrides from '@/components/dashboard/ClientThresholdOverrides';
```

Inside the component body, locate where `client` is available as a loaded value (look for `const [client, setClient] = ...` or similar). After the existing content sections but before the closing of the main wrapping div, add:

```tsx
{client && (
  <div style={{ marginBottom: 'var(--space-6)' }}>
    <ClientThresholdOverrides
      clientId={client.id}
      existingOverrides={client.report_settings?.threshold_overrides ?? {}}
      onSaved={newOverrides => {
        setClient({
          ...client,
          report_settings: {
            ...(client.report_settings ?? {}),
            threshold_overrides: newOverrides,
          },
        });
      }}
    />
  </div>
)}
```

If the file uses a different state setter (not `setClient`), adapt the `onSaved` handler to use whatever updates the client state locally.

- [ ] **Step 3: Typecheck and verify in browser**

```bash
cd frontend && npx tsc --noEmit
```

Start servers, navigate to a client detail page, confirm:
- "Threshold Overrides" panel appears
- "Add override" shows available metrics
- Editing values and clicking Save persists (refresh page to confirm)
- "Reset" removes an override
- Overrides flow through to the Dashboard cell colors for that client

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/clients/[id]/page.tsx
git commit -m "feat(frontend): per-client threshold overrides on client detail page"
```

---

## Phase I — End-to-End Verification

### Task I1: Full-flow smoke test

- [ ] **Step 1: Boot the full stack**

```bash
cd "/Users/siddumanju/Desktop/MatrixFerm/Data Extracter of MCC's/backend"
source venv/bin/activate
uvicorn app.main:app --reload --port 8000 &

cd "/Users/siddumanju/Desktop/MatrixFerm/Data Extracter of MCC's/frontend"
npm run dev &
```

Wait 5 seconds for both to finish starting.

- [ ] **Step 2: Verification checklist**

Open http://localhost:3000/dashboard. Walk through:

1. **Date range picker** — click, pick "Last 7 days", confirm table refetches
2. **Date range picker — custom** — pick custom range (e.g. 2026-03-01 → 2026-04-01), click Apply, confirm refetch
3. **Search filter** — type part of a client name, rows filter instantly
4. **Source filter** — pick "Shopify", only Shopify-connected clients show
5. **Priority filter** — pick "Top 5", only clients with priority ≤ 5 remain
6. **Performance filter** — pick "Has red metrics", only clients with any red cell remain
7. **Priority editing** — click a "—" cell, type `1`, press Enter, confirm value saves and table resorts
8. **Global thresholds** — click ⚙ Thresholds, change ROAS red_below to `1.0`, save, confirm cell colors update live
9. **Per-client override** — open a client's detail page, add a ROAS override with different red_below, save, return to dashboard, confirm that client's ROAS cell uses the override
10. **Edge: empty data** — pick a date range with no data, table shows "No clients match" or all cells show "—"

- [ ] **Step 3: Stop servers and commit any final fixes**

```bash
kill %1 %2 2>/dev/null
```

If bugs are found during verification, fix them, commit with `fix:` prefix, re-run the checklist, then:

```bash
git log --oneline | head -25
```

Confirm the commit history shows clean, incremental commits from Task A1 through F2.

---

## Summary of Deliverables

- **Backend:** 1 new model, 1 new schema file, 1 new service, 1 new router, 1 migration, 2 endpoints added to clients router, 1 new column on clients table, 1 new table
- **Frontend:** 1 new page, 8 new components, 3 new types, 6 new API methods, 1 sidebar entry, 1 settings card, 1 client-detail panel
- **Total expected commits:** ~20 small, focused commits
