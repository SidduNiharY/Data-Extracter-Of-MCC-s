'use client';
import React from 'react';
import { ThresholdConfig } from '@/types';

interface MetricCellProps {
  value: number | null;
  metricName: string;
  thresholds: ThresholdConfig[];
  format?: 'number' | 'currency' | 'percent' | 'ratio';
  currency?: string;
}

function formatValue(
  value: number | null,
  format: 'number' | 'currency' | 'percent' | 'ratio',
  currency: string,
): string {
  if (value === null || value === undefined) return '—';
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency', currency, maximumFractionDigits: 2,
      }).format(value);
    case 'percent':
      return `${value.toFixed(2)}%`;
    case 'ratio':
      return `${value.toFixed(2)}x`;
    case 'number':
    default:
      return new Intl.NumberFormat('en-US').format(value);
  }
}

function getBandColor(
  value: number | null,
  threshold: ThresholdConfig | undefined,
): 'red' | 'green' | 'neutral' {
  if (value === null || !threshold) return 'neutral';
  if (threshold.red_below !== null && value < threshold.red_below) return 'red';
  if (threshold.green_above !== null && value > threshold.green_above) return 'green';
  return 'neutral';
}

export default function MetricCell({
  value,
  metricName,
  thresholds,
  format = 'number',
  currency = 'USD',
}: MetricCellProps) {
  const threshold = thresholds.find(t => t.metric_name === metricName);
  const band = getBandColor(value, threshold);

  const colors = {
    red: { bg: 'rgba(239,68,68,0.12)', fg: '#ef4444' },
    green: { bg: 'rgba(16,185,129,0.12)', fg: '#10b981' },
    neutral: { bg: 'transparent', fg: 'var(--text-primary)' },
  }[band];

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.25rem 0.5rem',
        borderRadius: '4px',
        background: colors.bg,
        color: colors.fg,
        fontWeight: band === 'neutral' ? 400 : 600,
        fontSize: '0.875rem',
        fontVariantNumeric: 'tabular-nums',
        minWidth: '60px',
        textAlign: 'right',
      }}
    >
      {formatValue(value, format, currency)}
    </span>
  );
}
