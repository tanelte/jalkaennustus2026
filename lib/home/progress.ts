/**
 * Per-stage submission progress for the home page "Avatud aknad" cards.
 *
 * Counts the active player's submitted rows for a stage against the expected
 * count. Row-count reads, not aggregation of scoring math, so the work stays
 * out of `lib/scoring/`. Each stage code has a different submitted/expected
 * source; the shape is uniform — `{ submitted, expected, unit }`.
 */
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  games,
  questions,
  user_best_thirds,
  user_games,
  user_questions,
  user_teams,
} from '@/db/schema';
import type { StageCode } from './open-windows';

export type ProgressUnit = 'esitatud' | 'valitud' | 'vastatud';

export interface StageProgress {
  submitted: number;
  expected: number;
  unit: ProgressUnit;
}

const KNOCKOUT_EXPECTED: Record<'r32' | 'r16' | 'qf' | 'sf', number> = {
  r32: 16,
  r16: 8,
  qf: 4,
  sf: 2,
};

const BEST_THIRDS_EXPECTED = 8;
const FINAL_EXPECTED = 4;

export function formatProgress(progress: StageProgress): string {
  return `${progress.submitted} / ${progress.expected} ${progress.unit}`;
}

export interface GetStageProgressDeps {
  countUserGamesGroupStage: (userId: string, tournamentId: string) => Promise<number>;
  countGroupStageGames: (tournamentId: string) => Promise<number>;
  countUserBestThirds: (userId: string, tournamentId: string) => Promise<number>;
  countUserTeams: (
    userId: string,
    tournamentId: string,
    round: string,
  ) => Promise<number>;
  countUserTrivia: (userId: string, tournamentId: string) => Promise<number>;
  countTriviaQuestions: (tournamentId: string) => Promise<number>;
}

export async function getStageProgress(
  stageCode: StageCode,
  userId: string,
  tournamentId: string,
  deps: GetStageProgressDeps = defaultDeps,
): Promise<StageProgress> {
  switch (stageCode) {
    case 'group_matches': {
      const [submitted, expected] = await Promise.all([
        deps.countUserGamesGroupStage(userId, tournamentId),
        deps.countGroupStageGames(tournamentId),
      ]);
      return { submitted, expected, unit: 'esitatud' };
    }
    case 'best_thirds': {
      const submitted = await deps.countUserBestThirds(userId, tournamentId);
      return { submitted, expected: BEST_THIRDS_EXPECTED, unit: 'valitud' };
    }
    case 'r32':
    case 'r16':
    case 'qf':
    case 'sf': {
      const submitted = await deps.countUserTeams(userId, tournamentId, stageCode);
      return { submitted, expected: KNOCKOUT_EXPECTED[stageCode], unit: 'esitatud' };
    }
    case 'final': {
      const submitted = await deps.countUserTeams(userId, tournamentId, 'final');
      return { submitted, expected: FINAL_EXPECTED, unit: 'valitud' };
    }
    case 'trivia': {
      const [submitted, expected] = await Promise.all([
        deps.countUserTrivia(userId, tournamentId),
        deps.countTriviaQuestions(tournamentId),
      ]);
      return { submitted, expected, unit: 'vastatud' };
    }
  }
}

const defaultDeps: GetStageProgressDeps = {
  async countUserGamesGroupStage(userId, tournamentId) {
    const { rows } = await db.execute<{ count: number | string }>(sql`
      select count(*)::int as count
        from ${user_games} ug
        join ${games} g on g.id = ug.game_id
       where ug.user_id = ${userId}
         and g.tournament_id = ${tournamentId}
         and g.stage_code = 'group_matches'
    `);
    return Number(rows[0]?.count ?? 0);
  },
  async countGroupStageGames(tournamentId) {
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(games)
      .where(and(eq(games.tournament_id, tournamentId), eq(games.stage_code, 'group_matches')));
    return Number(rows[0]?.count ?? 0);
  },
  async countUserBestThirds(userId, tournamentId) {
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(user_best_thirds)
      .where(
        and(
          eq(user_best_thirds.user_id, userId),
          eq(user_best_thirds.tournament_id, tournamentId),
        ),
      );
    return Number(rows[0]?.count ?? 0);
  },
  async countUserTeams(userId, tournamentId, round) {
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(user_teams)
      .where(
        and(
          eq(user_teams.user_id, userId),
          eq(user_teams.tournament_id, tournamentId),
          eq(user_teams.round, round),
        ),
      );
    return Number(rows[0]?.count ?? 0);
  },
  async countUserTrivia(userId, tournamentId) {
    const { rows } = await db.execute<{ count: number | string }>(sql`
      select count(*)::int as count
        from ${user_questions} uq
        join ${questions} q on q.id = uq.question_id
       where uq.user_id = ${userId}
         and q.tournament_id = ${tournamentId}
    `);
    return Number(rows[0]?.count ?? 0);
  },
  async countTriviaQuestions(tournamentId) {
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(questions)
      .where(eq(questions.tournament_id, tournamentId));
    return Number(rows[0]?.count ?? 0);
  },
};
