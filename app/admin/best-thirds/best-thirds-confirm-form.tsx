'use client';

import { Check } from 'lucide-react';
import { useActionState, useState } from 'react';

import { SubmitButton } from '@/components/submit-button';
import { confirmBestThirds, type ConfirmBestThirdsState } from './actions';
import {
  GROUP_LETTERS,
  REQUIRED_PICKS,
} from '@/app/predict/best-thirds/constants';

const initialState: ConfirmBestThirdsState = {};

const ERROR_COPY: Record<string, string> = {
  no_session: 'Logi sisse uuesti.',
  not_operator: 'Operaatori õigused puuduvad.',
  too_many: 'Maksimaalselt 8 tähte (komplekti suurus on 8).',
  invalid_letter: 'Üks valitud tähtedest ei kuulu gruppide A–L hulka.',
  duplicate: 'Iga grupi tähte saab valida vaid ühe korra.',
};

export function BestThirdsConfirmForm({
  initialLetters,
}: {
  initialLetters: readonly string[];
}) {
  const [state, formAction, pending] = useActionState(confirmBestThirds, initialState);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialLetters));

  function toggle(letter: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(letter)) next.delete(letter);
      else if (next.size < REQUIRED_PICKS) next.add(letter);
      return next;
    });
  }

  const count = selected.size;
  // Operator may save partial progress (0..8). Player picker (S05) still
  // requires exactly 8 -- that lives in a separate file.
  const submittable = count <= REQUIRED_PICKS && !pending;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div
        className="grid grid-cols-4 gap-3 sm:grid-cols-6"
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
              }`}
            >
              <input
                type="checkbox"
                name="letters"
                value={letter}
                checked={checked}
                onChange={() => toggle(letter)}
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
        {count < REQUIRED_PICKS && (
          <span className="ml-2 text-text-muted">
            (saad salvestada ka osalise komplekti)
          </span>
        )}
      </p>

      {state.error && ERROR_COPY[state.error] && (
        <p role="alert" className="text-sm text-state-closed-text">
          {ERROR_COPY[state.error]}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-sm text-brand-green">
          Salvestatud. Ümber arvutatud ennustusi:{' '}
          <strong className="text-text-primary">{state.rescored ?? 0}</strong>.
        </p>
      )}

      <div className="flex justify-end pt-2">
        <SubmitButton
          pendingOverride={pending}
          disabled={!submittable}
          className="bg-brand-green hover:bg-brand-green-hover"
        >
          {count === REQUIRED_PICKS
            ? 'Kinnita ametlik komplekt'
            : `Salvesta (${count}/${REQUIRED_PICKS})`}
        </SubmitButton>
      </div>
    </form>
  );
}
