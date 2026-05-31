import { describe, expect, it } from 'vitest';
import {
  computeBestThirdsRescoreInputs,
  validateOfficialLetters,
} from './best-thirds';

describe('validateOfficialLetters', () => {
  it('accepts exactly 8 distinct valid letters', () => {
    const out = validateOfficialLetters(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.set.size).toBe(8);
      expect(out.set.has('A')).toBe(true);
      expect(out.set.has('I')).toBe(false);
    }
  });

  it('accepts an empty set (operator clears official letters)', () => {
    const out = validateOfficialLetters([]);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.set.size).toBe(0);
    }
  });

  it('accepts a partial set (operator builds incrementally)', () => {
    const out = validateOfficialLetters(['A', 'B', 'C']);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.set.size).toBe(3);
      expect(out.set.has('A')).toBe(true);
      expect(out.set.has('D')).toBe(false);
    }
  });

  it('rejects more than 8 letters', () => {
    expect(
      validateOfficialLetters(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']),
    ).toEqual({ ok: false, reason: 'too_many' });
  });

  it('rejects an unknown letter', () => {
    expect(
      validateOfficialLetters(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'Z']),
    ).toEqual({ ok: false, reason: 'invalid_letter' });
  });

  it('rejects duplicate letters', () => {
    expect(
      validateOfficialLetters(['A', 'A', 'C', 'D', 'E', 'F', 'G', 'H']),
    ).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('rejects duplicates in a partial set as well', () => {
    expect(validateOfficialLetters(['A', 'A', 'B'])).toEqual({
      ok: false,
      reason: 'duplicate',
    });
  });
});

describe('computeBestThirdsRescoreInputs', () => {
  const officialSet = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);

  it('awards 8 to rows whose letter is official, 0 otherwise', () => {
    const rows = [
      { id: 'r-1', user_id: 'u-1', group_letter: 'A' },
      { id: 'r-2', user_id: 'u-1', group_letter: 'Z' },
      { id: 'r-3', user_id: 'u-2', group_letter: 'H' },
      { id: 'r-4', user_id: 'u-2', group_letter: 'I' },
    ];
    expect(computeBestThirdsRescoreInputs(rows, officialSet)).toEqual([
      { id: 'r-1', points: 8 },
      { id: 'r-2', points: 0 },
      { id: 'r-3', points: 8 },
      { id: 'r-4', points: 0 },
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(computeBestThirdsRescoreInputs([], officialSet)).toEqual([]);
  });

  it('handles all-wrong predictions', () => {
    const rows = [
      { id: 'r-1', user_id: 'u-1', group_letter: 'I' },
      { id: 'r-2', user_id: 'u-1', group_letter: 'J' },
    ];
    expect(computeBestThirdsRescoreInputs(rows, officialSet)).toEqual([
      { id: 'r-1', points: 0 },
      { id: 'r-2', points: 0 },
    ]);
  });

  it('handles all-correct predictions', () => {
    const rows = Array.from(officialSet).map((letter, i) => ({
      id: `r-${i}`,
      user_id: 'u-1',
      group_letter: letter,
    }));
    expect(computeBestThirdsRescoreInputs(rows, officialSet)).toEqual(
      rows.map((r) => ({ id: r.id, points: 8 })),
    );
  });

  it('scores against a partial official set (operator built only some letters)', () => {
    const partial = new Set(['A', 'B', 'C']);
    const rows = [
      { id: 'r-A', user_id: 'u-1', group_letter: 'A' },
      { id: 'r-D', user_id: 'u-1', group_letter: 'D' },
      { id: 'r-H', user_id: 'u-1', group_letter: 'H' },
    ];
    expect(computeBestThirdsRescoreInputs(rows, partial)).toEqual([
      { id: 'r-A', points: 8 },
      { id: 'r-D', points: 0 },
      { id: 'r-H', points: 0 },
    ]);
  });

  it('scores everything to 0 against an empty official set', () => {
    const rows = [
      { id: 'r-A', user_id: 'u-1', group_letter: 'A' },
      { id: 'r-B', user_id: 'u-1', group_letter: 'B' },
    ];
    expect(computeBestThirdsRescoreInputs(rows, new Set())).toEqual([
      { id: 'r-A', points: 0 },
      { id: 'r-B', points: 0 },
    ]);
  });
});
