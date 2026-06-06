import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { TopBar } from '@/components/top-bar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { auth, signOut } from '@/lib/auth';
import {
  clearCurrentUserCookie,
  getCurrentUserId,
} from '@/lib/current-user';
import { db } from '@/lib/db';
import { resolveTournamentCode } from '@/lib/tournaments/current';
import { users } from '@/db/schema';
import { ChangePinForm } from './change-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Muuda PIN-i' };

async function logoutAction() {
  'use server';
  await clearCurrentUserCookie();
  await signOut({ redirectTo: '/login' });
}

/**
 * E03 S03 — PIN change surface. If the user has no PIN set, surface an empty
 * state with a link to `/me/pin` (the enable flow) rather than rendering the
 * change form against nothing.
 */
export default async function ChangePinPage() {
  const session = await auth();
  if (!session?.user?.group_id) {
    redirect('/login');
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    redirect('/select-user');
  }

  const rows = await db
    .select({
      username: users.username,
      is_operator: users.is_operator,
      pin_hash: users.pin_hash,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    redirect('/select-user');
  }

  const tournamentChip = resolveTournamentCode();
  const hasPin = row.pin_hash !== null;

  return (
    <>
      <TopBar
        groupName={session.user.username}
        playerName={row.username}
        isOperator={row.is_operator}
        tournamentChip={tournamentChip}
        logoutAction={logoutAction}
      />
      <main className="mx-auto max-w-xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="space-y-1">
          <h1 className="text-3xl font-semibold">Muuda PIN-i</h1>
          <p className="text-sm text-text-muted">
            Sisesta praegune PIN ja vali uus 4-kohaline PIN.
          </p>
        </header>

        {!hasPin ? (
          <Card>
            <CardHeader>
              <CardTitle>PIN pole seadistatud</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>Et PIN-i muuta, pead selle esmalt sisse lülitama.</p>
              <Link
                href="/me/pin"
                className="inline-block rounded bg-black px-4 py-2 text-sm font-medium text-white"
              >
                Lülita PIN sisse
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <ChangePinForm />
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
