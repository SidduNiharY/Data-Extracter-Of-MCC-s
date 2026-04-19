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
