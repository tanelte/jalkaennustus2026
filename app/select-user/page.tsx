import { and, asc, eq, isNull } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { user_groups, users } from '@/db/schema';
import { SelectUserForms } from './select-user-forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Vali kasutaja — Jalkaennustus' };

async function listUsersInGroup(groupId: string) {
  return db
    .select({ id: users.id, username: users.username })
    .from(users)
    .innerJoin(user_groups, eq(user_groups.user_id, users.id))
    .where(and(eq(user_groups.group_id, groupId), isNull(user_groups.deleted_at)))
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
      <SelectUserForms users={groupUsers} />
    </main>
  );
}
