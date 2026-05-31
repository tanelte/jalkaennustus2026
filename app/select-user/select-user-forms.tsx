'use client';

import { useActionState } from 'react';
import {
  createAndSelectUser,
  selectExistingUser,
  type SelectUserError,
  type SelectUserState,
} from './actions';

const initialState: SelectUserState = {};

const ERROR_COPY: Record<SelectUserError, string> = {
  no_session: 'Sessiooni ei leitud. Logi uuesti sisse.',
  missing_user_id: 'Kasutaja valimine ebaõnnestus, palun proovi uuesti.',
  not_a_member: 'See kasutaja ei kuulu sellesse gruppi.',
  invalid_username: 'Kasutajanimi peab olema 1–64 tähemärki.',
  username_taken_in_group: 'Selle nimega kasutaja on selles grupis juba olemas.',
};

interface GroupUser {
  id: string;
  username: string;
}

export function SelectUserForms({ users }: { users: GroupUser[] }) {
  const [selectState, selectAction, selectPending] = useActionState(
    selectExistingUser,
    initialState,
  );
  const [createState, createAction, createPending] = useActionState(
    createAndSelectUser,
    initialState,
  );

  return (
    <>
      {users.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-medium">Olemasolevad kasutajad</h2>
          {selectState.error && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {ERROR_COPY[selectState.error]}
            </p>
          )}
          <ul className="mt-3 space-y-2">
            {users.map((u) => (
              <li key={u.id}>
                <form action={selectAction}>
                  <input type="hidden" name="user_id" value={u.id} />
                  <button
                    type="submit"
                    disabled={selectPending}
                    className="w-full rounded border px-3 py-2 text-left hover:bg-gray-50 disabled:opacity-50"
                  >
                    {u.username}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-medium">Loo uus kasutaja</h2>
        <form action={createAction} className="mt-3 space-y-3" noValidate>
          <div>
            <label htmlFor="username" className="block text-sm font-medium">
              Kasutajanimi
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="off"
              maxLength={64}
              className="mt-1 block w-full rounded border px-3 py-2"
            />
          </div>
          {createState.error && (
            <p role="alert" className="text-sm text-red-700">
              {ERROR_COPY[createState.error]}
            </p>
          )}
          <button
            type="submit"
            disabled={createPending}
            className="w-full rounded bg-black px-3 py-2 text-white disabled:opacity-50"
          >
            {createPending ? 'Loon…' : 'Loo ja vali'}
          </button>
        </form>
      </section>
    </>
  );
}
