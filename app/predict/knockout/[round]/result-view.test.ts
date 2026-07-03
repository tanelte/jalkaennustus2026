import { describe, expect, it } from 'vitest';
import { buildKnockoutMatchResult } from './result-view';
import {
  KNOCKOUT_EXACT_POINTS_BY_STAGE,
  KNOCKOUT_WINNER_POINTS_BY_STAGE,
} from '@/lib/scoring/weights';

// qf weights: exact 22, winner 11.
const QF_WEIGHTS = {
  exactPoints: KNOCKOUT_EXACT_POINTS_BY_STAGE.qf,
  winnerPoints: KNOCKOUT_WINNER_POINTS_BY_STAGE.qf,
};

describe('buildKnockoutMatchResult — no official result', () => {
  it('returns null when result_code is null', () => {
    const view = buildKnockoutMatchResult({
      prediction: '1A',
      resultCode: null,
      scoreHome: null,
      scoreAway: null,
      finishType: null,
      weights: QF_WEIGHTS,
    });
    expect(view).toBeNull();
  });

  it('returns null when result_code is not a valid knockout code', () => {
    const view = buildKnockoutMatchResult({
      prediction: '1A',
      resultCode: 'X',
      scoreHome: 1,
      scoreAway: 1,
      finishType: 'NORMAL_TIME',
      weights: QF_WEIGHTS,
    });
    expect(view).toBeNull();
  });
});

describe('buildKnockoutMatchResult — scoring', () => {
  it('exact pick (right team + right finish) scores the round exact weight', () => {
    const view = buildKnockoutMatchResult({
      prediction: '1B',
      resultCode: '1B',
      scoreHome: 2,
      scoreAway: 1,
      finishType: 'EXTRA_TIME',
      weights: QF_WEIGHTS,
    });
    expect(view).not.toBeNull();
    expect(view!.points).toBe(22);
    expect(view!.outcome).toBe('exact');
  });

  it('winner pick (right team, wrong finish) scores the round winner weight', () => {
    const view = buildKnockoutMatchResult({
      prediction: '1A',
      resultCode: '1B',
      scoreHome: 2,
      scoreAway: 1,
      finishType: 'PENALTIES',
      weights: QF_WEIGHTS,
    });
    expect(view!.points).toBe(11);
    expect(view!.outcome).toBe('winner');
  });

  it('miss (wrong team) scores 0', () => {
    const view = buildKnockoutMatchResult({
      prediction: '2A',
      resultCode: '1A',
      scoreHome: 3,
      scoreAway: 0,
      finishType: 'NORMAL_TIME',
      weights: QF_WEIGHTS,
    });
    expect(view!.points).toBe(0);
    expect(view!.outcome).toBe('miss');
  });

  it('shows the result but hides points when the viewer made no prediction', () => {
    const view = buildKnockoutMatchResult({
      prediction: null,
      resultCode: '1A',
      scoreHome: 2,
      scoreAway: 0,
      finishType: 'NORMAL_TIME',
      weights: QF_WEIGHTS,
    });
    expect(view!.points).toBeNull();
    expect(view!.outcome).toBeNull();
    expect(view!.scoreHome).toBe(2);
    expect(view!.scoreAway).toBe(0);
  });
});

describe('buildKnockoutMatchResult — finish labels', () => {
  it.each([
    ['NORMAL_TIME', 'normaalaeg'],
    ['EXTRA_TIME', 'lisaaeg'],
    ['PENALTIES', 'penaltid'],
  ])('maps finish_type %s to %s', (finishType, expected) => {
    const view = buildKnockoutMatchResult({
      prediction: '1A',
      resultCode: '1A',
      scoreHome: 1,
      scoreAway: 0,
      finishType,
      weights: QF_WEIGHTS,
    });
    expect(view!.finishLabel).toBe(expected);
  });

  it('leaves the finish label null for an unknown finish_type', () => {
    const view = buildKnockoutMatchResult({
      prediction: '1A',
      resultCode: '1A',
      scoreHome: 1,
      scoreAway: 0,
      finishType: null,
      weights: QF_WEIGHTS,
    });
    expect(view!.finishLabel).toBeNull();
  });
});
