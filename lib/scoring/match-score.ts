import type { ResultCode } from './types';
import {
  DOUBLE_POINTS_MULTIPLIER,
  MATCH_EXACT_POINTS,
  MATCH_MISS_POINTS,
  MATCH_WINNER_POINTS,
} from './weights';

export interface MatchScoreInput {
  predicted: ResultCode;
  actual: ResultCode;
  doublePoints: boolean;
}

export interface MatchScoreResult {
  points: number;
  outcome: 'exact' | 'winner' | 'miss';
}

/**
 * Score a single group-stage match prediction against the official result.
 *
 * Legacy BR-001/BR-002/BR-003: exact code match awards 5; matching the
 * first character (same winning side, different margin) when neither side
 * is a draw awards 3; otherwise 0. The game's `double_points` flag doubles
 * the base. Pure function -- no I/O.
 */
export function scoreMatchPrediction(input: MatchScoreInput): MatchScoreResult {
  const { predicted, actual, doublePoints } = input;

  let base: number;
  let outcome: MatchScoreResult['outcome'];

  if (predicted === actual) {
    base = MATCH_EXACT_POINTS;
    outcome = 'exact';
  } else if (predicted !== 'X' && actual !== 'X' && predicted[0] === actual[0]) {
    base = MATCH_WINNER_POINTS;
    outcome = 'winner';
  } else {
    base = MATCH_MISS_POINTS;
    outcome = 'miss';
  }

  const points = doublePoints ? base * DOUBLE_POINTS_MULTIPLIER : base;
  return { points, outcome };
}
