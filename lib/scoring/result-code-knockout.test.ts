import { describe, expect, it } from 'vitest';
import { mapKnockoutFeedToResultCode } from './result-code-knockout';
import type { KnockoutFinishType } from './types';

const FINISH_TYPES: readonly KnockoutFinishType[] = [
  'NORMAL_TIME',
  'EXTRA_TIME',
  'PENALTIES',
];

describe('mapKnockoutFeedToResultCode — non-final statuses', () => {
  it.each([
    ['SCHEDULED', 'NOT_FINAL'],
    ['TIMED', 'NOT_FINAL'],
    ['IN_PLAY', 'NOT_FINAL'],
    ['PAUSED', 'NOT_FINAL'],
    ['POSTPONED', 'POSTPONED'],
    ['CANCELLED', 'CANCELLED'],
    ['SUSPENDED', 'ABANDONED'],
  ] as const)('%s → no-result/%s', (status, reason) => {
    const out = mapKnockoutFeedToResultCode({
      homeScore: 2,
      awayScore: 1,
      status,
      finishType: 'NORMAL_TIME',
    });
    expect(out).toEqual({ kind: 'no-result', reason });
  });
});

describe('mapKnockoutFeedToResultCode — finished, home wins', () => {
  it('NORMAL_TIME narrow home win → 1A', () => {
    expect(
      mapKnockoutFeedToResultCode({
        homeScore: 2,
        awayScore: 1,
        status: 'FINISHED',
        finishType: 'NORMAL_TIME',
      }),
    ).toEqual({ kind: 'result', code: '1A' });
  });

  it('NORMAL_TIME wide home win → still 1A (margin does NOT matter in knockouts)', () => {
    expect(
      mapKnockoutFeedToResultCode({
        homeScore: 5,
        awayScore: 0,
        status: 'FINISHED',
        finishType: 'NORMAL_TIME',
      }),
    ).toEqual({ kind: 'result', code: '1A' });
  });

  it('EXTRA_TIME home win → 1B', () => {
    expect(
      mapKnockoutFeedToResultCode({
        homeScore: 3,
        awayScore: 2,
        status: 'FINISHED',
        finishType: 'EXTRA_TIME',
      }),
    ).toEqual({ kind: 'result', code: '1B' });
  });

  it('PENALTIES home win (shootout score) → 1B', () => {
    expect(
      mapKnockoutFeedToResultCode({
        homeScore: 4,
        awayScore: 3,
        status: 'FINISHED',
        finishType: 'PENALTIES',
      }),
    ).toEqual({ kind: 'result', code: '1B' });
  });
});

describe('mapKnockoutFeedToResultCode — finished, away wins', () => {
  it('NORMAL_TIME away win → 2A', () => {
    expect(
      mapKnockoutFeedToResultCode({
        homeScore: 0,
        awayScore: 1,
        status: 'FINISHED',
        finishType: 'NORMAL_TIME',
      }),
    ).toEqual({ kind: 'result', code: '2A' });
  });

  it('EXTRA_TIME away win → 2B', () => {
    expect(
      mapKnockoutFeedToResultCode({
        homeScore: 1,
        awayScore: 2,
        status: 'FINISHED',
        finishType: 'EXTRA_TIME',
      }),
    ).toEqual({ kind: 'result', code: '2B' });
  });

  it('PENALTIES away win → 2B', () => {
    expect(
      mapKnockoutFeedToResultCode({
        homeScore: 3,
        awayScore: 5,
        status: 'FINISHED',
        finishType: 'PENALTIES',
      }),
    ).toEqual({ kind: 'result', code: '2B' });
  });
});

describe('mapKnockoutFeedToResultCode — ties are invalid', () => {
  it.each(FINISH_TYPES)('FINISHED 0-0 + %s → no-result/KNOCKOUT_TIE_INVALID', (finishType) => {
    expect(
      mapKnockoutFeedToResultCode({
        homeScore: 0,
        awayScore: 0,
        status: 'FINISHED',
        finishType,
      }),
    ).toEqual({ kind: 'no-result', reason: 'KNOCKOUT_TIE_INVALID' });
  });

  it('FINISHED 2-2 + NORMAL_TIME → no-result/KNOCKOUT_TIE_INVALID', () => {
    expect(
      mapKnockoutFeedToResultCode({
        homeScore: 2,
        awayScore: 2,
        status: 'FINISHED',
        finishType: 'NORMAL_TIME',
      }),
    ).toEqual({ kind: 'no-result', reason: 'KNOCKOUT_TIE_INVALID' });
  });
});

describe('mapKnockoutFeedToResultCode — AWARDED behaves like FINISHED', () => {
  it('AWARDED home win + NORMAL_TIME → 1A', () => {
    expect(
      mapKnockoutFeedToResultCode({
        homeScore: 3,
        awayScore: 0,
        status: 'AWARDED',
        finishType: 'NORMAL_TIME',
      }),
    ).toEqual({ kind: 'result', code: '1A' });
  });
});
