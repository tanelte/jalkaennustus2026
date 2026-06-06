import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { TopBar } from '@/components/top-bar';
import { Card, CardContent } from '@/components/ui/card';
import { auth, signOut } from '@/lib/auth';
import {
  clearCurrentUserCookie,
  getCurrentUserId,
} from '@/lib/current-user';
import { db } from '@/lib/db';
import { resolveTournamentCode } from '@/lib/tournaments/current';
import { users } from '@/db/schema';
import { DisablePinForm } from './disable-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Lülita PIN välja' };

async function logoutAction() {
  'use server';
  await clearCurrentUserCookie();
  await signOut({ redirectTo: '/login' });
}

/**
 * E03 S04 — PIN disable surface. If the user has no PIN set, there is nothing
 * to disable and we bounce back to `/me`. Otherwise render the one-field
 * disable form; the Server Action does an atomic clear of `pin_hash`,
 * `recovery_email`, and any unconsumed `user_pin_resets` rows (D4 + R-5).
 */
export default async function DisablePinPage() {
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

  if (row.pin_hash === null) {
    // Nothing to disable; bounce back to the account index.
    redirect('/me');
  }

  const tournamentChip = resolveTournamentCode();

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
          <h1 className="text-3xl font-semibold">Lülita PIN välja</h1>
          <p className="text-sm text-text-muted">
            Kinnita oma praeguse PIN-iga, et PIN-kaitse välja lülitada.
          </p>
        </header>

        <Card>
          <CardContent className="pt-6">
            <DisablePinForm />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
