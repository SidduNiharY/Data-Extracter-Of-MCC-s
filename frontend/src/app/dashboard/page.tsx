'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Activity } from 'lucide-react';
import { DashboardRow, ThresholdConfig } from '@/types';
import { api } from '@/lib/api';
import DashboardTable from '@/components/dashboard/DashboardTable';
import DateRangePicker, { DateRange } from '@/components/dashboard/DateRangePicker';
import DashboardFilters, { FilterState } from '@/components/dashboard/DashboardFilters';
import ThresholdEditor from '@/components/dashboard/ThresholdEditor';
import s from './dashboard.module.css';

function defaultRange(): DateRange {
  const today = new Date();
  const from = new Date(today); from.setDate(today.getDate() - 29);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(today), label: 'Last 30 days' };
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
const fmtCompact = (v: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

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

  useEffect(() => {
    setLoading(true);
    api.getDashboardPerformance(range.from, range.to).then(data => {
      setRows(data);
      setLoading(false);
    });
  }, [range.from, range.to]);

  useEffect(() => {
    api.getDashboardThresholds().then(setThresholds);
  }, []);

  const handlePriorityChanged = (clientId: string, newPriority: number | null) => {
    setRows(prev => prev.map(r => r.client_id === clientId ? { ...r, priority: newPriority } : r));
  };

  const filteredRows = useMemo(() => {
    let out = rows;

    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      out = out.filter(r => r.client_name.toLowerCase().includes(q));
    }
    if (filters.source !== 'all') {
      const src = filters.source;
      out = out.filter(r => r.connected_sources.includes(src));
    }
    if (filters.priorityMax !== null) {
      out = out.filter(r => r.priority !== null && r.priority <= filters.priorityMax!);
    }
    if (filters.performance === 'has_red') {
      out = out.filter(r => hasRedMetric(r, thresholds));
    }

    out = [...out].sort((a, b) => {
      if (a.priority === null && b.priority === null) return a.client_name.localeCompare(b.client_name);
      if (a.priority === null) return 1;
      if (b.priority === null) return -1;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.client_name.localeCompare(b.client_name);
    });
    return out;
  }, [rows, filters, thresholds]);

  // ─── Aggregate KPIs across visible rows ───
  const kpis = useMemo(() => {
    const sum = (key: keyof DashboardRow) =>
      rows.reduce((acc, r) => acc + ((r[key] as number | null) ?? 0), 0);
    const totalCost = sum('cost');
    const totalRev = sum('revenue') + sum('shopify_revenue'); // combined
    const totalOrders = sum('orders') + sum('shopify_orders');
    const totalImpressions = sum('impressions');
    const blendedRoas = totalCost > 0 ? totalRev / totalCost : null;
    return {
      clients: rows.length,
      totalCost, totalRev, totalOrders, totalImpressions, blendedRoas,
    };
  }, [rows]);

  const hasAnyData = rows.some(r =>
    r.impressions !== null || r.clicks !== null || r.cost !== null ||
    r.shopify_revenue !== null || r.ga4_revenue !== null,
  );

  const nowStamp = new Date().toLocaleString('en-US', {
    month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className={s.page}>
      {/* ─── HERO ─── */}
      <header className={`${s.hero} ${s.rise} ${s.rise1}`}>
        <div>
          <div className={s.eyebrow}>
            <Activity size={11} strokeWidth={2.5} />
            Performance Terminal · v1.0
          </div>
          <h1 className={s.title}>
            The <em>pulse</em> of every<br />account, at a glance.
          </h1>
          <p className={s.subtitle}>
            A cross-client performance ledger. Threshold-colored metrics surface outliers;
            priority ranks decide who gets your attention first.
          </p>
        </div>
        <div className={s.heroRight}>
          <div className={s.clock}>
            <strong>◎ LIVE</strong> · {nowStamp}
          </div>
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </header>

      {/* ─── KPI STRIP ─── */}
      <section className={`${s.kpis} ${s.rise} ${s.rise2}`}>
        <div className={s.kpi}>
          <div className={s.kpiLabel}>Accounts<span className={s.kpiTick} /></div>
          <div className={s.kpiValue}>{kpis.clients.toString().padStart(2, '0')}</div>
          <div className={s.kpiSub}>tracked · {filteredRows.length} visible</div>
        </div>
        <div className={s.kpi}>
          <div className={s.kpiLabel}>Spend</div>
          <div className={s.kpiValueMono}>{kpis.totalCost > 0 ? fmtCurrency(kpis.totalCost) : '—'}</div>
          <div className={s.kpiSub}>{range.label}</div>
        </div>
        <div className={s.kpi}>
          <div className={s.kpiLabel}>Revenue</div>
          <div className={s.kpiValueMono}>{kpis.totalRev > 0 ? fmtCurrency(kpis.totalRev) : '—'}</div>
          <div className={s.kpiSub}>{kpis.totalOrders > 0 ? `${fmtCompact(kpis.totalOrders)} orders` : 'awaiting orders'}</div>
        </div>
        <div className={s.kpi}>
          <div className={s.kpiLabel}>Blended ROAS</div>
          <div className={s.kpiValue}>{kpis.blendedRoas !== null ? `${kpis.blendedRoas.toFixed(2)}×` : '—'}</div>
          <div className={s.kpiSub}>revenue ÷ spend</div>
        </div>
      </section>

      {/* ─── EMPTY-STATE BANNER ─── */}
      {!loading && rows.length > 0 && !hasAnyData && (
        <div className={`${s.banner} ${s.rise} ${s.rise3}`}>
          <div className={s.bannerIcon}><AlertTriangle size={18} /></div>
          <div>
            <div className={s.bannerTitle}>No source data for this window</div>
            <div className={s.bannerText}>
              The aggregator ran clean — it just had nothing to aggregate. Raw tables
              (<code>google_ads_campaign</code>, <code>shopify_orders</code>, <code>ga4_revenue</code>)
              are empty and no client has an active <code>client_connections</code> row.
              Connect a client on its detail page, then trigger a pull job to populate metrics.
            </div>
          </div>
          <a href="/clients" className="btn btn-secondary btn-sm">Go to Clients →</a>
        </div>
      )}

      {/* ─── TOOLBAR / FILTERS ─── */}
      <div className={`${s.rise} ${s.rise3}`}>
        <DashboardFilters
          value={filters}
          onChange={setFilters}
          onOpenThresholdEditor={() => setEditorOpen(true)}
        />
      </div>

      {/* ─── TABLE ─── */}
      <section className={`${s.tableFrame} ${s.rise} ${s.rise4}`}>
        <div className={s.tableMeta}>
          <span>◯ Ledger · <strong>{filteredRows.length}</strong> rows · window {range.from} → {range.to}</span>
          <span>colorization: {thresholds.length} thresholds active</span>
        </div>
        {loading ? (
          <div className={s.loadingWell}>
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent-amber)' }} />
            Loading ledger…
          </div>
        ) : (
          <DashboardTable
            rows={filteredRows}
            thresholds={thresholds}
            onPriorityChanged={handlePriorityChanged}
          />
        )}
      </section>

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
