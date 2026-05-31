import { describe, expect, it } from 'vitest';
import { scoreFinal, scoreFinalSlot, type FinalSlotPicks } from './final-score';

const OFFICIAL: FinalSlotPicks = {
  F1: 'team-gold',
  F2: 'team-silver',
  F3: 'team-bronze',
  F4: 'team-fourth',
};

describe('scoreFinal — boundaries', () => {
  it('all four slots correct => 150 points', () => {
    expect(scoreFinal({ playerSlots: { ...OFFICIAL }, officialSlots: OFFICIAL })).toEqual({
      points: 150,
      correctSlots: ['F1', 'F2', 'F3', 'F4'],
    });
  });

  it('all four slots wrong => 0 points', () => {
    expect(
      scoreFinal({
        playerSlots: { F1: 'a', F2: 'b', F3: 'c', F4: 'd' },
        officialSlots: OFFICIAL,
      }),
    ).toEqual({ points: 0, correctSlots: [] });
  });
});

describe('scoreFinal — per-slot binary credit', () => {
  it('only F1 correct => 60', () => {
    expect(
      scoreFinal({
        playerSlots: { F1: 'team-gold', F2: 'x', F3: 'y', F4: 'z' },
        officialSlots: OFFICIAL,
      }),
    ).toEqual({ points: 60, correctSlots: ['F1'] });
  });

  it('only F2 correct => 40', () => {
    expect(
      scoreFinal({
        playerSlots: { F1: 'x', F2: 'team-silver', F3: 'y', F4: 'z' },
        officialSlots: OFFICIAL,
      }),
    ).toEqual({ points: 40, correctSlots: ['F2'] });
  });

  it('only F3 correct => 30', () => {
    expect(
      scoreFinal({
        playerSlots: { F1: 'x', F2: 'y', F3: 'team-bronze', F4: 'z' },
        officialSlots: OFFICIAL,
      }),
    ).toEqual({ points: 30, correctSlots: ['F3'] });
  });

  it('only F4 correct => 20', () => {
    expect(
      scoreFinal({
        playerSlots: { F1: 'x', F2: 'y', F3: 'z', F4: 'team-fourth' },
        officialSlots: OFFICIAL,
      }),
    ).toEqual({ points: 20, correctSlots: ['F4'] });
  });

  it('F1 + F3 correct => 90 (no EM swap rule, slots are independent)', () => {
    expect(
      scoreFinal({
        playerSlots: { F1: 'team-gold', F2: 'x', F3: 'team-bronze', F4: 'y' },
        officialSlots: OFFICIAL,
      }),
    ).toEqual({ points: 90, correctSlots: ['F1', 'F3'] });
  });

  it('F1↔F2 swap scores 0 (LOCKED-5: swap rule dropped for WC)', () => {
    expect(
      scoreFinal({
        playerSlots: {
          F1: 'team-silver',
          F2: 'team-gold',
          F3: 'team-bronze',
          F4: 'team-fourth',
        },
        officialSlots: OFFICIAL,
      }),
    ).toEqual({ points: 50, correctSlots: ['F3', 'F4'] });
  });
});

describe('scoreFinal — invariant guards', () => {
  it('throws if playerSlots misses a slot', () => {
    expect(() =>
      scoreFinal({
        playerSlots: { F1: 'a', F2: 'b', F3: 'c', F4: '' },
        officialSlots: OFFICIAL,
      }),
    ).toThrow(/playerSlots.*F4/);
  });

  it('throws if officialSlots misses a slot', () => {
    expect(() =>
      scoreFinal({
        playerSlots: { F1: 'a', F2: 'b', F3: 'c', F4: 'd' },
        officialSlots: { F1: 'a', F2: 'b', F3: 'c', F4: '' },
      }),
    ).toThrow(/officialSlots.*F4/);
  });

  it('allows playerSlots to reuse a team across slots (tactical pick)', () => {
    // Player tactically backs "team-gold" for every medal slot. Only F1 counts.
    expect(
      scoreFinal({
        playerSlots: {
          F1: 'team-gold',
          F2: 'team-gold',
          F3: 'team-gold',
          F4: 'team-gold',
        },
        officialSlots: OFFICIAL,
      }),
    ).toEqual({ points: 60, correctSlots: ['F1'] });
  });

  it('throws if officialSlots reuses a team across slots', () => {
    expect(() =>
      scoreFinal({
        playerSlots: { F1: 'a', F2: 'b', F3: 'c', F4: 'd' },
        officialSlots: {
          F1: 'team-gold',
          F2: 'team-gold',
          F3: 'team-bronze',
          F4: 'team-fourth',
        },
      }),
    ).toThrow(/officialSlots.*distinct/);
  });

  it('throws when a slot value is not a string', () => {
    expect(() =>
      scoreFinal({
        // @ts-expect-error — intentional violation to exercise the guard
        playerSlots: { F1: undefined, F2: 'b', F3: 'c', F4: 'd' },
        officialSlots: OFFICIAL,
      }),
    ).toThrow(/playerSlots.*F1/);
  });
});

describe('scoreFinalSlot — per-slot binary credit', () => {
  it('awards F1 weight on match', () => {
    expect(scoreFinalSlot('F1', 'team-gold', 'team-gold')).toBe(60);
  });

  it('awards 0 on mismatch', () => {
    expect(scoreFinalSlot('F2', 'team-x', 'team-silver')).toBe(0);
  });

  it('awards F3 weight on match', () => {
    expect(scoreFinalSlot('F3', 'team-bronze', 'team-bronze')).toBe(30);
  });

  it('awards F4 weight on match', () => {
    expect(scoreFinalSlot('F4', 'team-fourth', 'team-fourth')).toBe(20);
  });
});
