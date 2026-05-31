'use client';

import { startTransition, useActionState, useState } from 'react';
import { confirmTriviaAnswers, type ConfirmTriviaState } from './actions';
import { ANSWER_MAX_LEN } from '@/app/predict/trivia/constants';

const initialState: ConfirmTriviaState = {};

const ERROR_COPY: Record<string, string> = {
  no_session: 'Logi sisse uuesti.',
  not_operator: 'Operaatori õigused puuduvad.',
  invalid_position: 'Vormi viga — proovi uuesti.',
  invalid_integer: 'Numbrilist vastust ootab täisarvu.',
  too_long: 'Vastus on liiga pikk.',
};

export interface OfficialQuestionRow {
  position: number;
  promptEt: string;
  answerShape: string;
  conditionalOnPosition: number | null;
  currentCorrect: string;
}

export function TriviaConfirmForm({
  questions,
}: {
  questions: readonly OfficialQuestionRow[];
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
      className="mt-4 space-y-4"
      noValidate
    >
      {questions.map((q) => {
        const inputType = q.answerShape === 'integer' ? 'number' : 'text';
        const inputId = `official_${q.position}`;
        return (
          <div key={q.position} className="rounded border p-4">
            <label className="block font-medium" htmlFor={inputId}>
              Q{q.position}. {q.promptEt}
            </label>
            {q.conditionalOnPosition !== null && (
              <p className="mt-1 text-xs text-gray-600">
                Skoorib ainult juhul, kui Q{q.conditionalOnPosition} on õige.
              </p>
            )}
            <input
              id={inputId}
              name={inputId}
              type={inputType}
              maxLength={ANSWER_MAX_LEN}
              value={answers[q.position] ?? ''}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [q.position]: e.target.value }))
              }
              className="mt-2 w-full rounded border border-gray-300 px-3 py-2"
              placeholder="(jätta tühjaks = veel teadmata)"
            />
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
          Salvestatud. Ümber arvutatud vastuseid: <strong>{state.rescored ?? 0}</strong>.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
      >
        {pending ? 'Salvestan…' : 'Kinnita ametlikud vastused'}
      </button>
    </form>
  );
}
