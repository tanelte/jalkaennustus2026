import { and, asc, eq, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { isStageOpen } from '@/lib/stages/is-stage-open';
import { getCurrentTournamentId } from '@/lib/tournaments/current';
import { games, teams, user_games } from '@/db/schema';
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

export default async function KnockoutRoundPage({ params }: PageProps) {
  const { round } = await params;
  if (!isKnockoutRound(round)) {
    notFound();
  }

  const userId = await requireCurrentUserId();
  const tournamentId = await getCurrentTournamentId();
  const [matches, gate] = await Promise.all([
    loadRoundMatches(tournamentId, round, userId),
    isStageOpen(round, tournamentId),
  ]);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <header>
        <Link href="/" className="text-sm text-gray-500 hover:underline">
          ← Tagasi
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{ROUND_LABELS_ET[round]}</h1>
        <p className="mt-1 text-sm text-gray-600">
          Iga mängu kohta vali võitja meeskond ja kuidas võit saavutati
          (normaalaeg või lisaaeg/penaltid). Õige meeskond + õige režiim annab
          täispunktid, õige meeskond aga vale režiim poole punktidest.
        </p>
      </header>

      {!gate.open && (
        <p
          role="alert"
          className="mt-4 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900"
        >
          {gate.reason === 'closed'
            ? 'Aken on suletud — uusi valikuid enam vastu ei võeta.'
            : gate.reason === 'not_yet'
            ? `Aken avaneb ${gate.opensAt?.toISOString() ?? ''}.`
            : 'Selle vooru etappi ei leitud.'}
        </p>
      )}

      <KnockoutForm round={round} matches={matches} disabled={!gate.open} />
    </main>
  );
}
