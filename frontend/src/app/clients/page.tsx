import { api } from '@/lib/api';
import ClientCard from '@/components/ClientCard';
import Link from 'next/link';
import { Plus, Smartphone, Store, Upload, Users } from 'lucide-react';

export default async function ClientsPage() {
  const clients = await api.getClients();
  const activeCount = clients.filter(c => c.is_active).length;

  return (
    <div className="fade-in">
      {/* Page Header */}
      <header style={{ marginBottom: 'var(--space-8)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="heading-1">Client Management</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginTop: 'var(--space-1)' }}>
            {activeCount} active client{activeCount !== 1 ? 's' : ''} across {clients.length} total accounts.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Link href="/clients/manual-setup" className="btn btn-ghost" style={{ border: '1px solid var(--surface-border)' }}>
            <Plus size={18} /> Manual Setup
          </Link>
          <Link href="/clients/mcc-import" className="btn btn-secondary">
            <Users size={18} /> Import MCC
          </Link>
          <Link href="/clients/meta-import" className="btn btn-secondary">
            <Smartphone size={18} /> Meta Ads
          </Link>
          <Link href="/clients/shopify-import" className="btn btn-secondary">
            <Store size={18} /> Shopify Store
          </Link>
        </div>
      </header>

      {/* Client Grid */}
      {clients.length > 0 ? (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', 
          gap: 'var(--space-5)' 
        }}>
          {clients.map((client, i) => (
            <div key={client.id} className="fade-in" style={{ animationDelay: `${i * 0.05}s`, animationFillMode: 'backwards' }}>
              <ClientCard client={client} />
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-panel empty-state" style={{ minHeight: '300px' }}>
          <Users size={48} />
          <div>
            <h3 className="heading-3" style={{ marginBottom: 'var(--space-2)' }}>No clients yet</h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: '360px' }}>
              Import your first client from your Google Ads MCC to get started with automated reporting.
            </p>
          </div>
          <Link href="/clients/mcc-import" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>
            <Upload size={16} />
            Import from MCC
          </Link>
        </div>
      )}
    </div>
  );
}
