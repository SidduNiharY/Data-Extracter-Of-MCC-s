'use client';

import { useState } from 'react';
import { Plus, X, Globe, Smartphone, Store, BarChart2, Loader2, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';

interface PlatformConnectorProps {
  clientId: string;
  onSuccess: () => void;
}

type PlatformSource = 'meta_ads' | 'shopify' | 'ga4';

export default function PlatformConnector({ clientId, onSuccess }: PlatformConnectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<PlatformSource>('meta_ads');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form states
  const [metaId, setMetaId] = useState('');
  const [shopifyDomain, setShopifyDomain] = useState('');
  const [shopifyToken, setShopifyToken] = useState('');
  const [ga4PropertyId, setGa4PropertyId] = useState('');

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    let credentials: Record<string, string> = {};
    if (activeTab === 'meta_ads') {
      if (!metaId) return setLoading(false);
      credentials = { ad_account_id: metaId };
    } else if (activeTab === 'shopify') {
      if (!shopifyDomain || !shopifyToken) return setLoading(false);
      credentials = { shop_domain: shopifyDomain, access_token: shopifyToken };
    } else if (activeTab === 'ga4') {
      if (!ga4PropertyId) return setLoading(false);
      credentials = { property_id: ga4PropertyId };
    }

    try {
      const result = await api.connectDataSource(clientId, { source: activeTab, credentials });
      if (result) {
        setStatus({ type: 'success', message: `${activeTab.replace('_', ' ').toUpperCase()} connected successfully!` });
        setTimeout(() => {
          setIsOpen(false);
          setStatus(null);
          onSuccess();
        }, 1500);
      } else {
        setStatus({ type: 'error', message: 'Failed to connect. Please check your credentials.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'An unexpected error occurred.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="btn btn-primary btn-sm"
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
      >
        <Plus size={16} /> Connect Platform
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
            position: 'relative', animation: 'fadeIn 0.3s ease-out'
          }}>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ position: 'absolute', top: 20, right: 20, color: 'var(--text-muted)' }}
            >
              <X size={20} />
            </button>

            <h2 className="heading-2" style={{ marginBottom: 'var(--space-6)', fontSize: '1.25rem' }}>Connect Data Source</h2>

            {/* Tabs */}
            <div style={{
              display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)',
              background: 'var(--surface)', padding: 'var(--space-1)', borderRadius: 'var(--radius-md)'
            }}>
              <button 
                onClick={() => setActiveTab('meta_ads')}
                style={{
                  flex: 1, padding: '0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem',
                  background: activeTab === 'meta_ads' ? 'var(--surface-hover)' : 'transparent',
                  color: activeTab === 'meta_ads' ? 'var(--accent-purple)' : 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)'
                }}
              >
                <Smartphone size={14} /> Meta
              </button>
              <button 
                onClick={() => setActiveTab('shopify')}
                style={{
                  flex: 1, padding: '0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem',
                  background: activeTab === 'shopify' ? 'var(--surface-hover)' : 'transparent',
                  color: activeTab === 'shopify' ? 'var(--status-success)' : 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)'
                }}
              >
                <Store size={14} /> Shopify
              </button>
              <button 
                onClick={() => setActiveTab('ga4')}
                style={{
                  flex: 1, padding: '0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem',
                  background: activeTab === 'ga4' ? 'var(--surface-hover)' : 'transparent',
                  color: activeTab === 'ga4' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)'
                }}
              >
                <BarChart2 size={14} /> GA4
              </button>
            </div>

            <form onSubmit={handleConnect}>
              {activeTab === 'meta_ads' && (
                <div style={{ marginBottom: 'var(--space-6)' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                    AD ACCOUNT ID (e.g. act_12345678)
                  </label>
                  <input 
                    type="text"
                    value={metaId}
                    onChange={(e) => setMetaId(e.target.value)}
                    placeholder="act_..."
                    style={{
                      width: '100%', padding: '0.75rem', background: 'var(--surface)',
                      border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)', outline: 'none'
                    }}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>
                    Uses global app credentials from system environment.
                  </p>
                </div>
              )}

              {activeTab === 'shopify' && (
                <div style={{ marginBottom: 'var(--space-6)' }}>
                  <div style={{ marginBottom: 'var(--space-4)' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                      SHOP DOMAIN (e.g. store.myshopify.com)
                    </label>
                    <input 
                      type="text"
                      value={shopifyDomain}
                      onChange={(e) => setShopifyDomain(e.target.value)}
                      placeholder="myshop.myshopify.com"
                      style={{
                        width: '100%', padding: '0.75rem', background: 'var(--surface)',
                        border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)', outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                      ADMIN API ACCESS TOKEN
                    </label>
                    <input 
                      type="password"
                      value={shopifyToken}
                      onChange={(e) => setShopifyToken(e.target.value)}
                      placeholder="shpat_..."
                      style={{
                        width: '100%', padding: '0.75rem', background: 'var(--surface)',
                        border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)', outline: 'none'
                      }}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'ga4' && (
                <div style={{ marginBottom: 'var(--space-6)' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                    PROPERTY ID (e.g. 12345678)
                  </label>
                  <input 
                    type="text"
                    value={ga4PropertyId}
                    onChange={(e) => setGa4PropertyId(e.target.value)}
                    placeholder="123456..."
                    style={{
                      width: '100%', padding: '0.75rem', background: 'var(--surface)',
                      border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)', outline: 'none'
                    }}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>
                    Uses global service account from system environment.
                  </p>
                </div>
              )}

              {status && (
                <div style={{
                  padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)',
                  background: status.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  color: status.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
                  fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 'var(--space-2)'
                }}>
                  {status.type === 'success' ? <CheckCircle2 size={16} /> : <X size={16} />}
                  {status.message}
                </div>
              )}

              <button 
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : 'Confirm Connection'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
