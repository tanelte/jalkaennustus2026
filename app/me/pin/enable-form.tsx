'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  enablePinAction,
  type EnablePinError,
  type EnablePinState,
} from './actions';

const initialState: EnablePinState = {};

const ERROR_COPY: Record<EnablePinError, string> = {
  no_session: 'Sessioon on aegunud. Logi uuesti sisse.',
  no_user: 'Vali esmalt oma kasutaja.',
  already_enabled: 'Sul on juba PIN seadistatud.',
  invalid_pin: 'PIN peab olema täpselt 4 numbrit.',
  pin_mismatch: 'Sisestatud PIN-id ei kattu.',
  invalid_email: 'Palun sisesta korrektne e-posti aadress.',
};

export function EnablePinForm() {
  const [state, formAction, pending] = useActionState(enablePinAction, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      router.push('/me');
      router.refresh();
    }
  }, [state.ok, router]);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <p className="text-sm text-text-muted">
        PIN kaitseb su ennustusi grupiliikmete juhuslike ja oportunistlike
        muudatuste eest. Grupi parooli omavad inimesed saavad endiselt muul
        viisil olukorda mõjutada.
      </p>

      <div>
        <label htmlFor="pin" className="block text-sm font-medium">
          PIN (4 numbrit)
        </label>
        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          pattern="[0-9]{4}"
          maxLength={4}
          minLength={4}
          required
          aria-label="Sinu uus 4-kohaline PIN"
          className="mt-1 block w-full rounded border px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="pin_confirm" className="block text-sm font-medium">
          Korda PIN-i
        </label>
        <input
          id="pin_confirm"
          name="pin_confirm"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          pattern="[0-9]{4}"
          maxLength={4}
          minLength={4}
          required
          aria-label="Korda sama 4-kohalist PIN-i"
          className="mt-1 block w-full rounded border px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="recovery_email" className="block text-sm font-medium">
          Taastamise e-post
        </label>
        <input
          id="recovery_email"
          name="recovery_email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 block w-full rounded border px-3 py-2"
        />
        <p className="mt-1 text-xs text-text-muted">
          Kasutatakse ainult PIN-i taastamiseks, kui sa selle unustad.
        </p>
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
        {pending ? 'Salvestamine…' : 'Lülita PIN sisse'}
      </button>
    </form>
  );
}
