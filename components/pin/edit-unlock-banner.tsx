'use client';

import { KeyRound } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Prominent top-of-form banner shown on every prediction-write surface when
 * the user is PIN-protected and not yet unlocked (`mode === 'pending-unlock'`).
 * Surfaces the "Muuda" call-to-action at the top so users don't have to
 * scroll to find it. Modal open state lives in the parent form component;
 * this banner is a stateless presentational wrapper around the trigger.
 */
export function EditUnlockBanner({ onUnlockClick }: { onUnlockClick: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-brand-green/30 bg-brand-green-soft p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-text-body">
        Sinu ennustused on PIN-iga kaitstud. Klõpsa{' '}
        <strong>Muuda</strong>, et muudatusi teha.
      </p>
      <Button
        type="button"
        onClick={onUnlockClick}
        aria-label="Sisesta PIN, et alustada muutmist"
        className="bg-brand-green hover:bg-brand-green-hover"
      >
        <KeyRound aria-hidden="true" />
        Muuda
      </Button>
    </div>
  );
}
