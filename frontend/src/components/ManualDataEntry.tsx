'use client';

import { useState, useRef } from 'react';
import { Upload, FileText, Download, Save, Loader2, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';

interface ManualDataEntryProps {
  clientId: string;
  clientType: string;
  onSuccess?: () => void;
}

type SourceType = 'google_ads' | 'meta_ads' | 'shopify' | 'ga4';

const SOURCE_TABLES: Record<SourceType, { value: string; label: string }[]> = {
  // Google Ads: one upload type only — exact Google Ads UI export format
  google_ads: [
    { value: 'campaign_raw', label: 'Campaign Performance' },
  ],
  meta_ads: [
    { value: 'campaign',      label: 'Campaign Level' },
    { value: 'leadgen',       label: 'Lead Gen Metrics' },
    { value: 'time_segments', label: 'Day / Hour Segments' },
    { value: 'demographics',  label: 'Gender & Age' },
  ],
  shopify: [
    { value: 'orders',   label: 'Orders / Revenue' },
    { value: 'products', label: 'Top Products' },
  ],
  ga4: [
    { value: 'revenue',  label: 'Revenue Summary' },
    { value: 'channels', label: 'Revenue by Channel' },
    { value: 'devices',  label: 'Revenue by Device' },
  ],
};

// Which sources are available per client type
const TYPE_SOURCES: Record<string, SourceType[]> = {
  google_only:   ['google_ads'],
  meta_only:     ['meta_ads'],
  google_meta:   ['google_ads', 'meta_ads'],
  ecomm_shopify: ['google_ads', 'meta_ads', 'shopify'],
  ecomm_ga4:     ['google_ads', 'meta_ads', 'ga4'],
  leadgen:       ['google_ads', 'meta_ads'],
};

export default function ManualDataEntry({ clientId, clientType, onSuccess }: ManualDataEntryProps) {
  const availableSources = TYPE_SOURCES[clientType] ?? ['google_ads', 'meta_ads', 'shopify', 'ga4'];

  const [source, setSource] = useState<SourceType>(availableSources[0]);
  const [table, setTable]   = useState<string>(SOURCE_TABLES[availableSources[0]][0].value);
  const [file,  setFile]    = useState<File | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [dlLoading, setDlLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSourceChange = (s: SourceType) => {
    setSource(s);
    setTable(SOURCE_TABLES[s][0].value);
    setFile(null);
    setStatus(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setStatus(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setStatus(null);
    try {
      const result = await api.uploadCSV(clientId, source, table, file);
      if (result) {
        const skippedNote = result.rows_skipped
          ? ` (${result.rows_skipped} rows skipped)`
          : '';
        const warnNote = result.warnings?.length
          ? ` — ${result.warnings.length} warning(s)`
          : '';
        setStatus({
          type: 'success',
          message: `Imported ${result.rows_processed} rows${skippedNote}${warnNote}.`,
        });
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        onSuccess?.();
      } else {
        setStatus({ type: 'error', message: 'Upload failed. Check that column headers match the template.' });
      }
    } catch {
      setStatus({ type: 'error', message: 'Upload failed. Please verify the file format.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setDlLoading(true);
    try {
      const blob = await api.downloadCSVTemplate(source, table);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${source}_${table}_template.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setDlLoading(false);
    }
  };

  const tableOptions = SOURCE_TABLES[source];

  return (
    <div className="glass-panel" style={{ padding: 'var(--space-8)' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h3 className="heading-3" style={{ marginBottom: 'var(--space-1)' }}>Bulk Data Upload</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Select a platform, download the template to see the required columns, then upload your CSV.
          For Google Ads — upload the file directly from the UI export without renaming any columns.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 'var(--space-8)' }}>

        {/* ── Left column: source + table ── */}
        <div>
          <label className="label">1. Platform</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
            {availableSources.map(s => (
              <button
                key={s}
                onClick={() => handleSourceChange(s)}
                style={{
                  padding: 'var(--space-3)', textAlign: 'left', borderRadius: 'var(--radius-md)',
                  background: source === s ? 'var(--surface-hover)' : 'transparent',
                  border: `1px solid ${source === s ? 'var(--accent-primary)' : 'var(--surface-border)'}`,
                  color: source === s ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </button>
            ))}
          </div>

          {/* Step 2 — Data Type: only shown when multiple options exist */}
          {tableOptions.length > 1 && (
            <>
              <label className="label">2. Data Type</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
                {tableOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setTable(opt.value); setFile(null); setStatus(null); }}
                    style={{
                      padding: 'var(--space-2) var(--space-3)', textAlign: 'left',
                      borderRadius: 'var(--radius-sm)',
                      background: table === opt.value ? 'rgba(59,130,246,0.08)' : 'transparent',
                      border: `1px solid ${table === opt.value ? 'var(--accent-primary)' : 'var(--surface-border)'}`,
                      color: table === opt.value ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      fontSize: '0.8125rem', fontWeight: table === opt.value ? 600 : 400,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Google Ads: show expected column headers as a reference */}
          {source === 'google_ads' && (
            <div style={{
              marginBottom: 'var(--space-6)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(59,130,246,0.05)',
              border: '1px solid rgba(59,130,246,0.15)',
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)', marginBottom: 'var(--space-2)' }}>
                Required CSV Columns
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {[
                  'Day', 'Campaign', 'Impr.', 'Clicks', 'CTR',
                  'Currency code', 'Cost', 'Avg. CPC', 'Conversions',
                  'Cost / conv.', 'Conv. value / cost', 'Conv. value',
                  'Conv. rate', 'Avg. order value',
                ].map(col => (
                  <code key={col} style={{
                    fontSize: '0.6875rem', color: 'var(--text-secondary)',
                    background: 'var(--surface-hover)',
                    padding: '1px 6px', borderRadius: 3, width: 'fit-content',
                  }}>
                    {col}
                  </code>
                ))}
              </div>
            </div>
          )}

          <label className="label">{tableOptions.length > 1 ? '3.' : '2.'} Template</label>
          <button
            onClick={handleDownloadTemplate}
            disabled={dlLoading}
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.8125rem', border: '1px dashed var(--surface-border)' }}
          >
            {dlLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Download CSV Template
          </button>
        </div>

        {/* ── Right column: upload zone ── */}
        <div>
          <label className="label">{tableOptions.length > 1 ? '4.' : '3.'} Upload File</label>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              height: '220px', border: '2px dashed var(--surface-border)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'border-color 0.15s', background: 'rgba(255,255,255,0.01)',
            }}
            onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
            onMouseOut={e  => (e.currentTarget.style.borderColor = 'var(--surface-border)')}
          >
            <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />

            {!file ? (
              <>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.03)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-3)',
                }}>
                  <Upload size={28} color="var(--text-muted)" />
                </div>
                <span style={{ fontWeight: 500, marginBottom: 4 }}>Click to browse</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Only .CSV files accepted</span>
              </>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <FileText size={44} color="var(--accent-primary)" style={{ marginBottom: 'var(--space-2)' }} />
                <p style={{ fontWeight: 600, marginBottom: 4 }}>{file.name}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{(file.size / 1024).toFixed(1)} KB</p>
                <button
                  onClick={e => { e.stopPropagation(); setFile(null); }}
                  className="btn btn-sm"
                  style={{ marginTop: 'var(--space-3)', color: 'var(--status-error)' }}
                >
                  <Trash2 size={13} /> Remove
                </button>
              </div>
            )}
          </div>

          <div style={{ marginTop: 'var(--space-5)', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className="btn btn-primary"
              style={{ minWidth: 160 }}
            >
              {loading
                ? <Loader2 className="animate-spin" size={16} />
                : <><Save size={16} /> Ingest Data</>}
            </button>
          </div>

          {status && (
            <div style={{
              marginTop: 'var(--space-5)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)',
              background: status.type === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
              color: status.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
              fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
              border: `1px solid ${status.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}>
              {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {status.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
