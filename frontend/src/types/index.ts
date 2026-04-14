export type ClientType =
  | 'google_only'
  | 'meta_only'
  | 'google_meta'
  | 'ecomm_shopify'
  | 'ecomm_ga4'
  | 'leadgen';

export type DataSource = 'google_ads' | 'meta_ads' | 'shopify' | 'ga4';

export type JobStatus = 'pending' | 'running' | 'success' | 'failed' | 'partial';

export interface Client {
  id: string;
  name: string;
  type: ClientType;
  google_ads_customer_id: string | null;
  meta_ad_account_id: string | null;
  shopify_shop_domain: string | null;
  ga4_property_id: string | null;
  currency: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Connection {
  id: string;
  client_id: string;
  source: DataSource;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

export interface PullJob {
  id: string;
  client_id: string;
  source: string;
  status: JobStatus;
  date_range_start: string;
  date_range_end: string;
  rows_pulled: number | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// Analytics Types
export interface MetricSummary {
  impressions?: number;
  clicks?: number;
  spend?: number;
  conversions?: number;
  revenue?: number;
  orders?: number;
  sessions?: number;
}

export interface PlatformMetrics {
  google?: MetricSummary;
  meta?: MetricSummary;
  shopify?: MetricSummary;
  ga4?: MetricSummary;
}

export interface MCCAccount {
  customer_id: string; // Used for Google Ads CID
  name: string;
  is_imported?: boolean;
  token_limited?: boolean;
  meta_id?: string;
  shop_domain?: string;
}

export interface MCCAccountsResponse {
  accounts: MCCAccount[];
  token_limited: boolean;
  token_warning: string | null;
}

// ── Report Types ──

export interface ReportSection {
  id: string;
  report_id: string;
  source: string;
  section_type: string;
  data: Record<string, unknown>;
  created_at: string;
}

export interface Report {
  id: string;
  client_id: string;
  report_type: 'weekly' | 'monthly';
  period_start: string;
  period_end: string;
  status: 'generating' | 'ready' | 'failed';
  error_message: string | null;
  generated_at: string | null;
  created_at: string;
  sections: ReportSection[];
}

export interface ReportSummary {
  id: string;
  client_id: string;
  report_type: 'weekly' | 'monthly';
  period_start: string;
  period_end: string;
  status: 'generating' | 'ready' | 'failed';
  error_message: string | null;
  generated_at: string | null;
  created_at: string;
  section_count: number;
}

export interface GenerateReportRequest {
  client_id: string;
  report_type: 'weekly' | 'monthly';
  period_start?: string;
  period_end?: string;
  year?: number;
  month?: number;
}
