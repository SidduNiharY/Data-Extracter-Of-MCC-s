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

const thStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  fontFamily: 'var(--font-mono), ui-monospace, monospace',
  fontSize: '0.6875rem',
  fontWeight: 500,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  borderBottom: '1px solid var(--surface-border)',
  background: 'rgba(255,255,255,0.015)',
  whiteSpace: 'nowrap',
};

const thRight: React.CSSProperties = { ...thStyle, textAlign: 'right' };
const thCenter: React.CSSProperties = { ...thStyle, textAlign: 'center' };

const tdBase: React.CSSProperties = {
  padding: '0.85rem 1rem',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
  fontSize: '0.875rem',
};

const groupHead: React.CSSProperties = {
  ...thStyle,
  fontSize: '0.625rem',
  color: 'var(--accent-amber)',
  letterSpacing: '0.18em',
  borderBottom: '1px solid var(--accent-amber-line)',
  background: 'rgba(245,165,36,0.03)',
  textAlign: 'center',
};

export default function DashboardTable({ rows, thresholds, onPriorityChanged }: DashboardTableProps) {
  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{
        width: '100%',
        minWidth: '1280px',
        borderCollapse: 'collapse',
        textAlign: 'left',
      }}>
        <thead>
          {/* Grouping row */}
          <tr>
            <th colSpan={2} style={{ ...groupHead, textAlign: 'left', paddingLeft: '1.25rem' }}>Account</th>
            <th colSpan={7} style={groupHead}>Ads · Campaign Performance</th>
            <th colSpan={3} style={groupHead}>Shopify</th>
            <th colSpan={3} style={groupHead}>GA4</th>
          </tr>
          <tr>
            <th style={{ ...thCenter, width: 72 }}>Rank</th>
            <th style={{ ...thStyle, paddingLeft: '1.25rem' }}>Client</th>
            <th style={thRight}>Impr.</th>
            <th style={thRight}>Clicks</th>
            <th style={thRight}>Cost</th>
            <th style={thRight}>CPC</th>
            <th style={thRight}>Orders</th>
            <th style={thRight}>Revenue</th>
            <th style={thRight}>R/C</th>
            <th style={thRight}>Orders</th>
            <th style={thRight}>Revenue</th>
            <th style={thRight}>ROAS</th>
            <th style={thRight}>Orders</th>
            <th style={thRight}>Revenue</th>
            <th style={thRight}>ROAS</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={15}
                style={{
                  textAlign: 'center',
                  padding: '4rem 2rem',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-display), Georgia, serif',
                  fontStyle: 'italic',
                  fontSize: '1.05rem',
                }}
              >
                No accounts match the current filters.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr
                key={r.client_id}
                style={{ transition: 'background 0.15s ease' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,165,36,0.025)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ ...tdBase, textAlign: 'center' }}>
                  <PriorityCell
                    clientId={r.client_id}
                    priority={r.priority}
                    onSaved={p => onPriorityChanged(r.client_id, p)}
                  />
                </td>
                <td style={{
                  ...tdBase,
                  paddingLeft: '1.25rem',
                  fontFamily: 'var(--font-display), Georgia, serif',
                  fontSize: '1rem',
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                }}>
                  {r.client_name}
                  <div style={{
                    marginTop: 2,
                    fontFamily: 'var(--font-mono), ui-monospace, monospace',
                    fontSize: '0.65rem',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}>
                    {r.connected_sources.length > 0 ? r.connected_sources.join(' · ') : 'no connections'}
                  </div>
                </td>
                <td style={{ ...tdBase, textAlign: 'right' }}>
                  <MetricCell value={r.impressions} metricName="impressions" thresholds={thresholds} />
                </td>
                <td style={{ ...tdBase, textAlign: 'right' }}>
                  <MetricCell value={r.clicks} metricName="clicks" thresholds={thresholds} />
                </td>
                <td style={{ ...tdBase, textAlign: 'right' }}>
                  <MetricCell value={r.cost} metricName="cost" thresholds={thresholds} format="currency" />
                </td>
                <td style={{ ...tdBase, textAlign: 'right' }}>
                  <MetricCell value={r.cpc} metricName="cpc" thresholds={thresholds} format="currency" />
                </td>
                <td style={{ ...tdBase, textAlign: 'right' }}>
                  <MetricCell value={r.orders} metricName="orders" thresholds={thresholds} />
                </td>
                <td style={{ ...tdBase, textAlign: 'right' }}>
                  <MetricCell value={r.revenue} metricName="revenue" thresholds={thresholds} format="currency" />
                </td>
                <td style={{ ...tdBase, textAlign: 'right' }}>
                  <MetricCell value={r.rc_ratio} metricName="rc_ratio" thresholds={thresholds} format="ratio" />
                </td>
                <td style={{ ...tdBase, textAlign: 'right' }}>
                  <MetricCell value={r.shopify_orders} metricName="orders" thresholds={thresholds} />
                </td>
                <td style={{ ...tdBase, textAlign: 'right' }}>
                  <MetricCell value={r.shopify_revenue} metricName="revenue" thresholds={thresholds} format="currency" />
                </td>
                <td style={{ ...tdBase, textAlign: 'right' }}>
                  <MetricCell value={r.shopify_roas} metricName="roas" thresholds={thresholds} format="ratio" />
                </td>
                <td style={{ ...tdBase, textAlign: 'right' }}>
                  <MetricCell value={r.ga4_orders} metricName="orders" thresholds={thresholds} />
                </td>
                <td style={{ ...tdBase, textAlign: 'right' }}>
                  <MetricCell value={r.ga4_revenue} metricName="revenue" thresholds={thresholds} format="currency" />
                </td>
                <td style={{ ...tdBase, textAlign: 'right' }}>
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
