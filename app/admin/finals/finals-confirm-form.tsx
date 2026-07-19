'use client';

import { Medal } from 'lucide-react';
import { startTransition, useActionState, useMemo, useState } from 'react';

import { SubmitButton } from '@/components/submit-button';
import { confirmFinals, type ConfirmFinalsState } from './actions';
import {
  FINAL_SLOTS,
  FINAL_SLOT_LABELS_ET,
  FORM_FIELD_PREFIX,
  type FinalSlot,
} from '@/app/predict/final/constants';

export interface CandidateTeamView {
  id: string;
  code: string;
  name_et: string;
}

const initialState: ConfirmFinalsState = {};

const ERROR_COPY: Record<string, string> = {
  no_session: 'Logi sisse uuesti.',
  not_operator: 'Operaatori õigused puuduvad.',
  duplicate_team: 'Iga meeskonda saab valida ainult ühel kohal.',
  unknown_team: 'Üks valitud meeskondadest ei kuulu sellesse turniiri.',
};

// Mirror the player surface's medal tone (S05) so operator + player views are
// visually aligned per UX §15.4 / §15.9.
const MEDAL_TONE: Record<FinalSlot, string> = {
  F1: 'text-yellow-500',
  F2: 'text-gray-400',
  F3: 'text-amber-700',
  F4: 'text-text-muted',
};

export interface FinalsConfirmFormProps {
  initialOfficial: Partial<Record<FinalSlot, string>>;
  candidates: readonly CandidateTeamView[];
}

export function FinalsConfirmForm({
  initialOfficial,
  candidates,
}: FinalsConfirmFormProps) {
  const [state, formAction, pending] = useActionState(confirmFinals, initialState);
  const [picks, setPicks] = useState<Partial<Record<FinalSlot, string>>>(initialOfficial);

  function onPick(slot: FinalSlot, teamId: string) {
    setPicks((prev) => ({ ...prev, [slot]: teamId || undefined }));
  }

  const { filled, hasDuplicate } = useMemo(() => {
    const values = FINAL_SLOTS.map((s) => picks[s]).filter((v): v is string => Boolean(v));
    return {
      filled: values.length,
      hasDuplicate: new Set(values).size !== values.length,
    };
  }, [picks]);

  const allFilled = filled === FINAL_SLOTS.length;
  const submittable = !hasDuplicate && !pending;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        // React 19's <form action=…> auto-resets uncontrolled inputs after a
        // successful submit and mangles <select> via the option's
        // defaultSelected attribute — even controlled selects flicker back to
        // their initial value. Driving the action via onSubmit + startTransition
        // sidesteps that reset while keeping useActionState's `pending` accurate.
        startTransition(() => formAction(formData));
      }}
      className="space-y-5"
      noValidate
    >
      <div className="space-y-3">
        {FINAL_SLOTS.map((slot) => {
          const inputId = `admin_${FORM_FIELD_PREFIX}${slot}`;
          return (
            <div
              key={slot}
              className="flex flex-col gap-2 rounded-lg border border-border-default bg-surface-card p-4"
            >
              <label
                htmlFor={inputId}
                className="flex items-center gap-2 text-sm font-medium text-text-primary"
              >
                <Medal
                  aria-hidden="true"
                  className={`h-4 w-4 ${MEDAL_TONE[slot]}`}
                />
                {FINAL_SLOT_LABELS_ET[slot]}
              </label>
              <select
                id={inputId}
                name={`${FORM_FIELD_PREFIX}${slot}`}
                value={picks[slot] ?? ''}
                onChange={(e) => onPick(slot, e.target.value)}
                className="rounded-md border border-border-default bg-surface-card px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2"
              >
                <option value="">— tühi (osaline komplekt) —</option>
                {candidates.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name_et} ({team.code})
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-text-muted" aria-live="polite">
        Täidetud:{' '}
        <strong className="text-text-primary">
          {filled} / {FINAL_SLOTS.length}
        </strong>
        {!allFilled && (
          <span className="ml-2 text-text-muted">
            (salvestamisel arvutatakse punktid kohe kinnitatud kohtade eest —
            ülejäänud kohad saad lisada hiljem)
          </span>
        )}
        {hasDuplicate && (
          <span className="ml-2 text-state-closed-text">
            Sama meeskond on valitud mitmel kohal — palun paranda.
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
          Salvestatud.
          {typeof state.rescored === 'number' && (
            <>
              {' '}
              Ümber arvutatud ennustusi:{' '}
              <strong className="text-text-primary">{state.rescored}</strong>.
            </>
          )}
        </p>
      )}

      <div className="flex justify-end pt-2">
        <SubmitButton
          pendingOverride={pending}
          disabled={!submittable}
          className="bg-brand-green hover:bg-brand-green-hover"
          pendingLabel="Salvestab…"
        >
          {allFilled
            ? 'Kinnita ametlik komplekt'
            : `Salvesta (${filled}/${FINAL_SLOTS.length})`}
        </SubmitButton>
      </div>
    </form>
  );
}
