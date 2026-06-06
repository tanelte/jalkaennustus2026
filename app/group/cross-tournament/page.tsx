import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { Crown } from 'lucide-react';

import { PodiumRow } from '@/components/podium-row';
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

  // Rows from buildCrossTournamentMatrix are already sorted by total_points
  // (the underlying query orders by total_points DESC). Each `cells` entry is
  // null when the user did not participate in that tournament, so a count of
  // non-null cells gives the "Turniire" column without touching queries/views.
  const rowsView = matrix.rows.map((row, idx) => ({
    rank: idx + 1,
    id: row.user_id,
    podiumRow: {
      userId: row.user_id,
      username: row.username,
      totalPoints: row.total_points,
    },
    tournamentsPlayed: row.cells.reduce(
      (acc, cell) => (cell == null ? acc : acc + 1),
      0,
    ),
    totalPoints: row.total_points,
    username: row.username,
  }));

  const topThree = rowsView.slice(0, 3);
  const rest = rowsView.slice(3);

  return (
    <>
      <TopBar
        groupName={groupName}
        playerName={playerName}
        isOperator={isOperator}
        tournamentChip={tournamentChip}
        logoutAction={logoutAction}
      />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-500" aria-hidden />
            <h1 className="text-3xl font-semibold">{groupName} läbi aegade</h1>
          </div>
          <p className="text-sm text-text-muted">
            Kogu liiga koondtabel kõikide turniiride peale
          </p>
        </header>

        {rowsView.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-text-muted">
              Liiga ajalugu pole veel — kogume andmeid esimese turniiri jooksul.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="p-0">
                <ol className="divide-y divide-border-default p-2">
                  {topThree.map((row) => (
                    <PodiumRow
                      key={row.id}
                      row={row.podiumRow}
                      rank={row.rank}
                    />
                  ))}
                </ol>
              </CardContent>
            </Card>

            {rest.length > 0 && (
              <Card className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-surface-card">
                        Koht
                      </TableHead>
                      <TableHead>Mängija</TableHead>
                      <TableHead className="text-right tabular-nums">
                        Turniire
                      </TableHead>
                      <TableHead className="text-right tabular-nums">
                        Kogupunktid
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rest.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="sticky left-0 bg-inherit">
                          {row.rank}.
                        </TableCell>
                        <TableCell>{row.username}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.tournamentsPlayed}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.totalPoints}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </>
        )}
      </main>
    </>
  );
}
