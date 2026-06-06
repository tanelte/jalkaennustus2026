'use client';

import { Medal } from 'lucide-react';
import { startTransition, useActionState, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { SubmitButton } from '@/components/submit-button';
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

const MEDAL_TONE: Record<FinalSlot, string> = {
  F1: 'text-yellow-500',
  F2: 'text-gray-400',
  F3: 'text-amber-700',
  F4: 'text-text-muted',
};

export interface FinalFormProps {
  candidates: readonly CandidateTeamView[];
  initialPicks: Partial<Record<FinalSlot, string>>;
  slotsOrder: readonly FinalSlot[];
  disabled: boolean;
  gateClosed?: boolean;
}

export function FinalForm({
  candidates,
  initialPicks,
  slotsOrder,
  disabled,
  gateClosed = false,
}: FinalFormProps) {
  const [state, formAction, pending] = useActionState(submitFinalPicks, initialState);
  const [picks, setPicks] = useState<Partial<Record<FinalSlot, string>>>(initialPicks);

  function onPick(slot: FinalSlot, teamId: string) {
    setPicks((prev) => ({ ...prev, [slot]: teamId || undefined }));
  }

  const filledCount = slotsOrder.filter((s) => picks[s]).length;
  const allFilled = filledCount === slotsOrder.length;

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
        {slotsOrder.map((slot) => {
          const inputId = `${FORM_FIELD_PREFIX}${slot}`;
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
                name={inputId}
                value={picks[slot] ?? ''}
                disabled={disabled}
                onChange={(e) => onPick(slot, e.target.value)}
                className="rounded-md border border-border-default bg-surface-card px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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

      <p className="text-sm text-text-muted" aria-live="polite">
        Valitud:{' '}
        <strong className="text-text-primary">
          {filledCount} / {slotsOrder.length}
        </strong>
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
            disabled={!allFilled}
            className="bg-brand-green hover:bg-brand-green-hover"
          >
            Salvesta valikud
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
