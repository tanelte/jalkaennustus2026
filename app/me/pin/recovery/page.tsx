import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { TopBar } from '@/components/top-bar';
import { Card, CardContent } from '@/components/ui/card';
import { auth, signOut } from '@/lib/auth';
import {
  clearCurrentUserCookie,
  getCurrentUserId,
} from '@/lib/current-user';
import { db } from '@/lib/db';
import { maskEmail } from '@/lib/pin/mask-email';
import { resolveTournamentCode } from '@/lib/tournaments/current';
import { users } from '@/db/schema';
import { RecoveryForm } from './recovery-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Lähtesta PIN' };

async function logoutAction() {
  'use server';
  await clearCurrentUserCookie();
  await signOut({ redirectTo: '/login' });
}

/**
 * E03 S05 — Dashboard-side PIN recovery surface. The same `requestPinResetAction`
 * also fires from inside the PIN-entry modal; this page is the explicit
 * "I want to reset my PIN" entry point from `/me`.
 */
export default async function PinRecoveryPage() {
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
      recovery_email: users.recovery_email,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    redirect('/select-user');
  }

  if (row.pin_hash === null) {
    // No PIN to reset.
    redirect('/me');
  }

  const maskedEmail = row.recovery_email ? maskEmail(row.recovery_email) : null;
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
          <h1 className="text-3xl font-semibold">Lähtesta PIN</h1>
          <p className="text-sm text-text-muted">
            Saadame ühekordse taastuslingi su salvestatud meiliaadressile. Link
            kehtib 30 minutit.
          </p>
        </header>

        <Card>
          <CardContent className="pt-6">
            {maskedEmail ? (
              <RecoveryForm maskedEmail={maskedEmail} />
            ) : (
              <div className="space-y-3 text-sm">
                <p>
                  Sul pole salvestatud taastusmeili — PIN-i meili teel
                  lähtestada ei saa. Lülita PIN välja ja seadista see uuesti
                  koos taastusmeiliga.
                </p>
                <Link
                  href="/me/pin/disable"
                  className="inline-block rounded border px-4 py-2 text-sm font-medium"
                >
                  Lülita PIN välja
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
