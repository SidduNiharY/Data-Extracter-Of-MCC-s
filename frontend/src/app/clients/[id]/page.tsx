import { api } from '@/lib/api';
import DataSourceBadge from '@/components/DataSourceBadge';
import PlatformConnector from '@/components/PlatformConnector';
import ReportParametersEditor from '@/components/ReportParametersEditor';
import ClientActionsBar from '@/components/ClientActionsBar';
import ClientDetailContent from '@/components/ClientDetailContent';
import { revalidatePath } from 'next/cache';

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const client = await api.getClient(params.id);
  const metrics = await api.getClientMetrics(params.id);
  const jobs = await api.getClientJobs(params.id);

  if (!client) {
    return <div className="flex-center" style={{ minHeight: '50vh' }}><h1>Client not found</h1></div>;
  }

  // Refresh server action
  const handleRefresh = async () => {
    'use server';
    revalidatePath(`/clients/${params.id}`);
  };

  // Helper as defined in earlier component
  const getSources = (type: string) => {
    switch (type) {
      case 'google_only': return ['google_ads'];
      case 'meta_only': return ['meta_ads'];
      case 'google_meta': return ['google_ads', 'meta_ads'];
      case 'ecomm_shopify': return ['google_ads', 'meta_ads', 'shopify'];
      case 'ecomm_ga4': return ['google_ads', 'meta_ads', 'ga4'];
      case 'leadgen': return ['google_ads', 'meta_ads'];
      default: return [];
    }
  };

  const sources = getSources(client.type);

  return (
    <div className="fade-in">
      <ClientActionsBar clientId={client.id} />

      <header className="glass-panel" style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-8)' }}>
        <div className="flex-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
              <h1 className="heading-1" style={{ marginBottom: 0 }}>{client.name}</h1>
              <PlatformConnector clientId={client.id} onSuccess={handleRefresh} />
              <ReportParametersEditor client={client} onUpdate={handleRefresh} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-4)', color: 'var(--text-secondary)' }}>
              <span>ID: {client.id}</span>
              <span>Type: {client.type.replace('_', ' ').toUpperCase()}</span>
              <span>Currency: {client.currency}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {sources.map(s => <DataSourceBadge key={s} source={s} />)}
          </div>
        </div>
      </header>

      <ClientDetailContent client={client} metrics={metrics} jobs={jobs} onRefresh={handleRefresh} />
    </div>
  );
}
