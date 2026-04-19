import axios from 'axios';
import { Client, PullJob, PlatformMetrics, MCCAccount, MCCAccountsResponse, Report, ReportSummary, GenerateReportRequest, ClientCreateRequest, CsvTemplateInfo, CsvUploadResult, ReportMetric, ReportProgressRow, DashboardRow, ThresholdConfig, ThresholdOverride } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api';

export const api = {
  getMccAccounts: async (mccId?: string): Promise<MCCAccountsResponse> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/data/google-ads/mcc-accounts`, {
        params: { mcc_id: mccId }
      });
      return response.data;
    } catch (e) {
      console.error(e);
      return { accounts: [], token_limited: false, token_warning: null };
    }
  },
  getMetaAccounts: async (): Promise<{ accounts: MCCAccount[] }> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/data/meta/accounts`);
      return response.data;
    } catch (e) {
      console.error(e);
      return { accounts: [] };
    }
  },
  getShopifyAccounts: async (): Promise<{ accounts: MCCAccount[]; setup_required?: boolean }> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/data/shopify/stores`);
      return response.data;
    } catch (e) {
      console.error(e);
      return { accounts: [] };
    }
  },
  importMetaAccount: async (meta_id: string, name: string): Promise<Client | undefined> => {
    try {
      // We'll create a new endpoint for this or reuse a generic one
      const response = await axios.post(`${API_BASE_URL}/clients/import-meta`, { meta_id, name });
      return response.data;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  },
  importMccAccount: async (customer_id: string, name: string, mcc_id?: string): Promise<Client | undefined> => {
    try {
      const response = await axios.post(`${API_BASE_URL}/clients/import-mcc`, { customer_id, name, mcc_id });
      return response.data;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  },
  importShopifyAccount: async (shop_url: string, access_token: string): Promise<Client | undefined> => {
    try {
      const response = await axios.post(`${API_BASE_URL}/clients/import-shopify`, { shop_url, access_token });
      return response.data;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  },
  manualSetup: async (req: { 
    name: string; 
    type: string; 
    google_ads_id?: string; 
    meta_ads_id?: string; 
    shopify_url?: string; 
    ga4_id?: string;
    currency?: string;
    timezone?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    report_settings?: any;
  }): Promise<Client | undefined> => {
    try {
      const response = await axios.post(`${API_BASE_URL}/clients/manual-setup`, req);
      return response.data;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  },
  connectDataSource: async (clientId: string, req: { source: string; credentials: Record<string, string> }) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/clients/${clientId}/connect`, req);
      return response.data;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  },
  getClients: async (mccId?: string): Promise<Client[]> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/clients`, {
        params: mccId ? { mcc_id: mccId } : undefined,
      });
      return response.data;
    } catch (e) {
      console.error(e);
      return [];
    }
  },
  listMccs: async (): Promise<string[]> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/clients/mccs`);
      return response.data;
    } catch (e) {
      console.error(e);
      return [];
    }
  },
  getClient: async (id: string): Promise<Client | undefined> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/clients/${id}`);
      return response.data;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  },
  triggerPull: async (clientId?: string): Promise<{ status: string } | undefined> => {
    try {
      const response = await axios.post(`${API_BASE_URL}/pulls/trigger`, {
        client_id: clientId ?? null,
      });
      return response.data;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  },
  getRecentJobs: async (): Promise<PullJob[]> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/pulls`);
      return response.data;
    } catch (e) {
      console.error(e);
      return [];
    }
  },
  getClientJobs: async (clientId: string): Promise<PullJob[]> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/pulls/client/${clientId}`);
      return response.data;
    } catch (e) {
      console.error(e);
      return [];
    }
  },
  getClientMetrics: async (clientId: string): Promise<PlatformMetrics | Record<string, never>> => {
    try {
      const metrics: PlatformMetrics = {};

      const [google, meta, shopify, ga4] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/data/google-ads/${clientId}/campaign`),
        axios.get(`${API_BASE_URL}/data/meta/${clientId}/campaign`),
        axios.get(`${API_BASE_URL}/data/shopify/${clientId}/orders`),
        axios.get(`${API_BASE_URL}/data/ga4/${clientId}/revenue`),
      ]);

      if (google.status === 'fulfilled' && Object.keys(google.value.data).length > 0) {
        metrics.google = google.value.data;
      }
      if (meta.status === 'fulfilled' && Object.keys(meta.value.data).length > 0) {
        metrics.meta = meta.value.data;
      }
      if (shopify.status === 'fulfilled' && Object.keys(shopify.value.data).length > 0) {
        metrics.shopify = shopify.value.data;
      }
      if (ga4.status === 'fulfilled' && Object.keys(ga4.value.data).length > 0) {
        metrics.ga4 = ga4.value.data;
      }

      return metrics;
    } catch (e) {
      console.error(e);
      return {};
    }
  },

  // ── Reports ──

  getReports: async (params?: { client_id?: string; report_type?: string; status?: string }): Promise<ReportSummary[]> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/reports`, { params });
      return response.data;
    } catch (e) {
      console.error(e);
      return [];
    }
  },
  getReport: async (id: string): Promise<Report | undefined> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/reports/${id}`);
      return response.data;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  },
  getLatestReports: async (clientId: string): Promise<{ weekly?: Report; monthly?: Report }> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/reports/client/${clientId}/latest`);
      return response.data;
    } catch (e) {
      console.error(e);
      return {};
    }
  },
  generateReport: async (req: GenerateReportRequest): Promise<{ status: string } | undefined> => {
    try {
      const response = await axios.post(`${API_BASE_URL}/reports/generate`, req);
      return response.data;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  },
  generateAllReports: async (reportType: string = 'weekly'): Promise<{ status: string } | undefined> => {
    try {
      const response = await axios.post(`${API_BASE_URL}/reports/generate-all?report_type=${reportType}`);
      return response.data;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  },

  /** Backfill last 12 months + 6 weeks for a specific client (or all clients if no clientId). */
  backfillReports: async (
    clientId?: string,
    months = 12,
    weeks  = 6,
  ): Promise<{ status: string; months: number; weeks: number } | undefined> => {
    try {
      const url = clientId
        ? `${API_BASE_URL}/reports/backfill/${clientId}`
        : `${API_BASE_URL}/reports/backfill`;
      const response = await axios.post(url, null, { params: { months, weeks } });
      return response.data;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  submitManualData: async (clientId: string, req: any): Promise<any> => {
    try {
      const response = await axios.post(`${API_BASE_URL}/manual-entry/${clientId}/manual-entry`, req);
      return response.data;
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  uploadCSV: async (
    clientId: string,
    source: string,
    table: string,
    file: File,
  ): Promise<CsvUploadResult | undefined> => {
    try {
      const formData = new FormData();
      formData.append('source', source);
      formData.append('table', table);
      formData.append('file', file);
      const response = await axios.post(
        `${API_BASE_URL}/manual-entry/${clientId}/upload-csv`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return response.data;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateClient: async (id: string, patch: Partial<Client & { report_settings: any }>): Promise<Client | undefined> => {
    try {
      const response = await axios.patch(`${API_BASE_URL}/clients/${id}`, patch);
      return response.data;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  },

  createClient: async (req: ClientCreateRequest): Promise<Client | undefined> => {
    try {
      const response = await axios.post(`${API_BASE_URL}/clients/create`, req);
      return response.data;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  },

  getCSVTemplates: async (clientType: string): Promise<CsvTemplateInfo[]> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/manual-entry/templates`, {
        params: { client_type: clientType },
      });
      return response.data;
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  downloadCSVTemplate: async (source: string, table: string): Promise<Blob | undefined> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/manual-entry/csv-template`, {
        params: { source, table },
        responseType: 'blob',
      });
      return response.data;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  },

  getReportMetrics: async (reportId: string): Promise<ReportMetric[]> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/reports/${reportId}/metrics`);
      return response.data;
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  getClientProgress: async (
    clientId: string,
    reportType: string = 'monthly',
    source: string = 'google_ads',
    limit: number = 24,
  ): Promise<ReportProgressRow[]> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/reports/client/${clientId}/progress`, {
        params: { report_type: reportType, source, limit },
      });
      return response.data;
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  backfillMetrics: async (clientId?: string): Promise<{ status: string } | undefined> => {
    try {
      const response = await axios.post(`${API_BASE_URL}/reports/backfill-metrics`, null, {
        params: clientId ? { client_id: clientId } : {},
      });
      return response.data;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  },

  // ── Performance Dashboard ──
  getDashboardPerformance: async (dateFrom: string, dateTo: string, clientIds?: string[]): Promise<DashboardRow[]> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/dashboard/performance`, {
        params: {
          date_from: dateFrom,
          date_to: dateTo,
          ...(clientIds && clientIds.length ? { client_ids: clientIds.join(',') } : {}),
        },
      });
      return response.data;
    } catch (e) {
      console.error('Failed to load dashboard performance', e);
      return [];
    }
  },

  getDashboardThresholds: async (): Promise<ThresholdConfig[]> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/dashboard/thresholds`);
      return response.data;
    } catch (e) {
      console.error('Failed to load global thresholds', e);
      return [];
    }
  },

  saveDashboardThresholds: async (thresholds: ThresholdConfig[]): Promise<ThresholdConfig[]> => {
    try {
      const response = await axios.put(`${API_BASE_URL}/dashboard/thresholds`, { thresholds });
      return response.data;
    } catch (e) {
      console.error('Failed to save global thresholds', e);
      return [];
    }
  },

  getClientThresholds: async (clientId: string): Promise<ThresholdConfig[]> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/clients/${clientId}/thresholds`);
      return response.data;
    } catch (e) {
      console.error('Failed to load client thresholds', e);
      return [];
    }
  },

  saveClientThresholdOverrides: async (
    clientId: string,
    overrides: Record<string, ThresholdOverride>,
  ): Promise<Client | undefined> => {
    try {
      const response = await axios.patch(`${API_BASE_URL}/clients/${clientId}/thresholds`, { overrides });
      return response.data;
    } catch (e) {
      console.error('Failed to save client thresholds', e);
      return undefined;
    }
  },

  updateClientPriority: async (clientId: string, priority: number | null): Promise<Client | undefined> => {
    try {
      const response = await axios.patch(`${API_BASE_URL}/clients/${clientId}/priority`, { priority });
      return response.data;
    } catch (e) {
      console.error('Failed to update client priority', e);
      return undefined;
    }
  },
};
