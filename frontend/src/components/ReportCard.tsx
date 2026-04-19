'use client';
import { FileBarChart, Calendar, CheckCircle, AlertCircle, Loader2, Layers } from 'lucide-react';
import Link from 'next/link';
import type { ReportSummary } from '../types';
import React from 'react';

interface ReportCardProps {
  report: ReportSummary;
  clientName?: string;
  style?: React.CSSProperties;
}

export default function ReportCard({ report, clientName, style }: ReportCardProps) {
  const isWeekly = report.report_type === 'weekly';
  
  // Status logic
  let statusColor: string;
  let statusBg: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let StatusIcon: React.FC<any>;

  if (report.status === 'ready') {
    statusColor = 'var(--status-success)';
    statusBg = 'var(--status-success-bg)';
    StatusIcon = CheckCircle;
  } else if (report.status === 'failed') {
    statusColor = 'var(--status-error)';
    statusBg = 'var(--status-error-bg)';
    StatusIcon = AlertCircle;
  } else {
    statusColor = 'var(--status-warning)';
    statusBg = 'var(--status-warning-bg)';
    StatusIcon = Loader2;
  }

  const accentColor = isWeekly ? 'var(--accent-blue)' : 'var(--accent-purple)';

  const formatDate = (d: string) => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Link href={`/reports/${report.id}`} style={{ textDecoration: 'none', color: 'inherit', ...style }}>
      <div className="glass-card" style={{ cursor: 'pointer', padding: 'var(--space-5) var(--space-6)', transition: 'transform 0.2s' }}>
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
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                {isWeekly ? 'Weekly' : 'Monthly'} Report
              </div>
              {clientName && (
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {clientName}
                </div>
              )}
            </div>
          </div>

          {/* Status badge */}
          <div className="badge" style={{ background: statusBg, color: statusColor, padding: '0.3rem 0.75rem', fontSize: '0.875rem' }}>
            <StatusIcon size={12} className={report.status === 'generating' ? 'animate-spin' : ''} />
            {report.status}
          </div>
        </div>

        {/* Period */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          marginBottom: 'var(--space-3)',
          fontSize: '0.9375rem', color: 'var(--text-muted)'
        }}>
          <Calendar size={14} />
          <span style={{ fontWeight: 600 }}>{formatDate(report.period_start)}</span> — <span style={{ fontWeight: 600 }}>{formatDate(report.period_end)}</span>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          paddingTop: 'var(--space-3)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          fontSize: '0.8125rem', color: 'var(--text-muted)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Layers size={12} />
            {report.section_count} sections
          </div>
          {report.generated_at && (
            <span style={{ color: 'var(--text-secondary)' }}>Generated {formatDate(report.generated_at)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
