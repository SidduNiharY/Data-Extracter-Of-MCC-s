'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Calendar, TrendingUp, Loader2, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

interface Props {
  clientId: string;
}

export default function ClientActionsBar({ clientId }: Props) {
  const router = useRouter();
  const [pulling, setPulling] = useState(false);
  const [generating, setGenerating] = useState<'weekly' | 'monthly' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  const handlePull = async () => {
    setPulling(true);
    await api.triggerPull(clientId);
    showToast('Data pull queued — the table below will update once jobs complete.');
    setPulling(false);
    // Refresh server component data after a short delay
    setTimeout(() => router.refresh(), 5000);
  };

  const handleGenerate = async (type: 'weekly' | 'monthly') => {
    setGenerating(type);
    await api.generateReport({ client_id: clientId, report_type: type });
    showToast(`${type === 'weekly' ? 'Weekly' : 'Monthly'} report generation queued — check the Reports page.`);
    setGenerating(null);
  };

  const busy = pulling || generating !== null;

  return (
    <div className="glass-panel" style={{
      padding: 'var(--space-4) var(--space-6)',
      marginBottom: 'var(--space-6)',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: 'var(--space-1)' }}>
        Quick Actions
      </span>

      <button
        className="btn btn-secondary btn-sm"
        onClick={handlePull}
        disabled={busy}
      >
        {pulling
          ? <Loader2 size={14} className="animate-spin" />
          : <RefreshCw size={14} />
        }
        Fetch Latest Data
      </button>

      <button
        className="btn btn-secondary btn-sm"
        onClick={() => handleGenerate('weekly')}
        disabled={busy}
      >
        {generating === 'weekly'
          ? <Loader2 size={14} className="animate-spin" />
          : <Calendar size={14} />
        }
        Generate Weekly Report
      </button>

      <button
        className="btn btn-primary btn-sm"
        onClick={() => handleGenerate('monthly')}
        disabled={busy}
      >
        {generating === 'monthly'
          ? <Loader2 size={14} className="animate-spin" />
          : <TrendingUp size={14} />
        }
        Generate Monthly Report
      </button>

      {toast && (
        <div style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          fontSize: '0.8125rem',
          color: 'var(--status-success)',
        }}>
          <CheckCircle2 size={14} />
          {toast}
        </div>
      )}
    </div>
  );
}
