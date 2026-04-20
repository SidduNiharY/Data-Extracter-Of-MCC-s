'use client';
import { Search, SlidersHorizontal } from 'lucide-react';
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

const pill: React.CSSProperties = {
  appearance: 'none',
  background: 'transparent',
  border: '1px solid transparent',
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-mono), ui-monospace, monospace',
  fontSize: '0.75rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  padding: '0.5rem 0.85rem',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  outline: 'none',
};

export default function DashboardFilters({ value, onChange, onOpenThresholdEditor }: DashboardFiltersProps) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center',
      padding: '0.55rem', marginBottom: '1.25rem',
      background: 'var(--bg-secondary)',
      border: '1px solid var(--surface-border)',
      borderRadius: 'var(--radius-lg)',
    }}>
      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.55rem',
        padding: '0.45rem 0.9rem', flex: 1, minWidth: 240,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--surface-border)',
        borderRadius: 'var(--radius-md)',
      }}>
        <Search size={13} color="var(--text-muted)" />
        <input
          type="text"
          placeholder="Search accounts…"
          value={value.search}
          onChange={e => onChange({ ...value, search: e.target.value })}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontSize: '0.875rem',
            fontFamily: 'var(--font-mono), ui-monospace, monospace',
          }}
        />
      </div>

      <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--surface-border)', margin: '0 0.25rem' }} />

      {/* Source */}
      <select
        value={value.source}
        onChange={e => onChange({ ...value, source: e.target.value as FilterState['source'] })}
        style={{
          ...pill,
          border: '1px solid var(--surface-border)',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <option value="all">All sources</option>
        <option value="google_ads">Google Ads</option>
        <option value="meta_ads">Meta Ads</option>
        <option value="shopify">Shopify</option>
        <option value="ga4">GA4</option>
      </select>

      <select
        value={value.performance}
        onChange={e => onChange({ ...value, performance: e.target.value as FilterState['performance'] })}
        style={{
          ...pill,
          border: '1px solid var(--surface-border)',
          background: value.performance === 'has_red' ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.02)',
          color: value.performance === 'has_red' ? '#f87171' : 'var(--text-secondary)',
        }}
      >
        <option value="all">All performance</option>
        <option value="has_red">Red-flagged only</option>
      </select>

      <select
        value={value.priorityMax === null ? 'all' : String(value.priorityMax)}
        onChange={e => onChange({
          ...value,
          priorityMax: e.target.value === 'all' ? null : Number(e.target.value),
        })}
        style={{
          ...pill,
          border: '1px solid var(--surface-border)',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <option value="all">All priorities</option>
        <option value="3">Top 3</option>
        <option value="5">Top 5</option>
        <option value="10">Top 10</option>
      </select>

      <div style={{ flex: 1 }} />

      <button
        onClick={onOpenThresholdEditor}
        style={{
          ...pill,
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          background: 'var(--accent-amber-soft)',
          border: '1px solid var(--accent-amber-line)',
          color: 'var(--accent-amber)',
          fontWeight: 500,
        }}
      >
        <SlidersHorizontal size={13} />
        Thresholds
      </button>
    </div>
  );
}
