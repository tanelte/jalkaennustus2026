'use client';

import { startTransition, useActionState, useMemo, useState } from 'react';
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

  const submittable = !hasDuplicate && !pending;
  const allFilled = filled === FINAL_SLOTS.length;

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
      className="mt-2 space-y-4"
      noValidate
    >
      <div className="space-y-3">
        {FINAL_SLOTS.map((slot) => {
          const inputId = `admin_${FORM_FIELD_PREFIX}${slot}`;
          return (
            <div key={slot} className="flex flex-col gap-2 rounded border bg-white p-3">
              <label htmlFor={inputId} className="text-sm font-medium text-gray-900">
                {FINAL_SLOT_LABELS_ET[slot]}
              </label>
              <select
                id={inputId}
                name={`${FORM_FIELD_PREFIX}${slot}`}
                value={picks[slot] ?? ''}
                onChange={(e) => onPick(slot, e.target.value)}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
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

      <p className="text-sm text-gray-600" aria-live="polite">
        Täidetud: <strong>{filled} / {FINAL_SLOTS.length}</strong>
        {!allFilled && (
          <span className="ml-2 text-gray-500">
            (saad salvestada ka osalise komplekti — ümberarvutus käivitub
            alles siis, kui kõik neli on täidetud)
          </span>
        )}
        {hasDuplicate && (
          <span className="ml-2 text-red-700">
            Sama meeskond on valitud mitmel kohal — palun paranda.
          </span>
        )}
      </p>

      {state.error && ERROR_COPY[state.error] && (
        <p role="alert" className="text-sm text-red-700">
          {ERROR_COPY[state.error]}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-sm text-green-700">
          Salvestatud.
          {typeof state.rescored === 'number' && (
            <> Ümber arvutatud rividuid: <strong>{state.rescored}</strong>.</>
          )}
        </p>
      )}

      <button
        type="submit"
        disabled={!submittable}
        className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
      >
        {pending
          ? 'Salvestan…'
          : allFilled
          ? 'Kinnita ametlik komplekt'
          : `Salvesta (${filled}/${FINAL_SLOTS.length})`}
      </button>
    </form>
  );
}
