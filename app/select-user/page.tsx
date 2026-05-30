import { asc, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { user_groups, users } from '@/db/schema';
import { createAndSelectUser, selectExistingUser } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Vali kasutaja — Jalkaennustus' };

async function listUsersInGroup(groupId: string) {
  return db
    .select({ id: users.id, username: users.username })
    .from(users)
    .innerJoin(user_groups, eq(user_groups.user_id, users.id))
    .where(eq(user_groups.group_id, groupId))
    .orderBy(asc(users.username));
}

export default async function SelectUserPage() {
  const session = await auth();
  if (!session?.user?.group_id) {
    redirect('/login');
  }
  const groupUsers = await listUsersInGroup(session.user.group_id);

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-semibold">Vali kasutaja</h1>
      <p className="mt-2 text-sm text-gray-600">
        Grupp: <strong>{session.user.username}</strong>. Vali olemasolev kasutaja või
        loo uus, et hakata ennustama.
      </p>

      {groupUsers.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-medium">Olemasolevad kasutajad</h2>
          <ul className="mt-3 space-y-2">
            {groupUsers.map((u) => (
              <li key={u.id}>
                <form action={selectExistingUser}>
                  <input type="hidden" name="user_id" value={u.id} />
                  <button
                    type="submit"
                    className="w-full rounded border px-3 py-2 text-left hover:bg-gray-50"
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
        <form action={createAndSelectUser} className="mt-3 space-y-3">
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
          <button
            type="submit"
            className="w-full rounded bg-black px-3 py-2 text-white"
          >
            Loo ja vali
          </button>
        </form>
      </section>
    </main>
  );
}
