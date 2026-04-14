'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Calendar, CheckCircle, AlertCircle, Loader2,
  DollarSign, MousePointerClick, Eye, TrendingUp, ShoppingCart,
  Users, BarChart3, Globe, Smartphone, LayoutGrid
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

export default function ReportViewPage() {
  const params = useParams();
  const reportId = params?.id as string;

  const [report, setReport] = useState<Report | undefined>();
  const [client, setClient] = useState<Client | undefined>();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('cross_platform');

  useEffect(() => {
    if (reportId) loadReport();
  }, [reportId]);

  async function loadReport() {
    setLoading(true);
    const data = await api.getReport(reportId);
    if (data) {
      setReport(data);
      const c = await api.getClient(data.client_id);
      setClient(c);

      // Set initial tab to first available source
      const sources = Array.from(new Set(data.sections.map(s => s.source)));
      if (sources.includes('cross_platform')) {
        setActiveTab('cross_platform');
      } else if (sources.length > 0) {
        setActiveTab(sources[0]);
      }
    }
    setLoading(false);
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
    new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div style={{ padding: 'var(--space-8) var(--space-10)' }}>
      {/* Back + Header */}
      <Link href="/reports" className="btn btn-ghost" style={{ marginBottom: 'var(--space-4)', display: 'inline-flex' }}>
        <ArrowLeft size={16} /> Back to Reports
      </Link>

      <div className="glass-panel" style={{ padding: 'var(--space-6) var(--space-8)', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
              <h1 className="heading-1" style={{ marginBottom: 0 }}>
                <span className="text-gradient">
                  {report.report_type === 'weekly' ? 'Weekly' : 'Monthly'} Report
                </span>
              </h1>
              <div className="badge" style={{
                background: report.status === 'ready' ? 'var(--status-success-bg)' : 'var(--status-error-bg)',
                color: report.status === 'ready' ? 'var(--status-success)' : 'var(--status-error)',
              }}>
                {report.status === 'ready' ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
                {report.status}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-6)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Users size={14} /> {client?.name || 'Unknown Client'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Calendar size={14} /> {formatDate(report.period_start)} — {formatDate(report.period_end)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Source Tabs */}
      <div style={{
        display: 'flex', gap: '0.375rem',
        marginBottom: 'var(--space-6)',
        overflowX: 'auto',
        padding: 'var(--space-1)',
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--surface-border)',
      }}>
        {sources.map(source => (
          <button
            key={source}
            onClick={() => setActiveTab(source)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem',
              fontWeight: activeTab === source ? 600 : 400,
              background: activeTab === source ? `${SOURCE_COLORS[source]}20` : 'transparent',
              color: activeTab === source ? SOURCE_COLORS[source] : 'var(--text-secondary)',
              border: activeTab === source ? `1px solid ${SOURCE_COLORS[source]}33` : '1px solid transparent',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
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

// ── Section Renderer ────────────────────────────────────────────────────

function SectionRenderer({ section }: { section: ReportSection }) {
  const data = section.data as Record<string, unknown>;

  switch (section.section_type) {
    case 'summary':
      return <SummarySection data={data} source={section.source} />;
    case 'campaign_breakdown':
      return <CampaignBreakdownSection data={data} />;
    case 'search_terms':
      return <TableSection title="Top Search Terms" rows={(data.search_terms as Record<string, unknown>[]) || []} />;
    case 'keywords':
      return <TableSection title="Top Keywords" rows={(data.keywords as Record<string, unknown>[]) || []} />;
    case 'time_segments':
      return <TimeSegmentsSection data={data} />;
    case 'demographics':
      return <DemographicsSection data={data} />;
    case 'leadgen':
      return <LeadgenSection data={data} />;
    case 'products':
      return <ProductsSection data={data} />;
    case 'channel_breakdown':
      return <ChannelBreakdownSection data={data} />;
    case 'device_breakdown':
      return <DeviceBreakdownSection data={data} />;
    case 'revenue_by_day':
      return <RevenueByDaySection data={data} />;
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

// ── Summary KPI Cards ──────────────────────────────────────────────────

function SummarySection({ data, source }: { data: Record<string, unknown>; source: string }) {
  const summary = (data.summary || data) as Record<string, string>;
  const growth = (summary.growth || data.growth || {}) as Record<string, string>;
  const color = SOURCE_COLORS[source] || 'var(--accent-blue)';

  const kpis: { label: string; value: string; change?: string; prefix?: string; suffix?: string; icon: React.ReactNode }[] = [];

  if (summary.spend || summary.total_spend) {
    kpis.push({ label: 'Total Spend', value: formatNum(summary.spend || summary.total_spend), prefix: '$', change: growth.spend_growth, icon: <DollarSign size={16} color={color} /> });
  }
  if (summary.total_revenue || summary.purchase_revenue) {
    kpis.push({ label: 'Revenue', value: formatNum(summary.total_revenue || summary.purchase_revenue), prefix: '$', change: growth.revenue_growth, icon: <TrendingUp size={16} color={color} /> });
  }
  if (summary.impressions) {
    kpis.push({ label: 'Impressions', value: formatNum(summary.impressions), change: growth.impressions_growth, icon: <Eye size={16} color={color} /> });
  }
  if (summary.clicks) {
    kpis.push({ label: 'Clicks', value: formatNum(summary.clicks), change: growth.clicks_growth, icon: <MousePointerClick size={16} color={color} /> });
  }
  if (summary.conversions || summary.total_conversions) {
    kpis.push({ label: 'Conversions', value: formatNum(summary.conversions || summary.total_conversions), change: growth.conversions_growth, icon: <ShoppingCart size={16} color={color} /> });
  }
  if (summary.blended_roas || summary.roas) {
    kpis.push({ label: 'ROAS', value: parseFloat(summary.blended_roas || summary.roas || '0').toFixed(2), suffix: 'x', change: growth.roas_growth, icon: <BarChart3 size={16} color={color} /> });
  }
  if (summary.total_orders !== undefined) {
    kpis.push({ label: 'Orders', value: formatNum(summary.total_orders), change: growth.orders_growth, icon: <ShoppingCart size={16} color={color} /> });
  }
  if (summary.avg_order_value) {
    kpis.push({ label: 'Avg Order Value', value: parseFloat(summary.avg_order_value).toFixed(2), prefix: '$', icon: <DollarSign size={16} color={color} /> });
  }
  if (summary.sessions) {
    kpis.push({ label: 'Sessions', value: formatNum(summary.sessions), icon: <Globe size={16} color={color} /> });
  }
  if (summary.ctr) {
    kpis.push({ label: 'CTR', value: parseFloat(summary.ctr).toFixed(2), suffix: '%', change: growth.ctr_growth, icon: <MousePointerClick size={16} color={color} /> });
  }
  if (summary.cpc) {
    kpis.push({ label: 'CPC', value: parseFloat(summary.cpc).toFixed(2), prefix: '$', change: growth.cpc_growth, icon: <DollarSign size={16} color={color} /> });
  }
  if (summary.conversion_rate) {
    kpis.push({ label: 'Conv. Rate', value: parseFloat(summary.conversion_rate).toFixed(2), suffix: '%', change: growth.conversion_rate_growth, icon: <TrendingUp size={16} color={color} /> });
  }
  if (summary.reach) {
    kpis.push({ label: 'Reach', value: formatNum(summary.reach), change: growth.reach_growth, icon: <Users size={16} color={color} /> });
  }
  if (summary.frequency) {
    kpis.push({ label: 'Frequency', value: parseFloat(summary.frequency).toFixed(2), change: growth.frequency_growth, icon: <Eye size={16} color={color} /> });
  }
  if (summary.cpm) {
    kpis.push({ label: 'CPM', value: parseFloat(summary.cpm).toFixed(2), prefix: '$', change: growth.cpm_growth, icon: <DollarSign size={16} color={color} /> });
  }
  if (summary.session_conversion_rate) {
    kpis.push({ label: 'Session Conv. Rate', value: (parseFloat(summary.session_conversion_rate) * 100).toFixed(2), suffix: '%', icon: <TrendingUp size={16} color={color} /> });
  }
  if (summary.active_users) {
    kpis.push({ label: 'Active Users', value: formatNum(summary.active_users), icon: <Users size={16} color={color} /> });
  }

  if (kpis.length === 0) return null;

  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      <h3 className="heading-3" style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <LayoutGrid size={16} /> Performance Summary
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(kpis.length, 4)}, 1fr)`, gap: 'var(--space-4)' }}>
        {kpis.map((kpi, i) => (
          <KPICard
            key={i}
            label={kpi.label}
            value={kpi.value}
            change={kpi.change}
            prefix={kpi.prefix}
            suffix={kpi.suffix}
            icon={kpi.icon}
            accentColor={color}
          />
        ))}
      </div>

      {/* Platforms active badge (cross-platform) */}
      {Array.isArray(data.platforms_active) && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
          {(data.platforms_active as string[]).map((p: string) => (
            <span key={p} className="badge" style={{
              background: `${SOURCE_COLORS[p]}15`,
              color: SOURCE_COLORS[p],
              border: `1px solid ${SOURCE_COLORS[p]}30`,
            }}>
              {SOURCE_LABELS[p] || p}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Campaign Breakdown ─────────────────────────────────────────────────

function CampaignBreakdownSection({ data }: { data: Record<string, unknown> }) {
  const campaigns = (data.campaigns || []) as Record<string, unknown>[];
  if (campaigns.length === 0) return null;

  return (
    <div className="glass-panel" style={{ padding: 'var(--space-5) var(--space-6)', marginBottom: 'var(--space-4)', overflow: 'hidden' }}>
      <h3 className="heading-3" style={{ marginBottom: 'var(--space-4)' }}>Campaign Breakdown</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Impressions</th>
              <th>Clicks</th>
              <th>Spend</th>
              <th>CTR</th>
              <th>Conv.</th>
              <th>ROAS</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.slice(0, 20).map((c, i) => (
              <tr key={i} style={{ opacity: 0, animation: `fadeIn 0.25s ease-out ${i * 30}ms forwards` }}>
                <td style={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {String(c.campaign_name || '-')}
                </td>
                <td>{formatNum(c.impressions)}</td>
                <td>{formatNum(c.clicks)}</td>
                <td>${formatNum(c.spend)}</td>
                <td>{parseFloat(String(c.ctr || '0')).toFixed(2)}%</td>
                <td>{formatNum(c.conversions)}</td>
                <td>{c.roas ? parseFloat(String(c.roas)).toFixed(2) + 'x' : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Generic Table Section ──────────────────────────────────────────────

function TableSection({ title, rows }: { title: string; rows: Record<string, unknown>[] }) {
  if (rows.length === 0) return null;
  const keys = Object.keys(rows[0]).filter(k => k !== 'report_date');

  return (
    <div className="glass-panel" style={{ padding: 'var(--space-5) var(--space-6)', marginBottom: 'var(--space-4)', overflow: 'hidden' }}>
      <h3 className="heading-3" style={{ marginBottom: 'var(--space-4)' }}>{title}</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              {keys.map(k => <th key={k}>{k.replace(/_/g, ' ')}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {keys.map(k => <td key={k}>{formatVal(row[k])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Time Segments (Bar Chart) ──────────────────────────────────────────

function TimeSegmentsSection({ data }: { data: Record<string, unknown> }) {
  const dayData = (data.day_of_week || data.day || []) as Record<string, unknown>[];
  const hourData = (data.hour_of_day || data.hour || []) as Record<string, unknown>[];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
      {dayData.length > 0 && (
        <div className="glass-panel" style={{ padding: 'var(--space-5) var(--space-6)' }}>
          <h3 className="heading-3" style={{ marginBottom: 'var(--space-4)' }}>Day of Week</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="segment_value" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar dataKey="clicks" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {hourData.length > 0 && (
        <div className="glass-panel" style={{ padding: 'var(--space-5) var(--space-6)' }}>
          <h3 className="heading-3" style={{ marginBottom: 'var(--space-4)' }}>Hour of Day</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={hourData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="segment_value" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="clicks" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Demographics (Pie Chart) ───────────────────────────────────────────

function DemographicsSection({ data }: { data: Record<string, unknown> }) {
  const demos = (data.demographics || []) as Record<string, unknown>[];
  if (demos.length === 0) return null;

  // Aggregate by gender
  const genderMap: Record<string, number> = {};
  demos.forEach(d => {
    const g = String(d.gender || 'Unknown');
    genderMap[g] = (genderMap[g] || 0) + Number(d.impressions || 0);
  });
  const genderData = Object.entries(genderMap).map(([name, value]) => ({ name, value }));

  // Aggregate by age
  const ageMap: Record<string, number> = {};
  demos.forEach(d => {
    const a = String(d.age_range || d.age_group || 'Unknown');
    ageMap[a] = (ageMap[a] || 0) + Number(d.impressions || 0);
  });
  const ageData = Object.entries(ageMap).map(([name, value]) => ({ name, value }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
      <div className="glass-panel" style={{ padding: 'var(--space-5) var(--space-6)' }}>
        <h3 className="heading-3" style={{ marginBottom: 'var(--space-4)' }}>Gender Distribution</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={genderData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={(e) => e.name}>
              {genderData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip {...TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="glass-panel" style={{ padding: 'var(--space-5) var(--space-6)' }}>
        <h3 className="heading-3" style={{ marginBottom: 'var(--space-4)' }}>Age Distribution</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={ageData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Lead Gen ───────────────────────────────────────────────────────────

function LeadgenSection({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="glass-panel" style={{ padding: 'var(--space-5) var(--space-6)', marginBottom: 'var(--space-4)' }}>
      <h3 className="heading-3" style={{ marginBottom: 'var(--space-4)' }}>Lead Generation</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <KPICard label="Total Leads" value={formatNum(data.total_leads)} accentColor="#8b5cf6" />
        <KPICard label="Avg CPL" value={formatNum(data.avg_cpl)} prefix="$" accentColor="#8b5cf6" />
        <KPICard label="Campaigns" value={String((data.leadgen as unknown[])?.length || 0)} accentColor="#8b5cf6" />
      </div>
      <TableSection title="" rows={(data.leadgen as Record<string, unknown>[]) || []} />
    </div>
  );
}

// ── Products ───────────────────────────────────────────────────────────

function ProductsSection({ data }: { data: Record<string, unknown> }) {
  const products = (data.top_products || []) as Record<string, unknown>[];
  if (products.length === 0) return null;

  return (
    <div className="glass-panel" style={{ padding: 'var(--space-5) var(--space-6)', marginBottom: 'var(--space-4)' }}>
      <h3 className="heading-3" style={{ marginBottom: 'var(--space-4)' }}>Top Products</h3>
      <ResponsiveContainer width="100%" height={Math.min(products.length * 40 + 40, 300)}>
        <BarChart data={products.slice(0, 10)} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="product_title" width={180} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip {...TOOLTIP_STYLE} />
          <Bar dataKey="total_revenue" fill="#10b981" radius={[0, 4, 4, 0]} name="Revenue" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Channel Breakdown ──────────────────────────────────────────────────

function ChannelBreakdownSection({ data }: { data: Record<string, unknown> }) {
  const channels = (data.channels || []) as Record<string, unknown>[];
  if (channels.length === 0) return null;

  return (
    <div className="glass-panel" style={{ padding: 'var(--space-5) var(--space-6)', marginBottom: 'var(--space-4)' }}>
      <h3 className="heading-3" style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <Globe size={16} /> Revenue by Channel
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={channels.map(c => ({ name: String(c.channel_group), value: Number(c.revenue || 0) }))} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" label={(e) => e.name}>
              {channels.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip {...TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
        <table className="data-table">
          <thead><tr><th>Channel</th><th>Revenue</th><th>Sessions</th></tr></thead>
          <tbody>
            {channels.map((c, i) => (
              <tr key={i}>
                <td style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  {String(c.channel_group)}
                </td>
                <td>${formatNum(c.revenue)}</td>
                <td>{formatNum(c.sessions)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Device Breakdown ───────────────────────────────────────────────────

function DeviceBreakdownSection({ data }: { data: Record<string, unknown> }) {
  const devices = (data.devices || []) as Record<string, unknown>[];
  if (devices.length === 0) return null;

  const deviceIcons: Record<string, React.ReactNode> = {
    desktop: <Globe size={14} />,
    mobile: <Smartphone size={14} />,
    tablet: <LayoutGrid size={14} />,
  };

  return (
    <div className="glass-panel" style={{ padding: 'var(--space-5) var(--space-6)', marginBottom: 'var(--space-4)' }}>
      <h3 className="heading-3" style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <Smartphone size={16} /> Revenue by Device
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${devices.length}, 1fr)`, gap: 'var(--space-4)' }}>
        {devices.map((d, i) => (
          <div key={i} className="stat-card" style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 'var(--space-2)', color: CHART_COLORS[i] }}>
              {(deviceIcons[String(d.device_category).toLowerCase()] ?? <Globe size={14} />)}
            </div>
            <div className="stat-card-label">{String(d.device_category)}</div>
            <div className="stat-card-value" style={{ fontSize: '1.5rem' }}>${formatNum(d.revenue)}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
              {formatNum(d.sessions)} sessions
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Revenue by Day ─────────────────────────────────────────────────────

function RevenueByDaySection({ data }: { data: Record<string, unknown> }) {
  const daily = (data.daily || []) as Record<string, unknown>[];
  if (daily.length === 0) return null;

  const totalRevenue = daily.reduce((sum, d) => sum + Number(d.revenue || 0), 0);
  const totalOrders = daily.reduce((sum, d) => sum + Number(d.orders || 0), 0);

  return (
    <div className="glass-panel" style={{ padding: 'var(--space-5) var(--space-6)', marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h3 className="heading-3">Revenue by Day</h3>
        <div style={{ display: 'flex', gap: 'var(--space-6)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          <span>Total: <strong style={{ color: 'var(--text-primary)' }}>${formatNum(totalRevenue)}</strong></span>
          <span>Orders: <strong style={{ color: 'var(--text-primary)' }}>{totalOrders}</strong></span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={daily} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `$${formatNum(v)}`}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(v: unknown, name: string) => [
              name === 'revenue' ? `$${formatNum(v)}` : String(v),
              name === 'revenue' ? 'Revenue' : 'Orders',
            ]}
          />
          <Legend
            formatter={(value: string) => value === 'revenue' ? 'Revenue' : 'Orders'}
            wrapperStyle={{ fontSize: '0.75rem', color: '#94a3b8' }}
          />
          <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────

function formatNum(val: unknown): string {
  if (val === null || val === undefined) return '0';
  const n = Number(val);
  if (isNaN(n)) return String(val);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(2);
}

function formatVal(val: unknown): string {
  if (val === null || val === undefined) return '-';
  if (typeof val === 'number') return formatNum(val);
  return String(val);
}
