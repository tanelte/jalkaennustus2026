import { describe, expect, it } from 'vitest';
import { mapFeedToResultCode } from './result-code';
import type { FeedStatus, ResultCode } from './types';

function expectedCodeForDiff(home: number, away: number): ResultCode {
  const diff = home - away;
  if (diff === 0) return 'X';
  if (diff >= 3) return '1B';
  if (diff >= 1) return '1A';
  if (diff <= -3) return '2B';
  return '2A';
}

describe('mapFeedToResultCode — FINISHED matches', () => {
  // Exhaustive sweep across 0..6 x 0..6 covers all diff buckets and both
  // boundary edges (diff=2 vs 3, diff=-2 vs -3).
  for (let home = 0; home <= 6; home += 1) {
    for (let away = 0; away <= 6; away += 1) {
      const code = expectedCodeForDiff(home, away);
      it(`${home}-${away} -> ${code}`, () => {
        expect(
          mapFeedToResultCode({ homeScore: home, awayScore: away, status: 'FINISHED' }),
        ).toEqual({ kind: 'result', code });
      });
    }
  }

  it('AWARDED matches map the same as FINISHED', () => {
    expect(
      mapFeedToResultCode({ homeScore: 3, awayScore: 0, status: 'AWARDED' }),
    ).toEqual({ kind: 'result', code: '1B' });
  });

  // Spot-check the boundary edges explicitly so any future regression on the
  // narrow/wide threshold is loud.
  it('home margin of exactly 2 is 1A (narrow)', () => {
    expect(
      mapFeedToResultCode({ homeScore: 2, awayScore: 0, status: 'FINISHED' }),
    ).toEqual({ kind: 'result', code: '1A' });
  });

  it('home margin of exactly 3 is 1B (wide)', () => {
    expect(
      mapFeedToResultCode({ homeScore: 3, awayScore: 0, status: 'FINISHED' }),
    ).toEqual({ kind: 'result', code: '1B' });
  });

  it('away margin of exactly 2 is 2A (narrow)', () => {
    expect(
      mapFeedToResultCode({ homeScore: 0, awayScore: 2, status: 'FINISHED' }),
    ).toEqual({ kind: 'result', code: '2A' });
  });

  it('away margin of exactly 3 is 2B (wide)', () => {
    expect(
      mapFeedToResultCode({ homeScore: 0, awayScore: 3, status: 'FINISHED' }),
    ).toEqual({ kind: 'result', code: '2B' });
  });
});

describe('mapFeedToResultCode — non-final statuses', () => {
  const cases: ReadonlyArray<[FeedStatus, 'NOT_FINAL' | 'POSTPONED' | 'CANCELLED' | 'ABANDONED']> = [
    ['SCHEDULED', 'NOT_FINAL'],
    ['TIMED', 'NOT_FINAL'],
    ['IN_PLAY', 'NOT_FINAL'],
    ['PAUSED', 'NOT_FINAL'],
    ['POSTPONED', 'POSTPONED'],
    ['CANCELLED', 'CANCELLED'],
    ['SUSPENDED', 'ABANDONED'],
  ];

  for (const [status, reason] of cases) {
    it(`status ${status} is a no-result with reason ${reason}`, () => {
      expect(
        mapFeedToResultCode({ homeScore: 1, awayScore: 1, status }),
      ).toEqual({ kind: 'no-result', reason });
    });
  }
});
