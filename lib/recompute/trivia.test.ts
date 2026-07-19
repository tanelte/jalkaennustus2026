import { describe, expect, it } from 'vitest';
import {
  computePointsForPlayerAnswers,
  integerDistance,
  judgeAnswer,
  type OfficialQuestion,
  type PlayerAnswerRow,
} from './trivia';

const WC2026_OFFICIALS: OfficialQuestion[] = [
  { position: 1, answer_shape: 'team', correct_answer: 'ARG', conditional_on_position: null },
  { position: 2, answer_shape: 'team', correct_answer: 'ENG', conditional_on_position: null },
  { position: 3, answer_shape: 'integer', correct_answer: '12', conditional_on_position: null },
  { position: 4, answer_shape: 'text', correct_answer: 'Mbappe', conditional_on_position: null },
  { position: 5, answer_shape: 'integer', correct_answer: '8', conditional_on_position: 4 },
];

function rows(answers: readonly string[]): PlayerAnswerRow[] {
  return answers.map((a, i) => ({
    id: `row-${i + 1}`,
    user_id: 'u1',
    position: (i + 1) as 1 | 2 | 3 | 4 | 5,
    answer: a,
  }));
}

describe('judgeAnswer', () => {
  it('returns null when official is not yet set', () => {
    expect(judgeAnswer('foo', null, 'text')).toBeNull();
  });

  it('returns null when official is empty / whitespace', () => {
    expect(judgeAnswer('foo', '   ', 'text')).toBeNull();
  });

  it('integer: matches numerically', () => {
    expect(judgeAnswer('180', '180', 'integer')).toBe(true);
    expect(judgeAnswer(' 180 ', '180', 'integer')).toBe(true);
    expect(judgeAnswer('181', '180', 'integer')).toBe(false);
  });

  it('integer: non-numeric player answer is false (not null)', () => {
    expect(judgeAnswer('lots', '180', 'integer')).toBe(false);
  });

  it('integer: non-numeric official treated as false', () => {
    expect(judgeAnswer('180', 'lots', 'integer')).toBe(false);
  });

  it('text: case-insensitive, whitespace-trimmed', () => {
    expect(judgeAnswer('  mBaPpE  ', 'Mbappe', 'text')).toBe(true);
    expect(judgeAnswer('Messi', 'Mbappe', 'text')).toBe(false);
  });

  it('team: case-insensitive', () => {
    expect(judgeAnswer('arg', 'ARG', 'team')).toBe(true);
    expect(judgeAnswer('BRA', 'ARG', 'team')).toBe(false);
  });
});

describe('integerDistance', () => {
  it('returns null when official is not yet set / empty / non-integer', () => {
    expect(integerDistance('8', null)).toBeNull();
    expect(integerDistance('8', '   ')).toBeNull();
    expect(integerDistance('8', 'lots')).toBeNull();
  });

  it('returns the absolute gap', () => {
    expect(integerDistance('9', '10')).toBe(1);
    expect(integerDistance('12', '10')).toBe(2);
    expect(integerDistance(' 10 ', '10')).toBe(0);
  });

  it('returns Infinity for a blank / non-numeric guess', () => {
    expect(integerDistance('', '10')).toBe(Number.POSITIVE_INFINITY);
    expect(integerDistance('lots', '10')).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('computePointsForPlayerAnswers — integer proximity', () => {
  it('Q3 off by 2 => 12; Q5 off by 1 (Q4 correct) => 13', () => {
    // Officials: Q3='12', Q5='8', Q4='Mbappe'.
    const player = rows(['ARG', 'ENG', '10', 'Mbappe', '7']);
    const result = computePointsForPlayerAnswers(WC2026_OFFICIALS, player);
    const byPos = Object.fromEntries(
      result.map((r, i) => [i + 1, r.points]),
    ) as Record<number, number | null>;
    expect(byPos).toEqual({ 1: 14, 2: 14, 3: 12, 4: 14, 5: 13 });
  });

  it('Q4 wrong => Q5 zero even when the goal count is a near miss', () => {
    const player = rows(['ARG', 'ENG', '12', 'Messi', '7']);
    const result = computePointsForPlayerAnswers(WC2026_OFFICIALS, player);
    const byPos = Object.fromEntries(
      result.map((r, i) => [i + 1, r.points]),
    ) as Record<number, number | null>;
    expect(byPos).toEqual({ 1: 14, 2: 14, 3: 14, 4: 0, 5: 0 });
  });

  it('blank / non-numeric integer guess => 0', () => {
    const player = rows(['ARG', 'ENG', 'lots', 'Mbappe', '']);
    const result = computePointsForPlayerAnswers(WC2026_OFFICIALS, player);
    const byPos = Object.fromEntries(
      result.map((r, i) => [i + 1, r.points]),
    ) as Record<number, number | null>;
    expect(byPos).toEqual({ 1: 14, 2: 14, 3: 0, 4: 14, 5: 0 });
  });

  it('far-off integer guess floors at 0', () => {
    const player = rows(['ARG', 'ENG', '99', 'Mbappe', '8']);
    const result = computePointsForPlayerAnswers(WC2026_OFFICIALS, player);
    const byPos = Object.fromEntries(
      result.map((r, i) => [i + 1, r.points]),
    ) as Record<number, number | null>;
    expect(byPos).toEqual({ 1: 14, 2: 14, 3: 0, 4: 14, 5: 14 });
  });
});

describe('computePointsForPlayerAnswers', () => {
  it('Q3 official missing: Q3 stays null but Q1/Q2/Q4/Q5 are scored', () => {
    const partial: OfficialQuestion[] = WC2026_OFFICIALS.map((o, i) =>
      i === 2 ? { ...o, correct_answer: null } : o,
    );
    const player = rows(['ARG', 'ENG', '12', 'Mbappe', '8']);
    const result = computePointsForPlayerAnswers(partial, player);
    const byPos = Object.fromEntries(
      result.map((r, i) => [i + 1, r.points]),
    ) as Record<number, number | null>;
    expect(byPos).toEqual({ 1: 14, 2: 14, 3: null, 4: 14, 5: 14 });
  });

  it('only Q1 + Q2 officials known: Q1 + Q2 score, Q3/Q4/Q5 stay null (partial leaderboard motion)', () => {
    const partial: OfficialQuestion[] = WC2026_OFFICIALS.map((o, i) =>
      i < 2 ? o : { ...o, correct_answer: null },
    );
    const player = rows(['ARG', 'ENG', '12', 'Mbappe', '8']);
    const result = computePointsForPlayerAnswers(partial, player);
    const byPos = Object.fromEntries(
      result.map((r, i) => [i + 1, r.points]),
    ) as Record<number, number | null>;
    expect(byPos).toEqual({ 1: 14, 2: 14, 3: null, 4: null, 5: null });
  });

  it('Q4 wrong + Q5 official still unknown: Q5 is definitively 0 (gate failed)', () => {
    const partial: OfficialQuestion[] = WC2026_OFFICIALS.map((o, i) =>
      i === 4 ? { ...o, correct_answer: null } : o,
    );
    const player = rows(['ARG', 'ENG', '12', 'Messi', '8']);
    const result = computePointsForPlayerAnswers(partial, player);
    const byPos = Object.fromEntries(
      result.map((r, i) => [i + 1, r.points]),
    ) as Record<number, number | null>;
    expect(byPos).toEqual({ 1: 14, 2: 14, 3: 14, 4: 0, 5: 0 });
  });

  it('player has only Q1..Q3 rows: those score, the missing positions are not returned', () => {
    const player = rows(['ARG', 'ENG', '12']);
    const result = computePointsForPlayerAnswers(WC2026_OFFICIALS, player);
    expect(result).toHaveLength(3);
    const byPos = Object.fromEntries(
      result.map((r, i) => [i + 1, r.points]),
    ) as Record<number, number | null>;
    expect(byPos).toEqual({ 1: 14, 2: 14, 3: 14 });
  });

  it('all 5 correct => 14 each, Q5 unlocked by correct Q4', () => {
    const player = rows(['ARG', 'ENG', '12', 'Mbappe', '8']);
    const result = computePointsForPlayerAnswers(WC2026_OFFICIALS, player);
    const byPos = Object.fromEntries(
      result.map((r, i) => [i + 1, r.points]),
    ) as Record<number, number | null>;
    expect(byPos).toEqual({ 1: 14, 2: 14, 3: 14, 4: 14, 5: 14 });
  });

  it('Q4 wrong => Q5 also zero even if Q5 string matches', () => {
    const player = rows(['ARG', 'ENG', '12', 'Messi', '8']);
    const result = computePointsForPlayerAnswers(WC2026_OFFICIALS, player);
    const byPos = Object.fromEntries(
      result.map((r, i) => [i + 1, r.points]),
    ) as Record<number, number | null>;
    expect(byPos).toEqual({ 1: 14, 2: 14, 3: 14, 4: 0, 5: 0 });
  });

  it('partial Q1..Q3 correct, Q4 correct, Q5 wrong => Q5 zero (independently)', () => {
    const player = rows(['BRA', 'ENG', '12', 'Mbappe', '99']);
    const result = computePointsForPlayerAnswers(WC2026_OFFICIALS, player);
    const byPos = Object.fromEntries(
      result.map((r, i) => [i + 1, r.points]),
    ) as Record<number, number | null>;
    expect(byPos).toEqual({ 1: 0, 2: 14, 3: 14, 4: 14, 5: 0 });
  });

  it('preserves row ids in the returned updates (so the orchestrator can target them)', () => {
    const player = rows(['ARG', 'ENG', '12', 'Mbappe', '8']);
    const result = computePointsForPlayerAnswers(WC2026_OFFICIALS, player);
    expect(result.map((r) => r.id)).toEqual(['row-1', 'row-2', 'row-3', 'row-4', 'row-5']);
  });
});
