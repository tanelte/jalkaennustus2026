'use client';

import { useActionState } from 'react';
import {
  createGroupAction,
  type CreateGroupError,
  type CreateGroupState,
} from './actions';

const initialState: CreateGroupState = {};

const ERROR_COPY: Record<CreateGroupError, string> = {
  invalid_username: 'Kasutajanimi peab olema 3–64 tähemärki.',
  invalid_password: 'Parool ei tohi olla tühi.',
  password_mismatch: 'Paroolid ei kattu.',
  username_taken: 'See kasutajanimi on juba kasutusel.',
  rate_limited: 'Liiga palju katseid. Proovi 15 minuti pärast uuesti.',
};

export function CreateGroupForm() {
  const [state, formAction, pending] = useActionState(createGroupAction, initialState);

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
          minLength={3}
          maxLength={64}
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
          autoComplete="new-password"
          required
          className="mt-1 block w-full rounded border px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="password_confirm" className="block text-sm font-medium">
          Korda parooli
        </label>
        <input
          id="password_confirm"
          name="password_confirm"
          type="password"
          autoComplete="new-password"
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
        {pending ? 'Loomine…' : 'Loo grupp'}
      </button>
    </form>
  );
}
