import { api } from '@/lib/api';
import ClientCard from '@/components/ClientCard';
import PullJobStatus from '@/components/PullJobStatus';
import Link from 'next/link';
import { ArrowRight, TrendingUp, Layers, AlertTriangle } from 'lucide-react';

export default async function DashboardPage() {
  const clients = await api.getClients();
  const jobs = await api.getRecentJobs();
  
  const activeClients = clients.filter(c => c.is_active);

  const getIntegrationCount = (type: string) => {
    switch (type) {
      case 'google_only':
      case 'meta_only': return 1;
      case 'google_meta':
      case 'leadgen': return 2;
      case 'ecomm_ga4':
      case 'ecomm_shopify': return 3;
      default: return 0;
    }
  };
  const totalIntegrations = activeClients.reduce((acc, c) => acc + getIntegrationCount(c.type), 0);
  const failedJobs = jobs.filter(j => j.status === 'failed').length;

  return (
    <div className="fade-in">
      <header style={{ marginBottom: 'var(--space-8)' }}>
        <h1 className="heading-1 text-gradient">Executive Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>Overview of all ad accounts and platform integrations.</p>
      </header>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-10)' }}>
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-card-label">Active Clients</div>
              <div className="stat-card-value">{activeClients.length}</div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-lg)', background: 'var(--status-info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={18} color="var(--accent-blue)" />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-card-label">Integrations</div>
              <div className="stat-card-value">{totalIntegrations}</div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-lg)', background: 'rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={18} color="var(--accent-purple)" />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-card-label">Failed Pulls</div>
              <div className="stat-card-value" style={{ color: failedJobs > 0 ? 'var(--status-error)' : 'var(--status-success)' }}>{failedJobs}</div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-lg)', background: failedJobs > 0 ? 'var(--status-error-bg)' : 'var(--status-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={18} color={failedJobs > 0 ? 'var(--status-error)' : 'var(--status-success)'} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-8)' }}>
        {/* Client Grid */}
        <section>
          <div className="flex-between" style={{ marginBottom: 'var(--space-5)' }}>
            <h2 className="heading-2">Recent Clients</h2>
            <Link href="/clients" className="btn btn-ghost btn-sm">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
            {activeClients.slice(0, 4).map((client, i) => (
              <div key={client.id} className="fade-in" style={{ animationDelay: `${i * 0.06}s`, animationFillMode: 'backwards' }}>
                <ClientCard client={client} />
              </div>
            ))}
          </div>
        </section>

        {/* Recent Jobs */}
        <section>
          <div className="flex-between" style={{ marginBottom: 'var(--space-5)' }}>
            <h2 className="heading-2">Job Activity</h2>
            <Link href="/pulls" className="btn btn-ghost btn-sm">
              Logs <ArrowRight size={14} />
            </Link>
          </div>
          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            {jobs.length === 0 ? (
              <div className="empty-state" style={{ minHeight: '200px' }}>
                <p style={{ fontSize: '0.875rem' }}>No recent pull jobs</p>
              </div>
            ) : (
              jobs.slice(0, 6).map((job, idx) => {
                const c = clients.find(cl => cl.id === job.client_id);
                return (
                  <div key={job.id} style={{ 
                    padding: 'var(--space-4) var(--space-5)', 
                    borderBottom: idx < Math.min(jobs.length, 6) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'background 0.15s ease',
                  }}>
                    <div>
                      <div style={{ fontWeight: 500, marginBottom: '2px', fontSize: '0.875rem' }}>{c?.name || 'Unknown'}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
                        {job.source.replace('_', ' ')}
                      </div>
                    </div>
                    <PullJobStatus status={job.status} />
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
