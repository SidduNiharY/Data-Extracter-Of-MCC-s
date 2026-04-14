'use client';

import { useState } from 'react';
import { Settings, Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface ReportParametersEditorProps {
  client: any;
  onUpdate: () => void;
}

export default function ReportParametersEditor({ client, onUpdate }: ReportParametersEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const initialSettings = client.report_settings || {};
  const [settings, setSettings] = useState({
    target_roas: initialSettings.kpi_targets?.roas || '4.0',
    target_cpa: initialSettings.kpi_targets?.cpa || '30.0',
    enabled_sections: initialSettings.enabled_sections || ["summary", "campaign_breakdown", "time_segments"]
  });

  const handleSave = async () => {
    setLoading(true);
    setStatus(null);

    const payload = {
      report_settings: {
        kpi_targets: {
          roas: parseFloat(settings.target_roas),
          cpa: parseFloat(settings.target_cpa)
        },
        enabled_sections: settings.enabled_sections
      }
    };

    try {
      const result = await api.manualSetup({ ...client, ...payload }); // Reuse manualSetup or create patch
      // Actually let's use a generic update if available, but for now this works if api handles it
      // Note: In real app we should have api.updateClient
      if (result) {
        setStatus({ type: 'success', message: 'Parameters updated successfully!' });
        setTimeout(() => {
          setIsOpen(false);
          setStatus(null);
          onUpdate();
        }, 1500);
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Failed to update settings.' });
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setSettings(prev => ({
      ...prev,
      enabled_sections: prev.enabled_sections.includes(section)
        ? prev.enabled_sections.filter(s => s !== section)
        : [...prev.enabled_sections, section]
    }));
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="btn btn-secondary btn-sm"
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
      >
        <Settings size={16} /> Reporting Parameters
      </button>

      {isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 'var(--space-6)'
        }}>
          <div className="glass-panel" style={{
            width: '100%', maxWidth: 500, padding: 'var(--space-6)',
            position: 'relative'
          }}>
            <h2 className="heading-3" style={{ marginBottom: 'var(--space-6)' }}>Reporting Parameters</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
              <div>
                <label className="label">Target ROAS</label>
                <input 
                  type="number" step="0.1" className="input"
                  value={settings.target_roas}
                  onChange={(e) => setSettings({...settings, target_roas: e.target.value})}
                />
              </div>
              <div>
                <label className="label">Target CPA</label>
                <input 
                  type="number" step="1" className="input"
                  value={settings.target_cpa}
                  onChange={(e) => setSettings({...settings, target_cpa: e.target.value})}
                />
              </div>
            </div>

            <div style={{ marginBottom: 'var(--space-8)' }}>
              <label className="label">Enabled Report Sections</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {["summary", "campaign_breakdown", "time_segments", "search_terms", "keywords", "demographics"].map(section => (
                  <button
                    key={section}
                    onClick={() => toggleSection(section)}
                    style={{
                      padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem', textTransform: 'capitalize',
                      background: settings.enabled_sections.includes(section) ? 'var(--accent-primary)' : 'var(--surface)',
                      color: settings.enabled_sections.includes(section) ? 'white' : 'var(--text-secondary)',
                      border: '1px solid var(--surface-border)', cursor: 'pointer'
                    }}
                  >
                    {section.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {status && (
              <div style={{
                padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)',
                background: status.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                color: status.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
                fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 'var(--space-2)'
              }}>
                {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {status.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button onClick={() => setIsOpen(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
              <button 
                onClick={handleSave} 
                disabled={loading} 
                className="btn btn-primary" 
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <><Save size={16} /> Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
