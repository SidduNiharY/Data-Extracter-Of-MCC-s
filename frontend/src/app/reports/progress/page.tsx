'use client';
import { useEffect, useState, useMemo } from 'react';
import { Minus, Filter, RefreshCw, Loader2, ArrowUpRight, ArrowDownRight, BarChart3 } from 'lucide-react';
import { api } from '../../../lib/api';
import type { Client, ReportProgressRow } from '../../../types';
import Link from 'next/link';

// Metrics that are "lower is better" — decrease shown in green
const INVERSE_METRICS = new Set(['spend', 'avg_cpc', 'cpc', 'cpm', 'cost_per_conv', 'cost_per_lead', 'cost_per_result', 'cpa', 'total_spend']);

// Define which metrics to show per source
const SOURCE_DISPLAY_METRICS: Record<string, { key: string; label: string; format: 'number' | 'currency' | 'pct' | 'decimal' }[]> = {
  google_ads: [
    { key: 'impressions', label: 'Impressions', format: 'number' },
    { key: 'clicks', label: 'Clicks', format: 'number' },
    { key: 'spend', label: 'Spend', format: 'currency' },
    { key: 'conversions', label: 'Conversions', format: 'number' },
    { key: 'conv_value', label: 'Conv. Value', format: 'currency' },
    { key: 'ctr', label: 'CTR', format: 'pct' },
    { key: 'avg_cpc', label: 'Avg CPC', format: 'currency' },
    { key: 'roas', label: 'ROAS', format: 'decimal' },
    { key: 'cost_per_conv', label: 'Cost/Conv', format: 'currency' },
  ],
  meta_ads: [
    { key: 'impressions', label: 'Impressions', format: 'number' },
    { key: 'clicks', label: 'Clicks', format: 'number' },
    { key: 'spend', label: 'Spend', format: 'currency' },
    { key: 'conversions', label: 'Conversions', format: 'number' },
    { key: 'ctr', label: 'CTR', format: 'pct' },
    { key: 'cpc', label: 'CPC', format: 'currency' },
    { key: 'roas', label: 'ROAS', format: 'decimal' },
    { key: 'reach', label: 'Reach', format: 'number' },
    { key: 'cpm', label: 'CPM', format: 'currency' },
  ],
  shopify: [
    { key: 'total_revenue', label: 'Revenue', format: 'currency' },
    { key: 'total_orders', label: 'Orders', format: 'number' },
    { key: 'avg_order_value', label: 'AOV', format: 'currency' },
    { key: 'new_customers', label: 'New Customers', format: 'number' },
  ],
  ga4: [
    { key: 'purchase_revenue', label: 'Revenue', format: 'currency' },
    { key: 'transactions', label: 'Transactions', format: 'number' },
    { key: 'sessions', label: 'Sessions', format: 'number' },
    { key: 'active_users', label: 'Active Users', format: 'number' },
    { key: 'session_conversion_rate', label: 'Conv. Rate', format: 'pct' },
  ],
  cross_platform: [
    { key: 'total_spend', label: 'Total Spend', format: 'currency' },
    { key: 'total_revenue', label: 'Total Revenue', format: 'currency' },
    { key: 'total_conversions', label: 'Conversions', format: 'number' },
    { key: 'blended_roas', label: 'Blended ROAS', format: 'decimal' },
  ],
};

function formatValue(value: number | null, format: string): string {
  if (value === null || value === undefined) return '—';
  switch (format) {
    case 'currency': return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'pct': return `${Number(value).toFixed(2)}%`;
    case 'decimal': return Number(value).toFixed(2);
    case 'number': return Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
    default: return String(value);
  }
}

function ChangeBadge({ pct, metricKey }: { pct: number | null; metricKey: string }) {
  if (pct === null || pct === undefined) return <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>;

  const isInverse = INVERSE_METRICS.has(metricKey);
  const isPositive = pct > 0;
  const isGood = isInverse ? !isPositive : isPositive;
  const color = pct === 0 ? 'var(--text-muted)' : isGood ? 'var(--status-success)' : 'var(--status-error)';
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontSize: '0.7rem', fontWeight: 600, color,
      background: pct === 0 ? 'transparent' : isGood ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
      padding: '1px 6px', borderRadius: 'var(--radius-sm)',
    }}>
      <Icon size={10} />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function formatPeriodLabel(periodStart: string, reportType: string): string {
  const d = new Date(periodStart + 'T00:00:00');
  if (reportType === 'monthly') {
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ProgressPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [reportType, setReportType] = useState<string>('monthly');
  const [source, setSource] = useState<string>('google_ads');
  const [rows, setRows] = useState<ReportProgressRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  useEffect(() => {
    api.getClients().then(setClients);
  }, []);

  // Auto-select first client
  useEffect(() => {
    if (clients.length > 0 && !selectedClient) {
      setSelectedClient(clients[0].id);
    }
  }, [clients, selectedClient]);

  // Load progress data when filters change
  useEffect(() => {
    if (!selectedClient) return;
    setLoading(true);
    api.getClientProgress(selectedClient, reportType, source, 24).then((data) => {
      setRows(data);
      setLoading(false);
    });
  }, [selectedClient, reportType, source]);

  const displayMetrics = SOURCE_DISPLAY_METRICS[source] || [];

  // Sort rows by period_start ascending for the table (oldest first)
  const sortedRows = useMemo(() => [...rows].reverse(), [rows]);

  async function handleBackfill() {
    setBackfilling(true);
    await api.backfillMetrics(selectedClient || undefined);
    // Wait a bit then reload
    setTimeout(async () => {
      if (selectedClient) {
        const data = await api.getClientProgress(selectedClient, reportType, source, 24);
        setRows(data);
      }
      setBackfilling(false);
    }, 3000);
  }

  const availableSources = [
    { value: 'google_ads', label: 'Google Ads' },
    { value: 'meta_ads', label: 'Meta Ads' },
    { value: 'shopify', label: 'Shopify' },
    { value: 'ga4', label: 'GA4' },
    { value: 'cross_platform', label: 'Cross-Platform' },
  ];

  return (
    <div style={{ padding: 'var(--space-8) var(--space-10)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="heading-1">
              <span className="text-gradient">Performance Progress</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
              Track KPI trends across months and weeks with increment/decrement indicators
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleBackfill}
              disabled={backfilling}
              title="Extract metrics from all existing reports"
            >
              {backfilling ? <Loader2 size={14} className="animate-spin" /> : <BarChart3 size={14} />}
              Backfill Metrics
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel" style={{
        padding: 'var(--space-4) var(--space-5)',
        marginBottom: 'var(--space-6)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
      }}>
        <Filter size={16} color="var(--text-muted)" />

        <select
          value={selectedClient}
          onChange={(e) => setSelectedClient(e.target.value)}
          style={{
            background: 'var(--surface)', border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-md)', padding: '0.4rem 0.75rem',
            color: 'var(--text-primary)', fontSize: '0.8125rem', fontFamily: 'inherit',
            minWidth: 180,
          }}
        >
          <option value="">Select Client</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          style={{
            background: 'var(--surface)', border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-md)', padding: '0.4rem 0.75rem',
            color: 'var(--text-primary)', fontSize: '0.8125rem', fontFamily: 'inherit',
          }}
        >
          <option value="monthly">Monthly</option>
          <option value="weekly">Weekly</option>
        </select>

        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          style={{
            background: 'var(--surface)', border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-md)', padding: '0.4rem 0.75rem',
            color: 'var(--text-primary)', fontSize: '0.8125rem', fontFamily: 'inherit',
          }}
        >
          {availableSources.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <button className="btn btn-ghost btn-sm" onClick={() => {
          if (selectedClient) {
            setLoading(true);
            api.getClientProgress(selectedClient, reportType, source, 24).then((data) => {
              setRows(data);
              setLoading(false);
            });
          }
        }} style={{ marginLeft: 'auto' }}>
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {sortedRows.length > 0 && (() => {
        const latest = rows[0]; // rows are desc, so first is latest
        const latestMetrics = latest?.metrics || [];
        return (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(displayMetrics.length, 5)}, 1fr)`, gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
            {displayMetrics.slice(0, 5).map(dm => {
              const m = latestMetrics.find(x => x.metric_name === dm.key);
              return (
                <div key={dm.key} className="stat-card">
                  <div className="stat-card-label">{dm.label}</div>
                  <div className="stat-card-value" style={{ fontSize: '1.5rem' }}>
                    {m ? formatValue(m.current_value, dm.format) : '—'}
                  </div>
                  {m && <ChangeBadge pct={m.change_pct} metricKey={dm.key} />}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Progress Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <Loader2 size={32} className="animate-spin" color="var(--accent-blue)" />
        </div>
      ) : sortedRows.length === 0 ? (
        <div className="empty-state">
          <BarChart3 size={48} />
          <div>
            <h3 className="heading-3" style={{ marginBottom: 'var(--space-2)' }}>No progress data</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {!selectedClient
                ? 'Select a client to view their performance progress.'
                : 'Generate reports first, then click "Backfill Metrics" to extract trend data.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="glass-panel" style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: displayMetrics.length * 140 }}>
            <thead>
              <tr style={{ background: 'var(--surface-hover)', borderBottom: '1px solid var(--surface-border)' }}>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.8125rem', fontWeight: 600, position: 'sticky', left: 0, background: 'var(--surface-hover)', zIndex: 1 }}>
                  Period
                </th>
                {displayMetrics.map(dm => (
                  <th key={dm.key} style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.75rem', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {dm.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, idx) => {
                const metricsMap = Object.fromEntries(row.metrics.map(m => [m.metric_name, m]));
                const isLatest = idx === sortedRows.length - 1;
                return (
                  <tr key={row.report_id} style={{
                    borderBottom: '1px solid var(--surface-border)',
                    background: isLatest ? 'rgba(59,130,246,0.04)' : undefined,
                  }}>
                    <td style={{
                      padding: 'var(--space-3) var(--space-4)', fontSize: '0.8125rem', fontWeight: isLatest ? 600 : 400,
                      position: 'sticky', left: 0, background: isLatest ? 'rgba(59,130,246,0.04)' : 'var(--bg-primary)', zIndex: 1,
                      whiteSpace: 'nowrap',
                    }}>
                      <Link href={`/reports/${row.report_id}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>
                        {formatPeriodLabel(row.period_start, row.report_type)}
                      </Link>
                    </td>
                    {displayMetrics.map(dm => {
                      const m = metricsMap[dm.key];
                      return (
                        <td key={dm.key} style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontSize: '0.8125rem' }}>
                          <div>{m ? formatValue(m.current_value, dm.format) : '—'}</div>
                          {m && m.change_pct !== null && (
                            <ChangeBadge pct={m.change_pct} metricKey={dm.key} />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
