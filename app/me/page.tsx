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

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Sinu konto' };

async function logoutAction() {
  'use server';
  await clearCurrentUserCookie();
  await signOut({ redirectTo: '/login' });
}

/**
 * E03 S01 — user dashboard index. PIN-status card surfaces here. When the
 * user has no PIN, the "Protect your predictions with a PIN" card invites
 * them to `/me/pin`; once enabled, the card flips to show Change / Disable
 * links (those routes land in S03 / S04).
 */
export default async function MePage() {
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

  const hasPin = row.pin_hash !== null;
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
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="space-y-1">
          <h1 className="text-3xl font-semibold">Sinu konto</h1>
          <p className="text-sm text-text-muted">
            Halda oma PIN-i ja muid kontoseadeid.
          </p>
        </header>

        {!hasPin ? (
          <Card>
            <CardHeader>
              <CardTitle>Kaitse oma ennustusi PIN-iga</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>
                PIN takistab teisi grupi liikmeid kogemata või tahtlikult sinu
                ennustusi muutmast. Vaatamist see ei piira.
              </p>
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
            <CardHeader>
              <CardTitle>PIN aktiveeritud</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>
                Sinu ennustused on PIN-iga kaitstud. Muudatused küsivad PIN-i
                enne salvestamist.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/me/pin/change"
                  className="inline-block rounded border px-4 py-2 text-sm font-medium"
                >
                  Muuda PIN-i
                </Link>
                <Link
                  href="/me/pin/recovery"
                  className="inline-block rounded border px-4 py-2 text-sm font-medium"
                >
                  Unustasid PIN-i?
                </Link>
                <Link
                  href="/me/pin/disable"
                  className="inline-block rounded border px-4 py-2 text-sm font-medium"
                >
                  Lülita PIN välja
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
