import { MetricSummary } from '@/types';

interface MetricsTableProps {
  title: string;
  data?: Partial<MetricSummary>;
  currency?: string;
}

export default function MetricsTable({ title, data, currency = 'USD' }: MetricsTableProps) {
  if (!data) return null;

  const fmtCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v);
  const fmtNum = (v: number) => new Intl.NumberFormat('en-US').format(v);
  const fmtPct = (v: number) => `${v.toFixed(2)}%`;
  const fmtX   = (v: number) => `${v.toFixed(2)}x`;

  // Each tile: { label, value, formatted }
  type Tile = { label: string; value: string; highlight?: string };
  const tiles: Tile[] = [];

  const push = (label: string, raw: number | undefined, fmt: (n: number) => string, highlight?: string) => {
    if (raw !== undefined && raw !== null) tiles.push({ label, value: fmt(raw), highlight });
  };

  // ── Spend / Revenue ─────────────────────────────
  push('Spend',         data.spend,            fmtCurrency);
  push('Revenue',       data.revenue ?? data.purchase_revenue, fmtCurrency, 'var(--status-success)');

  // ── Volume ──────────────────────────────────────
  push('Impressions',   data.impressions,       fmtNum);
  push('Clicks',        data.clicks,            fmtNum);
  push('Reach',         data.reach,             fmtNum);
  push('Sessions',      data.sessions,          fmtNum);
  push('Active Users',  data.active_users,      fmtNum);

  // ── Conversions ─────────────────────────────────
  push('Conversions',   data.conversions,       fmtNum);
  push('Transactions',  data.transactions,      fmtNum);
  push('Orders',        data.orders,            fmtNum);

  // ── Rates ───────────────────────────────────────
  push('CTR',           data.ctr,               fmtPct);
  push('Conv. Rate',    data.conversion_rate,   fmtPct);
  push('Session Conv.', data.session_conversion_rate, fmtPct);
  push('Frequency',     data.frequency,         (v) => v.toFixed(2));

  // ── Cost Metrics ────────────────────────────────
  push('CPC',           data.cpc,               fmtCurrency);
  push('CPM',           data.cpm,               fmtCurrency);
  push('Cost / Conv.',  data.cost_per_conv,     fmtCurrency);
  push('Cost / Result', data.cost_per_result,   fmtCurrency);

  // ── Return / Value ──────────────────────────────
  push('ROAS',          data.roas,              fmtX, 'var(--accent-primary)');
  push('Avg Order Val.',data.avg_order_value,   fmtCurrency);
  push('Avg Purchase',  data.purchase_revenue && data.transactions
    ? data.purchase_revenue / data.transactions : undefined, fmtCurrency);

  if (tiles.length === 0) return null;

  return (
    <div className="glass-panel" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
      <h3 style={{
        fontSize: '1.0625rem', fontWeight: 600, marginBottom: 'var(--space-5)',
        paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--surface-border)',
      }}>
        {title}
      </h3>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 'var(--space-4)',
      }}>
        {tiles.map(({ label, value, highlight }) => (
          <div key={label}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 500 }}>
              {label}
            </div>
            <div style={{
              fontSize: '1.25rem', fontWeight: 700,
              color: highlight ?? 'var(--text-primary)',
            }}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
