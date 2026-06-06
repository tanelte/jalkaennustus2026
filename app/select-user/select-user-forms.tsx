'use client';

import { useActionState } from 'react';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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

function ErrorStrip({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md bg-state-closed-bg px-3 py-2 text-sm text-state-closed-text"
    >
      <XCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
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
    <div className="space-y-6">
      {users.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium text-text-primary">Kes sa oled?</h2>
          {selectState.error && <ErrorStrip message={ERROR_COPY[selectState.error]} />}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {users.map((u) => (
              <form key={u.id} action={selectAction}>
                <input type="hidden" name="user_id" value={u.id} />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={selectPending}
                  className="w-full"
                >
                  {u.username}
                </Button>
              </form>
            ))}
          </div>
        </section>
      )}

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-text-primary">Lisa uus mängija</h2>
        <form action={createAction} className="space-y-3" noValidate>
          {createState.error && <ErrorStrip message={ERROR_COPY[createState.error]} />}
          <div className="space-y-1.5">
            <Label htmlFor="new-username">Nimi</Label>
            <div className="flex gap-2">
              <Input
                id="new-username"
                name="username"
                type="text"
                required
                autoComplete="off"
                maxLength={64}
                className="flex-1"
              />
              <Button type="submit" disabled={createPending}>
                {createPending ? 'Lisab…' : 'Lisa'}
              </Button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
