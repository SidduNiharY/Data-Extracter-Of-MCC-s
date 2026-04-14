import { DataSource } from '@/types';

export default function DataSourceBadge({ source }: { source: DataSource | string }) {
  const badgeColors: Record<string, { bg: string, color: string, label: string, border: string }> = {
    google_ads: { bg: 'rgba(59, 130, 246, 0.08)', color: '#60a5fa', label: 'Google Ads', border: 'rgba(59,130,246,0.12)' },
    meta_ads: { bg: 'rgba(139, 92, 246, 0.08)', color: '#a78bfa', label: 'Meta Ads', border: 'rgba(139,92,246,0.12)' },
    shopify: { bg: 'rgba(16, 185, 129, 0.08)', color: '#34d399', label: 'Shopify', border: 'rgba(16,185,129,0.12)' },
    ga4: { bg: 'rgba(245, 158, 11, 0.08)', color: '#fbbf24', label: 'GA4', border: 'rgba(245,158,11,0.12)' }
  };

  const config = badgeColors[source] || { bg: 'var(--surface)', color: 'var(--text-muted)', label: source, border: 'var(--surface-border)' };

  return (
    <span style={{
      background: config.bg,
      color: config.color,
      padding: '0.1875rem 0.5rem',
      borderRadius: 'var(--radius-full)',
      fontSize: '0.6875rem',
      fontWeight: 600,
      letterSpacing: '0.04em',
      border: `1px solid ${config.border}`,
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.25rem'
    }}>
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: config.color, flexShrink: 0 }} />
      {config.label}
    </span>
  );
}
