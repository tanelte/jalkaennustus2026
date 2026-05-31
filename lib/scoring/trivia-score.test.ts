import { describe, expect, it } from 'vitest';
import { scoreTrivia, type TriviaAnswerInput, type TriviaPosition } from './trivia-score';

function mk(
  position: TriviaPosition,
  isCorrect: boolean | null,
  conditionalOnPosition: TriviaPosition | null = null,
): TriviaAnswerInput {
  return { position, isCorrect, conditionalOnPosition };
}

// All five questions independent (baseline shape — no conditional rule).
function baseline(flags: readonly [boolean, boolean, boolean, boolean, boolean]): TriviaAnswerInput[] {
  return [
    mk(1, flags[0]),
    mk(2, flags[1]),
    mk(3, flags[2]),
    mk(4, flags[3]),
    mk(5, flags[4]),
  ];
}

// WC2026 seed shape: Q5 conditional on Q4.
function wc2026Shape(
  flags: readonly [boolean, boolean, boolean, boolean, boolean],
): TriviaAnswerInput[] {
  return [
    mk(1, flags[0]),
    mk(2, flags[1]),
    mk(3, flags[2]),
    mk(4, flags[3]),
    mk(5, flags[4], 4),
  ];
}

describe('scoreTrivia — boundaries', () => {
  it('all 5 correct (no conditional) => 70 points', () => {
    const r = scoreTrivia(baseline([true, true, true, true, true]));
    expect(r.totalPoints).toBe(70);
    expect(r.perAnswer).toEqual([
      { position: 1, points: 14 },
      { position: 2, points: 14 },
      { position: 3, points: 14 },
      { position: 4, points: 14 },
      { position: 5, points: 14 },
    ]);
  });

  it('all 5 wrong => 0 points', () => {
    const r = scoreTrivia(baseline([false, false, false, false, false]));
    expect(r.totalPoints).toBe(0);
    for (const a of r.perAnswer) expect(a.points).toBe(0);
  });
});

describe('scoreTrivia — Q5-conditional-on-Q4 (the trick)', () => {
  it('all 5 correct with Q5 conditional on Q4 => 70 (Q5 unlocked by correct Q4)', () => {
    const r = scoreTrivia(wc2026Shape([true, true, true, true, true]));
    expect(r.totalPoints).toBe(70);
    expect(r.perAnswer[4]).toEqual({ position: 5, points: 14 });
  });

  it('Q1..Q4 correct, Q5 wrong => 56 (no Q5 credit)', () => {
    const r = scoreTrivia(wc2026Shape([true, true, true, true, false]));
    expect(r.totalPoints).toBe(56);
    expect(r.perAnswer[4]).toEqual({ position: 5, points: 0 });
  });

  it('Q4 wrong, Q5 correct => Q5 still 0 (the trick)', () => {
    const r = scoreTrivia(wc2026Shape([true, true, true, false, true]));
    // Q1=14 + Q2=14 + Q3=14 + Q4=0 + Q5=0 (gated) = 42
    expect(r.totalPoints).toBe(42);
    expect(r.perAnswer[3]).toEqual({ position: 4, points: 0 });
    expect(r.perAnswer[4]).toEqual({ position: 5, points: 0 });
  });

  it('Q4 wrong, Q5 wrong => both 0', () => {
    const r = scoreTrivia(wc2026Shape([true, true, true, false, false]));
    expect(r.totalPoints).toBe(42);
    expect(r.perAnswer[3].points).toBe(0);
    expect(r.perAnswer[4].points).toBe(0);
  });

  it('Q5 conditional gate looks at the actual gate-position, not "position 4" hardcoded', () => {
    // Construct a (hypothetical) shape where Q3 is the gate for Q5 instead of Q4.
    const answers: TriviaAnswerInput[] = [
      mk(1, false),
      mk(2, false),
      mk(3, false), // gate fails
      mk(4, true),  // Q4 is independently correct here
      mk(5, true, 3),
    ];
    const r = scoreTrivia(answers);
    // Q4 scores 14 independently; Q5 zeroed because the gate (Q3) is wrong.
    expect(r.perAnswer[3].points).toBe(14);
    expect(r.perAnswer[4].points).toBe(0);
    expect(r.totalPoints).toBe(14);
  });
});

describe('scoreTrivia — partial Q1..Q3 permutations', () => {
  // 8 permutations over Q1..Q3 × (Q4 correct, Q5 correct).
  for (let mask = 0; mask < 8; mask++) {
    const q1 = (mask & 1) !== 0;
    const q2 = (mask & 2) !== 0;
    const q3 = (mask & 4) !== 0;
    const independents = [q1, q2, q3].filter(Boolean).length;

    it(`Q1=${q1} Q2=${q2} Q3=${q3} Q4=true Q5=true => ${(independents + 2) * 14}`, () => {
      const r = scoreTrivia(wc2026Shape([q1, q2, q3, true, true]));
      expect(r.totalPoints).toBe((independents + 2) * 14);
    });

    it(`Q1=${q1} Q2=${q2} Q3=${q3} Q4=false Q5=true => ${independents * 14} (Q5 gated)`, () => {
      const r = scoreTrivia(wc2026Shape([q1, q2, q3, false, true]));
      expect(r.totalPoints).toBe(independents * 14);
    });
  }
});

describe('scoreTrivia — partial officials (isCorrect: null)', () => {
  it('non-conditional: null isCorrect => null points', () => {
    const r = scoreTrivia([mk(1, null), mk(2, null), mk(3, null), mk(4, null), mk(5, null, 4)]);
    expect(r.perAnswer).toEqual([
      { position: 1, points: null },
      { position: 2, points: null },
      { position: 3, points: null },
      { position: 4, points: null },
      { position: 5, points: null },
    ]);
    expect(r.totalPoints).toBe(0);
  });

  it('only Q1 + Q2 officials known: Q1 + Q2 scored, others null', () => {
    const r = scoreTrivia([
      mk(1, true),
      mk(2, true),
      mk(3, null),
      mk(4, null),
      mk(5, null, 4),
    ]);
    expect(r.perAnswer).toEqual([
      { position: 1, points: 14 },
      { position: 2, points: 14 },
      { position: 3, points: null },
      { position: 4, points: null },
      { position: 5, points: null }, // gate unknown
    ]);
    expect(r.totalPoints).toBe(28);
  });

  it('Q4 correct, Q5 official unknown: Q5 still null (gate open but own unknown)', () => {
    const r = scoreTrivia([mk(1, true), mk(2, true), mk(3, true), mk(4, true), mk(5, null, 4)]);
    expect(r.perAnswer[4]).toEqual({ position: 5, points: null });
    expect(r.totalPoints).toBe(56);
  });

  it('Q4 wrong, Q5 official unknown: Q5 is definitively 0 (gate failed)', () => {
    const r = scoreTrivia([mk(1, true), mk(2, true), mk(3, true), mk(4, false), mk(5, null, 4)]);
    expect(r.perAnswer[3]).toEqual({ position: 4, points: 0 });
    expect(r.perAnswer[4]).toEqual({ position: 5, points: 0 });
    expect(r.totalPoints).toBe(42);
  });

  it('Q4 unknown, Q5 correct: Q5 null because gate unknown', () => {
    const r = scoreTrivia([mk(1, true), mk(2, true), mk(3, true), mk(4, null), mk(5, true, 4)]);
    expect(r.perAnswer[3]).toEqual({ position: 4, points: null });
    expect(r.perAnswer[4]).toEqual({ position: 5, points: null });
    expect(r.totalPoints).toBe(42);
  });
});

describe('scoreTrivia — invariant guards', () => {
  it('throws if fewer than 5 answers', () => {
    expect(() =>
      scoreTrivia([mk(1, true), mk(2, true), mk(3, true), mk(4, true)]),
    ).toThrow(/exactly 5 answers/);
  });

  it('throws if more than 5 answers', () => {
    expect(() =>
      scoreTrivia([
        mk(1, true),
        mk(2, true),
        mk(3, true),
        mk(4, true),
        mk(5, true),
        // @ts-expect-error position 6 deliberately out of range
        mk(6, true),
      ]),
    ).toThrow(/exactly 5 answers/);
  });

  it('throws if duplicate position', () => {
    expect(() =>
      scoreTrivia([mk(1, true), mk(2, true), mk(3, true), mk(4, true), mk(1, true)]),
    ).toThrow(/duplicate position/);
  });

  it('throws if a position 1..5 is missing (covered range, duplicate of another)', () => {
    // Five entries, positions 1,2,3,4,4 — position 5 missing, but duplicate is caught first.
    expect(() =>
      scoreTrivia([mk(1, true), mk(2, true), mk(3, true), mk(4, true), mk(4, true)]),
    ).toThrow(/duplicate position/);
  });

  it('throws if a position is out of range', () => {
    expect(() =>
      scoreTrivia([
        mk(1, true),
        mk(2, true),
        mk(3, true),
        mk(4, true),
        // @ts-expect-error position 9 deliberately out of range
        mk(9, true),
      ]),
    ).toThrow(/out of range/);
  });
});
