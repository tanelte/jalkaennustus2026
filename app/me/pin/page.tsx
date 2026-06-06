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
import { EnablePinForm } from './enable-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Lülita PIN sisse' };

async function logoutAction() {
  'use server';
  await clearCurrentUserCookie();
  await signOut({ redirectTo: '/login' });
}

/**
 * E03 S01 — PIN-enable surface. If the user already has a PIN, redirect-style
 * empty state with a link back to the dashboard (real Change / Disable land
 * on their own routes in S03 / S04).
 */
export default async function EnablePinPage() {
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
  const alreadyEnabled = row.pin_hash !== null;

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
          <h1 className="text-3xl font-semibold">Lülita PIN sisse</h1>
          <p className="text-sm text-text-muted">
            Vali 4-kohaline PIN ja anna taastamise e-post.
          </p>
        </header>

        {alreadyEnabled ? (
          <Card>
            <CardHeader>
              <CardTitle>Sul on juba PIN seadistatud</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>Tagasi kontolehele saad alt nupust.</p>
              <Link
                href="/me"
                className="inline-block rounded border px-4 py-2 text-sm font-medium"
              >
                Mine tagasi kontolehele
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <EnablePinForm />
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
