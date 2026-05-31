'use client';

import { useActionState } from 'react';
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

export function TriviaForm({
  questions,
  disabled,
}: {
  questions: readonly TriviaQuestionRow[];
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(submitTrivia, initialState);

  return (
    <form action={formAction} className="mt-6 space-y-5" noValidate>
      {questions.map((q) => {
        const inputType = q.answerShape === 'integer' ? 'number' : 'text';
        const inputMode = q.answerShape === 'integer' ? 'numeric' : 'text';
        return (
          <div key={q.position} className="rounded border p-4">
            <label className="block font-medium" htmlFor={`answer_${q.position}`}>
              Q{q.position}. {q.promptEt}
            </label>
            {q.conditionalOnPosition !== null && (
              <p className="mt-1 text-xs text-gray-600">
                Skoorib ainult juhul, kui Q{q.conditionalOnPosition} on õige
                (Q5-conditional-on-Q4 trikk).
              </p>
            )}
            <input
              id={`answer_${q.position}`}
              name={`answer_${q.position}`}
              type={inputType}
              inputMode={inputMode}
              maxLength={ANSWER_MAX_LEN}
              defaultValue={q.currentAnswer}
              disabled={disabled}
              required
              className="mt-2 w-full rounded border border-gray-300 px-3 py-2"
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
