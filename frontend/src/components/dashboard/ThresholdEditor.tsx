'use client';
import { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { ThresholdConfig } from '@/types';
import { api } from '@/lib/api';

interface ThresholdEditorProps {
  open: boolean;
  onClose: () => void;
  onSaved?: (thresholds: ThresholdConfig[]) => void;
}

const METRIC_LABELS: Record<string, string> = {
  roas: 'ROAS',
  cpc: 'CPC',
  rc_ratio: 'R/C Ratio',
  orders: 'Orders',
  revenue: 'Revenue',
  impressions: 'Impressions',
  clicks: 'Clicks',
  cost: 'Cost',
};

export default function ThresholdEditor({ open, onClose, onSaved }: ThresholdEditorProps) {
  const [thresholds, setThresholds] = useState<ThresholdConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.getDashboardThresholds().then(ts => {
      setThresholds(ts);
      setLoading(false);
    });
  }, [open]);

  if (!open) return null;

  const update = (metric: string, field: 'red_below' | 'green_above', raw: string) => {
    const n = raw.trim() === '' ? null : Number(raw);
    setThresholds(prev => prev.map(t =>
      t.metric_name === metric ? { ...t, [field]: isNaN(n as number) ? null : n } : t,
    ));
  };

  const save = async () => {
    setSaving(true);
    const saved = await api.saveDashboardThresholds(thresholds);
    setSaving(false);
    if (saved.length) {
      onSaved?.(saved);
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div className="glass-panel" style={{
        width: '560px', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        padding: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--space-5)', borderBottom: '1px solid var(--surface-border)',
        }}>
          <h2 className="heading-3" style={{ margin: 0 }}>Dashboard Thresholds</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm"><X size={16} /></button>
        </div>

        <div style={{ padding: 'var(--space-5)', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : (
            <table style={{ width: '100%', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <th style={{ textAlign: 'left', padding: 'var(--space-2)' }}>Metric</th>
                  <th style={{ textAlign: 'left', padding: 'var(--space-2)' }}>🔴 Red below</th>
                  <th style={{ textAlign: 'left', padding: 'var(--space-2)' }}>🟢 Green above</th>
                </tr>
              </thead>
              <tbody>
                {thresholds.map(t => (
                  <tr key={t.metric_name} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    <td style={{ padding: 'var(--space-2)', fontWeight: 500 }}>
                      {METRIC_LABELS[t.metric_name] ?? t.metric_name}
                    </td>
                    <td style={{ padding: 'var(--space-2)' }}>
                      <input
                        type="number"
                        step="any"
                        value={t.red_below === null ? '' : t.red_below}
                        onChange={e => update(t.metric_name, 'red_below', e.target.value)}
                        placeholder="—"
                        className="form-input"
                        style={{ width: '100px' }}
                      />
                    </td>
                    <td style={{ padding: 'var(--space-2)' }}>
                      <input
                        type="number"
                        step="any"
                        value={t.green_above === null ? '' : t.green_above}
                        onChange={e => update(t.metric_name, 'green_above', e.target.value)}
                        placeholder="—"
                        className="form-input"
                        style={{ width: '100px' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)',
          padding: 'var(--space-5)', borderTop: '1px solid var(--surface-border)',
        }}>
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving || loading} className="btn btn-primary">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Save size={14} /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}
