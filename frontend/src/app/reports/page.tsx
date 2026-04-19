'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  FileBarChart, Plus, Calendar, RefreshCw, Loader2, History,
  ChevronDown, Users, CheckCircle, AlertCircle, Layers,
  Download, Search, Filter, Sparkles, TrendingUp, Clock,
  BarChart3, Zap,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { ReportSummary, Client } from '../../types';
import Link from 'next/link';

/* ─── helpers ─────────────────────────────────────────────────────────── */

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function periodLabel(r: ReportSummary): string {
  const s = new Date(r.period_start + 'T00:00:00');
  if (r.report_type === 'monthly') {
    return s.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  return `${formatDate(r.period_start)} – ${formatDate(r.period_end)}`;
}

function relativeDate(d?: string | null): string {
  if (!d) return '—';
  const diffMs = Date.now() - new Date(d).getTime();
  const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDay < 1)   return 'today';
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7)   return `${diffDay}d ago`;
  if (diffDay < 30)  return `${Math.floor(diffDay / 7)}w ago`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)}mo ago`;
  return `${Math.floor(diffDay / 365)}y ago`;
}

/* Generate a deterministic gradient pair from a string (used for avatars) */
function avatarGradient(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const palette = [
    ['#3b82f6', '#06b6d4'],
    ['#8b5cf6', '#ec4899'],
    ['#10b981', '#06b6d4'],
    ['#f59e0b', '#ef4444'],
    ['#6366f1', '#8b5cf6'],
    ['#14b8a6', '#3b82f6'],
    ['#a855f7', '#3b82f6'],
    ['#ef4444', '#f59e0b'],
  ];
  const [a, b] = palette[h % palette.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

function clientInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
}

function statusBadge(status: string) {
  const cfg: Record<string, { bg: string; color: string; Icon: typeof CheckCircle }> = {
    ready:      { bg: 'var(--status-success-bg)', color: 'var(--status-success)', Icon: CheckCircle },
    failed:     { bg: 'var(--status-error-bg)',   color: 'var(--status-error)',   Icon: AlertCircle },
    generating: { bg: 'var(--status-warning-bg)', color: 'var(--status-warning)', Icon: Loader2 },
  };
  const c = cfg[status] ?? cfg.generating;
  return (
    <span className="badge" style={{ background: c.bg, color: c.color, fontSize: '0.6875rem' }}>
      <c.Icon size={10} className={status === 'generating' ? 'animate-spin' : ''} />
      {status}
    </span>
  );
}

/* ─── per-client card ─────────────────────────────────────────────────── */

interface ClientCardProps {
  client: Client;
  reports: ReportSummary[];
}

function ClientCard({ client, reports }: ClientCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly'>('weekly');

  const weekly = useMemo(
    () => reports
      .filter(r => r.report_type === 'weekly')
      .sort((a, b) => b.period_start.localeCompare(a.period_start)),
    [reports],
  );
  const monthly = useMemo(
    () => reports
      .filter(r => r.report_type === 'monthly')
      .sort((a, b) => b.period_start.localeCompare(a.period_start)),
    [reports],
  );

  const readyCount = reports.filter(r => r.status === 'ready').length;
  const failedCount = reports.filter(r => r.status === 'failed').length;
  const successRate = reports.length > 0 ? Math.round((readyCount / reports.length) * 100) : 0;

  // Most recent report (any type) for the "last generated" hint
  const mostRecent = useMemo(() => {
    return [...reports]
      .filter(r => r.generated_at)
      .sort((a, b) => (b.generated_at ?? '').localeCompare(a.generated_at ?? ''))[0];
  }, [reports]);

  const gradient = avatarGradient(client.name);
  const initials = clientInitials(client.name);
  const visibleReports = activeTab === 'weekly' ? weekly : monthly;
  const accentColor = activeTab === 'weekly' ? 'var(--accent-blue)' : 'var(--accent-purple)';

  return (
    <div
      style={{
        borderRadius: 'var(--radius-2xl)',
        border: `1px solid ${expanded ? 'rgba(59,130,246,0.25)' : 'var(--surface-border)'}`,
        background: expanded
          ? 'linear-gradient(145deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.015) 100%)'
          : 'linear-gradient(145deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
        overflow: 'hidden',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: expanded ? 'var(--shadow-md), 0 0 30px rgba(59,130,246,0.08)' : 'var(--shadow-sm)',
      }}
    >
      {/* ── Account header (clickable) ── */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--space-5)',
          padding: 'var(--space-5) var(--space-6)',
          background: 'none', border: 'none', cursor: 'pointer', color: 'inherit',
          textAlign: 'left', fontFamily: 'inherit',
        }}
      >
        {/* Avatar */}
        <div style={{
          width: 52, height: 52, borderRadius: 'var(--radius-lg)',
          background: gradient,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          fontWeight: 700, fontSize: '1.0625rem', color: '#fff',
          boxShadow: '0 4px 14px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)',
          letterSpacing: '-0.02em',
        }}>
          {initials}
        </div>

        {/* Name + chips */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: '1.0625rem', letterSpacing: '-0.01em' }}>
              {client.name}
            </span>
            {client.type && (
              <span className="badge" style={{
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-muted)',
                fontSize: '0.625rem',
                border: '1px solid var(--surface-border)',
              }}>
                {client.type.replace(/_/g, ' ')}
              </span>
            )}
            {failedCount > 0 && (
              <span className="badge" style={{
                background: 'var(--status-error-bg)',
                color: 'var(--status-error)',
                fontSize: '0.625rem',
              }}>
                {failedCount} failed
              </span>
            )}
          </div>

          {/* Inline stat strip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
            fontSize: '0.8125rem', color: 'var(--text-muted)', flexWrap: 'wrap',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <FileBarChart size={12} />
              <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{reports.length}</strong> reports
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                background: 'var(--accent-blue)',
              }} />
              {weekly.length} weekly
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                background: 'var(--accent-purple)',
              }} />
              {monthly.length} monthly
            </span>
            {mostRecent && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Clock size={11} />
                Updated {relativeDate(mostRecent.generated_at)}
              </span>
            )}
          </div>
        </div>

        {/* Success ratio donut + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexShrink: 0 }}>
          <SuccessRing percent={successRate} />
          <div style={{
            transition: 'transform 0.25s ease',
            transform: expanded ? 'rotate(180deg)' : 'none',
            color: 'var(--text-muted)',
          }}>
            <ChevronDown size={20} />
          </div>
        </div>
      </button>

      {/* ── Expanded body ── */}
      {expanded && (
        <div style={{
          padding: '0 var(--space-6) var(--space-6)',
          borderTop: '1px solid var(--surface-border)',
        }}>
          {/* Tab bar */}
          <div style={{
            display: 'flex', gap: 'var(--space-1)',
            marginTop: 'var(--space-5)', marginBottom: 'var(--space-4)',
            padding: 4,
            background: 'rgba(0,0,0,0.2)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--surface-border)',
            width: 'fit-content',
          }}>
            <TabButton
              label="Weekly"
              count={weekly.length}
              active={activeTab === 'weekly'}
              accent="var(--accent-blue)"
              onClick={() => setActiveTab('weekly')}
            />
            <TabButton
              label="Monthly"
              count={monthly.length}
              active={activeTab === 'monthly'}
              accent="var(--accent-purple)"
              onClick={() => setActiveTab('monthly')}
            />
          </div>

          {/* Report list */}
          <div style={{
            border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-lg)',
            background: 'rgba(0,0,0,0.15)',
            overflow: 'hidden',
            maxHeight: 420, overflowY: 'auto',
          }}>
            {visibleReports.length === 0 ? (
              <div style={{
                padding: 'var(--space-8)',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.875rem',
              }}>
                <FileBarChart size={28} style={{ opacity: 0.3, marginBottom: 'var(--space-2)' }} />
                <div>No {activeTab} reports yet</div>
              </div>
            ) : (
              visibleReports.map((report, idx) => (
                <ReportRow key={report.id} report={report} accentColor={accentColor} divider={idx > 0} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── small UI primitives used by the card ─────────────────────────────── */

function SuccessRing({ percent }: { percent: number }) {
  const radius = 16;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (percent / 100) * circ;
  const color =
    percent >= 80 ? 'var(--status-success)' :
    percent >= 50 ? 'var(--status-warning)' : 'var(--status-error)';

  return (
    <div style={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
      <svg width={40} height={40} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={20} cy={20} r={radius}
          stroke="var(--surface-border)" strokeWidth={3} fill="none" />
        <circle cx={20} cy={20} r={radius}
          stroke={color} strokeWidth={3} fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.6875rem', fontWeight: 700, color,
      }}>
        {percent}%
      </div>
    </div>
  );
}

function TabButton({
  label, count, active, accent, onClick,
}: { label: string; count: number; active: boolean; accent: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
        padding: '0.4rem 0.875rem',
        borderRadius: 'var(--radius-md)',
        background: active ? 'var(--surface-hover)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        fontWeight: 600, fontSize: '0.8125rem',
        border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        transition: 'all 0.15s ease',
      }}
    >
      <span style={{
        display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
        background: active ? accent : 'var(--text-muted)',
        opacity: active ? 1 : 0.5,
      }} />
      {label}
      <span style={{
        fontSize: '0.6875rem', fontWeight: 700,
        color: active ? accent : 'var(--text-muted)',
        background: active ? `${accent}1f` : 'transparent',
        padding: '1px 6px', borderRadius: 'var(--radius-full)', minWidth: 20, textAlign: 'center',
      }}>
        {count}
      </span>
    </button>
  );
}

function ReportRow({
  report, accentColor, divider,
}: { report: ReportSummary; accentColor: string; divider: boolean }) {
  return (
    <Link
      href={`/reports/${report.id}`}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'var(--space-4) var(--space-5)',
        borderTop: divider ? '1px solid var(--surface-border)' : 'none',
        textDecoration: 'none', color: 'inherit',
        transition: 'background 0.12s ease',
        background: 'transparent',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', minWidth: 0 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 'var(--radius-md)',
          background: `${accentColor}1a`,
          border: `1px solid ${accentColor}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Calendar size={15} color={accentColor} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 2 }}>
            {periodLabel(report)}
          </div>
          <div style={{
            fontSize: '0.75rem', color: 'var(--text-muted)',
            display: 'flex', gap: 'var(--space-3)', alignItems: 'center',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Layers size={11} />
              {report.section_count} sections
            </span>
            {report.generated_at && (
              <>
                <span style={{ opacity: 0.4 }}>•</span>
                <span>Generated {relativeDate(report.generated_at)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        {statusBadge(report.status)}
        {report.status === 'ready' && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(
                `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api'}/reports/v/download/${report.id}`,
                '_blank',
              );
            }}
            title="Download PDF"
            style={{
              padding: '0.4rem 0.625rem', borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)',
              transition: 'all 0.15s ease',
              border: '1px solid transparent', background: 'transparent',
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: '0.75rem', fontWeight: 600, fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = accentColor;
              e.currentTarget.style.background = `${accentColor}14`;
              e.currentTarget.style.borderColor = `${accentColor}33`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'transparent';
            }}
          >
            <Download size={13} />
            PDF
          </button>
        )}
      </div>
    </Link>
  );
}

/* ─── Stat tile ───────────────────────────────────────────────────────── */

function StatTile({
  label, value, icon, accent, glowColor,
}: {
  label: string; value: number;
  icon: React.ReactNode;
  accent: string;
  glowColor: string;
}) {
  return (
    <div
      className="stat-card"
      style={{
        position: 'relative',
        background: `linear-gradient(145deg, ${glowColor}10 0%, rgba(255,255,255,0.01) 100%)`,
        borderColor: `${glowColor}26`,
      }}
    >
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 100, height: 100, borderRadius: '50%',
        background: glowColor, filter: 'blur(50px)', opacity: 0.18,
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="stat-card-label">{label}</div>
          <div className="stat-card-value" style={{ color: accent }}>{value}</div>
        </div>
        <div style={{
          width: 38, height: 38, borderRadius: 'var(--radius-md)',
          background: `${glowColor}1f`,
          border: `1px solid ${glowColor}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accent,
        }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

/* ─── main page ───────────────────────────────────────────────────────── */

type FilterType = 'all' | 'weekly' | 'monthly';
type FilterStatus = 'all' | 'ready' | 'generating' | 'failed';

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  // UI filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [reportsData, clientsData] = await Promise.all([
        api.getReports({}),
        api.getClients(),
      ]);
      setReports(reportsData);
      setClients(clientsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /* Apply filters before grouping */
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      if (filterType !== 'all' && r.report_type !== filterType) return false;
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      return true;
    });
  }, [reports, filterType, filterStatus]);

  /* Group reports by client_id */
  const reportsByClient = useMemo(() => {
    const map = new Map<string, ReportSummary[]>();
    for (const r of filteredReports) {
      const list = map.get(r.client_id) ?? [];
      list.push(r);
      map.set(r.client_id, list);
    }
    return map;
  }, [filteredReports]);

  const clientMap = useMemo(
    () => new Map(clients.map(c => [c.id, c])),
    [clients],
  );

  /* Clients that have reports, with search filter */
  const clientsWithReports = useMemo(() => {
    const ids = Array.from(reportsByClient.keys());
    const result = ids
      .map(id => clientMap.get(id))
      .filter(Boolean) as Client[];
    const q = search.trim().toLowerCase();
    return result
      .filter(c => !q || c.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [reportsByClient, clientMap, search]);

  /* Stats — always reflect the unfiltered totals */
  const readyCount = reports.filter(r => r.status === 'ready').length;
  const weeklyCount = reports.filter(r => r.report_type === 'weekly').length;
  const monthlyCount = reports.filter(r => r.report_type === 'monthly').length;

  async function handleGenerateAll(type: 'weekly' | 'monthly') {
    if (generating || backfilling) return;
    setGenerating(true);
    await api.generateAllReports(type);
    const poll = setInterval(async () => {
      const updated = await api.getReports({});
      setReports(updated);
      if (!updated.some(r => r.status === 'generating')) {
        clearInterval(poll);
        setGenerating(false);
        loadData();
      }
    }, 3000);
    setTimeout(() => { clearInterval(poll); setGenerating(false); loadData(); }, 120000);
  }

  async function handleBackfillAll() {
    if (generating || backfilling) return;
    setBackfilling(true);
    await api.backfillReports(undefined, 24, 6);
    setTimeout(() => { loadData(); setBackfilling(false); }, 4000);
  }

  const activeFiltersCount =
    (filterType !== 'all' ? 1 : 0) + (filterStatus !== 'all' ? 1 : 0) + (search ? 1 : 0);

  return (
    <div style={{ padding: 'var(--space-8) var(--space-10)', maxWidth: 1400, margin: '0 auto' }}>
      {/* ── Hero header ── */}
      <div
        style={{
          position: 'relative',
          marginBottom: 'var(--space-8)',
          padding: 'var(--space-8)',
          borderRadius: 'var(--radius-2xl)',
          border: '1px solid var(--surface-border)',
          background:
            'radial-gradient(ellipse at top left, rgba(59,130,246,0.08) 0%, transparent 55%), ' +
            'radial-gradient(ellipse at bottom right, rgba(139,92,246,0.08) 0%, transparent 55%), ' +
            'linear-gradient(145deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
          overflow: 'hidden',
        }}
      >
        {/* Top gradient hair-line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)',
        }} />

        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', gap: 'var(--space-6)', flexWrap: 'wrap',
        }}>
          <div style={{ flex: '1 1 360px', minWidth: 0 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '0.25rem 0.75rem',
              background: 'rgba(59,130,246,0.1)',
              border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 'var(--radius-full)',
              color: 'var(--accent-blue)',
              fontSize: '0.6875rem', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              marginBottom: 'var(--space-3)',
            }}>
              <Sparkles size={11} />
              Automated Insights
            </div>
            <h1 className="heading-1" style={{ fontSize: '2.5rem', marginBottom: 'var(--space-2)' }}>
              <span className="text-gradient">Performance Reports</span>
            </h1>
            <p style={{
              color: 'var(--text-secondary)', fontSize: '1rem',
              maxWidth: 580, lineHeight: 1.6,
            }}>
              Weekly and monthly snapshots of every account&apos;s ad performance —
              ready to share, download, or dive into.
            </p>
          </div>

          {/* Action cluster */}
          <div style={{
            display: 'flex', gap: 'var(--space-2)', alignItems: 'center',
            flexShrink: 0, flexWrap: 'wrap',
          }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={loadData}
              title="Refresh"
              style={{ padding: '0.5rem 0.75rem' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleBackfillAll}
              disabled={backfilling || generating}
            >
              {backfilling ? <Loader2 size={14} className="animate-spin" /> : <History size={14} />}
              Backfill
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleGenerateAll('weekly')}
              disabled={generating || backfilling}
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              This Week
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleGenerateAll('monthly')}
              disabled={generating || backfilling}
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              Generate Monthly
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 'var(--space-4)', marginBottom: 'var(--space-6)',
      }}>
        <StatTile
          label="Total Reports"
          value={reports.length}
          icon={<BarChart3 size={18} />}
          accent="var(--text-primary)"
          glowColor="#94a3b8"
        />
        <StatTile
          label="Ready"
          value={readyCount}
          icon={<CheckCircle size={18} />}
          accent="var(--status-success)"
          glowColor="#10b981"
        />
        <StatTile
          label="Weekly"
          value={weeklyCount}
          icon={<TrendingUp size={18} />}
          accent="var(--accent-blue)"
          glowColor="#3b82f6"
        />
        <StatTile
          label="Monthly"
          value={monthlyCount}
          icon={<Calendar size={18} />}
          accent="var(--accent-purple)"
          glowColor="#8b5cf6"
        />
      </div>

      {/* ── Filter bar ── */}
      <div style={{
        display: 'flex', gap: 'var(--space-3)',
        alignItems: 'center', marginBottom: 'var(--space-5)',
        flexWrap: 'wrap',
      }}>
        {/* Search */}
        <div style={{
          flex: '1 1 300px',
          position: 'relative',
          display: 'flex', alignItems: 'center',
          background: 'var(--surface)',
          border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '0.5rem 0.875rem',
          gap: 'var(--space-3)',
          transition: 'border-color 0.2s ease',
        }}>
          <Search size={15} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search by client name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: '0.875rem', fontFamily: 'inherit',
              minWidth: 0,
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                fontSize: '0.6875rem', color: 'var(--text-muted)',
                padding: '2px 8px', borderRadius: 'var(--radius-full)',
                background: 'var(--surface-hover)',
              }}
            >
              clear
            </button>
          )}
        </div>

        {/* Filter pills */}
        <FilterPillGroup
          icon={<Filter size={12} />}
          label="Type"
          options={[
            { value: 'all',     label: 'All' },
            { value: 'weekly',  label: 'Weekly',  dot: 'var(--accent-blue)' },
            { value: 'monthly', label: 'Monthly', dot: 'var(--accent-purple)' },
          ]}
          value={filterType}
          onChange={(v) => setFilterType(v as FilterType)}
        />
        <FilterPillGroup
          label="Status"
          options={[
            { value: 'all',        label: 'All' },
            { value: 'ready',      label: 'Ready',      dot: 'var(--status-success)' },
            { value: 'generating', label: 'Generating', dot: 'var(--status-warning)' },
            { value: 'failed',     label: 'Failed',     dot: 'var(--status-error)' },
          ]}
          value={filterStatus}
          onChange={(v) => setFilterStatus(v as FilterStatus)}
        />
        {activeFiltersCount > 0 && (
          <button
            onClick={() => { setSearch(''); setFilterType('all'); setFilterStatus('all'); }}
            style={{
              fontSize: '0.75rem', color: 'var(--text-muted)',
              padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--surface-border)',
              background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Reset filters
          </button>
        )}
      </div>

      {/* ── Result count ── */}
      {!loading && (
        <div style={{
          fontSize: '0.8125rem', color: 'var(--text-muted)',
          marginBottom: 'var(--space-4)',
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        }}>
          Showing
          <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
            {clientsWithReports.length}
          </strong>
          account{clientsWithReports.length !== 1 ? 's' : ''} •
          <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
            {filteredReports.length}
          </strong>
          report{filteredReports.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* ── Account cards ── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="shimmer" style={{ height: 96, borderRadius: 'var(--radius-2xl)' }} />
          ))}
        </div>
      ) : clientsWithReports.length === 0 ? (
        <div className="empty-state" style={{
          textAlign: 'center',
          padding: 'var(--space-12)',
          border: '1px dashed var(--surface-border)',
          borderRadius: 'var(--radius-2xl)',
          background: 'rgba(255,255,255,0.015)',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'var(--accent-gradient-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 'var(--space-4)',
          }}>
            <FileBarChart size={32} color="var(--accent-blue)" style={{ opacity: 0.85 }} />
          </div>
          <h3 className="heading-3" style={{ marginBottom: 'var(--space-2)' }}>
            {activeFiltersCount > 0 ? 'No matches found' : 'No reports yet'}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: 360 }}>
            {activeFiltersCount > 0
              ? 'Try adjusting your filters to see more results.'
              : 'Generate your first weekly or monthly report to see it here.'}
          </p>
          {activeFiltersCount === 0 && (
            <button
              className="btn btn-primary"
              onClick={() => handleGenerateAll('weekly')}
              style={{ marginTop: 'var(--space-4)' }}
            >
              <Plus size={16} />
              Generate Weekly Reports
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {clientsWithReports.map((client, idx) => (
            <div
              key={client.id}
              style={{
                opacity: 0,
                animation: `fadeIn 0.35s ease-out ${idx * 50}ms forwards`,
              }}
            >
              <ClientCard
                client={client}
                reports={reportsByClient.get(client.id) ?? []}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Filter pill group ───────────────────────────────────────────────── */

interface FilterPillOption { value: string; label: string; dot?: string }
function FilterPillGroup({
  icon, label, options, value, onChange,
}: {
  icon?: React.ReactNode;
  label?: string;
  options: FilterPillOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center',
      background: 'var(--surface)',
      border: '1px solid var(--surface-border)',
      borderRadius: 'var(--radius-lg)',
      padding: 4, gap: 2,
    }}>
      {(icon || label) && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '0 var(--space-3)',
          fontSize: '0.6875rem', color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
        }}>
          {icon}
          {label}
        </div>
      )}
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              background: active ? 'var(--surface-hover)' : 'transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: 600, fontSize: '0.75rem',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.12s ease',
            }}
          >
            {opt.dot && (
              <span style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                background: opt.dot,
              }} />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
