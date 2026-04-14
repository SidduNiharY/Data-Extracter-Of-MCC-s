import { api } from '@/lib/api';
import PullJobStatus from '@/components/PullJobStatus';

export default async function PullsPage() {
  const jobs = await api.getRecentJobs();
  const clients = await api.getClients();

  return (
    <div className="fade-in">
      <header style={{ marginBottom: 'var(--space-8)' }}>
        <h1 className="heading-1">Pull Job Activity</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem' }}>Global log of all background data extraction processes.</p>
      </header>

      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--surface-hover)', borderBottom: '1px solid var(--surface-border)' }}>
              <th style={{ padding: 'var(--space-4)' }}>Job ID</th>
              <th style={{ padding: 'var(--space-4)' }}>Client</th>
              <th style={{ padding: 'var(--space-4)' }}>Source</th>
              <th style={{ padding: 'var(--space-4)' }}>Date Range</th>
              <th style={{ padding: 'var(--space-4)' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(job => {
              const client = clients.find(c => c.id === job.client_id);
              return (
                <tr key={job.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <td style={{ padding: 'var(--space-4)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{job.id}</td>
                  <td style={{ padding: 'var(--space-4)' }}>{client?.name || 'Unknown'}</td>
                  <td style={{ padding: 'var(--space-4)', textTransform: 'uppercase', fontSize: '0.875rem' }}>{job.source.replace('_', ' ')}</td>
                  <td style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{job.date_range_start} to {job.date_range_end}</td>
                  <td style={{ padding: 'var(--space-4)' }}><PullJobStatus status={job.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
