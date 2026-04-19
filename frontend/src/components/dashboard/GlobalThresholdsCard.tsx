'use client';
import { useState } from 'react';
import { Sliders } from 'lucide-react';
import ThresholdEditor from './ThresholdEditor';

export default function GlobalThresholdsCard() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="glass-panel" style={{ padding: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <Sliders size={18} color="var(--accent-primary)" />
          <h3 className="heading-3" style={{ marginBottom: 0 }}>Dashboard Thresholds</h3>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 'var(--space-4)' }}>
          Set global red/green color thresholds for each metric on the Performance Dashboard.
          Per-client overrides can be set on each client's detail page.
        </p>
        <button onClick={() => setOpen(true)} className="btn btn-primary btn-sm">
          Edit Thresholds
        </button>
      </div>

      <ThresholdEditor open={open} onClose={() => setOpen(false)} />
    </>
  );
}
