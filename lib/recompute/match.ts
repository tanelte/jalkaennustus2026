import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { games, user_games } from '@/db/schema';
import { mapFeedToResultCode } from '@/lib/scoring/result-code';
import { mapKnockoutFeedToResultCode } from '@/lib/scoring/result-code-knockout';
import { scoreMatchPrediction } from '@/lib/scoring/match-score';
import type {
  FeedStatus,
  KnockoutFinishType,
  ResultCode,
} from '@/lib/scoring/types';

export const GROUP_STAGE_CODE = 'group_matches';

const VALID_FINISH_TYPES: readonly KnockoutFinishType[] = [
  'NORMAL_TIME',
  'EXTRA_TIME',
  'PENALTIES',
];

const VALID_RESULT_CODES: readonly ResultCode[] = ['1A', '1B', '2A', '2B', 'X'];

const VALID_FEED_STATUSES = new Set<string>([
  'SCHEDULED',
  'TIMED',
  'IN_PLAY',
  'PAUSED',
  'FINISHED',
  'SUSPENDED',
  'POSTPONED',
  'CANCELLED',
  'AWARDED',
]);

export interface GameForRescore {
  stage_code: string;
  score_home: number | null;
  score_away: number | null;
  final_status: string | null;
  finish_type: string | null;
  double_points: boolean;
}

export interface UserGameForRescore {
  id: string;
  prediction: string;
}

export interface RescoreRow {
  user_game_id: string;
  points: number | null;
}

export type ClearReason =
  | 'incomplete'
  | 'invalid_status'
  | 'non_result'
  | 'missing_finish_type'
  | 'invalid_finish_type'
  | 'knockout_tie';

export type RescoreOutcome =
  | { kind: 'rescore'; result_code: ResultCode; rows: RescoreRow[] }
  | { kind: 'cleared'; reason: ClearReason };

/**
 * Pure: given a game row + its predictions, return either the new result_code
 * and per-prediction points, or a cleared outcome (final result missing or not
 * scorable). No I/O. Tested exhaustively in match.test.ts.
 *
 * Invalid `prediction` text on a `user_games` row scores `points = null` rather
 * than crashing the whole recompute -- defensive against bad seed/migration data.
 */
export function computeMatchRescoreInputs(
  game: GameForRescore,
  userGames: readonly UserGameForRescore[],
): RescoreOutcome {
  if (
    game.score_home === null ||
    game.score_away === null ||
    game.final_status === null
  ) {
    return { kind: 'cleared', reason: 'incomplete' };
  }
  if (!VALID_FEED_STATUSES.has(game.final_status)) {
    return { kind: 'cleared', reason: 'invalid_status' };
  }

  const isKnockout = game.stage_code !== GROUP_STAGE_CODE;
  let outcome;
  if (isKnockout) {
    if (game.finish_type === null) {
      return { kind: 'cleared', reason: 'missing_finish_type' };
    }
    if (!VALID_FINISH_TYPES.includes(game.finish_type as KnockoutFinishType)) {
      return { kind: 'cleared', reason: 'invalid_finish_type' };
    }
    outcome = mapKnockoutFeedToResultCode({
      homeScore: game.score_home,
      awayScore: game.score_away,
      status: game.final_status as FeedStatus,
      finishType: game.finish_type as KnockoutFinishType,
    });
  } else {
    outcome = mapFeedToResultCode({
      homeScore: game.score_home,
      awayScore: game.score_away,
      status: game.final_status as FeedStatus,
    });
  }
  if (outcome.kind === 'no-result') {
    const reason: ClearReason =
      outcome.reason === 'KNOCKOUT_TIE_INVALID' ? 'knockout_tie' : 'non_result';
    return { kind: 'cleared', reason };
  }
  const actual = outcome.code;
  const rows: RescoreRow[] = userGames.map((ug) => {
    if (!VALID_RESULT_CODES.includes(ug.prediction as ResultCode)) {
      return { user_game_id: ug.id, points: null };
    }
    const { points } = scoreMatchPrediction({
      predicted: ug.prediction as ResultCode,
      actual,
      doublePoints: game.double_points,
    });
    return { user_game_id: ug.id, points };
  });
  return { kind: 'rescore', result_code: actual, rows };
}

export interface RecomputeMatchResult {
  rescored: number;
  result_code: ResultCode | null;
  outcome: 'rescored' | 'cleared';
  clear_reason?: ClearReason;
}

type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Orchestrator: reads the game + its predictions, runs the pure rescorer,
 * persists `games.result_code` and per-`user_games.points` updates.
 *
 * Per Constitution Rule 8: every singleton-owned result write triggers this
 * scoped recompute. S18 (live feed) reuses this entry point verbatim.
 *
 * Caller may pass an outer transaction so the score-write + recompute happen
 * atomically; otherwise this opens its own tx.
 */
export async function recomputeMatch(
  gameId: string,
  tx?: DbExecutor,
): Promise<RecomputeMatchResult> {
  if (!tx) {
    return db.transaction((innerTx) => recomputeMatch(gameId, innerTx));
  }

  const gameRows = await tx
    .select({
      stage_code: games.stage_code,
      score_home: games.score_home,
      score_away: games.score_away,
      final_status: games.final_status,
      finish_type: games.finish_type,
      double_points: games.double_points,
    })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);
  const game = gameRows[0];
  if (!game) {
    throw new Error(`recomputeMatch: game ${gameId} not found`);
  }

  const userGameRows = await tx
    .select({ id: user_games.id, prediction: user_games.prediction })
    .from(user_games)
    .where(eq(user_games.game_id, gameId));

  const outcome = computeMatchRescoreInputs(game, userGameRows);

  if (outcome.kind === 'cleared') {
    await tx.update(games).set({ result_code: null }).where(eq(games.id, gameId));
    if (userGameRows.length > 0) {
      await tx
        .update(user_games)
        .set({ points: null, updated_at: new Date() })
        .where(eq(user_games.game_id, gameId));
    }
    return {
      rescored: 0,
      result_code: null,
      outcome: 'cleared',
      clear_reason: outcome.reason,
    };
  }

  await tx
    .update(games)
    .set({ result_code: outcome.result_code })
    .where(eq(games.id, gameId));

  let count = 0;
  for (const row of outcome.rows) {
    await tx
      .update(user_games)
      .set({ points: row.points, updated_at: new Date() })
      .where(eq(user_games.id, row.user_game_id));
    count += 1;
  }

  return {
    rescored: count,
    result_code: outcome.result_code,
    outcome: 'rescored',
  };
}
