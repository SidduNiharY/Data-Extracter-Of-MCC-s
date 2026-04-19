'use client';
import React from 'react';
import { DashboardRow, ThresholdConfig } from '@/types';
import MetricCell from './MetricCell';
import PriorityCell from './PriorityCell';

interface DashboardTableProps {
  rows: DashboardRow[];
  thresholds: ThresholdConfig[];
  onPriorityChanged: (clientId: string, newPriority: number | null) => void;
}

export default function DashboardTable({ rows, thresholds, onPriorityChanged }: DashboardTableProps) {
  return (
    <div className="glass-panel" style={{ overflow: 'auto' }}>
      <table className="data-table" style={{ minWidth: '1200px' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'center', width: '80px' }}>Priority</th>
            <th>Account Name</th>
            <th style={{ textAlign: 'right' }}>Impressions</th>
            <th style={{ textAlign: 'right' }}>Clicks</th>
            <th style={{ textAlign: 'right' }}>Cost</th>
            <th style={{ textAlign: 'right' }}>CPC</th>
            <th style={{ textAlign: 'right' }}>Orders</th>
            <th style={{ textAlign: 'right' }}>Revenue</th>
            <th style={{ textAlign: 'right' }}>R/C</th>
            <th style={{ textAlign: 'right' }}>Orders (Shopify)</th>
            <th style={{ textAlign: 'right' }}>Revenue (Shopify)</th>
            <th style={{ textAlign: 'right' }}>ROAS (Shopify)</th>
            <th style={{ textAlign: 'right' }}>Orders (GA4)</th>
            <th style={{ textAlign: 'right' }}>Revenue (GA4)</th>
            <th style={{ textAlign: 'right' }}>ROAS (GA4)</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={15} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
                No clients match the current filters.
              </td>
            </tr>
          ) : (
            rows.map(r => (
              <tr key={r.client_id}>
                <td style={{ textAlign: 'center' }}>
                  <PriorityCell
                    clientId={r.client_id}
                    priority={r.priority}
                    onSaved={p => onPriorityChanged(r.client_id, p)}
                  />
                </td>
                <td style={{ fontWeight: 500 }}>{r.client_name}</td>
                <td style={{ textAlign: 'right' }}>
                  <MetricCell value={r.impressions} metricName="impressions" thresholds={thresholds} />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MetricCell value={r.clicks} metricName="clicks" thresholds={thresholds} />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MetricCell value={r.cost} metricName="cost" thresholds={thresholds} format="currency" />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MetricCell value={r.cpc} metricName="cpc" thresholds={thresholds} format="currency" />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MetricCell value={r.orders} metricName="orders" thresholds={thresholds} />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MetricCell value={r.revenue} metricName="revenue" thresholds={thresholds} format="currency" />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MetricCell value={r.rc_ratio} metricName="rc_ratio" thresholds={thresholds} format="ratio" />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MetricCell value={r.shopify_orders} metricName="orders" thresholds={thresholds} />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MetricCell value={r.shopify_revenue} metricName="revenue" thresholds={thresholds} format="currency" />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MetricCell value={r.shopify_roas} metricName="roas" thresholds={thresholds} format="ratio" />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MetricCell value={r.ga4_orders} metricName="orders" thresholds={thresholds} />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MetricCell value={r.ga4_revenue} metricName="revenue" thresholds={thresholds} format="currency" />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MetricCell value={r.ga4_roas} metricName="roas" thresholds={thresholds} format="ratio" />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
