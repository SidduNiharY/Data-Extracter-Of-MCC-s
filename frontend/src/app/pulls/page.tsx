import { api } from '@/lib/api';
import PullJobStatus from '@/components/PullJobStatus';
import { AlertCircle } from 'lucide-react';

export default async function PullsPage() {
  const [jobs, clients] = await Promise.all([
    api.getRecentJobs(),
    api.getClients(),
  ]);

  const clientMap = Object.fromEntries(clients.map(c => [c.id, c.name]));

  const total   = jobs.length;
  const success = jobs.filter(j => j.status === 'success').length;
  const failed  = jobs.filter(j => j.status === 'failed').length;
  const running = jobs.filter(j => j.status === 'running').length;

  return (
    <div className="fade-in">
      <header style={{ marginBottom: 'var(--space-8)' }}>
        <h1 className="heading-1">Pull Job Activity</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
          Global log of all background data extraction processes.
        </p>
      </header>

      {/* Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 'var(--space-4)', marginBottom: 'var(--space-8)',
      }}>
        {[
          { label: 'Total Jobs',   value: total,   color: 'var(--text-primary)' },
          { label: 'Successful',   value: success, color: 'var(--status-success)' },
          { label: 'Failed',       value: failed,  color: 'var(--status-error)' },
          { label: 'In Progress',  value: running, color: 'var(--status-warning)' },
        ].map(s => (
          <div key={s.label} className="glass-panel" style={{ padding: 'var(--space-5)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: 'var(--surface-hover)', borderBottom: '1px solid var(--surface-border)' }}>
              <th style={{ padding: 'var(--space-4)' }}>Client</th>
              <th style={{ padding: 'var(--space-4)' }}>Source</th>
              <th style={{ padding: 'var(--space-4)' }}>Date Range</th>
              <th style={{ padding: 'var(--space-4)' }}>Rows</th>
              <th style={{ padding: 'var(--space-4)' }}>Status</th>
              <th style={{ padding: 'var(--space-4)' }}>Error / Note</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No pull jobs recorded yet.
                </td>
              </tr>
            )}
            {jobs.map(job => (
              <tr key={job.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                <td style={{ padding: 'var(--space-4)', fontWeight: 500 }}>
                  {clientMap[job.client_id] ?? <span style={{ color: 'var(--text-muted)' }}>Unknown</span>}
                </td>
                <td style={{ padding: 'var(--space-4)', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.03em' }}>
                  {job.source.replace(/_/g, ' ')}
                </td>
                <td style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)' }}>
                  {job.date_range_start} → {job.date_range_end}
                </td>
                <td style={{ padding: 'var(--space-4)', fontWeight: 600 }}>
                  {job.rows_pulled ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </td>
                <td style={{ padding: 'var(--space-4)' }}>
                  <PullJobStatus status={job.status} />
                </td>
                <td style={{ padding: 'var(--space-4)', maxWidth: 280 }}>
                  {job.error_message ? (
                    <span style={{
                      display: 'flex', alignItems: 'flex-start', gap: 6,
                      color: job.status === 'failed' ? 'var(--status-error)' : 'var(--text-muted)',
                      fontSize: '0.8125rem',
                    }}>
                      {job.status === 'failed' && <AlertCircle size={13} style={{ marginTop: 2, flexShrink: 0 }} />}
                      <span style={{ wordBreak: 'break-word' }}>{job.error_message}</span>
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
