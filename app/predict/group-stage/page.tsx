import { and, asc, eq, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { EnnustabBanner } from '@/components/ennustab-banner';
import { WindowStatePill } from '@/components/window-state-pill';
import { requireCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { scoreMatchPrediction } from '@/lib/scoring/match-score';
import type { ResultCode } from '@/lib/scoring/types';
import { isStageOpen } from '@/lib/stages/is-stage-open';
import { getCurrentTournamentId } from '@/lib/tournaments/current';
import { games, result_codes, teams, user_games, users } from '@/db/schema';
import {
  GROUP_LETTERS,
  GROUP_STAGE_STAGE_CODE,
  extractGroupLetter,
  isGroupStagePredictionCode,
  type GroupLetter,
} from './constants';
import {
  GroupStageForm,
  type GroupStageMatchView,
  type MatchResultView,
  type TeamView,
} from './group-stage-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Grupimängud — Jalkaennustus' };

function isGroupLetter(value: string): value is GroupLetter {
  return (GROUP_LETTERS as readonly string[]).includes(value);
}

async function loadActiveUsername(userId: string): Promise<string> {
  const rows = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.username ?? 'tundmatu mängija';
}

async function loadGroupMatches(
  tournamentId: string,
  userId: string,
): Promise<GroupStageMatchView[]> {
  const gameRows = await db
    .select({
      id: games.id,
      round_label: games.round_label,
      kickoff_at: games.kickoff_at,
      team_home_id: games.team_home_id,
      team_away_id: games.team_away_id,
      double_points: games.double_points,
      result_code: games.result_code,
      score_home: games.score_home,
      score_away: games.score_away,
    })
    .from(games)
    .where(
      and(
        eq(games.tournament_id, tournamentId),
        eq(games.stage_code, GROUP_STAGE_STAGE_CODE),
      ),
    )
    .orderBy(asc(games.kickoff_at), asc(games.round_label));

  if (gameRows.length === 0) return [];

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
  const userGameRows = await db
    .select({
      game_id: user_games.game_id,
      prediction: user_games.prediction,
      points: user_games.points,
    })
    .from(user_games)
    .where(and(eq(user_games.user_id, userId), inArray(user_games.game_id, gameIds)));
  const userGameByGameId = new Map(userGameRows.map((r) => [r.game_id, r]));

  const resultCodes = Array.from(
    new Set(gameRows.map((g) => g.result_code).filter((c): c is string => c !== null)),
  );
  const resultCodeRows =
    resultCodes.length === 0
      ? []
      : await db
          .select({ code: result_codes.code, label_et: result_codes.label_et })
          .from(result_codes)
          .where(inArray(result_codes.code, resultCodes));
  const labelByCode = new Map(resultCodeRows.map((r) => [r.code, r.label_et]));

  const out: GroupStageMatchView[] = [];
  for (const g of gameRows) {
    const homeTeam = g.team_home_id ? teamById.get(g.team_home_id) : undefined;
    const awayTeam = g.team_away_id ? teamById.get(g.team_away_id) : undefined;
    if (!homeTeam || !awayTeam) {
      // Group-stage matches always have both teams seeded; skip defensively
      // rather than crash if the data ever drifts.
      continue;
    }

    const groupLetterRaw = extractGroupLetter(g.round_label);
    if (!isGroupLetter(groupLetterRaw)) continue;

    const userGame = userGameByGameId.get(g.id);
    const currentPrediction =
      userGame && isGroupStagePredictionCode(userGame.prediction)
        ? userGame.prediction
        : null;

    let result: MatchResultView | null = null;
    if (g.result_code && isGroupStagePredictionCode(g.result_code)) {
      const actual = g.result_code satisfies ResultCode;
      let points: number | null = null;
      let outcome: MatchResultView['outcome'] = null;
      if (currentPrediction) {
        // Recompute the per-row breakdown for display. Stays in sync with the
        // persisted `user_games.points` populated by lib/recompute/match.ts.
        const scored = scoreMatchPrediction({
          predicted: currentPrediction,
          actual,
          doublePoints: g.double_points,
        });
        points = scored.points;
        outcome = scored.outcome;
      }
      result = {
        resultCode: actual,
        resultLabelEt: labelByCode.get(actual) ?? actual,
        scoreHome: g.score_home,
        scoreAway: g.score_away,
        points,
        outcome,
      };
    }

    out.push({
      id: g.id,
      groupLetter: groupLetterRaw,
      roundLabel: g.round_label,
      kickoffAt: g.kickoff_at.toISOString(),
      doublePoints: g.double_points,
      homeTeam: homeTeam satisfies TeamView,
      awayTeam: awayTeam satisfies TeamView,
      currentPrediction,
      result,
    });
  }

  return out;
}

export default async function GroupStagePage() {
  const userId = await requireCurrentUserId();
  const tournamentId = await getCurrentTournamentId();
  const [matches, gate, playerName] = await Promise.all([
    loadGroupMatches(tournamentId, userId),
    isStageOpen(GROUP_STAGE_STAGE_CODE, tournamentId),
    loadActiveUsername(userId),
  ]);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <header>
        <Link href="/" className="text-sm text-gray-500 hover:underline">
          ← Tagasi
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Grupimängud</h1>
        <p className="mt-1 text-sm text-gray-600">
          Iga grupimängu kohta vali viiest võimalusest: kodumeeskonna võit napilt
          (1-2 väravaga) või selgelt (3+), viik, või sama külalismeeskonna kohta.
          Täpne valik annab 5 punkti, õige võitja vale skoorivahega 3 punkti.
          Topeltpunktiga mängudel korrutatakse tulemus kahega.
        </p>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <WindowStatePill gate={gate} />
        <EnnustabBanner playerName={playerName} />
      </div>

      <GroupStageForm matches={matches} disabled={!gate.open} />
    </main>
  );
}
