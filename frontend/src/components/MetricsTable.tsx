import { MetricSummary } from '@/types';

export default function MetricsTable({ title, data, currency = 'USD' }: { title: string, data?: Partial<MetricSummary> & { orders?: number, sessions?: number }, currency?: string }) {
  if (!data) return null;
  
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(val);
  const formatNum = (val: number) => new Intl.NumberFormat('en-US').format(val);

  return (
    <div className="glass-panel" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--surface-border)', paddingBottom: 'var(--space-2)' }}>
        {title}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-4)' }}>
        
        {data.spend !== undefined && (
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>Spend</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(data.spend)}</div>
          </div>
        )}
        
        {data.revenue !== undefined && data.revenue > 0 && (
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>Revenue</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--status-success)' }}>{formatCurrency(data.revenue)}</div>
          </div>
        )}

        {data.conversions !== undefined && (
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>Conversions</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatNum(data.conversions)}</div>
          </div>
        )}

        {data.clicks !== undefined && (
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>Clicks</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatNum(data.clicks)}</div>
          </div>
        )}

        {data.impressions !== undefined && (
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>Impressions</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatNum(data.impressions)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
