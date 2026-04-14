import { JobStatus } from '@/types';
import { Check, Clock, Loader2, X, AlertTriangle } from 'lucide-react';

export default function PullJobStatus({ status }: { status: JobStatus | string }) {
  const configs: Record<string, { bg: string; color: string; label: string; Icon: typeof Check }> = {
    pending: { bg: 'rgba(245,158,11,0.08)', color: '#fbbf24', label: 'Pending', Icon: Clock },
    running: { bg: 'rgba(59,130,246,0.08)', color: '#60a5fa', label: 'Running', Icon: Loader2 },
    success: { bg: 'rgba(16,185,129,0.08)', color: '#34d399', label: 'Success', Icon: Check },
    failed: { bg: 'rgba(239,68,68,0.08)', color: '#f87171', label: 'Failed', Icon: X },
    partial: { bg: 'rgba(245,158,11,0.08)', color: '#fbbf24', label: 'Partial', Icon: AlertTriangle },
  };

  const cfg = configs[status] || configs.pending;
  const Icon = cfg.Icon;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.375rem',
      background: cfg.bg,
      color: cfg.color,
      padding: '0.25rem 0.625rem',
      borderRadius: 'var(--radius-full)',
      fontSize: '0.6875rem',
      fontWeight: 600,
      letterSpacing: '0.04em',
      border: `1px solid ${cfg.bg.replace('0.08', '0.15')}`
    }}>
      <Icon size={11} className={status === 'running' ? 'animate-spin' : ''} />
      {cfg.label}
    </span>
  );
}
