'use client';
import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

export interface DateRange {
  from: string;
  to: string;
  label: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function makePresets(): DateRange[] {
  const today = new Date();
  const yday = new Date(today); yday.setDate(today.getDate() - 1);
  const last7 = new Date(today); last7.setDate(today.getDate() - 6);
  const last14 = new Date(today); last14.setDate(today.getDate() - 13);
  const last30 = new Date(today); last30.setDate(today.getDate() - 29);
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  return [
    { from: iso(today), to: iso(today), label: 'Today' },
    { from: iso(yday), to: iso(yday), label: 'Yesterday' },
    { from: iso(last7), to: iso(today), label: 'Last 7 days' },
    { from: iso(last14), to: iso(today), label: 'Last 14 days' },
    { from: iso(last30), to: iso(today), label: 'Last 30 days' },
    { from: iso(thisMonthStart), to: iso(today), label: 'This month' },
    { from: iso(lastMonthStart), to: iso(lastMonthEnd), label: 'Last month' },
  ];
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(value.from);
  const [customTo, setCustomTo] = useState(value.to);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const presets = makePresets();

  const applyCustom = () => {
    if (customFrom && customTo && customFrom <= customTo) {
      onChange({ from: customFrom, to: customTo, label: `${customFrom} → ${customTo}` });
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="btn btn-secondary"
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
      >
        <Calendar size={14} />
        {value.label}
        <ChevronDown size={14} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 100,
          background: 'var(--bg-secondary)', border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)', minWidth: '320px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: 'var(--space-4)' }}>
            {presets.map(p => (
              <button
                key={p.label}
                onClick={() => { onChange(p); setOpen(false); }}
                style={{
                  textAlign: 'left', padding: '0.5rem 0.75rem',
                  background: value.label === p.label ? 'rgba(59,130,246,0.12)' : 'transparent',
                  color: value.label === p.label ? 'var(--accent-blue)' : 'var(--text-primary)',
                  border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: 'var(--space-4)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'var(--space-2)', fontWeight: 600 }}>
              CUSTOM RANGE
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="form-input"
                style={{ flex: 1 }}
              />
              <span>→</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="form-input"
                style={{ flex: 1 }}
              />
            </div>
            <button
              onClick={applyCustom}
              className="btn btn-primary btn-sm"
              style={{ marginTop: 'var(--space-3)', width: '100%' }}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
