'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Settings, 
  Plus, 
  ShoppingCart, 
  Users, 
  BarChart2, 
  ShieldCheck,
  AlertCircle,
  Loader2,
  Smartphone
} from 'lucide-react';
import Link from 'next/link';

const CLIENT_TYPES = [
  { id: 'google_only', name: 'Google Ads Only', description: 'Single platform Google Ads focus' },
  { id: 'meta_only', name: 'Meta Ads Only', description: 'Single platform Meta Ads focus' },
  { id: 'google_meta', name: 'Google + Meta Hybrid', description: 'Lead generation or Multi-channel focus' },
  { id: 'ecomm_shopify', name: 'E-commerce (Shopify)', description: 'Full funnel Shopify + Ads tracking' },
  { id: 'ecomm_ga4', name: 'E-commerce (GA4)', description: 'GA4 centric conversion tracking' },
  { id: 'leadgen', name: 'Lead Generation', description: 'Meta Lead Forms focus' },
];

export default function ManualSetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    type: 'google_only',
    google_ads_id: '',
    meta_ads_id: '',
    shopify_url: '',
    ga4_id: '',
    currency: 'USD',
    timezone: 'UTC',
    target_roas: '4.0',
    target_cpa: '30.0',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleTypeSelect = (typeId: string) => {
    setFormData(prev => ({ ...prev, type: typeId }));
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      ...formData,
      report_settings: {
        kpi_targets: {
          roas: parseFloat(formData.target_roas),
          cpa: parseFloat(formData.target_cpa)
        },
        enabled_sections: ["summary", "campaign_breakdown", "time_segments"]
      }
    };

    try {
      const client = await api.manualSetup(payload);
      if (client) {
        router.push(`/clients/${client.id}`);
      } else {
        setError("Failed to create client. Please check your IDs.");
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <header style={{ marginBottom: 'var(--space-8)' }}>
        <Link href="/clients" className="btn btn-ghost" style={{ marginBottom: 'var(--space-4)', paddingLeft: 0 }}>
          <ArrowLeft size={16} /> Back to Clients
        </Link>
        <h1 className="heading-1">Manual Account Setup</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Configure a multi-platform client by directly entering their IDs.</p>
      </header>

      {/* Wizard Progress */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-8)' }}>
        {[1, 2, 3].map(s => (
          <div 
            key={s} 
            style={{ 
              height: '4px', flex: 1, borderRadius: '2px',
              background: step >= s ? 'var(--accent-primary)' : 'var(--surface-border)',
              transition: 'background 0.3s ease'
            }} 
          />
        ))}
      </div>

      <div className="glass-panel" style={{ padding: 'var(--space-8)' }}>
        {error && (
          <div style={{ 
            padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', 
            background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-error)',
            marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)'
          }}>
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Step 1: Client Identity */}
          {step === 1 && (
            <div className="fade-in">
              <h3 className="heading-3" style={{ marginBottom: 'var(--space-6)' }}>1. Client Information</h3>
              
              <div style={{ marginBottom: 'var(--space-6)' }}>
                <label className="label">Client Name</label>
                <input 
                  type="text" name="name" required 
                  className="input" placeholder="e.g. Acme Marketing"
                  value={formData.name} onChange={handleChange}
                />
              </div>

              <label className="label">Configuration Type</label>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', 
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-8)'
              }}>
                {CLIENT_TYPES.map(type => (
                  <div 
                    key={type.id}
                    onClick={() => handleTypeSelect(type.id)}
                    style={{
                      padding: 'var(--space-4)', borderRadius: 'var(--radius-md)',
                      background: formData.type === type.id ? 'var(--surface-hover)' : 'var(--surface)',
                      border: `1px solid ${formData.type === type.id ? 'var(--accent-primary)' : 'var(--surface-border)'}`,
                      cursor: 'pointer', transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{type.name}</span>
                      {formData.type === type.id && <ShieldCheck size={16} color="var(--accent-primary)" />}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{type.description}</p>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  type="button" onClick={nextStep} className="btn btn-primary"
                  disabled={!formData.name}
                >
                  Next Step <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Platform Links */}
          {step === 2 && (
            <div className="fade-in">
              <h3 className="heading-3" style={{ marginBottom: 'var(--space-6)' }}>2. Link Platforms</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 'var(--space-6)' }}>
                Provide the unique identifiers for each platform you want to track.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                  <div className="icon-wrapper" style={{ background: 'rgba(66, 133, 244, 0.1)', color: '#4285F4' }}>
                    <Users size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="label">Google Ads Customer ID</label>
                    <input 
                      type="text" name="google_ads_id" className="input" placeholder="e.g. 123-456-7890"
                      value={formData.google_ads_id} onChange={handleChange}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                  <div className="icon-wrapper" style={{ background: 'rgba(24, 119, 242, 0.1)', color: '#1877F2' }}>
                    <Smartphone size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="label">Meta Ad Account ID</label>
                    <input 
                      type="text" name="meta_ads_id" className="input" placeholder="act_XXXXXXXXXXXX"
                      value={formData.meta_ads_id} onChange={handleChange}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                  <div className="icon-wrapper" style={{ background: 'rgba(149, 190, 71, 0.1)', color: '#95BF47' }}>
                    <ShoppingCart size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="label">Shopify Shop Domain</label>
                    <input 
                      type="text" name="shopify_url" className="input" placeholder="my-store.myshopify.com"
                      value={formData.shopify_url} onChange={handleChange}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                  <div className="icon-wrapper" style={{ background: 'rgba(255, 153, 0, 0.1)', color: '#FF9900' }}>
                    <BarChart2 size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="label">GA4 Property ID</label>
                    <input 
                      type="text" name="ga4_id" className="input" placeholder="123456789"
                      value={formData.ga4_id} onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" onClick={prevStep} className="btn btn-ghost">
                  <ArrowLeft size={16} /> Back
                </button>
                <button type="button" onClick={nextStep} className="btn btn-primary">
                  Next Step <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Parameters */}
          {step === 3 && (
            <div className="fade-in">
              <h3 className="heading-3" style={{ marginBottom: 'var(--space-6)' }}>3. Report Parameters</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
                <div>
                  <label className="label">Target ROAS</label>
                  <input 
                    type="number" step="0.1" name="target_roas" className="input"
                    value={formData.target_roas} onChange={handleChange}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>Threshold for ROAS alerts</p>
                </div>
                <div>
                  <label className="label">Target CPA ({formData.currency})</label>
                  <input 
                    type="number" step="1" name="target_cpa" className="input"
                    value={formData.target_cpa} onChange={handleChange}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>Desired cost per acquisition</p>
                </div>
              </div>

              <div style={{ 
                padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', 
                background: 'var(--surface)', border: '1px solid var(--surface-border)',
                marginBottom: 'var(--space-8)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--accent-primary)', marginBottom: 'var(--space-2)' }}>
                  <Settings size={16} />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Default Sections</span>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Weekly and Monthly reports will include Summary, Campaign Breakdown, and Time Segments by default.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" onClick={prevStep} className="btn btn-ghost">
                  <ArrowLeft size={16} /> Back
                </button>
                <button 
                  type="submit" disabled={loading} className="btn btn-primary"
                  style={{ minWidth: '160px' }}
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : (
                    <>Create Account <Check size={16} /></>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      <style jsx>{`
        .icon-wrapper {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
