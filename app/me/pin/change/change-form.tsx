'use client';

import { useActionState } from 'react';
import {
  changePinAction,
  type ChangePinError,
  type ChangePinState,
} from './actions';

const initialState: ChangePinState = {};

const ERROR_COPY: Record<ChangePinError, string> = {
  no_session: 'Logi sisse uuesti.',
  no_user: 'Vali kõigepealt mängija.',
  no_pin_set: 'PIN-i pole seadistatud.',
  invalid_pin: 'PIN peab koosnema neljast numbrist.',
  pin_mismatch: 'Uus PIN ei kattu kinnitusega.',
  wrong_current_pin: 'Praegune PIN on vale.',
};

export function ChangePinForm() {
  const [state, formAction, pending] = useActionState(changePinAction, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <p className="text-sm text-text-muted">
        Sisesta praegune PIN ja vali uus 4-kohaline PIN. Pärast vahetust
        küsitakse uut PIN-i järgmise muudatuse juures uuesti.
      </p>

      <div>
        <label htmlFor="current_pin" className="block text-sm font-medium">
          Praegune PIN
        </label>
        <input
          id="current_pin"
          name="current_pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          pattern="[0-9]{4}"
          maxLength={4}
          minLength={4}
          required
          aria-label="Praegune 4-kohaline PIN"
          className="mt-1 block w-full rounded border px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="new_pin" className="block text-sm font-medium">
          Uus PIN (4 numbrit)
        </label>
        <input
          id="new_pin"
          name="new_pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          pattern="[0-9]{4}"
          maxLength={4}
          minLength={4}
          required
          aria-label="Uus 4-kohaline PIN"
          className="mt-1 block w-full rounded border px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="new_pin_confirm" className="block text-sm font-medium">
          Korda uut PIN-i
        </label>
        <input
          id="new_pin_confirm"
          name="new_pin_confirm"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          pattern="[0-9]{4}"
          maxLength={4}
          minLength={4}
          required
          aria-label="Korda uut 4-kohalist PIN-i"
          className="mt-1 block w-full rounded border px-3 py-2"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {ERROR_COPY[state.error]}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-black px-3 py-2 text-white disabled:opacity-50"
      >
        {pending ? 'Salvestamine…' : 'Muuda PIN-i'}
      </button>
    </form>
  );
}
