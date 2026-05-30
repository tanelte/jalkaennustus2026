'use client';

import { useActionState, useState } from 'react';
import { submitBestThirds, type SubmitBestThirdsState } from './actions';
import { GROUP_LETTERS, REQUIRED_PICKS } from './constants';

const initialState: SubmitBestThirdsState = {};

const ERROR_COPY: Record<string, string> = {
  invalid_count: 'Vali täpselt 8 gruppi.',
  invalid_letter: 'Üks valitud tähtedest ei kuulu gruppide A–L hulka.',
  duplicate: 'Iga grupi tähte saab valida vaid ühe korra.',
  stage_closed: 'Best-thirds ennustuse aken on suletud.',
  stage_not_yet: 'Best-thirds ennustuse aken ei ole veel avatud.',
  stage_not_found: 'Best-thirds etappi ei leitud — võta ühendust korraldajaga.',
  no_user: 'Vali kõigepealt kasutaja.',
  no_session: 'Logi sisse uuesti.',
};

export function BestThirdsForm({ initialPicks }: { initialPicks: readonly string[] }) {
  const [state, formAction, pending] = useActionState(submitBestThirds, initialState);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialPicks));

  function toggle(letter: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(letter)) next.delete(letter);
      else if (next.size < REQUIRED_PICKS) next.add(letter);
      return next;
    });
  }

  const count = selected.size;
  const submittable = count === REQUIRED_PICKS && !pending;

  return (
    <form action={formAction} className="mt-6 space-y-5" noValidate>
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
