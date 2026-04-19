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
