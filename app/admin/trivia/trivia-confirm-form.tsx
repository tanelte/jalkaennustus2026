'use client';

import { useActionState } from 'react';
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

  return (
    <form action={formAction} className="mt-4 space-y-4" noValidate>
      {questions.map((q) => {
        const inputType = q.answerShape === 'integer' ? 'number' : 'text';
        return (
          <div key={q.position} className="rounded border p-4">
            <label className="block font-medium" htmlFor={`official_${q.position}`}>
              Q{q.position}. {q.promptEt}
            </label>
            {q.conditionalOnPosition !== null && (
              <p className="mt-1 text-xs text-gray-600">
                Skoorib ainult juhul, kui Q{q.conditionalOnPosition} on õige.
              </p>
            )}
            <input
              id={`official_${q.position}`}
              name={`official_${q.position}`}
              type={inputType}
              maxLength={ANSWER_MAX_LEN}
              defaultValue={q.currentCorrect}
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
