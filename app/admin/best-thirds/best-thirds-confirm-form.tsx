'use client';

import { useActionState, useState } from 'react';
import { confirmBestThirds, type ConfirmBestThirdsState } from './actions';
import {
  GROUP_LETTERS,
  REQUIRED_PICKS,
} from '@/app/predict/best-thirds/constants';

const initialState: ConfirmBestThirdsState = {};

const ERROR_COPY: Record<string, string> = {
  no_session: 'Logi sisse uuesti.',
  not_operator: 'Operaatori õigused puuduvad.',
  too_many: 'Maksimaalselt 8 tähte (komplekti suurus on 8).',
  invalid_letter: 'Üks valitud tähtedest ei kuulu gruppide A–L hulka.',
  duplicate: 'Iga grupi tähte saab valida vaid ühe korra.',
};

export function BestThirdsConfirmForm({
  initialLetters,
}: {
  initialLetters: readonly string[];
}) {
  const [state, formAction, pending] = useActionState(confirmBestThirds, initialState);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialLetters));

  function toggle(letter: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(letter)) next.delete(letter);
      else if (next.size < REQUIRED_PICKS) next.add(letter);
      return next;
    });
  }

  const count = selected.size;
  // Operator may save partial progress (0..8). Player picker (S05) still
  // requires exactly 8 -- that lives in a separate file.
  const submittable = count <= REQUIRED_PICKS && !pending;

  return (
    <form action={formAction} className="mt-4 space-y-4" noValidate>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-6" role="group" aria-label="Grupid">
        {GROUP_LETTERS.map((letter) => {
          const checked = selected.has(letter);
          return (
            <label
              key={letter}
              className={`flex cursor-pointer items-center justify-center rounded border px-3 py-3 text-lg font-semibold ${
                checked ? 'border-black bg-black text-white' : 'border-gray-300 bg-white'
              }`}
            >
              <input
                type="checkbox"
                name="letters"
                value={letter}
                checked={checked}
                onChange={() => toggle(letter)}
                className="sr-only"
              />
              <span>{letter}</span>
            </label>
          );
        })}
      </div>

      <p className="text-sm text-gray-600" aria-live="polite">
        Valitud: <strong>{count}</strong> / {REQUIRED_PICKS}
        {count < REQUIRED_PICKS && (
          <span className="ml-2 text-gray-500">
            (saad salvestada ka osalise komplekti)
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
          Salvestatud. Ümber arvutatud ennustusi: <strong>{state.rescored ?? 0}</strong>.
        </p>
      )}

      <button
        type="submit"
        disabled={!submittable}
        className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
      >
        {pending
          ? 'Salvestan…'
          : count === REQUIRED_PICKS
          ? 'Kinnita ametlik komplekt'
          : `Salvesta (${count}/${REQUIRED_PICKS})`}
      </button>
    </form>
  );
}
