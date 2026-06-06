'use client';

import { startTransition, useActionState, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { PinEntryModal } from '@/components/pin/pin-entry-modal';
import { SubmitButton } from '@/components/submit-button';
import { submitTrivia, type SubmitTriviaState } from './actions';
import { ANSWER_MAX_LEN } from './constants';

const initialState: SubmitTriviaState = {};

const ERROR_COPY: Record<string, string> = {
  no_session: 'Logi sisse uuesti.',
  no_user: 'Vali kõigepealt kasutaja.',
  invalid_count: 'Täida kõik viis vastust.',
  invalid_position: 'Vormi viga — proovi uuesti.',
  empty_answer: 'Iga vastus peab olema täidetud.',
  invalid_integer: 'Numbrilist vastust ootab täisarvu.',
  invalid_team: 'Vastus peab olema üks turniiri riikidest.',
  too_long: 'Vastus on liiga pikk.',
  unknown_question: 'Trivia küsimusi ei leitud — võta ühendust korraldajaga.',
  stage_closed: 'Trivia aken on suletud.',
  stage_not_yet: 'Trivia aken ei ole veel avatud.',
  stage_not_found: 'Trivia etappi ei leitud — võta ühendust korraldajaga.',
  pin_required: 'Sisesta oma PIN, et muudatusi salvestada.',
  pin_rate_limited:
    'Liiga palju vale PIN-i katseid. Proovi mõne minuti pärast (või kasuta "Unustasid PIN-i?").',
};

export interface TriviaQuestionRow {
  position: number;
  promptEt: string;
  answerShape: string;
  conditionalOnPosition: number | null;
  currentAnswer: string;
}

export interface TeamOption {
  code: string;
  name_et: string;
}

const INPUT_BASE =
  'mt-2 w-full rounded-md border border-border-default bg-surface-card px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

export function TriviaForm({
  questions,
  teams,
  disabled,
  gateClosed = false,
  userId,
}: {
  questions: readonly TriviaQuestionRow[];
  teams: readonly TeamOption[];
  disabled: boolean;
  gateClosed?: boolean;
  userId: string;
}) {
  const [state, formAction, pending] = useActionState(submitTrivia, initialState);
  const [answers, setAnswers] = useState<Record<number, string>>(() =>
    Object.fromEntries(questions.map((q) => [q.position, q.currentAnswer])),
  );
  const [pinModalOpen, setPinModalOpen] = useState(false);

  useEffect(() => {
    if (state.error === 'pin_required') setPinModalOpen(true);
  }, [state.error]);

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
        const inputId = `answer_${q.position}`;
        const isTeam = q.answerShape === 'team';
        const isInt = q.answerShape === 'integer';
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
                Q{q.position} avaneb, kui Q{q.conditionalOnPosition} on
                salvestatud.
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
                disabled={disabled}
                required
                className={INPUT_BASE}
              >
                <option value="" disabled>
                  Vali riik…
                </option>
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
                type={isInt ? 'number' : 'text'}
                inputMode={isInt ? 'numeric' : 'text'}
                maxLength={ANSWER_MAX_LEN}
                value={answers[q.position] ?? ''}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [q.position]: e.target.value }))
                }
                disabled={disabled}
                required
                className={INPUT_BASE}
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
          Trivia vastused salvestatud.
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
            className="bg-brand-green hover:bg-brand-green-hover"
          >
            Salvesta vastused
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
