'use client';

import { useActionState } from 'react';
import { loginAction } from './actions';

const initialState: { error?: string } = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="mt-6 space-y-4" noValidate>
      <div>
        <label htmlFor="username" className="block text-sm font-medium">
          Kasutajanimi
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          className="mt-1 block w-full rounded border px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Parool
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 block w-full rounded border px-3 py-2"
        />
      </div>
      {state.error === 'invalid' && (
        <p role="alert" className="text-sm text-red-700">
          Vale kasutajanimi või parool.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-black px-3 py-2 text-white disabled:opacity-50"
      >
        {pending ? 'Sisselogimine…' : 'Logi sisse'}
      </button>
    </form>
  );
}
