'use client';

import { startTransition, useActionState, useState } from 'react';
import { submitFinalPicks, type SubmitFinalPicksState } from './actions';
import {
  FINAL_SLOT_LABELS_ET,
  FORM_FIELD_PREFIX,
  type FinalSlot,
} from './constants';

export interface CandidateTeamView {
  id: string;
  code: string;
  name_et: string;
}

const initialState: SubmitFinalPicksState = {};

const ERROR_COPY: Record<string, string> = {
  no_session: 'Logi sisse uuesti.',
  no_user: 'Vali kõigepealt mängija.',
  missing_slot: 'Vali kõigile neljale kohale meeskond.',
  unknown_team: 'Üks valitud meeskondadest ei kuulu sellesse turniiri.',
  stage_closed: 'Finaali ennustuse aken on suletud.',
  stage_not_yet: 'Finaali ennustuse aken ei ole veel avatud.',
  stage_not_found: 'Finaali etappi ei leitud — võta ühendust korraldajaga.',
};

export interface FinalFormProps {
  candidates: readonly CandidateTeamView[];
  initialPicks: Partial<Record<FinalSlot, string>>;
  slotsOrder: readonly FinalSlot[];
  disabled: boolean;
}

export function FinalForm({
  candidates,
  initialPicks,
  slotsOrder,
  disabled,
}: FinalFormProps) {
  const [state, formAction, pending] = useActionState(submitFinalPicks, initialState);
  const [picks, setPicks] = useState<Partial<Record<FinalSlot, string>>>(initialPicks);

  function onPick(slot: FinalSlot, teamId: string) {
    setPicks((prev) => ({ ...prev, [slot]: teamId || undefined }));
  }

  const filledCount = slotsOrder.filter((s) => picks[s]).length;
  const allFilled = filledCount === slotsOrder.length;
  const submittable = allFilled && !disabled && !pending;

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
      className="mt-6 space-y-5"
      noValidate
    >
      <div className="space-y-3">
        {slotsOrder.map((slot) => {
          const inputId = `${FORM_FIELD_PREFIX}${slot}`;
          return (
            <div key={slot} className="flex flex-col gap-2 rounded border bg-white p-3">
              <label htmlFor={inputId} className="text-sm font-medium text-gray-900">
                {FINAL_SLOT_LABELS_ET[slot]}
              </label>
              <select
                id={inputId}
                name={inputId}
                value={picks[slot] ?? ''}
                disabled={disabled}
                onChange={(e) => onPick(slot, e.target.value)}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="">— vali meeskond —</option>
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
        Valitud:{' '}
        <strong>
          {filledCount} / {slotsOrder.length}
        </strong>
      </p>

      {state.error && ERROR_COPY[state.error] && (
        <p role="alert" className="text-sm text-red-700">
          {ERROR_COPY[state.error]}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-sm text-green-700">
          Ennustus salvestatud.
        </p>
      )}

      <button
        type="submit"
        disabled={!submittable}
        className="w-full rounded bg-black px-3 py-2 text-white disabled:opacity-50"
      >
        {pending ? 'Salvestan…' : 'Salvesta valikud'}
      </button>
    </form>
  );
}
