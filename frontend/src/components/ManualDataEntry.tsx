'use client';

import { useState, useRef } from 'react';
import { Upload, FileText, Download, Save, Loader2, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';

interface ManualDataEntryProps {
  clientId: string;
  onSuccess?: () => void;
}

type SourceType = 'google_ads' | 'meta_ads' | 'shopify';

export default function ManualDataEntry({ clientId, onSuccess }: ManualDataEntryProps) {
  const [source, setSource] = useState<SourceType>('google_ads');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setLoading(true);
    setStatus(null);

    try {
      const result = await api.uploadCSV(clientId, source, file);
      setStatus({ 
        type: 'success', 
        message: `Successfully uploaded ${result.rows_processed} rows of ${source.replace('_', ' ')} data from ${file.name}.` 
      });
      setFile(null);
      if (onSuccess) onSuccess();
    } catch (err) {
      setStatus({ type: 'error', message: 'Failed to upload CSV. Please verify the headers matches the template.' });
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    let headers = '';
    if (source === 'google_ads') {
      headers = 'Date,Campaign,Impressions,Clicks,Spend,Conversions,Conv_Value,Impression_Share';
    } else if (source === 'meta_ads') {
      headers = 'Date,Campaign,Impressions,Clicks,Spend,Conversions,Reach,Frequency';
    } else if (source === 'shopify') {
      headers = 'Date,Total_Price,Order_ID,New_Customer';
    }

    const blob = new Blob([headers], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${source}_template.csv`;
    a.click();
  };

  return (
    <div className="glass-panel" style={{ padding: 'var(--space-8)' }}>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h3 className="heading-3" style={{ marginBottom: 'var(--space-2)' }}>Bulk Data Upload</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Select the advertising platform and upload your CSV file to ingest performance metrics in bulk.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 'var(--space-8)' }}>
        {/* Left: Configuration */}
        <div>
          <label className="label">1. Platform Source</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
            {(['google_ads', 'meta_ads', 'shopify'] as SourceType[]).map((s) => (
              <button
                key={s}
                onClick={() => { setSource(s); setFile(null); }}
                style={{
                  padding: 'var(--space-3)', textAlign: 'left', borderRadius: 'var(--radius-md)',
                  background: source === s ? 'var(--surface-hover)' : 'transparent',
                  border: `1px solid ${source === s ? 'var(--accent-primary)' : 'var(--surface-border)'}`,
                  color: source === s ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                {s.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>

          <label className="label">2. Template</label>
          <button 
            onClick={downloadTemplate}
            className="btn btn-ghost" 
            style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.8125rem', border: '1px dashed var(--surface-border)' }}
          >
            <Download size={14} /> Download CSV Template
          </button>
        </div>

        {/* Right: Upload Zone */}
        <div>
          <label className="label">3. Upload File</label>
          <div 
            onClick={() => fileInputRef.current?.click()}
            style={{
              height: '240px', border: '2px dashed var(--surface-border)', borderRadius: 'var(--radius-lg)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.2s', background: 'rgba(255,255,255,0.01)',
              position: 'relative'
            }}
            onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
            onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--surface-border)'}
          >
            <input 
              type="file" accept=".csv" ref={fileInputRef} 
              onChange={handleFileChange} style={{ display: 'none' }} 
            />
            
            {!file ? (
              <>
                <div style={{ 
                  width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-4)'
                }}>
                  <Upload size={32} color="var(--text-muted)" />
                </div>
                <span style={{ fontWeight: 500, marginBottom: 'var(--space-1)' }}>Click to browse or Drag & Drop</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Only .CSV files are accepted</span>
              </>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <FileText size={48} color="var(--accent-primary)" style={{ marginBottom: 'var(--space-3)' }} />
                <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 'var(--space-1)' }}>{file.name}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{(file.size / 1024).toFixed(1)} KB</p>
                
                <button 
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="btn btn-sm"
                  style={{ marginTop: 'var(--space-4)', color: 'var(--status-error)' }}
                >
                  <Trash2 size={14} /> Remove
                </button>
              </div>
            )}
          </div>

          <div style={{ marginTop: 'var(--space-6)', display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              onClick={handleUpload}
              disabled={!file || loading}
              className="btn btn-primary"
              style={{ minWidth: '180px' }}
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Ingest Data</>}
            </button>
          </div>

          {status && (
            <div style={{
              marginTop: 'var(--space-6)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)',
              background: status.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              color: status.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
              fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
              border: `1px solid ${status.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`
            }}>
              {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              {status.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
