import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { Medal } from 'lucide-react';

import { StandingCard } from '@/components/standing-card';
import { TopBar } from '@/components/top-bar';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { auth, signOut } from '@/lib/auth';
import { clearCurrentUserCookie, requireCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import {
  getGroupLeaderboard,
  getTournamentIdByCode,
  getTournamentNameByCode,
} from '@/lib/leaderboard/queries';
import { resolveTournamentCode } from '@/lib/tournaments/current';
import { users } from '@/db/schema';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Edetabel' };

async function logoutAction() {
  'use server';
  await clearCurrentUserCookie();
  await signOut({ redirectTo: '/login' });
}

async function loadIsOperator(userId: string): Promise<boolean> {
  const rows = await db
    .select({ is_operator: users.is_operator })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.is_operator ?? false;
}

async function loadCurrentPlayerName(userId: string): Promise<string | null> {
  const rows = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.username ?? null;
}

function medalClassForRank(rank: number): string | null {
  switch (rank) {
    case 1:
      return 'text-amber-500';
    case 2:
      return 'text-slate-400';
    case 3:
      return 'text-orange-600';
    default:
      return null;
  }
}

export default async function LeaderboardPage() {
  const session = await auth();
  if (!session?.user?.group_id) {
    redirect('/login');
  }

  const tournamentCode = resolveTournamentCode();
  const [tournamentId, tournamentName, currentUserId] = await Promise.all([
    getTournamentIdByCode(tournamentCode),
    getTournamentNameByCode(tournamentCode),
    requireCurrentUserId(),
  ]);

  const [playerName, isOperator] = await Promise.all([
    loadCurrentPlayerName(currentUserId),
    loadIsOperator(currentUserId),
  ]);

  if (!tournamentId) {
    return (
      <>
        <TopBar
          groupName={session.user.username}
          playerName={playerName}
          isOperator={isOperator}
          tournamentChip={tournamentCode}
          logoutAction={logoutAction}
        />
        <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <h1 className="text-3xl font-semibold">Edetabel</h1>
          <p className="text-red-700">Turniiri {tournamentCode} ei leitud andmebaasist.</p>
        </main>
      </>
    );
  }

  const rows = await getGroupLeaderboard(session.user.group_id, tournamentId);

  // Gap = points behind the rank-1 leader. Computed in TS because the
  // v_user_points view shape is forward-only (constitution §6 Rule 7).
  const topPoints = rows[0]?.total_points ?? 0;
  const currentScore = (() => {
    const me = rows.find((r) => r.user_id === currentUserId);
    return me
      ? { totalPoints: me.total_points, position: me.position }
      : { totalPoints: 0, position: null };
  })();

  const groupName = session.user.username;
  const heading = tournamentName ? `${groupName} — ${tournamentName}` : groupName;

  return (
    <>
      <TopBar
        groupName={groupName}
        playerName={playerName}
        isOperator={isOperator}
        tournamentChip={tournamentCode}
        logoutAction={logoutAction}
      />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <h1 className="text-3xl font-semibold">{heading}</h1>

        {/* Already on /leaderboard — suppress the "Vaata tabelit →" link by
            passing an empty href (StandingCard uses `href &&` to gate the link). */}
        <StandingCard currentScore={currentScore} href="" />

        {rows.length === 0 ? (
          <Card className="p-6 text-text-muted">
            Selles grupis pole veel mängijaid.
          </Card>
        ) : (
          <Card className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    scope="col"
                    className="sticky left-0 bg-surface-card z-10"
                  >
                    Koht
                  </TableHead>
                  <TableHead scope="col">Mängija</TableHead>
                  <TableHead scope="col" className="text-right tabular-nums">
                    Punktid
                  </TableHead>
                  <TableHead
                    scope="col"
                    className="text-right tabular-nums text-text-muted"
                  >
                    Vahe
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const isCurrentPlayer = row.user_id === currentUserId;
                  const gap = row.position === 1 ? 0 : topPoints - row.total_points;
                  const medalClass = medalClassForRank(row.position);
                  return (
                    <TableRow
                      key={row.user_id}
                      className={cn(
                        isCurrentPlayer && 'bg-brand-green-soft/40',
                      )}
                    >
                      <TableCell
                        className={cn(
                          'sticky left-0 z-10 bg-inherit font-medium tabular-nums',
                          // Solid surface fallback so the sticky cell hides
                          // content underneath while horizontally scrolling.
                          !isCurrentPlayer && 'bg-surface-card',
                        )}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {medalClass ? (
                            <Medal
                              aria-hidden="true"
                              className={cn('h-4 w-4', medalClass)}
                              strokeWidth={2}
                            />
                          ) : null}
                          <span>{row.position}.</span>
                        </span>
                      </TableCell>
                      <TableCell>{row.username}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.total_points}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-text-muted">
                        {row.position === 1 ? '—' : `−${gap}`}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </main>
    </>
  );
}
