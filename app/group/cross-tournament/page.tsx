import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { Crown, Medal } from 'lucide-react';

import { TopBar } from '@/components/top-bar';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { users } from '@/db/schema';
import { auth, signOut } from '@/lib/auth';
import { buildCrossTournamentMatrix } from '@/lib/cross-tournament/build-matrix';
import {
  getGroupCrossTournamentCells,
  getGroupCrossTournamentTotals,
  getGroupTournaments,
} from '@/lib/cross-tournament/queries';
import { clearCurrentUserCookie, requireCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { resolveTournamentCode } from '@/lib/tournaments/current';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Läbi aegade' };

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

async function loadPlayerName(userId: string): Promise<string | null> {
  const rows = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.username ?? null;
}

const MEDAL_TINT: Record<1 | 2 | 3, string> = {
  1: 'text-amber-500',
  2: 'text-slate-400',
  3: 'text-orange-600',
};

export default async function CrossTournamentPage() {
  const session = await auth();
  if (!session?.user?.group_id) {
    redirect('/login');
  }

  const groupId = session.user.group_id;
  const groupName = session.user.username;
  const userId = await requireCurrentUserId();
  const tournamentChip = resolveTournamentCode();

  const [tournaments, cells, totals, isOperator, playerName] = await Promise.all([
    getGroupTournaments(groupId),
    getGroupCrossTournamentCells(groupId),
    getGroupCrossTournamentTotals(groupId),
    loadIsOperator(userId),
    loadPlayerName(userId),
  ]);

  const matrix = buildCrossTournamentMatrix(tournaments, cells, totals);

  return (
    <>
      <TopBar
        groupName={groupName}
        playerName={playerName}
        isOperator={isOperator}
        tournamentChip={tournamentChip}
        logoutAction={logoutAction}
      />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-500" aria-hidden />
            <h1 className="text-3xl font-semibold">{groupName} läbi aegade</h1>
          </div>
          <p className="text-sm text-text-muted">
            Grupi koondtabel turniiride kaupa
          </p>
        </header>

        {matrix.tournaments.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-text-muted">
              Liiga ajalugu pole veel — kogume andmeid esimese turniiri
              jooksul.
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 bg-surface-card w-12">
                    Koht
                  </TableHead>
                  <TableHead className="sticky left-12 z-10 bg-surface-card">
                    Mängija
                  </TableHead>
                  {matrix.tournaments.map((t) => (
                    <TableHead
                      key={t.id}
                      title={t.name}
                      scope="col"
                      className="text-right tabular-nums whitespace-nowrap"
                    >
                      {t.code}
                    </TableHead>
                  ))}
                  <TableHead className="text-right tabular-nums whitespace-nowrap">
                    Kokku
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matrix.rows.map((row, idx) => {
                  const rank = idx + 1;
                  const medalTint =
                    rank === 1 || rank === 2 || rank === 3
                      ? MEDAL_TINT[rank as 1 | 2 | 3]
                      : null;
                  return (
                    <TableRow key={row.user_id}>
                      <TableCell className="sticky left-0 z-10 bg-surface-card font-medium tabular-nums">
                        {medalTint ? (
                          <span className="inline-flex items-center gap-1">
                            <Medal
                              className={`h-4 w-4 ${medalTint}`}
                              aria-hidden
                            />
                            <span>{rank}.</span>
                          </span>
                        ) : (
                          `${rank}.`
                        )}
                      </TableCell>
                      <TableCell className="sticky left-12 z-10 bg-surface-card font-medium whitespace-nowrap">
                        {row.username}
                      </TableCell>
                      {row.cells.map((cell, cellIdx) => {
                        const isWinner = cell?.position === 1;
                        return (
                          <TableCell
                            key={matrix.tournaments[cellIdx].id}
                            className={`text-right tabular-nums whitespace-nowrap ${
                              isWinner
                                ? 'bg-brand-green-soft text-brand-green font-semibold'
                                : ''
                            }`}
                          >
                            {cell == null ? (
                              <span className="text-text-muted">—</span>
                            ) : (
                              <span>
                                {cell.points}
                                {cell.position != null && cell.points > 0 && (
                                  <sup className="ml-0.5 text-[10px] font-normal text-text-muted">
                                    {cell.position}
                                  </sup>
                                )}
                              </span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right tabular-nums font-semibold whitespace-nowrap">
                        {row.total_points}
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
