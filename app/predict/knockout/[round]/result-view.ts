import { scoreMatchPrediction, type MatchScoreWeights } from '@/lib/scoring/match-score';
import type { KnockoutFinishType, ResultCode } from '@/lib/scoring/types';
import { isKnockoutPredictionCode } from './constants';

/**
 * Post-result tail for a single knockout match. Mirrors the group-stage result
 * tail (`app/predict/group-stage`): the actual score + finish label, plus the
 * points the viewer earned on this match. `points` is null when the viewer made
 * no prediction (the result is still shown, the badge is hidden).
 */
export interface KnockoutMatchResult {
  scoreHome: number | null;
  scoreAway: number | null;
  /** Estonian finish-type label — 'normaalaeg' | 'lisaaeg' | 'penaltid'. */
  finishLabel: string | null;
  points: number | null;
  outcome: 'exact' | 'winner' | 'miss' | null;
}

const FINISH_LABELS_ET: Record<KnockoutFinishType, string> = {
  NORMAL_TIME: 'normaalaeg',
  EXTRA_TIME: 'lisaaeg',
  PENALTIES: 'penaltid',
};

function isKnockoutFinishType(value: string): value is KnockoutFinishType {
  return value === 'NORMAL_TIME' || value === 'EXTRA_TIME' || value === 'PENALTIES';
}

export interface BuildKnockoutMatchResultInput {
  /** The viewer's prediction (1A/1B/2A/2B), or null if none saved. */
  prediction: string | null;
  /** The official result code from `games.result_code`, or null if not final. */
  resultCode: string | null;
  scoreHome: number | null;
  scoreAway: number | null;
  finishType: string | null;
  /** Round weights from `KNOCKOUT_*_POINTS_BY_STAGE`. */
  weights: MatchScoreWeights;
}

/**
 * Pure: build the knockout match result tail. Returns null when no official
 * result exists yet (nothing to show). Points are recomputed live from the
 * official result code — stays in sync with the persisted `user_games.points`
 * populated by `lib/recompute/match.ts`, exactly as the group-stage surface does.
 */
export function buildKnockoutMatchResult(
  input: BuildKnockoutMatchResultInput,
): KnockoutMatchResult | null {
  const { prediction, resultCode, scoreHome, scoreAway, finishType, weights } = input;

  if (!resultCode || !isKnockoutPredictionCode(resultCode)) return null;
  const actual = resultCode satisfies ResultCode;

  let points: number | null = null;
  let outcome: KnockoutMatchResult['outcome'] = null;
  if (prediction && isKnockoutPredictionCode(prediction)) {
    const scored = scoreMatchPrediction({
      predicted: prediction,
      actual,
      doublePoints: false,
      weights,
    });
    points = scored.points;
    outcome = scored.outcome;
  }

  return {
    scoreHome,
    scoreAway,
    finishLabel:
      finishType && isKnockoutFinishType(finishType)
        ? FINISH_LABELS_ET[finishType]
        : null,
    points,
    outcome,
  };
}
