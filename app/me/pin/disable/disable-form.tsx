'use client';

import { useActionState } from 'react';
import {
  disablePinAction,
  type DisablePinError,
  type DisablePinState,
} from './actions';

const initialState: DisablePinState = {};

const ERROR_COPY: Record<DisablePinError, string> = {
  no_session: 'Logi sisse uuesti.',
  no_user: 'Vali kõigepealt mängija.',
  no_pin_set: 'PIN-i pole seadistatud.',
  wrong_pin: 'Vale PIN.',
};

export function DisablePinForm() {
  const [state, formAction, pending] = useActionState(disablePinAction, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <p className="text-sm text-text-muted">
        PIN-i väljalülitamisel kustutatakse ka su taastusmeil. Edaspidi muutub
        PIN-i taastamine võimatuks, kuni lülitad PIN-i uuesti sisse.
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

      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {ERROR_COPY[state.error]}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-red-700 px-3 py-2 text-white disabled:opacity-50"
      >
        {pending ? 'Lülitan välja…' : 'Lülita PIN välja'}
      </button>
    </form>
  );
}
