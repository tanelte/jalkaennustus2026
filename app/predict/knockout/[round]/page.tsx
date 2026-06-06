import { and, asc, eq, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { EnnustabBanner } from '@/components/ennustab-banner';
import { TopBar } from '@/components/top-bar';
import { Card, CardContent } from '@/components/ui/card';
import { WindowStatePill } from '@/components/window-state-pill';
import { auth, signOut } from '@/lib/auth';
import {
  clearCurrentUserCookie,
  requireCurrentUserId,
} from '@/lib/current-user';
import { db } from '@/lib/db';
import { isStageOpen } from '@/lib/stages/is-stage-open';
import { resolveTournamentCode, getCurrentTournamentId } from '@/lib/tournaments/current';
import { games, teams, user_games, users } from '@/db/schema';
import { KnockoutForm, type KnockoutMatchView } from './knockout-form';
import { ROUND_LABELS_ET, isKnockoutRound, type KnockoutRound } from './constants';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ round: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { round } = await params;
  if (!isKnockoutRound(round)) {
    return { title: 'Knockout ennustus — Jalkaennustus' };
  }
  return { title: `${ROUND_LABELS_ET[round]} — Jalkaennustus` };
}

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
    playerName: rows[0]?.username ?? 'tundmatu mängija',
    isOperator: rows[0]?.is_operator ?? false,
  };
}

async function loadRoundMatches(
  tournamentId: string,
  round: KnockoutRound,
  userId: string,
): Promise<KnockoutMatchView[]> {
  const gameRows = await db
    .select({
      id: games.id,
      round_label: games.round_label,
      kickoff_at: games.kickoff_at,
      team_home_id: games.team_home_id,
      team_away_id: games.team_away_id,
    })
    .from(games)
    .where(and(eq(games.tournament_id, tournamentId), eq(games.stage_code, round)))
    .orderBy(asc(games.kickoff_at), asc(games.round_label));

  const teamIds = Array.from(
    new Set(
      gameRows.flatMap((g) =>
        [g.team_home_id, g.team_away_id].filter((id): id is string => id !== null),
      ),
    ),
  );

  const teamRows =
    teamIds.length === 0
      ? []
      : await db
          .select({ id: teams.id, code: teams.code, name_et: teams.name_et })
          .from(teams)
          .where(inArray(teams.id, teamIds));
  const teamById = new Map(teamRows.map((t) => [t.id, t]));

  const gameIds = gameRows.map((g) => g.id);
  const userGameRows =
    gameIds.length === 0
      ? []
      : await db
          .select({ game_id: user_games.game_id, prediction: user_games.prediction })
          .from(user_games)
          .where(and(eq(user_games.user_id, userId), inArray(user_games.game_id, gameIds)));
  const predictionByGameId = new Map(
    userGameRows.map((r) => [r.game_id, r.prediction]),
  );

  return gameRows.map((g) => ({
    id: g.id,
    roundLabel: g.round_label,
    kickoffAt: g.kickoff_at.toISOString(),
    homeTeam: g.team_home_id ? teamById.get(g.team_home_id) ?? null : null,
    awayTeam: g.team_away_id ? teamById.get(g.team_away_id) ?? null : null,
    currentPrediction: predictionByGameId.get(g.id) ?? null,
  }));
}

/**
 * UX spec §15.4 — shared prediction shell wraps the per-bracket pairs as
 * 2-option radio groups. Round inferred from `[round]`; behaviour preserved
 * end-to-end (TBD pairs disabled, stage-gate enforced server-side).
 */
export default async function KnockoutRoundPage({ params }: PageProps) {
  const { round } = await params;
  if (!isKnockoutRound(round)) {
    notFound();
  }

  const session = await auth();
  if (!session?.user?.group_id) redirect('/login');

  const userId = await requireCurrentUserId();
  const tournamentId = await getCurrentTournamentId();
  const tournamentChip = resolveTournamentCode();

  const [matches, gate, { playerName, isOperator }] = await Promise.all([
    loadRoundMatches(tournamentId, round, userId),
    isStageOpen(round, tournamentId),
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
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
        <nav aria-label="Asukoht" className="text-sm text-text-muted">
          <Link href="/" className="hover:underline">
            Avaleht
          </Link>
          <span aria-hidden="true"> / </span>
          <span>{ROUND_LABELS_ET[round]}</span>
        </nav>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <WindowStatePill gate={gate} />
          <EnnustabBanner playerName={playerName} />
        </div>

        <header>
          <h1 className="text-3xl font-semibold text-text-primary">
            {ROUND_LABELS_ET[round]}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Iga mängu kohta vali võitja meeskond ja kuidas võit saavutati
            (normaalaeg või lisaaeg/penaltid). Õige meeskond + õige režiim
            annab täispunktid, õige meeskond aga vale režiim poole punktidest.
          </p>
        </header>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <KnockoutForm
              round={round}
              matches={matches}
              disabled={!gate.open}
              gateClosed={!gate.open}
              userId={userId}
            />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
