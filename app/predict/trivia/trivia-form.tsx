'use client';

import { startTransition, useActionState, useState } from 'react';
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

export function TriviaForm({
  questions,
  teams,
  disabled,
}: {
  questions: readonly TriviaQuestionRow[];
  teams: readonly TeamOption[];
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(submitTrivia, initialState);
  const [answers, setAnswers] = useState<Record<number, string>>(() =>
    Object.fromEntries(questions.map((q) => [q.position, q.currentAnswer])),
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
      className="mt-6 space-y-5"
      noValidate
    >
      {questions.map((q) => {
        const inputId = `answer_${q.position}`;
        const isTeam = q.answerShape === 'team';
        const isInt = q.answerShape === 'integer';
        return (
          <div key={q.position} className="rounded border p-4">
            <label className="block font-medium" htmlFor={inputId}>
              Q{q.position}. {q.promptEt}
            </label>
            {q.conditionalOnPosition !== null && (
              <p className="mt-1 text-xs text-gray-600">
                Skoorib ainult juhul, kui Q{q.conditionalOnPosition} on õige
                (Q5-conditional-on-Q4 trikk).
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
                className="mt-2 w-full rounded border border-gray-300 px-3 py-2"
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
                className="mt-2 w-full rounded border border-gray-300 px-3 py-2"
              />
            )}
          </div>
        );
      })}

      {state.error && ERROR_COPY[state.error] && (
        <p role="alert" className="text-sm text-red-700">
          {ERROR_COPY[state.error]}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-sm text-green-700">
          Trivia vastused salvestatud.
        </p>
      )}

      <button
        type="submit"
        disabled={disabled || pending}
        className="w-full rounded bg-black px-3 py-2 text-white disabled:opacity-50"
      >
        {pending ? 'Salvestan…' : 'Salvesta vastused'}
      </button>
    </form>
  );
}
