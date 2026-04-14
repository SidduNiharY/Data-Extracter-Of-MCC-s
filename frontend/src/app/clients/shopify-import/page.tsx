'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { MCCAccount } from '@/types';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Check, CheckCircle2, Loader2, Plus, Search, ShoppingBag } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ShopifyImportPage() {
  const router = useRouter();  // used for redirect after successful import
  const [accounts, setAccounts] = useState<MCCAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [success, setSuccess] = useState(false);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const data = await api.getShopifyAccounts();
      if (data.setup_required) {
        setSetupRequired(true);
      } else {
        setAccounts(data.accounts);
      }
    } catch (e) {
      console.error('Failed to load Shopify stores', e);
      setSetupRequired(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleImport = async (account: MCCAccount) => {
    setImportingId(account.shop_domain || account.customer_id);
    try {
      // Backend now pulls token from .env automatically
      const client = await api.importShopifyAccount(account.shop_domain || account.customer_id, '');
      if (client) {
        setSuccess(true);
        setTimeout(() => router.push(`/clients/${client.id}`), 1500);
      }
    } catch (e: any) {
      console.error('Import failed', e);
      alert(e.response?.data?.detail || 'Import failed. Ensure SHOPIFY_ACCESS_TOKEN is set in backend .env');
    } finally {
      setImportingId(null);
    }
  };

  const filteredAccounts = accounts.filter(acc =>
    acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (acc.shop_domain || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const importedCount = accounts.filter(a => a.is_imported).length;

  if (success) {
    return (
      <div className="empty-state" style={{ minHeight: '60vh' }}>
        <CheckCircle2 size={48} color="var(--status-success)" />
        <h2 className="heading-2">Shopify Connected!</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Redirecting to client dashboard...</p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <header style={{ marginBottom: 'var(--space-8)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Link href="/clients" className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-3)', marginLeft: '-0.75rem' }}>
            <ArrowLeft size={14} />
            Back to Clients
          </Link>
          <h1 className="heading-1">Import from Shopify</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', maxWidth: '560px' }}>
            Discover and import stores managed via your Shopify Partner account. API credentials are pulled automatically from your environment settings.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={loadAccounts} disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : 'Refresh Stores'}
        </button>
      </header>

      {setupRequired && !loading && (
        <div style={{ 
          marginBottom: 'var(--space-6)', padding: 'var(--space-4)', 
          background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)', 
          borderRadius: 'var(--radius-lg)', display: 'flex', gap: 'var(--space-3)' 
        }}>
          <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontSize: '0.875rem', color: '#ef4444', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
              Configuration Required
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Shopify Partner API credentials are missing in the backend `.env`. 
              Please set `SHOPIFY_PARTNER_ID` and `SHOPIFY_PARTNER_TOKEN` to enable automatic discovery.
            </p>
          </div>
        </div>
      )}

      {/* Stats Row */}
      {!loading && !setupRequired && accounts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <div className="stat-card">
            <div className="stat-card-label">Managed Stores</div>
            <div className="stat-card-value">{accounts.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Already Imported</div>
            <div className="stat-card-value" style={{ color: 'var(--status-success)' }}>{importedCount}</div>
          </div>
        </div>
      )}

      {/* Search */}
      {!loading && !setupRequired && accounts.length > 0 && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            background: 'var(--surface)', border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-lg)', padding: '0.625rem var(--space-4)',
          }}>
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search stores by name or domain..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '0.875rem' }}
            />
          </div>
        </div>
      )}

      {/* Discovery Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div className="empty-state" style={{ minHeight: '280px' }}>
            <Loader2 size={32} className="animate-spin" color="var(--accent-blue)" />
            <p>Fetching curated shopify stores...</p>
          </div>
        ) : setupRequired ? (
          <div className="empty-state" style={{ minHeight: '280px' }}>
            <ShoppingBag size={40} color="var(--text-muted)" />
            <div>
              <h3 className="heading-3" style={{ marginBottom: 'var(--space-2)' }}>No shops discovered</h3>
              <p style={{ fontSize: '0.875rem', maxWidth: '360px' }}>
                To list your Shopify stores automatically, configure the Shopify Partner API in your server environment.
              </p>
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Store</th>
                <th>Domain</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((acc, i) => (
                <tr key={acc.shop_domain || acc.customer_id} className="fade-in" style={{ animationDelay: `${i * 0.03}s`, opacity: acc.is_imported ? 0.6 : 1 }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 'var(--radius-md)',
                        background: acc.is_imported ? 'var(--status-success-bg)' : 'var(--status-info-bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <ShoppingBag size={14} color={acc.is_imported ? 'var(--status-success)' : 'var(--accent-blue)'} />
                      </div>
                      <span style={{ fontWeight: 500 }}>{acc.name}</span>
                    </div>
                  </td>
                  <td>
                    <code style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{acc.shop_domain}</code>
                  </td>
                  <td>
                    {acc.is_imported ? (
                      <span className="badge badge-imported"><Check size={10} /> Imported</span>
                    ) : (
                      <span className="badge" style={{ background: 'var(--status-info-bg)', color: 'var(--status-info)' }}>Available</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {!acc.is_imported && (
                      <button 
                        className="btn btn-primary btn-sm" 
                        onClick={() => handleImport(acc)}
                        disabled={importingId === (acc.shop_domain || acc.customer_id)}
                      >
                        {importingId === (acc.shop_domain || acc.customer_id) ? (
                          <><Loader2 size={12} className="animate-spin" /> Working...</>
                        ) : (
                          <><Plus size={12} /> Add to Reports</>
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
