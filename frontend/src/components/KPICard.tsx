'use client';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: string;
  change?: string | null;
  prefix?: string;
  suffix?: string;
  icon?: React.ReactNode;
  accentColor?: string;
}

export default function KPICard({ label, value, change, prefix = '', suffix = '', icon, accentColor = 'var(--accent-blue)' }: KPICardProps) {
  const changeNum = change ? parseFloat(change) : null;
  const isPositive = changeNum !== null && changeNum > 0;
  const isNegative = changeNum !== null && changeNum < 0;
  const isNeutral = changeNum === null || changeNum === 0;

  return (
    <div className="stat-card" style={{ position: 'relative' }}>
      {/* Accent glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${accentColor}, transparent)`,
        borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
        opacity: 0.7
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
        <span className="stat-card-label">{label}</span>
        {icon && (
          <div style={{
            width: 32, height: 32, borderRadius: 'var(--radius-md)',
            background: `${accentColor}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {icon}
          </div>
        )}
      </div>

      <div className="stat-card-value" style={{ marginBottom: 'var(--space-2)' }}>
        {prefix}{value}{suffix}
      </div>

      {change !== undefined && change !== null && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
          padding: '0.2rem 0.5rem',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.75rem', fontWeight: 600,
          background: isPositive ? 'var(--status-success-bg)' : isNegative ? 'var(--status-error-bg)' : 'rgba(255,255,255,0.05)',
          color: isPositive ? 'var(--status-success)' : isNegative ? 'var(--status-error)' : 'var(--text-muted)',
        }}>
          {isPositive ? <TrendingUp size={12} /> : isNegative ? <TrendingDown size={12} /> : <Minus size={12} />}
          {isPositive ? '+' : ''}{changeNum?.toFixed(1)}%
        </div>
      )}
    </div>
  );
}
