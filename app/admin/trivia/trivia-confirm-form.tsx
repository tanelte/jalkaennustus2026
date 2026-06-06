'use client';

import { startTransition, useActionState, useState } from 'react';

import { SubmitButton } from '@/components/submit-button';
import { confirmTriviaAnswers, type ConfirmTriviaState } from './actions';
import { ANSWER_MAX_LEN } from '@/app/predict/trivia/constants';

const initialState: ConfirmTriviaState = {};

const ERROR_COPY: Record<string, string> = {
  no_session: 'Logi sisse uuesti.',
  not_operator: 'Operaatori õigused puuduvad.',
  invalid_position: 'Vormi viga — proovi uuesti.',
  invalid_integer: 'Numbrilist vastust ootab täisarvu.',
  invalid_team: 'Vastus peab olema üks turniiri riikidest.',
  too_long: 'Vastus on liiga pikk.',
};

export interface OfficialQuestionRow {
  position: number;
  promptEt: string;
  answerShape: string;
  conditionalOnPosition: number | null;
  currentCorrect: string;
}

export interface TeamOption {
  code: string;
  name_et: string;
}

const INPUT_BASE =
  'mt-2 w-full rounded-md border border-border-default bg-surface-card px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

export function TriviaConfirmForm({
  questions,
  teams,
}: {
  questions: readonly OfficialQuestionRow[];
  teams: readonly TeamOption[];
}) {
  const [state, formAction, pending] = useActionState(confirmTriviaAnswers, initialState);
  const [answers, setAnswers] = useState<Record<number, string>>(() =>
    Object.fromEntries(questions.map((q) => [q.position, q.currentCorrect])),
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        // React 19's <form action=…> auto-resets uncontrolled inputs after a
        // successful submit and flickers controlled inputs back to initial.
        // Driving the action via onSubmit + startTransition sidesteps the
        // reset while keeping useActionState's `pending` accurate.
        startTransition(() => formAction(formData));
      }}
      className="space-y-5"
      noValidate
    >
      {questions.map((q) => {
        const inputId = `official_${q.position}`;
        const isTeam = q.answerShape === 'team';
        const helpId =
          q.conditionalOnPosition !== null ? `${inputId}-help` : undefined;
        return (
          <fieldset
            key={q.position}
            className="rounded-lg border border-border-default bg-surface-card p-4"
            aria-describedby={helpId}
          >
            <legend className="px-1 text-sm font-medium text-text-primary">
              Q{q.position}. {q.promptEt}
            </legend>
            {q.conditionalOnPosition !== null && (
              <p id={helpId} className="mt-1 text-xs text-text-muted">
                Skoorib ainult juhul, kui Q{q.conditionalOnPosition} on õige.
              </p>
            )}
            {isTeam ? (
              <select
                id={inputId}
                name={inputId}
                value={answers[q.position] ?? ''}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [q.position]: e.target.value }))
                }
                className={INPUT_BASE}
              >
                <option value="">(jätta tühjaks = veel teadmata)</option>
                {teams.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name_et}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={inputId}
                name={inputId}
                type={q.answerShape === 'integer' ? 'number' : 'text'}
                maxLength={ANSWER_MAX_LEN}
                value={answers[q.position] ?? ''}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [q.position]: e.target.value }))
                }
                className={INPUT_BASE}
                placeholder="(jätta tühjaks = veel teadmata)"
              />
            )}
          </fieldset>
        );
      })}

      {state.error && ERROR_COPY[state.error] && (
        <p role="alert" className="text-sm text-state-closed-text">
          {ERROR_COPY[state.error]}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-sm text-brand-green">
          Salvestatud. Ümber arvutatud vastuseid:{' '}
          <strong className="text-text-primary">{state.rescored ?? 0}</strong>.
        </p>
      )}

      <div className="flex justify-end pt-2">
        <SubmitButton
          pendingOverride={pending}
          className="bg-brand-green hover:bg-brand-green-hover"
        >
          Kinnita ametlikud vastused
        </SubmitButton>
      </div>
    </form>
  );
}
