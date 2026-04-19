import { CheckCircle2, XCircle, Settings, Database, Calendar, Globe } from 'lucide-react';
import GlobalThresholdsCard from '@/components/dashboard/GlobalThresholdsCard';

interface CredentialRow {
  label: string;
  envKey: string;
  value: string | undefined;
}

export default function SettingsPage() {
  // Read env vars server-side (these are NEXT_PUBLIC_ or process.env on server components)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api';

  const platformCredentials: CredentialRow[] = [
    { label: 'Google Ads Developer Token', envKey: 'GOOGLE_ADS_DEVELOPER_TOKEN',   value: process.env.GOOGLE_ADS_DEVELOPER_TOKEN },
    { label: 'Google Ads Client ID',        envKey: 'GOOGLE_ADS_CLIENT_ID',         value: process.env.GOOGLE_ADS_CLIENT_ID },
    { label: 'Google Ads MCC ID',           envKey: 'GOOGLE_ADS_MCC_ID',            value: process.env.GOOGLE_ADS_MCC_ID },
    { label: 'Meta App ID',                 envKey: 'META_APP_ID',                  value: process.env.META_APP_ID },
    { label: 'Meta Access Token',           envKey: 'META_ACCESS_TOKEN',            value: process.env.META_ACCESS_TOKEN },
    { label: 'Shopify Access Token',        envKey: 'SHOPIFY_ACCESS_TOKEN',         value: process.env.SHOPIFY_ACCESS_TOKEN },
    { label: 'GA4 Service Account JSON',    envKey: 'GA4_SERVICE_ACCOUNT_JSON',     value: process.env.GA4_SERVICE_ACCOUNT_JSON },
  ];

  const appSettings = [
    { label: 'Backend API URL',   value: apiUrl },
    { label: 'Default Currency',  value: process.env.DEFAULT_CURRENCY  ?? 'USD' },
    { label: 'Default Timezone',  value: process.env.DEFAULT_TIMEZONE  ?? 'UTC' },
    { label: 'Frontend URL',      value: process.env.FRONTEND_URL      ?? 'http://localhost:3000' },
  ];

  const schedulerInfo = [
    { label: 'Weekly Data Pull',    value: 'Every Monday — 06:00 UTC' },
    { label: 'Weekly Report Gen',   value: 'Every Monday — 08:00 UTC' },
    { label: 'Monthly Report Gen',  value: '1st of month  — 09:00 UTC' },
  ];

  return (
    <div className="fade-in" style={{ maxWidth: 860 }}>
      <header style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
          <Settings size={24} color="var(--accent-primary)" />
          <h1 className="heading-1" style={{ marginBottom: 0 }}>Settings</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
          Platform credentials, scheduler configuration, and application settings.
        </p>
      </header>

      <section style={{ marginBottom: 'var(--space-10)' }}>
        <GlobalThresholdsCard />
      </section>

      {/* Platform Credentials */}
      <section style={{ marginBottom: 'var(--space-10)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <Globe size={18} color="var(--text-secondary)" />
          <h2 className="heading-3" style={{ marginBottom: 0 }}>Platform Credentials</h2>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 'var(--space-4)' }}>
          These are read from the backend <code style={{ background: 'var(--surface-hover)', padding: '1px 6px', borderRadius: 4 }}>.env</code> file.
          Green = set, Red = missing (platform will not pull data).
        </p>

        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-hover)', borderBottom: '1px solid var(--surface-border)' }}>
                <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontWeight: 600 }}>Credential</th>
                <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontWeight: 600 }}>Env Variable</th>
                <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {platformCredentials.map((row, i) => {
                const isSet = !!(row.value && row.value.trim().length > 0);
                return (
                  <tr key={row.envKey} style={{ borderBottom: i < platformCredentials.length - 1 ? '1px solid var(--surface-border)' : 'none' }}>
                    <td style={{ padding: 'var(--space-4)', fontWeight: 500 }}>{row.label}</td>
                    <td style={{ padding: 'var(--space-4)' }}>
                      <code style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', background: 'var(--surface-hover)', padding: '2px 8px', borderRadius: 4 }}>
                        {row.envKey}
                      </code>
                    </td>
                    <td style={{ padding: 'var(--space-4)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: isSet ? 'var(--status-success)' : 'var(--status-error)', fontWeight: 600, fontSize: '0.8125rem' }}>
                        {isSet
                          ? <><CheckCircle2 size={15} /> Configured</>
                          : <><XCircle size={15} /> Not set</>
                        }
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Scheduler */}
      <section style={{ marginBottom: 'var(--space-10)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <Calendar size={18} color="var(--text-secondary)" />
          <h2 className="heading-3" style={{ marginBottom: 0 }}>Automated Scheduler</h2>
        </div>

        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <tbody>
              {schedulerInfo.map((row, i) => (
                <tr key={row.label} style={{ borderBottom: i < schedulerInfo.length - 1 ? '1px solid var(--surface-border)' : 'none' }}>
                  <td style={{ padding: 'var(--space-4)', fontWeight: 500, width: '40%' }}>{row.label}</td>
                  <td style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)' }}>{row.value}</td>
                  <td style={{ padding: 'var(--space-4)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--status-success)', fontSize: '0.8125rem', fontWeight: 600 }}>
                      <CheckCircle2 size={14} /> Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* App Config */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <Database size={18} color="var(--text-secondary)" />
          <h2 className="heading-3" style={{ marginBottom: 0 }}>Application Config</h2>
        </div>

        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <tbody>
              {appSettings.map((row, i) => (
                <tr key={row.label} style={{ borderBottom: i < appSettings.length - 1 ? '1px solid var(--surface-border)' : 'none' }}>
                  <td style={{ padding: 'var(--space-4)', fontWeight: 500, width: '40%' }}>{row.label}</td>
                  <td style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.8125rem' }}>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
