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
  mcc_id?: string | null;
  meta_ad_account_id: string | null;
  shopify_shop_domain: string | null;
  ga4_property_id: string | null;
  currency: string;
  timezone: string;
  is_active: boolean;
  report_settings?: ReportSettings;
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

// ── KPI / Report Settings ──

export interface KpiTargets {
  roas?: number;
  cpa?: number;
}

export interface ReportSettings {
  kpi_targets?: KpiTargets;
  enabled_sections?: string[];
  threshold_overrides?: Record<string, ThresholdOverride>;
}

// Analytics Types — all metrics from PDF spec
export interface MetricSummary {
  // Core
  impressions?: number;
  clicks?: number;
  spend?: number;
  conversions?: number;
  revenue?: number;
  orders?: number;
  sessions?: number;
  // Derived
  ctr?: number;
  cpc?: number;
  roas?: number;
  conversion_rate?: number;
  cost_per_conv?: number;
  avg_order_value?: number;
  // Meta-specific
  reach?: number;
  frequency?: number;
  cpm?: number;
  cost_per_result?: number;
  // GA4-specific
  active_users?: number;
  purchase_revenue?: number;
  transactions?: number;
  session_conversion_rate?: number;
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

// ── Manual Account Creation ──

export type Platform = 'google_ads' | 'meta_ads' | 'shopify' | 'ga4';

export interface ClientCreateRequest {
  name: string;
  platforms: Platform[];
  is_leadgen: boolean;
  google_ads_customer_id?: string;
  mcc_id?: string;
  meta_ad_account_id?: string;
  shopify_shop_domain?: string;
  ga4_property_id?: string;
  currency: string;
  timezone: string;
}

export interface CsvColumnDef {
  name: string;
  dtype: string;
  required: boolean;
  allowed: string[] | null;
}

export interface CsvTemplateInfo {
  source: string;
  table: string;
  label: string;
  client_types: string[];
  columns: CsvColumnDef[];
}

export interface CsvUploadResult {
  status: string;
  source: string;
  table: string;
  pull_job_id: string | null;
  rows_processed: number;
  rows_skipped?: number;   // rows ignored (totals rows, blank dates, etc.)
  warnings?: string[];     // non-fatal parse warnings (e.g. clamped CTR)
  message?: string;        // optional info message from server
}

// ── Report Metrics & Progress ──

export interface ReportMetric {
  id: string;
  report_id: string;
  client_id: string;
  source: string;
  metric_name: string;
  current_value: number | null;
  previous_value: number | null;
  change_pct: number | null;
  direction: 'up' | 'down' | 'flat' | null;
  created_at: string;
}

export interface ReportProgressRow {
  report_id: string;
  report_type: 'weekly' | 'monthly';
  period_start: string;
  period_end: string;
  status: string;
  generated_at: string | null;
  metrics: ReportMetric[];
}

// ── Performance Dashboard ──

export interface DashboardRow {
  client_id: string;
  client_name: string;
  priority: number | null;
  connected_sources: DataSource[];

  // Google Ads
  impressions: number | null;
  clicks: number | null;
  cost: number | null;
  cpc: number | null;

  // Cross-platform
  orders: number | null;
  revenue: number | null;
  rc_ratio: number | null;

  // Shopify
  shopify_orders: number | null;
  shopify_revenue: number | null;
  shopify_roas: number | null;

  // GA4
  ga4_orders: number | null;
  ga4_revenue: number | null;
  ga4_roas: number | null;
}

export interface ThresholdConfig {
  metric_name: string;
  red_below: number | null;
  green_above: number | null;
}

export interface ThresholdOverride {
  red_below: number | null;
  green_above: number | null;
}
