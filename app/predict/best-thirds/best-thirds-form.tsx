'use client';

import { Check, KeyRound } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PinEntryModal } from '@/components/pin/pin-entry-modal';
import { SaveStatusIndicator } from '@/components/save-status-indicator';
import { useAutoSave } from '@/lib/hooks/use-autosave';
import type { EditMode } from '@/lib/pin/edit-mode';
import { toggleBestThirdsLetter } from './actions';
import { GROUP_LETTERS, REQUIRED_PICKS } from './constants';

const ERROR_COPY: Record<string, string> = {
  invalid_letter: 'Üks valitud tähtedest ei kuulu gruppide A–L hulka.',
  stage_closed: 'Best-thirds ennustuse aken on suletud.',
  stage_not_yet: 'Best-thirds ennustuse aken ei ole veel avatud.',
  stage_not_found: 'Best-thirds etappi ei leitud — võta ühendust korraldajaga.',
  no_user: 'Vali kõigepealt kasutaja.',
  no_session: 'Logi sisse uuesti.',
  pin_required:
    'PIN-i sessioon aegus. Värskenda lehte ja klõpsa Muuda nuppu uuesti.',
  pin_rate_limited:
    'Liiga palju vale PIN-i katseid. Proovi mõne minuti pärast (või kasuta "Unustasid PIN-i?").',
  network_error: 'Võrguviga — proovi uuesti.',
};

export interface BestThirdsFormProps {
  initialPicks: readonly string[];
  mode: EditMode;
  userId: string;
  maskedRecoveryEmail?: string | null;
}

export function BestThirdsForm({
  initialPicks,
  mode,
  userId,
  maskedRecoveryEmail,
}: BestThirdsFormProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialPicks));
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const autosave = useAutoSave();

  const disabled = mode !== 'edit';

  function toggle(letter: string) {
    if (disabled) return;
    const wasSelected = selected.has(letter);
    // The UI cap is informational: prevent the user from over-picking past 8.
    // The server itself accepts partial selections.
    if (!wasSelected && selected.size >= REQUIRED_PICKS) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (wasSelected) next.delete(letter);
      else next.add(letter);
      return next;
    });
    autosave.schedule(`letter:${letter}`, () =>
      toggleBestThirdsLetter(letter, !wasSelected),
    );
  }

  const count = selected.size;
  const errorMessage = autosave.errorCode
    ? ERROR_COPY[autosave.errorCode] ?? null
    : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-muted" aria-live="polite">
          Valitud:{' '}
          <strong className="text-text-primary">{count}</strong> / {REQUIRED_PICKS}
        </p>
        <SaveStatusIndicator
          status={autosave.status}
          lastSavedAt={autosave.lastSavedAt}
          errorMessage={errorMessage}
        />
      </div>

      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        role="group"
        aria-label="Grupid"
      >
        {GROUP_LETTERS.map((letter) => {
          const checked = selected.has(letter);
          return (
            <label
              key={letter}
              className={`relative flex h-16 cursor-pointer items-center justify-center rounded-lg border text-xl font-semibold transition-colors ${
                checked
                  ? 'border-brand-green bg-brand-green text-white shadow-sm'
                  : 'border-border-default bg-surface-card text-text-primary hover:border-brand-green/40'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="checkbox"
                name="letters"
                value={letter}
                checked={checked}
                onChange={() => toggle(letter)}
                disabled={disabled}
                className="sr-only"
              />
              <span>{letter}</span>
              {checked && (
                <Check
                  aria-hidden="true"
                  className="absolute right-1.5 top-1.5 h-3.5 w-3.5"
                />
              )}
            </label>
          );
        })}
      </div>

      {mode !== 'edit' && (
        <div className="flex justify-end pt-2">
          {mode === 'closed' ? (
            <Badge
              variant="outline"
              className="border-state-closed-text bg-state-closed-bg text-state-closed-text"
            >
              Suletud
            </Badge>
          ) : (
            <Button
              type="button"
              onClick={() => setPinModalOpen(true)}
              aria-label="Sisesta PIN, et alustada muutmist"
              className="bg-brand-green hover:bg-brand-green-hover"
            >
              <KeyRound aria-hidden="true" />
              Muuda
            </Button>
          )}
        </div>
      )}

      <PinEntryModal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        userId={userId}
        maskedRecoveryEmail={maskedRecoveryEmail}
      />
    </div>
  );
}
