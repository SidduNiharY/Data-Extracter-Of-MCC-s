'use client';
import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';

interface PriorityCellProps {
  clientId: string;
  priority: number | null;
  onSaved: (newPriority: number | null) => void;
}

export default function PriorityCell({ clientId, priority, onSaved }: PriorityCellProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(priority !== null ? String(priority) : '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = async () => {
    const trimmed = value.trim();
    const parsed = trimmed === '' ? null : Number(trimmed);
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) {
      setValue(priority !== null ? String(priority) : '');
      setEditing(false);
      return;
    }
    setSaving(true);
    const updated = await api.updateClientPriority(clientId, parsed);
    setSaving(false);
    setEditing(false);
    if (updated) onSaved(parsed);
    else setValue(priority !== null ? String(priority) : '');
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={0}
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setValue(priority !== null ? String(priority) : '');
            setEditing(false);
          }
        }}
        disabled={saving}
        style={{
          width: '60px',
          padding: '0.25rem 0.5rem',
          background: 'var(--surface)',
          border: '1px solid var(--accent-blue)',
          borderRadius: '4px',
          color: 'var(--text-primary)',
          fontSize: '0.875rem',
          textAlign: 'center',
        }}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      style={{
        width: '60px',
        padding: '0.25rem 0.5rem',
        background: priority !== null ? 'rgba(59,130,246,0.12)' : 'transparent',
        color: priority !== null ? 'var(--accent-blue)' : 'var(--text-muted)',
        border: '1px dashed var(--surface-border)',
        borderRadius: '4px',
        fontSize: '0.875rem',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {priority !== null ? priority : '—'}
    </button>
  );
}
