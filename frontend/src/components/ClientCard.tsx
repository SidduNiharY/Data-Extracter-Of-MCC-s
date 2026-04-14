import Link from 'next/link';
import { Client } from '@/types';
import DataSourceBadge from './DataSourceBadge';
import { ArrowUpRight, CircleDot } from 'lucide-react';

export default function ClientCard({ client }: { client: Client }) {
  
  const getSources = (type: string) => {
    switch (type) {
      case 'google_only': return ['google_ads'];
      case 'meta_only': return ['meta_ads'];
      case 'google_meta': return ['google_ads', 'meta_ads'];
      case 'ecomm_shopify': return ['google_ads', 'meta_ads', 'shopify'];
      case 'ecomm_ga4': return ['google_ads', 'meta_ads', 'ga4'];
      case 'leadgen': return ['google_ads', 'meta_ads'];
      default: return [];
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'google_only': return 'Search';
      case 'meta_only': return 'Social';
      case 'google_meta': return 'Multi-Platform';
      case 'ecomm_shopify': return 'E-Commerce';
      case 'ecomm_ga4': return 'Analytics';
      case 'leadgen': return 'Lead Gen';
      default: return type;
    }
  };

  const getAccentColor = (type: string) => {
    switch (type) {
      case 'google_only': return '#3b82f6';
      case 'meta_only': return '#8b5cf6';
      case 'google_meta': return '#06b6d4';
      case 'ecomm_shopify': return '#10b981';
      case 'ecomm_ga4': return '#f59e0b';
      case 'leadgen': return '#ec4899';
      default: return '#64748b';
    }
  };

  const sources = getSources(client.type);
  const accent = getAccentColor(client.type);

  return (
    <Link href={`/clients/${client.id}`}>
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', cursor: 'pointer' }}>
        {/* Top accent line */}
        <div style={{ 
          position: 'absolute', top: 0, left: '1.5rem', right: '1.5rem', height: '2px',
          background: `linear-gradient(90deg, transparent 0%, ${accent} 50%, transparent 100%)`,
          opacity: 0.5
        }} />
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-5)' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ 
              fontSize: '1.125rem', fontWeight: 600, letterSpacing: '-0.02em', 
              marginBottom: '0.375rem', color: 'var(--text-primary)'
            }}>
              {client.name}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ 
                fontSize: '0.75rem', fontWeight: 500, color: accent,
                background: `${accent}15`, padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-full)',
                border: `1px solid ${accent}25`
              }}>
                {getTypeLabel(client.type)}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <CircleDot size={10} color={client.is_active ? 'var(--status-success)' : 'var(--text-muted)'} />
                <span style={{ fontSize: '0.6875rem', color: client.is_active ? 'var(--status-success)' : 'var(--text-muted)', fontWeight: 500 }}>
                  {client.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
          <div style={{
            width: 36, height: 36, borderRadius: 'var(--radius-lg)',
            background: 'var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s ease', flexShrink: 0
          }}>
            <ArrowUpRight size={16} color="var(--text-muted)" />
          </div>
        </div>

        {/* Platforms */}
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
          {sources.map(s => <DataSourceBadge key={s} source={s} />)}
        </div>

        {/* Targets */}
        {client.report_settings?.kpi_targets && (
          <div style={{ 
            display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-5)',
            background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: 'var(--radius-md)'
          }}>
            <div>
              <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target ROAS</p>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{client.report_settings.kpi_targets.roas}x</p>
            </div>
            <div style={{ paddingLeft: 'var(--space-4)', borderLeft: '1px solid var(--surface-border)' }}>
              <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target CPA</p>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--status-success)' }}>{client.currency}{client.report_settings.kpi_targets.cpa}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ 
          marginTop: 'auto', paddingTop: 'var(--space-4)', 
          borderTop: '1px solid rgba(255,255,255,0.04)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {client.google_ads_customer_id && `ID: ${client.google_ads_customer_id}`}
            {!client.google_ads_customer_id && `${client.currency} · ${client.timezone}`}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {new Date(client.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>
    </Link>
  );
}
