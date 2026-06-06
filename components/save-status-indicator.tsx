'use client';

import { AlertCircle, Check, CircleDashed, Loader2 } from 'lucide-react';

import type { AutoSaveStatus } from '@/lib/hooks/use-autosave';

export interface SaveStatusIndicatorProps {
  status: AutoSaveStatus;
  lastSavedAt: Date | null;
  /** Localized human-readable error message; rendered only when status === 'error'. */
  errorMessage?: string | null;
  className?: string;
}

function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mn = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mn}`;
}

export function SaveStatusIndicator({
  status,
  lastSavedAt,
  errorMessage,
  className,
}: SaveStatusIndicatorProps) {
  const base = `inline-flex items-center gap-1.5 text-xs ${className ?? ''}`;
  if (status === 'saving') {
    return (
      <span role="status" aria-live="polite" className={`${base} text-text-muted`}>
        <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
        Salvestab…
      </span>
    );
  }
  if (status === 'dirty') {
    return (
      <span role="status" aria-live="polite" className={`${base} text-text-muted`}>
        <CircleDashed aria-hidden="true" className="h-3.5 w-3.5" />
        Salvestamata muudatused
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span role="alert" className={`${base} text-state-closed-text`}>
        <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />
        Viga: {errorMessage ?? 'ei salvestunud — proovi uuesti'}
      </span>
    );
  }
  if (status === 'saved' && lastSavedAt) {
    return (
      <span role="status" aria-live="polite" className={`${base} text-brand-green`}>
        <Check aria-hidden="true" className="h-3.5 w-3.5" />
        Salvestatud kell {formatTime(lastSavedAt)}
      </span>
    );
  }
  return null;
}
