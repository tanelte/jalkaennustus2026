import { describe, expect, it } from 'vitest';
import { scoreBestThirds } from './best-thirds-score';

const OFFICIAL: readonly string[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

describe('scoreBestThirds — boundaries', () => {
  it('all 8 correct => 64 points', () => {
    expect(
      scoreBestThirds({ playerTicks: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], officialBestThirds: OFFICIAL }),
    ).toEqual({ points: 64, correctCount: 8 });
  });

  it('all 8 wrong => 0 points', () => {
    expect(
      scoreBestThirds({
        playerTicks: ['I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'],
        officialBestThirds: OFFICIAL,
      }),
    ).toEqual({ points: 0, correctCount: 0 });
  });
});

describe('scoreBestThirds — partial matches', () => {
  // Generate every k-correct case (k = 0..8) by swapping the first k officials with k non-officials.
  const NON_OFFICIAL = ['I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
  for (let k = 0; k <= 8; k++) {
    it(`${k} correct ticks => ${k * 8} points`, () => {
      const correctSlice = OFFICIAL.slice(0, k);
      const wrongSlice = NON_OFFICIAL.slice(0, 8 - k);
      const playerTicks = [...correctSlice, ...wrongSlice];
      expect(
        scoreBestThirds({ playerTicks, officialBestThirds: OFFICIAL }),
      ).toEqual({ points: k * 8, correctCount: k });
    });
  }

  it('order of player ticks does not affect score', () => {
    const reversed = [...OFFICIAL].reverse();
    expect(
      scoreBestThirds({ playerTicks: reversed, officialBestThirds: OFFICIAL }),
    ).toEqual({ points: 64, correctCount: 8 });
  });
});

describe('scoreBestThirds — invariant guards', () => {
  it('throws if playerTicks has fewer than 8 entries', () => {
    expect(() =>
      scoreBestThirds({
        playerTicks: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        officialBestThirds: OFFICIAL,
      }),
    ).toThrow(/playerTicks.*exactly 8/);
  });

  it('throws if playerTicks has more than 8 entries', () => {
    expect(() =>
      scoreBestThirds({
        playerTicks: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
        officialBestThirds: OFFICIAL,
      }),
    ).toThrow(/playerTicks.*exactly 8/);
  });

  it('throws if playerTicks contains duplicates', () => {
    expect(() =>
      scoreBestThirds({
        playerTicks: ['A', 'A', 'C', 'D', 'E', 'F', 'G', 'H'],
        officialBestThirds: OFFICIAL,
      }),
    ).toThrow(/playerTicks.*unique/);
  });

  it('throws if officialBestThirds has fewer than 8 entries', () => {
    expect(() =>
      scoreBestThirds({
        playerTicks: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
        officialBestThirds: ['A', 'B', 'C'],
      }),
    ).toThrow(/officialBestThirds.*exactly 8/);
  });

  it('throws if officialBestThirds contains duplicates', () => {
    expect(() =>
      scoreBestThirds({
        playerTicks: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
        officialBestThirds: ['A', 'A', 'C', 'D', 'E', 'F', 'G', 'H'],
      }),
    ).toThrow(/officialBestThirds.*unique/);
  });
});
