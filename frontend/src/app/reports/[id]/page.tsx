'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Calendar, CheckCircle, AlertCircle,
  DollarSign, MousePointerClick, Eye, TrendingUp, ShoppingCart,
  Users, BarChart3, Globe, Smartphone, LayoutGrid, Search, Tag,
  Clock, UserCheck, Download, Loader2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from 'recharts';
import { api } from '../../../lib/api';
import KPICard from '../../../components/KPICard';
import type { Report, ReportSection, Client } from '../../../types';

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'rgba(15,15,18,0.95)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    fontSize: '0.8125rem',
    color: '#f0f2f5',
  },
};

const SOURCE_LABELS: Record<string, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  shopify: 'Shopify',
  ga4: 'Google Analytics 4',
  cross_platform: 'Cross-Platform',
};

const SOURCE_COLORS: Record<string, string> = {
  google_ads: '#3b82f6',
  meta_ads: '#8b5cf6',
  shopify: '#10b981',
  ga4: '#f59e0b',
  cross_platform: '#06b6d4',
};

const DAY_ORDER = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'];
const DAY_SHORT: Record<string,string> = {
  MONDAY:'Mon', TUESDAY:'Tue', WEDNESDAY:'Wed', THURSDAY:'Thu',
  FRIDAY:'Fri', SATURDAY:'Sat', SUNDAY:'Sun',
};

export default function ReportViewPage() {
  const params = useParams();
  const reportId = params?.id as string;

  const [report, setReport] = useState<Report | undefined>();
  const [client, setClient] = useState<Client | undefined>();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('cross_platform');
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (reportId) loadReport();
  }, [reportId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadReport() {
    setLoading(true);
    const data = await api.getReport(reportId);
    if (data) {
      setReport(data);
      const c = await api.getClient(data.client_id);
      setClient(c);
      const sources = Array.from(new Set(data.sections.map(s => s.source)));
      if (sources.includes('cross_platform')) setActiveTab('cross_platform');
      else if (sources.length > 0) setActiveTab(sources[0]);
    }
    setLoading(false);
  }

  async function handleDownloadPdf() {
    if (!report || pdfLoading) return;
    setPdfLoading(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api';
      const url = `${apiBase}/reports/v/download/${report.id}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const clientName = client?.name?.replace(/\s+/g, '_') ?? 'Report';
      const period = report.report_type === 'monthly'
        ? new Date(report.period_start).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' }).replace(' ', '_')
        : `${report.period_start}_to_${report.period_end}`;
      link.download = `${clientName}_${report.report_type}_${period}.pdf`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('PDF download failed:', err);
      alert('PDF generation failed. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-8) var(--space-10)' }}>
        <div className="shimmer" style={{ height: 40, width: 200, marginBottom: 'var(--space-6)' }} />
        <div className="shimmer" style={{ height: 200, marginBottom: 'var(--space-4)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--space-4)' }}>
          {[1,2,3,4].map(i => <div key={i} className="shimmer" style={{ height: 100 }} />)}
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="empty-state" style={{ minHeight: '60vh' }}>
        <AlertCircle size={48} />
        <h2 className="heading-2">Report not found</h2>
        <Link href="/reports" className="btn btn-primary">Back to Reports</Link>
      </div>
    );
  }

  const sources = Array.from(new Set(report.sections.map(s => s.source)));
  const activeSections = report.sections.filter(s => s.source === activeTab);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-AU', { month: 'long', day: 'numeric', year: 'numeric' });

  const periodLabel = report.report_type === 'monthly'
    ? new Date(report.period_start).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
    : `${formatDate(report.period_start)} — ${formatDate(report.period_end)}`;

  return (
    <div style={{ padding: 'var(--space-8) var(--space-10)' }}>
      <style>{`
        .text-right { text-align: right !important; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      <Link href="/reports" className="btn btn-ghost" style={{ marginBottom: 'var(--space-4)', display: 'inline-flex' }}>
        <ArrowLeft size={16} /> Back to Reports
      </Link>

      {/* Header */}
      <div className="glass-panel" style={{ padding: 'var(--space-6) var(--space-8)', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
              <h1 className="heading-1" style={{ marginBottom: 0 }}>
                <span className="text-gradient">
                  {report.report_type === 'weekly' ? 'Weekly' : 'Monthly'} Report
                </span>
              </h1>
              <span className="badge" style={{
                background: report.status === 'ready' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                color: report.status === 'ready' ? '#10b981' : '#ef4444',
                border: `1px solid ${report.status === 'ready' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {report.status === 'ready' ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
                {report.status}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-6)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Users size={14} /> {client?.name || 'Unknown Client'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Calendar size={14} /> {periodLabel}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {sources.map(s => (
                <span key={s} className="badge" style={{
                  background: `${SOURCE_COLORS[s]}15`, color: SOURCE_COLORS[s],
                  border: `1px solid ${SOURCE_COLORS[s]}30`,
                }}>
                  {SOURCE_LABELS[s] || s}
                </span>
              ))}
            </div>
            {report.status === 'ready' && (
              <button
                onClick={handleDownloadPdf}
                disabled={pdfLoading}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
                  padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)',
                  background: pdfLoading ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.12)',
                  color: '#3b82f6',
                  border: '1px solid rgba(59,130,246,0.25)',
                  fontSize: '0.8125rem', fontWeight: 600,
                  cursor: pdfLoading ? 'not-allowed' : 'pointer',
                  opacity: pdfLoading ? 0.7 : 1,
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!pdfLoading) { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'; } }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.12)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.25)'; }}
              >
                {pdfLoading
                  ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
                  : <><Download size={14} /> Download PDF</>
                }
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '0.375rem', marginBottom: 'var(--space-6)', overflowX: 'auto',
        padding: 'var(--space-1)', background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--surface-border)',
      }}>
        {sources.map(source => (
          <button key={source} onClick={() => setActiveTab(source)} style={{
            padding: '0.5rem 1.125rem', borderRadius: 'var(--radius-md)',
            fontSize: '0.8125rem', fontWeight: activeTab === source ? 600 : 400,
            background: activeTab === source ? `${SOURCE_COLORS[source]}20` : 'transparent',
            color: activeTab === source ? SOURCE_COLORS[source] : 'var(--text-secondary)',
            border: activeTab === source ? `1px solid ${SOURCE_COLORS[source]}33` : '1px solid transparent',
            transition: 'all 0.15s ease', whiteSpace: 'nowrap', cursor: 'pointer',
          }}>
            {SOURCE_LABELS[source] || source}
          </button>
        ))}
      </div>

      {/* Section Content */}
      <div className="fade-in" key={activeTab}>
        {activeSections.map(section => (
          <SectionRenderer key={section.id} section={section} />
        ))}
      </div>
    </div>
  );
}

// ── Section Renderer ──────────────────────────────────────────────────────────

function SectionRenderer({ section }: { section: ReportSection }) {
  const data = section.data as Record<string, unknown>;
  switch (section.section_type) {
    case 'summary':          return <SummarySection data={data} source={section.source} />;
    case 'campaign_breakdown': return <CampaignBreakdownSection data={data} />;
    case 'search_terms':     return <SearchTermsSection data={data} />;
    case 'keywords':         return <KeywordsSection data={data} />;
    case 'time_segments':    return <TimeSegmentsSection data={data} />;
    case 'demographics':     return <DemographicsSection data={data} />;
    case 'leadgen':          return <LeadgenSection data={data} />;
    case 'products':         return <ProductsSection data={data} />;
    case 'channel_breakdown':  return <ChannelBreakdownSection data={data} />;
    case 'device_breakdown':   return <DeviceBreakdownSection data={data} />;
    case 'revenue_by_day':     return <RevenueByDaySection data={data} />;
    default:
      return (
        <div className="glass-panel" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
          <h3 className="heading-3" style={{ marginBottom: 'var(--space-3)' }}>{section.section_type}</h3>
          <pre style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'auto' }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      );
  }
}

// ── Summary KPI Cards ─────────────────────────────────────────────────────────

function SummarySection({ data, source }: { data: Record<string, unknown>; source: string }) {
  const summary = (data.summary || data) as Record<string, string>;
  const growth  = (summary.growth || data.growth || {}) as Record<string, string>;
  const color   = SOURCE_COLORS[source] || '#3b82f6';

  type KPI = { label: string; value: string; change?: string; prefix?: string; suffix?: string; icon: React.ReactNode };
  const kpis: KPI[] = [];

  const add = (label: string, val: unknown, icon: React.ReactNode, opts: Partial<KPI> = {}) => {
    if (val !== undefined && val !== null && val !== '' && val !== '0') {
      kpis.push({ label, value: String(val), icon, ...opts });
    }
  };

  add('Total Spend',   summary.spend || summary.total_spend,   <DollarSign size={16} color={color} />, { prefix: '$', change: growth.spend_growth });
  add('Revenue',       summary.total_revenue || summary.purchase_revenue, <TrendingUp size={16} color={color} />, { prefix: '$', change: growth.revenue_growth });
  add('Impressions',   summary.impressions,   <Eye size={16} color={color} />, { change: growth.impressions_growth });
  add('Clicks',        summary.clicks,        <MousePointerClick size={16} color={color} />, { change: growth.clicks_growth });
  add('Conversions',   summary.conversions || summary.total_conversions, <ShoppingCart size={16} color={color} />, { change: growth.conversions_growth });
  if (summary.blended_roas || summary.roas) {
    kpis.push({ label: 'ROAS', value: parseFloat(summary.blended_roas || summary.roas || '0').toFixed(2), suffix: 'x', change: growth.roas_growth, icon: <BarChart3 size={16} color={color} /> });
  }
  add('Orders',        summary.total_orders,   <ShoppingCart size={16} color={color} />, { change: growth.orders_growth });
  add('Avg Order Value', summary.avg_order_value, <DollarSign size={16} color={color} />, { prefix: '$' });
  add('New Customers', summary.new_customers,  <Users size={16} color={color} />);
  add('Returning Customers', summary.returning_customers, <Users size={16} color={color} />);
  if (summary.new_customer_pct) kpis.push({ label: 'New Customer %', value: parseFloat(summary.new_customer_pct).toFixed(2), suffix: '%', icon: <Users size={16} color={color} /> });
  if (summary.ctr) kpis.push({ label: 'CTR', value: parseFloat(summary.ctr).toFixed(2), suffix: '%', change: growth.ctr_growth, icon: <MousePointerClick size={16} color={color} /> });
  if (summary.cpc) kpis.push({ label: 'Avg CPC', value: parseFloat(summary.cpc).toFixed(2), prefix: '$', change: growth.cpc_growth, icon: <DollarSign size={16} color={color} /> });
  if (summary.conversion_rate) kpis.push({ label: 'Conv. Rate', value: parseFloat(summary.conversion_rate).toFixed(2), suffix: '%', change: growth.conversion_rate_growth, icon: <TrendingUp size={16} color={color} /> });
  add('Reach',         summary.reach,     <Users size={16} color={color} />, { change: growth.reach_growth });
  if (summary.frequency) kpis.push({ label: 'Frequency', value: parseFloat(summary.frequency).toFixed(2), change: growth.frequency_growth, icon: <Eye size={16} color={color} /> });
  if (summary.cpm) kpis.push({ label: 'CPM', value: parseFloat(summary.cpm).toFixed(2), prefix: '$', change: growth.cpm_growth, icon: <DollarSign size={16} color={color} /> });
  add('Sessions',      summary.sessions,  <Globe size={16} color={color} />);
  add('Active Users',  summary.active_users, <Users size={16} color={color} />);

  if (kpis.length === 0) return null;

  const cols = Math.min(kpis.length, 4);

  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      <SectionHeader icon={<LayoutGrid size={16} />} title="Performance Summary" color={color} />
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 'var(--space-4)' }}>
        {kpis.map((kpi, i) => (
          <KPICard key={i} label={kpi.label} value={kpi.value} change={kpi.change}
            prefix={kpi.prefix} suffix={kpi.suffix} icon={kpi.icon} accentColor={color} />
        ))}
      </div>
      {Array.isArray(data.platforms_active) && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
          {(data.platforms_active as string[]).map((p: string) => (
            <span key={p} className="badge" style={{ background: `${SOURCE_COLORS[p]}15`, color: SOURCE_COLORS[p], border: `1px solid ${SOURCE_COLORS[p]}30` }}>
              {SOURCE_LABELS[p] || p}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Campaign Breakdown ────────────────────────────────────────────────────────

function CampaignBreakdownSection({ data }: { data: Record<string, unknown> }) {
  const campaigns = (data.campaigns || []) as Record<string, unknown>[];
  const isRaw     = data.data_source === 'csv_upload';
  if (campaigns.length === 0) return null;

  return (
    <div className="glass-panel" style={{ padding: 'var(--space-5) var(--space-6)', marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <SectionHeader icon={<BarChart3 size={16} />} title="Campaign Breakdown" inline />
        {isRaw && <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>CSV Upload</span>}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ minWidth: 180 }}>Campaign</th>
              <th className="text-right">Impressions</th>
              <th className="text-right">Clicks</th>
              <th className="text-right">Spend</th>
              <th className="text-right">CTR</th>
              <th className="text-right">Avg CPC</th>
              <th className="text-right">Conversions</th>
              <th className="text-right">Conv. Rate</th>
              <th className="text-right">ROAS</th>
              <th className="text-right">Impr. Share</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.slice(0, 25).map((c, i) => (
              <tr key={i} style={{ opacity: 0, animation: `fadeIn 0.25s ease-out ${i * 25}ms forwards` }}>
                <td style={{ fontWeight: 500, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {String(c.campaign_name || '-')}
                </td>
                <td className="text-right">{fmtNum(c.impressions)}</td>
                <td className="text-right">{fmtNum(c.clicks)}</td>
                <td className="text-right">{fmtCurrency(c.spend)}</td>
                <td className="text-right">{fmtPct(c.ctr)}</td>
                <td className="text-right">{fmtCurrency(c.avg_cpc)}</td>
                <td className="text-right">{fmtDec(c.conversions)}</td>
                <td className="text-right">{fmtPct(c.conversion_rate)}</td>
                <td className="text-right">{fmtRoas(c.roas)}</td>
                <td className="text-right">{c.impression_share ? fmtPct(c.impression_share) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Search Terms ──────────────────────────────────────────────────────────────

function SearchTermsSection({ data }: { data: Record<string, unknown> }) {
  const rows = (data.search_terms || []) as Record<string, unknown>[];
  if (rows.length === 0) return null;
  const hasRoas = rows.some(r => r.roas !== null && r.roas !== undefined);
  const hasConvValue = rows.some(r => r.conv_value !== null && r.conv_value !== undefined);

  return (
    <div className="glass-panel" style={{ padding: 'var(--space-5) var(--space-6)', marginBottom: 'var(--space-4)' }}>
      <SectionHeader icon={<Search size={16} />} title="Top Search Terms" subtitle="Ranked by clicks · Search campaigns" />
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ minWidth: 200 }}>Search Term</th>
              <th className="text-right">Impressions</th>
              <th className="text-right">Clicks</th>
              <th className="text-right">CTR</th>
              <th className="text-right">Avg CPC</th>
              <th className="text-right">Conversions</th>
              {hasConvValue && <th className="text-right">Conv. Value</th>}
              {hasRoas     && <th className="text-right">ROAS</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ opacity: 0, animation: `fadeIn 0.25s ease-out ${i * 30}ms forwards` }}>
                <td style={{ fontWeight: 500 }}>{String(r.search_term || '—')}</td>
                <td className="text-right">{fmtNum(r.impressions)}</td>
                <td className="text-right">{fmtNum(r.clicks)}</td>
                <td className="text-right">{fmtPct(r.ctr)}</td>
                <td className="text-right">{fmtCurrency(r.avg_cpc)}</td>
                <td className="text-right">{fmtDec(r.conversions)}</td>
                {hasConvValue && <td className="text-right">{fmtCurrency(r.conv_value)}</td>}
                {hasRoas      && <td className="text-right">{fmtRoas(r.roas)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Keywords ──────────────────────────────────────────────────────────────────

const MATCH_BADGE: Record<string, { bg: string; color: string }> = {
  BROAD:  { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
  PHRASE: { bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6' },
  EXACT:  { bg: 'rgba(16,185,129,0.15)',  color: '#10b981' },
};

function KeywordsSection({ data }: { data: Record<string, unknown> }) {
  const rows = (data.keywords || []) as Record<string, unknown>[];
  if (rows.length === 0) return null;

  return (
    <div className="glass-panel" style={{ padding: 'var(--space-5) var(--space-6)', marginBottom: 'var(--space-4)' }}>
      <SectionHeader icon={<Tag size={16} />} title="Top Keywords" subtitle="Ranked by impressions · Search campaigns" />
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ minWidth: 200 }}>Keyword</th>
              <th>Match Type</th>
              <th className="text-right">Quality Score</th>
              <th className="text-right">Impressions</th>
              <th className="text-right">Clicks</th>
              <th className="text-right">CTR</th>
              <th className="text-right">Avg CPC</th>
              <th className="text-right">Conversions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const mt    = String(r.match_type || '').replace('KeywordMatchType.', '').toUpperCase();
              const badge = MATCH_BADGE[mt];
              const qs    = Number(r.quality_score || 0);
              return (
                <tr key={i} style={{ opacity: 0, animation: `fadeIn 0.25s ease-out ${i * 30}ms forwards` }}>
                  <td style={{ fontWeight: 500 }}>{String(r.keyword_text || '—')}</td>
                  <td>
                    {mt ? (
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, background: badge?.bg || 'rgba(255,255,255,0.08)', color: badge?.color || 'var(--text-secondary)' }}>
                        {mt}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="text-right">
                    {qs > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        <span style={{ fontWeight: 600, color: qs >= 7 ? '#10b981' : qs >= 4 ? '#f59e0b' : '#ef4444' }}>{qs}/10</span>
                        <div style={{ display: 'flex', gap: 2 }}>
                          {Array.from({ length: 10 }).map((_, j) => (
                            <div key={j} style={{ width: 4, height: 12, borderRadius: 2, background: j < qs ? (qs >= 7 ? '#10b981' : qs >= 4 ? '#f59e0b' : '#ef4444') : 'rgba(255,255,255,0.1)' }} />
                          ))}
                        </div>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="text-right">{fmtNum(r.impressions)}</td>
                  <td className="text-right">{fmtNum(r.clicks)}</td>
                  <td className="text-right">{fmtPct(r.ctr)}</td>
                  <td className="text-right">{fmtCurrency(r.avg_cpc)}</td>
                  <td className="text-right">{fmtDec(r.conversions)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Time Segments ─────────────────────────────────────────────────────────────

function TimeSegmentsSection({ data }: { data: Record<string, unknown> }) {
  const rawDay  = (data.day_of_week || data.day || []) as Record<string, unknown>[];
  const rawHour = (data.hour_of_day || data.hour || []) as Record<string, unknown>[];

  // Sort days Mon→Sun
  const dayData = [...rawDay].sort((a, b) => {
    const ai = DAY_ORDER.indexOf(String(a.segment_value).toUpperCase());
    const bi = DAY_ORDER.indexOf(String(b.segment_value).toUpperCase());
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  }).map(r => ({ ...r, label: DAY_SHORT[String(r.segment_value).toUpperCase()] || String(r.segment_value) }));

  // Sort hours 0→23
  const hourData = [...rawHour].sort((a, b) => Number(a.segment_value) - Number(b.segment_value))
    .map(r => ({ ...r, label: `${r.segment_value}h` }));

  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <SectionHeader icon={<Clock size={16} />} title="Day & Hour Performance" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
        {dayData.length > 0 && (
          <div className="glass-panel" style={{ padding: 'var(--space-5) var(--space-6)' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>Day of Week</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dayData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: '0.75rem', color: '#94a3b8' }} />
                <Bar dataKey="clicks" fill="#3b82f6" radius={[4,4,0,0]} name="Clicks" />
                <Bar dataKey="conversions" fill="#10b981" radius={[4,4,0,0]} name="Conversions" />
              </BarChart>
            </ResponsiveContainer>
            {/* Spend totals by day */}
            <div style={{ display: 'flex', gap: 6, marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
              {dayData.map((d, i) => (
                <div key={i} style={{ textAlign: 'center', flex: 1, minWidth: 36 }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{d.label}</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f59e0b' }}>{fmtCurrency((d as Record<string, unknown>).spend)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {hourData.length > 0 && (
          <div className="glass-panel" style={{ padding: 'var(--space-5) var(--space-6)' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>Hour of Day</h4>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={hourData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} interval={2} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: '0.75rem', color: '#94a3b8' }} />
                <Line type="monotone" dataKey="clicks" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Clicks" />
                <Line type="monotone" dataKey="conversions" stroke="#10b981" strokeWidth={2} dot={false} name="Conversions" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Demographics ──────────────────────────────────────────────────────────────

function DemographicsSection({ data }: { data: Record<string, unknown> }) {
  const demos = (data.demographics || []) as Record<string, unknown>[];
  if (demos.length === 0) return null;

  const genderMap: Record<string, { impressions: number; clicks: number; spend: number; conversions: number }> = {};
  const ageMap:    Record<string, { impressions: number; clicks: number; spend: number; conversions: number }> = {};

  demos.forEach(d => {
    const g = String(d.gender   || 'UNKNOWN').replace('GenderType.', '');
    const a = String(d.age_range || d.age_group || 'UNKNOWN').replace('AgeRangeType.', '').replace('AGE_RANGE_', '').replace('_', '–');
    [
      [genderMap, g] as const,
      [ageMap,    a] as const,
    ].forEach(([map, key]) => {
      if (!map[key]) map[key] = { impressions: 0, clicks: 0, spend: 0, conversions: 0 };
      map[key].impressions  += Number(d.impressions  || 0);
      map[key].clicks       += Number(d.clicks       || 0);
      map[key].spend        += Number(d.spend        || 0);
      map[key].conversions  += Number(d.conversions  || 0);
    });
  });

  const genderRows = Object.entries(genderMap).map(([name, v]) => ({ name, ...v }));
  const ageRows    = Object.entries(ageMap).map(([name, v]) => ({ name, ...v }));
  const totalImpr  = genderRows.reduce((s, r) => s + r.impressions, 0);

  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <SectionHeader icon={<UserCheck size={16} />} title="Audience Demographics" subtitle="Display / YouTube campaigns only" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>

        {/* Gender */}
        <div className="glass-panel" style={{ padding: 'var(--space-5) var(--space-6)' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Gender</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={genderRows.map(r => ({ name: r.name, value: r.impressions }))}
                  cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value">
                  {genderRows.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => fmtNum(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'var(--space-2)' }}>
              {genderRows.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      {totalImpr > 0 ? ((r.impressions / totalImpr) * 100).toFixed(1) : 0}% · {fmtNum(r.impressions)} impr.
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <table className="data-table" style={{ marginTop: 'var(--space-3)', fontSize: '0.8125rem' }}>
            <thead><tr><th>Gender</th><th className="text-right">Clicks</th><th className="text-right">Spend</th><th className="text-right">Conv.</th></tr></thead>
            <tbody>
              {genderRows.map((r, i) => (
                <tr key={i}><td>{r.name}</td><td className="text-right">{fmtNum(r.clicks)}</td><td className="text-right">{fmtCurrency(r.spend)}</td><td className="text-right">{fmtDec(r.conversions)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Age */}
        <div className="glass-panel" style={{ padding: 'var(--space-5) var(--space-6)' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Age Range</h4>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={ageRows} layout="vertical" margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" width={55} tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar dataKey="impressions" fill="#8b5cf6" radius={[0,4,4,0]} name="Impressions" />
            </BarChart>
          </ResponsiveContainer>
          <table className="data-table" style={{ marginTop: 'var(--space-3)', fontSize: '0.8125rem' }}>
            <thead><tr><th>Age</th><th className="text-right">Impressions</th><th className="text-right">Clicks</th><th className="text-right">Spend</th></tr></thead>
            <tbody>
              {ageRows.map((r, i) => (
                <tr key={i}><td>{r.name}</td><td className="text-right">{fmtNum(r.impressions)}</td><td className="text-right">{fmtNum(r.clicks)}</td><td className="text-right">{fmtCurrency(r.spend)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Lead Gen ──────────────────────────────────────────────────────────────────

function LeadgenSection({ data }: { data: Record<string, unknown> }) {
  const rows = (data.leadgen || []) as Record<string, unknown>[];
  return (
    <div className="glass-panel" style={{ padding: 'var(--space-5) var(--space-6)', marginBottom: 'var(--space-4)' }}>
      <SectionHeader icon={<UserCheck size={16} />} title="Lead Generation" inline />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
        <KPICard label="Total Leads"    value={fmtNum(data.total_leads)} accentColor="#8b5cf6" />
        <KPICard label="Avg Cost/Lead"  value={fmtNum(data.avg_cpl)} prefix="$" accentColor="#8b5cf6" />
        <KPICard label="Campaigns"      value={String(rows.length)} accentColor="#8b5cf6" />
      </div>
      {rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th className="text-right">Leads</th>
                <th className="text-right">Cost / Lead</th>
                <th className="text-right">Form Opens</th>
                <th className="text-right">Completion %</th>
                <th className="text-right">Clicks</th>
                <th className="text-right">Landing Views</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>{String(r.campaign_name || '—')}</td>
                  <td className="text-right">{fmtNum(r.leads)}</td>
                  <td className="text-right">{fmtCurrency(r.cost_per_lead)}</td>
                  <td className="text-right">{fmtNum(r.lead_form_opens)}</td>
                  <td className="text-right">{fmtPct(r.form_completion_rate)}</td>
                  <td className="text-right">{fmtNum(r.link_clicks)}</td>
                  <td className="text-right">{fmtNum(r.landing_page_views)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Products ──────────────────────────────────────────────────────────────────

function ProductsSection({ data }: { data: Record<string, unknown> }) {
  const products = (data.top_products || []) as Record<string, unknown>[];
  if (products.length === 0) return null;

  return (
    <div className="glass-panel" style={{ padding: 'var(--space-5) var(--space-6)', marginBottom: 'var(--space-4)' }}>
      <SectionHeader icon={<ShoppingCart size={16} />} title="Top Products" />
      <ResponsiveContainer width="100%" height={Math.min(products.length * 42 + 40, 320)}>
        <BarChart data={products.slice(0, 10)} layout="vertical" margin={{ top: 4, right: 40, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `$${fmtNum(v)}`} />
          <YAxis type="category" dataKey="product_title" width={200} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [`$${fmtNum(v)}`, 'Revenue']} />
          <Bar dataKey="total_revenue" fill="#10b981" radius={[0,4,4,0]} name="Revenue" label={{ position: 'right', fill: '#94a3b8', fontSize: 11, formatter: (v: unknown) => `$${fmtNum(v)}` }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Channel Breakdown ─────────────────────────────────────────────────────────

function ChannelBreakdownSection({ data }: { data: Record<string, unknown> }) {
  const channels = (data.channels || []) as Record<string, unknown>[];
  if (channels.length === 0) return null;

  return (
    <div className="glass-panel" style={{ padding: 'var(--space-5) var(--space-6)', marginBottom: 'var(--space-4)' }}>
      <SectionHeader icon={<Globe size={16} />} title="Revenue by Channel" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 'var(--space-6)' }}>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={channels.map(c => ({ name: String(c.channel_group), value: Number(c.revenue || 0) }))}
              cx="50%" cy="50%" innerRadius={60} outerRadius={95} dataKey="value">
              {channels.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [`$${fmtNum(v)}`, 'Revenue']} />
          </PieChart>
        </ResponsiveContainer>
        <table className="data-table">
          <thead><tr><th>Channel</th><th className="text-right">Revenue</th><th className="text-right">Sessions</th></tr></thead>
          <tbody>
            {channels.map((c, i) => (
              <tr key={i}>
                <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                  {String(c.channel_group)}
                </td>
                <td className="text-right">{fmtCurrency(c.revenue)}</td>
                <td className="text-right">{fmtNum(c.sessions)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Device Breakdown ──────────────────────────────────────────────────────────

function DeviceBreakdownSection({ data }: { data: Record<string, unknown> }) {
  const devices = (data.devices || []) as Record<string, unknown>[];
  if (devices.length === 0) return null;

  return (
    <div className="glass-panel" style={{ padding: 'var(--space-5) var(--space-6)', marginBottom: 'var(--space-4)' }}>
      <SectionHeader icon={<Smartphone size={16} />} title="Revenue by Device" />
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${devices.length}, 1fr)`, gap: 'var(--space-4)' }}>
        {devices.map((d, i) => (
          <div key={i} className="stat-card" style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 'var(--space-2)', color: CHART_COLORS[i] }}>
              {String(d.device_category).toLowerCase() === 'mobile' ? <Smartphone size={20} /> : <Globe size={20} />}
            </div>
            <div className="stat-card-label">{String(d.device_category)}</div>
            <div className="stat-card-value" style={{ fontSize: '1.5rem' }}>{fmtCurrency(d.revenue)}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
              {fmtNum(d.sessions)} sessions
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Revenue by Day ────────────────────────────────────────────────────────────

function RevenueByDaySection({ data }: { data: Record<string, unknown> }) {
  const daily = (data.daily || []) as Record<string, unknown>[];
  if (daily.length === 0) return null;

  const totalRevenue = daily.reduce((s, d) => s + Number(d.revenue || 0), 0);
  const totalOrders  = daily.reduce((s, d) => s + Number(d.orders  || 0), 0);

  return (
    <div className="glass-panel" style={{ padding: 'var(--space-5) var(--space-6)', marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <SectionHeader icon={<TrendingUp size={16} />} title="Revenue by Day" inline />
        <div style={{ display: 'flex', gap: 'var(--space-6)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          <span>Total: <strong style={{ color: 'var(--text-primary)' }}>{fmtCurrency(totalRevenue)}</strong></span>
          <span>Orders: <strong style={{ color: 'var(--text-primary)' }}>{totalOrders}</strong></span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={daily} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${fmtNum(v)}`} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown, name: unknown) => [name === 'revenue' ? `$${fmtNum(v)}` : String(v), name === 'revenue' ? 'Revenue' : 'Orders']} />
          <Legend formatter={(value: string) => value === 'revenue' ? 'Revenue' : 'Orders'} wrapperStyle={{ fontSize: '0.75rem', color: '#94a3b8' }} />
          <Bar dataKey="revenue" fill="#10b981" radius={[4,4,0,0]} />
          <Bar dataKey="orders"  fill="#3b82f6" radius={[4,4,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Shared: Section Header ────────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle, color, inline }: {
  icon: React.ReactNode; title: string; subtitle?: string; color?: string; inline?: boolean;
}) {
  const style = inline ? { display: 'inline-flex' as const } : { marginBottom: 'var(--space-4)' };
  return (
    <div style={{ ...style, alignItems: 'center', gap: 'var(--space-2)' }}>
      <span style={{ color: color || 'var(--accent-primary)', display: 'flex' }}>{icon}</span>
      <div>
        <h3 className="heading-3" style={{ marginBottom: 0 }}>{title}</h3>
        {subtitle && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtNum(val: unknown): string {
  if (val === null || val === undefined) return '—';
  const n = Number(val);
  if (isNaN(n)) return String(val);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000)    return (n / 1_000).toFixed(1) + 'K';
  if (n >= 1_000)     return n.toLocaleString('en-AU');
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

function fmtCurrency(val: unknown): string {
  if (val === null || val === undefined) return '—';
  const n = Number(val);
  if (isNaN(n) || n === 0) return '—';
  return '$' + fmtNum(n);
}

function fmtPct(val: unknown): string {
  if (val === null || val === undefined) return '—';
  const n = Number(val);
  if (isNaN(n)) return '—';
  return n.toFixed(2) + '%';
}

function fmtDec(val: unknown): string {
  if (val === null || val === undefined) return '—';
  const n = Number(val);
  if (isNaN(n)) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function fmtRoas(val: unknown): string {
  if (val === null || val === undefined) return '—';
  const n = Number(val);
  if (isNaN(n) || n === 0) return '—';
  return n.toFixed(2) + 'x';
}
