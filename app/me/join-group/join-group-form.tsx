'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import {
  joinGroupAction,
  type JoinGroupError,
  type JoinGroupState,
} from './actions';

const initialState: JoinGroupState = {};

const ERROR_COPY: Record<JoinGroupError, string> = {
  no_session: 'Sessioon on aegunud. Logi uuesti sisse.',
  no_user: 'Vali esmalt oma kasutaja.',
  rate_limited: 'Liiga palju katseid. Proovi mõne minuti pärast uuesti.',
  missing_input: 'Sisesta nii kasutajanimi kui ka parool.',
  invalid_credentials: 'Vale kasutajanimi või parool.',
  same_group: 'Sa oled juba selles grupis sees.',
  already_member: 'Sa kuulud juba sellesse gruppi.',
};

export function JoinGroupForm() {
  const [state, formAction, pending] = useActionState(joinGroupAction, initialState);

  if (state.ok) {
    return (
      <div className="space-y-4 text-sm">
        <p className="font-medium">
          Lisatud gruppi <strong>{state.joined_username}</strong>.
        </p>
        <p className="text-text-muted">
          Järgmine kord, kui logid sisse selle grupi kasutajanime ja parooliga,
          leiad end kasutajavaliku lehelt. Vali sama kasutaja, et ennustamist
          jätkata.
        </p>
        <Link
          href="/me"
          className="inline-block rounded border px-4 py-2 text-sm font-medium"
        >
          Tagasi kontolehele
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <p className="text-sm text-text-muted">
        Sisesta selle grupi kasutajanimi ja parool, millega soovid liituda. Sind
        lisatakse gruppi sama kasutajaga, kellena oled praegu sisse logitud.
      </p>

      <div>
        <label htmlFor="username" className="block text-sm font-medium">
          Grupi kasutajanimi
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="off"
          required
          className="mt-1 block w-full rounded border px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Grupi parool
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="off"
          required
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
        {pending ? 'Liitumine…' : 'Liitu grupiga'}
      </button>
    </form>
  );
}
