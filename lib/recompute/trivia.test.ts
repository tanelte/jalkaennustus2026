import { describe, expect, it } from 'vitest';
import {
  computePointsForPlayerAnswers,
  judgeAnswer,
  type OfficialQuestion,
  type PlayerAnswerRow,
} from './trivia';

const WC2026_OFFICIALS: OfficialQuestion[] = [
  { position: 1, answer_shape: 'integer', correct_answer: '180', conditional_on_position: null },
  { position: 2, answer_shape: 'text', correct_answer: 'Mbappe', conditional_on_position: null },
  { position: 3, answer_shape: 'integer', correct_answer: '12', conditional_on_position: null },
  { position: 4, answer_shape: 'team', correct_answer: 'ARG', conditional_on_position: null },
  { position: 5, answer_shape: 'integer', correct_answer: '3', conditional_on_position: 4 },
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

describe('computePointsForPlayerAnswers', () => {
  it('returns null points when any official is missing (cannot judge yet)', () => {
    const partial: OfficialQuestion[] = WC2026_OFFICIALS.map((o, i) =>
      i === 2 ? { ...o, correct_answer: null } : o,
    );
    const player = rows(['180', 'Mbappe', '12', 'ARG', '3']);
    const result = computePointsForPlayerAnswers(partial, player);
    expect(result).toHaveLength(5);
    for (const r of result) expect(r.points).toBeNull();
  });

  it('returns null when the player has fewer than 5 rows (not all positions yet)', () => {
    const player = rows(['180', 'Mbappe', '12']);
    const result = computePointsForPlayerAnswers(WC2026_OFFICIALS, player);
    expect(result).toHaveLength(3);
    for (const r of result) expect(r.points).toBeNull();
  });

  it('all 5 correct => 14 each, Q5 unlocked by correct Q4', () => {
    const player = rows(['180', 'Mbappe', '12', 'ARG', '3']);
    const result = computePointsForPlayerAnswers(WC2026_OFFICIALS, player);
    const byPos = Object.fromEntries(
      result.map((r, i) => [i + 1, r.points]),
    ) as Record<number, number | null>;
    expect(byPos).toEqual({ 1: 14, 2: 14, 3: 14, 4: 14, 5: 14 });
  });

  it('Q4 wrong => Q5 also zero even if Q5 string matches', () => {
    const player = rows(['180', 'Mbappe', '12', 'BRA', '3']);
    const result = computePointsForPlayerAnswers(WC2026_OFFICIALS, player);
    const byPos = Object.fromEntries(
      result.map((r, i) => [i + 1, r.points]),
    ) as Record<number, number | null>;
    expect(byPos).toEqual({ 1: 14, 2: 14, 3: 14, 4: 0, 5: 0 });
  });

  it('partial Q1..Q3 correct, Q4 correct, Q5 wrong => Q5 zero (independently)', () => {
    const player = rows(['181', 'Mbappe', '12', 'ARG', '99']);
    const result = computePointsForPlayerAnswers(WC2026_OFFICIALS, player);
    const byPos = Object.fromEntries(
      result.map((r, i) => [i + 1, r.points]),
    ) as Record<number, number | null>;
    expect(byPos).toEqual({ 1: 0, 2: 14, 3: 14, 4: 14, 5: 0 });
  });

  it('preserves row ids in the returned updates (so the orchestrator can target them)', () => {
    const player = rows(['180', 'Mbappe', '12', 'ARG', '3']);
    const result = computePointsForPlayerAnswers(WC2026_OFFICIALS, player);
    expect(result.map((r) => r.id)).toEqual(['row-1', 'row-2', 'row-3', 'row-4', 'row-5']);
  });
});
