'use client';

import { Check } from 'lucide-react';
import { useActionState, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { PinEntryModal } from '@/components/pin/pin-entry-modal';
import { SubmitButton } from '@/components/submit-button';
import { submitBestThirds, type SubmitBestThirdsState } from './actions';
import { GROUP_LETTERS, REQUIRED_PICKS } from './constants';

const initialState: SubmitBestThirdsState = {};

const ERROR_COPY: Record<string, string> = {
  invalid_count: 'Vali täpselt 8 gruppi.',
  invalid_letter: 'Üks valitud tähtedest ei kuulu gruppide A–L hulka.',
  duplicate: 'Iga grupi tähte saab valida vaid ühe korra.',
  stage_closed: 'Best-thirds ennustuse aken on suletud.',
  stage_not_yet: 'Best-thirds ennustuse aken ei ole veel avatud.',
  stage_not_found: 'Best-thirds etappi ei leitud — võta ühendust korraldajaga.',
  no_user: 'Vali kõigepealt kasutaja.',
  no_session: 'Logi sisse uuesti.',
  pin_required: 'Sisesta oma PIN, et muudatusi salvestada.',
  pin_rate_limited:
    'Liiga palju vale PIN-i katseid. Proovi mõne minuti pärast (või kasuta "Unustasid PIN-i?").',
};

export interface BestThirdsFormProps {
  initialPicks: readonly string[];
  disabled?: boolean;
  gateClosed?: boolean;
  userId: string;
}

export function BestThirdsForm({
  initialPicks,
  disabled = false,
  gateClosed = false,
  userId,
}: BestThirdsFormProps) {
  const [state, formAction, pending] = useActionState(submitBestThirds, initialState);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialPicks));
  const [pinModalOpen, setPinModalOpen] = useState(false);

  useEffect(() => {
    if (state.error === 'pin_required') setPinModalOpen(true);
  }, [state.error]);

  function toggle(letter: string) {
    if (disabled) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(letter)) next.delete(letter);
      else if (next.size < REQUIRED_PICKS) next.add(letter);
      return next;
    });
  }

  const count = selected.size;

  return (
    <form action={formAction} className="space-y-5" noValidate>
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

      <p className="text-sm text-text-muted" aria-live="polite">
        Valitud:{' '}
        <strong className="text-text-primary">{count}</strong> / {REQUIRED_PICKS}
      </p>

      {state.error && ERROR_COPY[state.error] && (
        <p role="alert" className="text-sm text-state-closed-text">
          {ERROR_COPY[state.error]}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-sm text-brand-green">
          Ennustus salvestatud.
        </p>
      )}

      <div className="flex justify-end pt-2">
        {gateClosed ? (
          <Badge
            variant="outline"
            className="border-state-closed-text bg-state-closed-bg text-state-closed-text"
          >
            Suletud
          </Badge>
        ) : (
          <SubmitButton
            pendingOverride={pending}
            disabled={count !== REQUIRED_PICKS}
            className="bg-brand-green hover:bg-brand-green-hover"
          >
            Salvesta valikud
          </SubmitButton>
        )}
      </div>
      <PinEntryModal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        userId={userId}
      />
    </form>
  );
}
