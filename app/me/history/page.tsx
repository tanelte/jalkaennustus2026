import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { Trophy } from 'lucide-react';

import { HistoryRow } from '@/components/history-row';
import { TopBar } from '@/components/top-bar';
import { Card, CardContent } from '@/components/ui/card';
import { auth, signOut } from '@/lib/auth';
import {
  clearCurrentUserCookie,
  requireCurrentUserId,
} from '@/lib/current-user';
import { db } from '@/lib/db';
import { getPlayerHistory } from '@/lib/me/history/queries';
import { resolveTournamentCode } from '@/lib/tournaments/current';
import { users } from '@/db/schema';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Sinu ajalugu' };

async function logoutAction() {
  'use server';
  await clearCurrentUserCookie();
  await signOut({ redirectTo: '/login' });
}

async function loadPlayerContext(
  userId: string,
): Promise<{ playerName: string; isOperator: boolean }> {
  const rows = await db
    .select({ username: users.username, is_operator: users.is_operator })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return {
    playerName: rows[0]?.username ?? 'mängija',
    isOperator: rows[0]?.is_operator ?? false,
  };
}

/**
 * UX spec §15.6 — per-player history-trail page. Layout: dark sticky
 * `AppHeader`, h1 + muted sub-copy, then a single `Card` housing a vertical
 * divided list of `HistoryRow`s (component reused from S03). A decorative
 * trophy watermark sits behind the header/list at ~5 % opacity (aria-hidden).
 */
export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user?.group_id) {
    redirect('/login');
  }

  const userId = await requireCurrentUserId();
  const tournamentChip = resolveTournamentCode();

  const [historyRows, { playerName, isOperator }] = await Promise.all([
    getPlayerHistory(userId, session.user.group_id),
    loadPlayerContext(userId),
  ]);

  return (
    <>
      <TopBar
        groupName={session.user.username}
        playerName={playerName}
        isOperator={isOperator}
        tournamentChip={tournamentChip}
        logoutAction={logoutAction}
      />
      <main className="relative mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {/* §15.6 — decorative trophy watermark, behind text content. */}
        <Trophy
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-12 z-0 h-64 w-64 text-text-primary opacity-5"
          strokeWidth={1}
        />

        <header className="relative z-10 space-y-1">
          <h1 className="text-3xl font-semibold">Sinu ajalugu</h1>
          <p className="text-sm text-text-muted">
            EM2012 → WC2026, kõik turniirid
          </p>
        </header>

        {historyRows.length === 0 ? (
          <Card className="relative z-10 p-6 text-sm text-text-muted">
            Esimene turniir — kogu ajalugu algab siit.
          </Card>
        ) : (
          <Card className="relative z-10 overflow-hidden">
            <CardContent className="p-0">
              {/*
                HistoryRow renders its own <li>; we wrap them in <ul> and add
                row padding via descendant selectors so the shared S03
                component stays untouched.
              */}
              <ul className="divide-y divide-border-default [&>li]:px-5 [&>li]:py-3">
                {historyRows.map((row) => (
                  <HistoryRow key={row.tournamentCode} row={row} />
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
