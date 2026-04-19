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

      <select
        value={value.performance}
        onChange={e => onChange({ ...value, performance: e.target.value as FilterState['performance'] })}
        className="form-input"
        style={{ minWidth: '180px' }}
      >
        <option value="all">All performance</option>
        <option value="has_red">Has red metrics</option>
      </select>

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
