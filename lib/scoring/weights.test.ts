import { describe, expect, it } from 'vitest';
import {
  DOUBLE_POINTS_MULTIPLIER,
  KNOCKOUT_EXACT_POINTS_BY_STAGE,
  KNOCKOUT_WINNER_POINTS_BY_STAGE,
  MATCH_EXACT_POINTS,
  MATCH_MISS_POINTS,
  MATCH_WINNER_POINTS,
  TRIVIA_POINTS_PER_CORRECT,
  TRIVIA_QUESTION_COUNT,
} from './weights';

// The locked scoring table is the test oracle. If these values change without
// a corresponding update to the brainstorming research, something is wrong.
describe('locked scoring weights', () => {
  it('MATCH_EXACT_POINTS is 5', () => {
    expect(MATCH_EXACT_POINTS).toBe(5);
  });

  it('MATCH_WINNER_POINTS is 3', () => {
    expect(MATCH_WINNER_POINTS).toBe(3);
  });

  it('MATCH_MISS_POINTS is 0', () => {
    expect(MATCH_MISS_POINTS).toBe(0);
  });

  it('DOUBLE_POINTS_MULTIPLIER is 2', () => {
    expect(DOUBLE_POINTS_MULTIPLIER).toBe(2);
  });
});

describe('knockout per-round weights — match the locked Final Scoring Table', () => {
  it('R32: exact 8, winner 4 (stage max 16 picks × 8 = 128)', () => {
    expect(KNOCKOUT_EXACT_POINTS_BY_STAGE.r32).toBe(8);
    expect(KNOCKOUT_WINNER_POINTS_BY_STAGE.r32).toBe(4);
  });

  it('R16: exact 14, winner 7 (stage max 8 × 14 = 112)', () => {
    expect(KNOCKOUT_EXACT_POINTS_BY_STAGE.r16).toBe(14);
    expect(KNOCKOUT_WINNER_POINTS_BY_STAGE.r16).toBe(7);
  });

  it('QF: exact 22, winner 11 (stage max 4 × 22 = 88)', () => {
    expect(KNOCKOUT_EXACT_POINTS_BY_STAGE.qf).toBe(22);
    expect(KNOCKOUT_WINNER_POINTS_BY_STAGE.qf).toBe(11);
  });

  it('SF: exact 35, winner 18 (stage max 2 × 35 = 70; half locked at 18 not 17.5)', () => {
    expect(KNOCKOUT_EXACT_POINTS_BY_STAGE.sf).toBe(35);
    expect(KNOCKOUT_WINNER_POINTS_BY_STAGE.sf).toBe(18);
  });
});

describe('trivia weights — match the locked Final Scoring Table', () => {
  it('TRIVIA_POINTS_PER_CORRECT is 14 (5 × 14 = 70 = 7% of tournament budget)', () => {
    expect(TRIVIA_POINTS_PER_CORRECT).toBe(14);
  });

  it('TRIVIA_QUESTION_COUNT is 5', () => {
    expect(TRIVIA_QUESTION_COUNT).toBe(5);
  });
});
