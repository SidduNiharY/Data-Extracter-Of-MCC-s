'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronRight, ChevronLeft, CheckCircle2, Loader2,
  Download, Upload, AlertCircle, TrendingUp, ShoppingBag,
  BarChart2, Target, X,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Platform, Client, CsvTemplateInfo } from '@/types';

// ─────────────────────────────────────────────────────────────
// Platform metadata
// ─────────────────────────────────────────────────────────────

const PLATFORM_META: Record<Platform, { label: string; icon: React.ReactNode; color: string; idLabel: string; idPlaceholder: string }> = {
  google_ads: {
    label: 'Google Ads',
    icon: <TrendingUp size={22} />,
    color: 'var(--status-info)',
    idLabel: 'Google Ads Customer ID',
    idPlaceholder: 'e.g. 123-456-7890',
  },
  meta_ads: {
    label: 'Meta Ads',
    icon: <Target size={22} />,
    color: '#1877F2',
    idLabel: 'Meta Ad Account ID',
    idPlaceholder: 'e.g. act_123456789',
  },
  shopify: {
    label: 'Shopify',
    icon: <ShoppingBag size={22} />,
    color: '#95BF47',
    idLabel: 'Shop Domain',
    idPlaceholder: 'e.g. my-store.myshopify.com',
  },
  ga4: {
    label: 'Google Analytics 4',
    icon: <BarChart2 size={22} />,
    color: '#F9AB00',
    idLabel: 'GA4 Property ID',
    idPlaceholder: 'e.g. 123456789',
  },
};

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

interface UploadCard {
  source: string;
  table: string;
  label: string;
  state: UploadState;
  rowsProcessed?: number;
  error?: string;    // on 'error' state: failure reason; on 'done' state: skipped rows note
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export default function CreateClientPage() {
  const router = useRouter();

  // Step 1 state
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [isLeadgen, setIsLeadgen] = useState(false);

  // Step 2 state
  const [ids, setIds] = useState<Record<Platform, string>>({
    google_ads: '', meta_ads: '', shopify: '', ga4: '',
  });

  // Step 3 state
  const [dataSource, setDataSource] = useState<'api' | 'csv'>('api');

  // Post-creation state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [createdClient, setCreatedClient] = useState<Client | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [templates, setTemplates] = useState<CsvTemplateInfo[]>([]);
  const [uploadCards, setUploadCards] = useState<UploadCard[]>([]);
  const [creating, setCreating] = useState(false);
  const [triggeringPull, setTriggeringPull] = useState(false);
  const [error, setError] = useState('');

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── Helpers ─────────────────────────────────────────────────

  const togglePlatform = (p: Platform) => {
    setPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const canProceedStep1 = name.trim().length > 0 && platforms.length > 0;

  const canProceedStep2 = platforms.every(p => ids[p].trim().length > 0);

  // ── Step navigation ──────────────────────────────────────────

  const goToStep2 = () => {
    if (!canProceedStep1) return;
    setStep(2);
  };

  const goToStep3 = () => {
    if (!canProceedStep2) return;
    setStep(3);
  };

  // ── Create client ─────────────────────────────────────────────

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      const client = await api.createClient({
        name: name.trim(),
        platforms,
        is_leadgen: isLeadgen,
        google_ads_customer_id: ids.google_ads || undefined,
        meta_ad_account_id: ids.meta_ads || undefined,
        shopify_shop_domain: ids.shopify || undefined,
        ga4_property_id: ids.ga4 || undefined,
        currency,
        timezone: 'UTC',
      });

      if (!client) throw new Error('Server returned no data');

      setCreatedClient(client);

      if (dataSource === 'csv') {
        // Fetch templates for this client type
        const tpls = await api.getCSVTemplates(client.type);
        setTemplates(tpls);
        setUploadCards(tpls.map(t => ({
          source: t.source,
          table: t.table,
          label: t.label,
          state: 'idle',
        })));
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Failed to create account');
    } finally {
      setCreating(false);
    }
  };

  const handleTriggerPull = async () => {
    if (!createdClient) return;
    setTriggeringPull(true);
    await api.triggerPull(createdClient.id);
    setTimeout(() => router.push(`/clients/${createdClient.id}`), 1200);
  };

  // ── CSV download ──────────────────────────────────────────────

  const handleDownloadTemplate = async (source: string, table: string) => {
    const blob = await api.downloadCSVTemplate(source, table);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${source}_${table}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── CSV upload ────────────────────────────────────────────────

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    source: string,
    table: string,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !createdClient) return;

    setUploadCards(prev =>
      prev.map(c =>
        c.source === source && c.table === table
          ? { ...c, state: 'uploading', error: undefined }
          : c
      )
    );

    const result = await api.uploadCSV(createdClient.id, source, table, file);

    setUploadCards(prev =>
      prev.map(c =>
        c.source === source && c.table === table
          ? result
            ? {
                ...c,
                state: 'done',
                rowsProcessed: result.rows_processed,
                error: result.rows_skipped
                  ? `${result.rows_skipped} rows skipped (totals / blank dates)`
                  : undefined,
              }
            : { ...c, state: 'error', error: 'Upload failed — check column headers match the template' }
          : c
      )
    );

    // Reset file input
    const key = `${source}_${table}`;
    if (fileInputRefs.current[key]) {
      fileInputRefs.current[key]!.value = '';
    }
  };

  const allUploaded = uploadCards.length > 0 &&
    uploadCards.every(c => c.state === 'done');

  // ─────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────

  const stepDot = (n: number) => (
    <div style={{
      width: 28, height: 28, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.8125rem', fontWeight: 700,
      background: step === n ? 'var(--accent-primary)' : step > n ? 'var(--status-success)' : 'var(--surface-hover)',
      color: step >= n ? '#fff' : 'var(--text-muted)',
      flexShrink: 0,
    }}>
      {step > n ? <CheckCircle2 size={14} /> : n}
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // STEP 1 — Name & Platforms
  // ─────────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div>
      <h2 className="heading-2" style={{ marginBottom: 'var(--space-6)' }}>
        Select Platforms
      </h2>

      {/* Client Name */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 600, fontSize: '0.875rem' }}>
          Account Name *
        </label>
        <input
          className="input"
          type="text"
          placeholder="e.g. Acme Corp — Spring 2024"
          value={name}
          onChange={e => setName(e.target.value)}
          style={{ width: '100%', maxWidth: 420 }}
        />
      </div>

      {/* Platform selection */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--space-3)', fontWeight: 600, fontSize: '0.875rem' }}>
          Platforms * <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(select all that apply)</span>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
          {(Object.entries(PLATFORM_META) as [Platform, typeof PLATFORM_META[Platform]][]).map(([key, meta]) => {
            const active = platforms.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => togglePlatform(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${active ? meta.color : 'var(--surface-border)'}`,
                  background: active ? `${meta.color}18` : 'var(--surface-secondary)',
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                }}
              >
                <span style={{ color: active ? meta.color : 'var(--text-muted)' }}>{meta.icon}</span>
                <span style={{ fontWeight: 600, fontSize: '0.875rem', color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {meta.label}
                </span>
                {active && <CheckCircle2 size={14} style={{ marginLeft: 'auto', color: meta.color }} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* LeadGen toggle — only shown when Meta is selected */}
      {platforms.includes('meta_ads') && platforms.includes('google_ads') && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            cursor: 'pointer', width: 'fit-content',
          }}>
            <input
              type="checkbox"
              checked={isLeadgen}
              onChange={e => setIsLeadgen(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--accent-primary)' }}
            />
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
              This is a Lead Generation account (Meta lead forms + Google lead conversions)
            </span>
          </label>
        </div>
      )}

      {/* Currency */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 600, fontSize: '0.875rem' }}>
          Currency
        </label>
        <select
          className="input"
          value={currency}
          onChange={e => setCurrency(e.target.value)}
          style={{ width: 160 }}
        >
          {['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'INR', 'SGD'].map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <button
        className="btn btn-primary"
        onClick={goToStep2}
        disabled={!canProceedStep1}
      >
        Next — Enter Account IDs <ChevronRight size={16} />
      </button>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // STEP 2 — Account IDs
  // ─────────────────────────────────────────────────────────────

  const renderStep2 = () => (
    <div>
      <h2 className="heading-2" style={{ marginBottom: 'var(--space-2)' }}>
        Enter Account IDs
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)', fontSize: '0.9rem' }}>
        These IDs are used to fetch data via the API and to tag uploaded CSV data.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', marginBottom: 'var(--space-8)' }}>
        {platforms.map(p => {
          const meta = PLATFORM_META[p];
          return (
            <div key={p} className="glass-panel" style={{ padding: 'var(--space-5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <span style={{ color: meta.color }}>{meta.icon}</span>
                <span style={{ fontWeight: 700 }}>{meta.label}</span>
              </div>
              <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                {meta.idLabel} *
              </label>
              <input
                className="input"
                type="text"
                placeholder={meta.idPlaceholder}
                value={ids[p]}
                onChange={e => setIds(prev => ({ ...prev, [p]: e.target.value }))}
                style={{ width: '100%', maxWidth: 380 }}
              />
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <button className="btn btn-ghost" onClick={() => setStep(1)}>
          <ChevronLeft size={16} /> Back
        </button>
        <button
          className="btn btn-primary"
          onClick={goToStep3}
          disabled={!canProceedStep2}
        >
          Next — Choose Data Source <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // STEP 3 — Data source + create
  // ─────────────────────────────────────────────────────────────

  const renderStep3 = () => (
    <div>
      <h2 className="heading-2" style={{ marginBottom: 'var(--space-2)' }}>
        Choose Data Source
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)', fontSize: '0.9rem' }}>
        How do you want to bring in raw data for this account?
      </p>

      {/* Data source cards */}
      {!createdClient && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-8)', maxWidth: 560 }}>
            {/* API */}
            <button
              type="button"
              onClick={() => setDataSource('api')}
              style={{
                padding: 'var(--space-5)',
                borderRadius: 'var(--radius-md)',
                border: `2px solid ${dataSource === 'api' ? 'var(--accent-primary)' : 'var(--surface-border)'}`,
                background: dataSource === 'api' ? 'var(--accent-primary)18' : 'var(--surface-secondary)',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <TrendingUp size={24} style={{ color: dataSource === 'api' ? 'var(--accent-primary)' : 'var(--text-muted)', marginBottom: 'var(--space-2)' }} />
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Fetch via API</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Pull live data automatically using your connected platform credentials.
              </div>
            </button>

            {/* CSV */}
            <button
              type="button"
              onClick={() => setDataSource('csv')}
              style={{
                padding: 'var(--space-5)',
                borderRadius: 'var(--radius-md)',
                border: `2px solid ${dataSource === 'csv' ? 'var(--accent-primary)' : 'var(--surface-border)'}`,
                background: dataSource === 'csv' ? 'var(--accent-primary)18' : 'var(--surface-secondary)',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <Upload size={24} style={{ color: dataSource === 'csv' ? 'var(--accent-primary)' : 'var(--text-muted)', marginBottom: 'var(--space-2)' }} />
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Upload CSV</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Manually upload pre-exported data using provided templates.
              </div>
            </button>
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--status-error)', marginBottom: 'var(--space-4)', fontSize: '0.875rem' }}>
              <AlertCircle size={16} />{error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button className="btn btn-ghost" onClick={() => setStep(2)}>
              <ChevronLeft size={16} /> Back
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Create Account
            </button>
          </div>
        </>
      )}

      {/* ── After client is created ── */}
      {createdClient && (
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            color: 'var(--status-success)', marginBottom: 'var(--space-6)',
            fontWeight: 600,
          }}>
            <CheckCircle2 size={18} />
            Account <strong>{createdClient.name}</strong> created successfully!
          </div>

          {/* API mode — just trigger pull */}
          {dataSource === 'api' && (
            <div className="glass-panel" style={{ padding: 'var(--space-6)', maxWidth: 480, marginBottom: 'var(--space-6)' }}>
              <p style={{ marginBottom: 'var(--space-4)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Click below to queue a data pull from all connected platforms using your <code>.env</code> credentials.
              </p>
              <button
                className="btn btn-primary"
                onClick={handleTriggerPull}
                disabled={triggeringPull}
              >
                {triggeringPull
                  ? <><Loader2 size={16} className="animate-spin" /> Queuing Pull…</>
                  : <><TrendingUp size={16} /> Fetch Data Now</>
                }
              </button>
            </div>
          )}

          {/* CSV mode — upload cards */}
          {dataSource === 'csv' && (
            <div>
              <p style={{ marginBottom: 'var(--space-5)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Download each template, fill it with your data, then upload it below.
                The columns match the exact spec from the Metrics Specification document.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                {uploadCards.map(card => {
                  const key = `${card.source}_${card.table}`;
                  return (
                    <div
                      key={key}
                      className="glass-panel"
                      style={{
                        padding: 'var(--space-5)',
                        borderLeft: `3px solid ${
                          card.state === 'done'  ? 'var(--status-success)' :
                          card.state === 'error' ? 'var(--status-error)'   :
                          'var(--surface-border)'
                        }`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                        {/* Label + status */}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>{card.label}</div>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                            {card.source} / {card.table}
                          </div>
                          {card.state === 'done' && (
                            <div style={{ marginTop: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--status-success)', fontSize: '0.8125rem' }}>
                                <CheckCircle2 size={13} /> {card.rowsProcessed} rows imported
                              </div>
                              {card.error && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2 }}>
                                  <AlertCircle size={11} /> {card.error}
                                </div>
                              )}
                            </div>
                          )}
                          {card.state === 'error' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--status-error)', fontSize: '0.8125rem', marginTop: 4 }}>
                              <AlertCircle size={13} /> {card.error}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                          {/* Download template */}
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleDownloadTemplate(card.source, card.table)}
                            title="Download CSV template"
                          >
                            <Download size={14} /> Template
                          </button>

                          {/* Upload file */}
                          {card.state !== 'done' && (
                            <>
                              <input
                                type="file"
                                accept=".csv"
                                ref={el => { fileInputRefs.current[key] = el; }}
                                style={{ display: 'none' }}
                                onChange={e => handleFileSelect(e, card.source, card.table)}
                              />
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => fileInputRefs.current[key]?.click()}
                                disabled={card.state === 'uploading'}
                              >
                                {card.state === 'uploading'
                                  ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                                  : <><Upload size={14} /> Upload CSV</>
                                }
                              </button>
                            </>
                          )}

                          {/* Re-upload on done */}
                          {card.state === 'done' && (
                            <>
                              <input
                                type="file"
                                accept=".csv"
                                ref={el => { fileInputRefs.current[key] = el; }}
                                style={{ display: 'none' }}
                                onChange={e => handleFileSelect(e, card.source, card.table)}
                              />
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => fileInputRefs.current[key]?.click()}
                                title="Replace with a new file"
                              >
                                <Upload size={14} /> Re-upload
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                className="btn btn-primary"
                onClick={() => router.push(`/clients/${createdClient.id}`)}
              >
                Go to Client Dashboard <ChevronRight size={16} />
              </button>
              {!allUploaded && (
                <p style={{ marginTop: 'var(--space-3)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  You can skip any templates now and upload them later from the client page.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // Page layout
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="fade-in" style={{ maxWidth: 760, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-8)' }}>
        <div>
          <h1 className="heading-1" style={{ marginBottom: 'var(--space-1)' }}>Create New Account</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
            Set up a client account for any platform combination
          </p>
        </div>
        <button className="btn btn-ghost" onClick={() => router.push('/clients')}>
          <X size={16} /> Cancel
        </button>
      </div>

      {/* Step indicators */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-8)' }}>
        {stepDot(1)}
        <span style={{ fontSize: '0.875rem', fontWeight: step === 1 ? 700 : 400, color: step === 1 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          Platforms
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--surface-border)' }} />
        {stepDot(2)}
        <span style={{ fontSize: '0.875rem', fontWeight: step === 2 ? 700 : 400, color: step === 2 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          Account IDs
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--surface-border)' }} />
        {stepDot(3)}
        <span style={{ fontSize: '0.875rem', fontWeight: step === 3 ? 700 : 400, color: step === 3 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          Data Source
        </span>
      </div>

      {/* Step content */}
      <div className="glass-panel" style={{ padding: 'var(--space-8)' }}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </div>

      {/* Bottom hint — client type preview */}
      {step < 3 && platforms.length > 0 && (
        <div style={{ marginTop: 'var(--space-4)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Derived account type: <strong style={{ color: 'var(--text-secondary)' }}>
            {deriveClientTypeLabel(platforms, isLeadgen)}
          </strong>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helper — label from platforms (mirrors backend logic)
// ─────────────────────────────────────────────────────────────

function deriveClientTypeLabel(platforms: Platform[], isLeadgen: boolean): string {
  const g = platforms.includes('google_ads');
  const m = platforms.includes('meta_ads');
  const s = platforms.includes('shopify');
  const a = platforms.includes('ga4');

  if (g && m && s) return 'Ecomm + Shopify';
  if (g && m && a) return 'Ecomm + GA4';
  if (g && m && isLeadgen) return 'Lead Gen';
  if (g && m) return 'Google + Meta';
  if (g) return 'Google Ads Only';
  if (m) return 'Meta Ads Only';
  if (s) return 'Ecomm + Shopify';
  if (a) return 'Ecomm + GA4';
  return '—';
}
