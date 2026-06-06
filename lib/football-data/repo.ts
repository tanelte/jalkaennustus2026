import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { games, teams, tournaments } from '@/db/schema';
import { recomputeMatch } from '@/lib/recompute/match';
import type { ApplyFeedInput, GameRow, PollRepo } from './poll';

async function findTournamentIdByCode(code: string): Promise<string | null> {
  const rows = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(eq(tournaments.code, code))
    .limit(1);
  return rows[0]?.id ?? null;
}

async function findGameForMatch(input: {
  tournament_id: string;
  match_id: string;
  team_home_code: string | null;
  team_away_code: string | null;
}): Promise<GameRow | null> {
  const byMatchId = await db
    .select({
      id: games.id,
      match_id: games.match_id,
      score_home: games.score_home,
      score_away: games.score_away,
      final_status: games.final_status,
      finish_type: games.finish_type,
      result_source: games.result_source,
      stage_code: games.stage_code,
    })
    .from(games)
    .where(and(eq(games.tournament_id, input.tournament_id), eq(games.match_id, input.match_id)))
    .limit(1);
  if (byMatchId[0]) return byMatchId[0];

  if (!input.team_home_code || !input.team_away_code) return null;

  const home = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.tournament_id, input.tournament_id), eq(teams.code, input.team_home_code)))
    .limit(1);
  const away = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.tournament_id, input.tournament_id), eq(teams.code, input.team_away_code)))
    .limit(1);
  if (!home[0] || !away[0]) return null;

  const byTeams = await db
    .select({
      id: games.id,
      match_id: games.match_id,
      score_home: games.score_home,
      score_away: games.score_away,
      final_status: games.final_status,
      finish_type: games.finish_type,
      result_source: games.result_source,
      stage_code: games.stage_code,
    })
    .from(games)
    .where(
      and(
        eq(games.tournament_id, input.tournament_id),
        eq(games.team_home_id, home[0].id),
        eq(games.team_away_id, away[0].id),
      ),
    )
    .limit(1);
  return byTeams[0] ?? null;
}

async function applyFeedResult(
  input: ApplyFeedInput,
): Promise<{ rescored: number; result_code: string | null }> {
  return db.transaction(async (tx) => {
    await tx
      .update(games)
      .set({
        match_id: input.match_id,
        score_home: input.score_home,
        score_away: input.score_away,
        final_status: input.final_status,
        finish_type: input.finish_type,
        result_source: 'feed',
      })
      .where(eq(games.id, input.game_id));
    const out = await recomputeMatch(input.game_id, tx);
    return { rescored: out.rescored, result_code: out.result_code };
  });
}

async function linkMatchId(input: { game_id: string; match_id: string }): Promise<void> {
  await db.update(games).set({ match_id: input.match_id }).where(eq(games.id, input.game_id));
}

export const drizzlePollRepo: PollRepo = {
  findTournamentIdByCode,
  findGameForMatch,
  applyFeedResult,
  linkMatchId,
};
