'use client';

import { useState } from 'react';
import MetricsTable from './MetricsTable';
import PullJobStatus from './PullJobStatus';
import ManualDataEntry from './ManualDataEntry';

export default function ClientDetailContent({ client, metrics, jobs, onRefresh }: any) {
  const [activeTab, setActiveTab] = useState('performance');

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
          <ManualDataEntry clientId={client.id} onSuccess={onRefresh} />
        </section>
      )}
    </>
  );
}
