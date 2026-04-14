'use client';
import { useEffect, useState } from 'react';
import { FileBarChart, Filter, Plus, Calendar, RefreshCw, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import ReportCard from '../../components/ReportCard';
import type { ReportSummary, Client } from '../../types';

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState<string>('');
  const [filterClient, setFilterClient] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [filterType, filterClient, filterStatus]);

  async function loadData() {
    setLoading(true);
    const params: Record<string, string> = {};
    if (filterType) params.report_type = filterType;
    if (filterClient) params.client_id = filterClient;
    if (filterStatus) params.status = filterStatus;

    const [reportsData, clientsData] = await Promise.all([
      api.getReports(params),
      api.getClients(),
    ]);
    setReports(reportsData);
    setClients(clientsData);
    setLoading(false);
  }

  const clientMap = Object.fromEntries(clients.map(c => [c.id, c.name]));

  async function handleGenerateAll(type: 'weekly' | 'monthly') {
    setGenerating(true);
    await api.generateAllReports(type);
    setTimeout(() => {
      loadData();
      setGenerating(false);
    }, 2000);
  }

  const readyCount = reports.filter(r => r.status === 'ready').length;
  const weeklyCount = reports.filter(r => r.report_type === 'weekly').length;
  const monthlyCount = reports.filter(r => r.report_type === 'monthly').length;

  return (
    <div style={{ padding: 'var(--space-8) var(--space-10)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="heading-1">
              <span className="text-gradient">Reports</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
              Automated weekly and monthly performance reports across all platforms
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => handleGenerateAll('weekly')} disabled={generating}>
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Generate Weekly
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => handleGenerateAll('monthly')} disabled={generating}>
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
              Generate Monthly
            </button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <div className="stat-card">
          <div className="stat-card-label">Total Reports</div>
          <div className="stat-card-value" style={{ fontSize: '1.75rem' }}>{reports.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Ready</div>
          <div className="stat-card-value" style={{ fontSize: '1.75rem', color: 'var(--status-success)' }}>{readyCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Weekly</div>
          <div className="stat-card-value" style={{ fontSize: '1.75rem', color: 'var(--accent-blue)' }}>{weeklyCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Monthly</div>
          <div className="stat-card-value" style={{ fontSize: '1.75rem', color: 'var(--accent-purple)' }}>{monthlyCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel" style={{
        padding: 'var(--space-4) var(--space-5)',
        marginBottom: 'var(--space-6)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
      }}>
        <Filter size={16} color="var(--text-muted)" />

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            background: 'var(--surface)', border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-md)', padding: '0.4rem 0.75rem',
            color: 'var(--text-primary)', fontSize: '0.8125rem', fontFamily: 'inherit',
          }}
        >
          <option value="">All Types</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>

        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          style={{
            background: 'var(--surface)', border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-md)', padding: '0.4rem 0.75rem',
            color: 'var(--text-primary)', fontSize: '0.8125rem', fontFamily: 'inherit',
            minWidth: 160,
          }}
        >
          <option value="">All Clients</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            background: 'var(--surface)', border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-md)', padding: '0.4rem 0.75rem',
            color: 'var(--text-primary)', fontSize: '0.8125rem', fontFamily: 'inherit',
          }}
        >
          <option value="">All Statuses</option>
          <option value="ready">Ready</option>
          <option value="generating">Generating</option>
          <option value="failed">Failed</option>
        </select>

        <button className="btn btn-ghost btn-sm" onClick={loadData} style={{ marginLeft: 'auto' }}>
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Report Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="shimmer" style={{ height: 160, borderRadius: 'var(--radius-xl)' }} />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="empty-state">
          <FileBarChart size={48} />
          <div>
            <h3 className="heading-3" style={{ marginBottom: 'var(--space-2)' }}>No reports yet</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Generate your first weekly or monthly report to see it here.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => handleGenerateAll('weekly')}>
            <Plus size={16} />
            Generate Weekly Reports
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
          {reports.map((report, idx) => (
            <ReportCard
              key={report.id}
              report={report}
              clientName={clientMap[report.client_id]}
              style={{ opacity: 0, animation: `fadeIn 0.35s ease-out ${idx * 50}ms forwards` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
