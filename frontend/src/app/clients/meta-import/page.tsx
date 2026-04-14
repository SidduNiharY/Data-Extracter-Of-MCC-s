'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { MCCAccount } from '@/types';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Check, CloudOff, Loader2, Plus, Search, Users } from 'lucide-react';

export default function MetaImportPage() {
  const [accounts, setAccounts] = useState<MCCAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMetaAccounts();
      setAccounts(data.accounts);
    } catch (e: any) {
      console.error('Failed to load Meta accounts', e);
      setError(e.response?.data?.detail || 'Failed to connect to Meta API. Check your Access Token.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleImport = async (account: MCCAccount) => {
    setImportingId(account.meta_id || account.customer_id);
    try {
      const client = await api.importMetaAccount(account.meta_id || account.customer_id, account.name);
      if (client) {
        setAccounts(prev =>
          prev.map(acc =>
            (acc.meta_id === account.meta_id || acc.customer_id === account.customer_id)
              ? { ...acc, is_imported: true }
              : acc
          )
        );
      }
    } catch (e: any) {
      console.error('Import failed', e);
      alert(e.response?.data?.detail || 'Import failed');
    } finally {
      setImportingId(null);
    }
  };

  const filteredAccounts = accounts.filter(acc =>
    acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    acc.customer_id.includes(searchQuery)
  );

  const importedCount = accounts.filter(a => a.is_imported).length;

  return (
    <div className="fade-in">
      {/* Header */}
      <header style={{ marginBottom: 'var(--space-8)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Link href="/clients" className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-3)', marginLeft: '-0.75rem' }}>
            <ArrowLeft size={14} />
            Back to Clients
          </Link>
          <h1 className="heading-1">Import from Meta Ads</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', maxWidth: '560px' }}>
            Discover ad accounts associated with your Meta Business Manager and import them as clients.
          </p>
        </div>
        <button 
          className="btn btn-secondary" 
          onClick={loadAccounts}
          disabled={loading}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : 'Refresh Accounts'}
        </button>
      </header>

      {/* Error Banner */}
      {!loading && error && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
          background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)',
          marginBottom: 'var(--space-5)'
        }}>
          <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontSize: '0.875rem', color: '#ef4444', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
              Connection Error
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Stats Row */}
      {!loading && accounts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <div className="stat-card">
            <div className="stat-card-label">Ad Accounts Discovered</div>
            <div className="stat-card-value">{accounts.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Imported</div>
            <div className="stat-card-value" style={{ color: 'var(--status-success)' }}>{importedCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Available</div>
            <div className="stat-card-value" style={{ color: 'var(--accent-blue)' }}>{accounts.length - importedCount}</div>
          </div>
        </div>
      )}

      {/* Search */}
      {!loading && accounts.length > 0 && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            background: 'var(--surface)', border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-lg)', padding: '0.625rem var(--space-4)',
          }}>
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--text-primary)', fontSize: '0.875rem', fontFamily: 'inherit'
              }}
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div className="empty-state" style={{ minHeight: '280px' }}>
            <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent-blue)' }} />
            <p style={{ fontSize: '0.9375rem' }}>Fetching Meta Ad Accounts...</p>
          </div>
        ) : accounts.length === 0 ? (
          <div className="empty-state" style={{ minHeight: '280px' }}>
            <CloudOff size={40} />
            <div>
              <h3 className="heading-3" style={{ marginBottom: 'var(--space-2)', color: 'var(--text-secondary)' }}>No ad accounts found</h3>
              <p style={{ fontSize: '0.875rem', maxWidth: '360px' }}>
                Ensure your Access Token has the `ads_read` permission and is associated with a Business Manager.
              </p>
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Ad Account</th>
                <th>Account ID</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((acc, i) => (
                <tr key={acc.meta_id || acc.customer_id} className="fade-in" style={{ 
                  animationDelay: `${i * 0.03}s`, animationFillMode: 'backwards',
                  opacity: acc.is_imported ? 0.55 : 1
                }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 'var(--radius-md)',
                        background: acc.is_imported ? 'var(--status-success-bg)' : 'var(--status-info-bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        {acc.is_imported ? (
                          <Check size={14} color="var(--status-success)" />
                        ) : (
                          <Users size={14} color="var(--accent-blue)" />
                        )}
                      </div>
                      <span style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{acc.name}</span>
                    </div>
                  </td>
                  <td>
                    <code style={{ 
                      fontSize: '0.8125rem', color: 'var(--text-muted)', fontFamily: 'ui-monospace, monospace',
                      background: 'rgba(255,255,255,0.03)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)'
                    }}>
                      {acc.customer_id}
                    </code>
                  </td>
                  <td>
                    {acc.is_imported ? (
                      <span className="badge badge-imported">
                        <Check size={10} /> Synced
                      </span>
                    ) : (
                      <span className="badge" style={{ background: 'var(--status-info-bg)', color: 'var(--status-info)' }}>
                        Available
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {acc.is_imported ? (
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Already imported</span>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleImport(acc)}
                        disabled={importingId === (acc.meta_id || acc.customer_id)}
                      >
                        {importingId === (acc.meta_id || acc.customer_id) ? (
                          <><Loader2 size={12} className="animate-spin" /> Importing...</>
                        ) : (
                          <><Plus size={12} /> Add to App</>
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
