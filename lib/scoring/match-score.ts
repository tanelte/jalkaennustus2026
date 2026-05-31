import type { ResultCode } from './types';
import {
  DOUBLE_POINTS_MULTIPLIER,
  MATCH_EXACT_POINTS,
  MATCH_MISS_POINTS,
  MATCH_WINNER_POINTS,
} from './weights';

export interface MatchScoreWeights {
  exactPoints: number;
  winnerPoints: number;
}

export interface MatchScoreInput {
  predicted: ResultCode;
  actual: ResultCode;
  doublePoints: boolean;
  /**
   * Optional per-round override. Group-stage uses the locked 5/3 defaults;
   * knockout rounds (S08) inject their per-round weights from
   * `KNOCKOUT_*_POINTS_BY_STAGE` in `weights.ts`. Miss is always 0.
   */
  weights?: MatchScoreWeights;
}

export interface MatchScoreResult {
  points: number;
  outcome: 'exact' | 'winner' | 'miss';
}

/**
 * Score a single match prediction against the official result.
 *
 * Group-stage (BR-001/BR-002/BR-003): exact code match awards 5; matching the
 * first character (same winning side, different margin) when neither side
 * is a draw awards 3; otherwise 0. The game's `double_points` flag doubles
 * the base. Pure function -- no I/O.
 *
 * Knockout interpretation reuses the same exact-vs-winner-vs-miss shape with
 * the round's locked weights threaded through `weights`. Knockout matches
 * never set `double_points`, but the multiplier code stays out of the way
 * because the default is `false`.
 */
export function scoreMatchPrediction(input: MatchScoreInput): MatchScoreResult {
  const { predicted, actual, doublePoints, weights } = input;
  const exactPoints = weights?.exactPoints ?? MATCH_EXACT_POINTS;
  const winnerPoints = weights?.winnerPoints ?? MATCH_WINNER_POINTS;

  let base: number;
  let outcome: MatchScoreResult['outcome'];

  if (predicted === actual) {
    base = exactPoints;
    outcome = 'exact';
  } else if (predicted !== 'X' && actual !== 'X' && predicted[0] === actual[0]) {
    base = winnerPoints;
    outcome = 'winner';
  } else {
    base = MATCH_MISS_POINTS;
    outcome = 'miss';
  }

  const points = doublePoints ? base * DOUBLE_POINTS_MULTIPLIER : base;
  return { points, outcome };
}
