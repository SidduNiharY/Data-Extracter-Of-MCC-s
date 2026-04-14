'use client';
import { FileBarChart, Calendar, CheckCircle, AlertCircle, Loader2, Layers } from 'lucide-react';
import Link from 'next/link';
import type { ReportSummary } from '../types';

interface ReportCardProps {
  report: ReportSummary;
  clientName?: string;
  style?: React.CSSProperties;
}

export default function ReportCard({ report, clientName, style }: ReportCardProps) {
  const isWeekly = report.report_type === 'weekly';
  const statusColor = report.status === 'ready'
    ? 'var(--status-success)'
    : report.status === 'failed'
    ? 'var(--status-error)'
    : 'var(--status-warning)';
  const statusBg = report.status === 'ready'
    ? 'var(--status-success-bg)'
    : report.status === 'failed'
    ? 'var(--status-error-bg)'
    : 'var(--status-warning-bg)';
  const StatusIcon = report.status === 'ready' ? CheckCircle : report.status === 'failed' ? AlertCircle : Loader2;

  const accentColor = isWeekly ? 'var(--accent-blue)' : 'var(--accent-purple)';

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Link href={`/reports/${report.id}`} style={{ textDecoration: 'none', color: 'inherit', ...style }}>
      <div className="glass-card" style={{ cursor: 'pointer', padding: 'var(--space-5) var(--space-6)' }}>
        {/* Top accent */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, ${accentColor}, transparent)`,
          borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
        }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius-md)',
              background: isWeekly ? 'rgba(59,130,246,0.1)' : 'rgba(139,92,246,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileBarChart size={18} color={accentColor} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                {isWeekly ? 'Weekly' : 'Monthly'} Report
              </div>
              {clientName && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  {clientName}
                </div>
              )}
            </div>
          </div>

          {/* Status badge */}
          <div className="badge" style={{ background: statusBg, color: statusColor }}>
            <StatusIcon size={11} className={report.status === 'generating' ? 'animate-spin' : ''} />
            {report.status}
          </div>
        </div>

        {/* Period */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          marginBottom: 'var(--space-3)',
          fontSize: '0.8125rem', color: 'var(--text-muted)'
        }}>
          <Calendar size={13} />
          {formatDate(report.period_start)} — {formatDate(report.period_end)}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          paddingTop: 'var(--space-3)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          fontSize: '0.75rem', color: 'var(--text-muted)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Layers size={12} />
            {report.section_count} sections
          </div>
          {report.generated_at && (
            <span>Generated {formatDate(report.generated_at)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
