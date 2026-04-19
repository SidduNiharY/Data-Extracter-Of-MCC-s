'use client';
import { useState } from 'react';
import { ThresholdOverride } from '@/types';
import ClientThresholdOverrides from './ClientThresholdOverrides';

interface Props {
  clientId: string;
  initialOverrides: Record<string, ThresholdOverride>;
}

export default function ClientThresholdOverridesSection({ clientId, initialOverrides }: Props) {
  const [overrides, setOverrides] = useState<Record<string, ThresholdOverride>>(initialOverrides || {});

  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      <ClientThresholdOverrides
        clientId={clientId}
        existingOverrides={overrides}
        onSaved={setOverrides}
      />
    </div>
  );
}
