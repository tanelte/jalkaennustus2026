import { describe, expect, it } from 'vitest';
import {
  DOUBLE_POINTS_MULTIPLIER,
  MATCH_EXACT_POINTS,
  MATCH_MISS_POINTS,
  MATCH_WINNER_POINTS,
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
