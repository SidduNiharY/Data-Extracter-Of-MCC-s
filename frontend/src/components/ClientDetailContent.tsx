'use client';

import { useState } from 'react';
import { History, Loader2 } from 'lucide-react';
import MetricsTable from './MetricsTable';
import PullJobStatus from './PullJobStatus';
import ManualDataEntry from './ManualDataEntry';
import { api } from '@/lib/api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ClientDetailContent({ client, metrics, jobs, onRefresh }: any) {
  const [activeTab, setActiveTab] = useState('performance');
  const [backfilling, setBackfilling] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState<string | null>(null);

  async function handleBackfill() {
    setBackfilling(true);
    setBackfillStatus(null);
    await api.backfillReports(client.id, 24, 6);
    setBackfillStatus('Generating last 12 months + 6 weeks of reports in the background…');
    setBackfilling(false);
  }

  return (
    <>
      {/* Tab Switcher */}
      <div style={{ 
        display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-6)',
        background: 'var(--surface)', padding: 'var(--space-1)', borderRadius: 'var(--radius-md)',
        width: 'fit-content'
      }}>
        <button 
          onClick={() => setActiveTab('performance')}
          className={`btn btn-sm ${activeTab === 'performance' ? 'btn-primary' : 'btn-ghost'}`}
        >
          Performance View
        </button>
        <button 
          onClick={() => setActiveTab('manual')}
          className={`btn btn-sm ${activeTab === 'manual' ? 'btn-primary' : 'btn-ghost'}`}
        >
          Manual Data Entry
        </button>
      </div>

      {activeTab === 'performance' ? (
        <>
          <section style={{ marginBottom: 'var(--space-12)' }}>
            <h2 className="heading-2" style={{ marginBottom: 'var(--space-6)' }}>Platform Performance</h2>
            {metrics.google && <MetricsTable title="Google Ads" data={metrics.google} currency={client.currency} />}
            {metrics.meta && <MetricsTable title="Meta Ads" data={metrics.meta} currency={client.currency} />}
            {metrics.shopify && <MetricsTable title="Shopify Direct" data={metrics.shopify} currency={client.currency} />}
            {metrics.ga4 && <MetricsTable title="Analytics (GA4)" data={metrics.ga4} currency={client.currency} />}
            
            {Object.keys(metrics).length === 0 && (
              <div className="glass-panel flex-center" style={{ padding: 'var(--space-12)', color: 'var(--text-muted)' }}>
                No metrics available for the selected period. Let the background jobs finish.
              </div>
            )}
          </section>

          <section style={{ marginBottom: 'var(--space-8)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
              <h2 className="heading-2" style={{ marginBottom: 0 }}>Reports</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                {backfillStatus && (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--status-success)' }}>{backfillStatus}</span>
                )}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleBackfill}
                  disabled={backfilling}
                  title="Generate last 12 months of monthly + last 6 weeks of weekly reports"
                >
                  {backfilling ? <Loader2 size={13} className="animate-spin" /> : <History size={13} />}
                  Generate History
                </button>
              </div>
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
              Generates last 12 monthly + 6 weekly reports. Skips periods that already have a report.
            </div>
          </section>

          <section>
            <h2 className="heading-2" style={{ marginBottom: 'var(--space-6)' }}>Recent Data Pulls</h2>
            <div className="glass-panel" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-hover)', borderBottom: '1px solid var(--surface-border)' }}>
                    <th style={{ padding: 'var(--space-4)' }}>Source</th>
                    <th style={{ padding: 'var(--space-4)' }}>Date Range</th>
                    <th style={{ padding: 'var(--space-4)' }}>Rows</th>
                    <th style={{ padding: 'var(--space-4)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {jobs.map((job: any) => (
                    <tr key={job.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                      <td style={{ padding: 'var(--space-4)', textTransform: 'uppercase', fontSize: '0.875rem' }}>{job.source.replace('_', ' ')}</td>
                      <td style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{job.date_range_start} to {job.date_range_end}</td>
                      <td style={{ padding: 'var(--space-4)' }}>{job.rows_pulled ?? '-'}</td>
                      <td style={{ padding: 'var(--space-4)' }}><PullJobStatus status={job.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <section>
          <h2 className="heading-2" style={{ marginBottom: 'var(--space-6)' }}>Manual Data Ingestion</h2>
          <ManualDataEntry clientId={client.id} clientType={client.type} onSuccess={onRefresh} />
        </section>
      )}
    </>
  );
}
