import { describe, expect, it } from 'vitest';
import { scoreMatchPrediction } from './match-score';
import type { ResultCode } from './types';
import {
  KNOCKOUT_EXACT_POINTS_BY_STAGE,
  KNOCKOUT_WINNER_POINTS_BY_STAGE,
  type KnockoutStageCode,
} from './weights';

const ALL_CODES: readonly ResultCode[] = ['1A', '1B', '2A', '2B', 'X'];

function expectedOutcome(
  predicted: ResultCode,
  actual: ResultCode,
): 'exact' | 'winner' | 'miss' {
  if (predicted === actual) return 'exact';
  if (predicted !== 'X' && actual !== 'X' && predicted[0] === actual[0]) {
    return 'winner';
  }
  return 'miss';
}

function expectedBase(outcome: 'exact' | 'winner' | 'miss'): number {
  if (outcome === 'exact') return 5;
  if (outcome === 'winner') return 3;
  return 0;
}

describe('scoreMatchPrediction — full 5x5 matrix x doublePoints', () => {
  for (const predicted of ALL_CODES) {
    for (const actual of ALL_CODES) {
      for (const doublePoints of [false, true]) {
        const outcome = expectedOutcome(predicted, actual);
        const base = expectedBase(outcome);
        const points = doublePoints ? base * 2 : base;
        it(`predicted=${predicted} actual=${actual} doublePoints=${doublePoints} -> ${points} (${outcome})`, () => {
          expect(scoreMatchPrediction({ predicted, actual, doublePoints })).toEqual({
            points,
            outcome,
          });
        });
      }
    }
  }
});

describe('scoreMatchPrediction — BR-002 nuance (X never qualifies as a winner)', () => {
  // Predicted X with any non-X actual: miss, not winner.
  for (const actual of ALL_CODES) {
    if (actual === 'X') continue;
    it(`predicted=X actual=${actual} is a miss`, () => {
      expect(scoreMatchPrediction({ predicted: 'X', actual, doublePoints: false })).toEqual({
        points: 0,
        outcome: 'miss',
      });
    });
  }

  // Predicted any non-X with actual X: miss, not winner.
  for (const predicted of ALL_CODES) {
    if (predicted === 'X') continue;
    it(`predicted=${predicted} actual=X is a miss`, () => {
      expect(scoreMatchPrediction({ predicted, actual: 'X', doublePoints: false })).toEqual({
        points: 0,
        outcome: 'miss',
      });
    });
  }
});

describe('scoreMatchPrediction — double-points spot checks', () => {
  it('exact match with double-points doubles to 10', () => {
    expect(
      scoreMatchPrediction({ predicted: '1A', actual: '1A', doublePoints: true }),
    ).toEqual({ points: 10, outcome: 'exact' });
  });

  it('winner match with double-points doubles to 6', () => {
    expect(
      scoreMatchPrediction({ predicted: '1A', actual: '1B', doublePoints: true }),
    ).toEqual({ points: 6, outcome: 'winner' });
  });

  it('miss with double-points stays at 0', () => {
    expect(
      scoreMatchPrediction({ predicted: '1A', actual: '2A', doublePoints: true }),
    ).toEqual({ points: 0, outcome: 'miss' });
  });
});

describe('scoreMatchPrediction — knockout per-round weights', () => {
  const ROUNDS: readonly KnockoutStageCode[] = ['r32', 'r16', 'qf', 'sf'];

  for (const round of ROUNDS) {
    const weights = {
      exactPoints: KNOCKOUT_EXACT_POINTS_BY_STAGE[round],
      winnerPoints: KNOCKOUT_WINNER_POINTS_BY_STAGE[round],
    };

    it(`${round}: exact 1A→1A awards ${weights.exactPoints}`, () => {
      expect(
        scoreMatchPrediction({
          predicted: '1A',
          actual: '1A',
          doublePoints: false,
          weights,
        }),
      ).toEqual({ points: weights.exactPoints, outcome: 'exact' });
    });

    it(`${round}: winner 1A→1B awards ${weights.winnerPoints}`, () => {
      expect(
        scoreMatchPrediction({
          predicted: '1A',
          actual: '1B',
          doublePoints: false,
          weights,
        }),
      ).toEqual({ points: weights.winnerPoints, outcome: 'winner' });
    });

    it(`${round}: winner 2B→2A awards ${weights.winnerPoints}`, () => {
      expect(
        scoreMatchPrediction({
          predicted: '2B',
          actual: '2A',
          doublePoints: false,
          weights,
        }),
      ).toEqual({ points: weights.winnerPoints, outcome: 'winner' });
    });

    it(`${round}: miss 1A→2B awards 0`, () => {
      expect(
        scoreMatchPrediction({
          predicted: '1A',
          actual: '2B',
          doublePoints: false,
          weights,
        }),
      ).toEqual({ points: 0, outcome: 'miss' });
    });
  }
});
