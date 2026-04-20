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
      // Compact currency for larger values to keep columns tight
      if (Math.abs(value) >= 10000) {
        const compact = new Intl.NumberFormat('en-US', {
          notation: 'compact', maximumFractionDigits: 1,
        }).format(value);
        const sym = new Intl.NumberFormat('en-US', { style: 'currency', currency })
          .formatToParts(0).find(p => p.type === 'currency')?.value ?? '$';
        return `${sym}${compact}`;
      }
      return new Intl.NumberFormat('en-US', {
        style: 'currency', currency, maximumFractionDigits: 2,
      }).format(value);
    case 'percent':
      return `${value.toFixed(2)}%`;
    case 'ratio':
      return `${value.toFixed(2)}×`;
    case 'number':
    default:
      if (Math.abs(value) >= 10000) {
        return new Intl.NumberFormat('en-US', {
          notation: 'compact', maximumFractionDigits: 1,
        }).format(value);
      }
      return new Intl.NumberFormat('en-US').format(value);
  }
}

function getBandColor(
  value: number | null,
  threshold: ThresholdConfig | undefined,
): 'red' | 'green' | 'neutral' | 'empty' {
  if (value === null) return 'empty';
  if (!threshold) return 'neutral';
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

  const palette = {
    red:     { fg: '#f87171', shadow: 'inset 2px 0 0 #ef4444' },
    green:   { fg: '#34d399', shadow: 'inset 2px 0 0 #10b981' },
    neutral: { fg: 'var(--text-primary)', shadow: 'none' },
    empty:   { fg: 'var(--text-muted)', shadow: 'none' },
  }[band];

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.2rem 0.55rem 0.2rem 0.6rem',
        fontFamily: 'var(--font-mono), ui-monospace, monospace',
        fontSize: '0.825rem',
        fontWeight: band === 'red' || band === 'green' ? 600 : 400,
        color: palette.fg,
        boxShadow: palette.shadow,
        borderRadius: '3px',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.01em',
        minWidth: 52,
        textAlign: 'right',
      }}
    >
      {formatValue(value, format, currency)}
    </span>
  );
}
