import { describe, expect, it } from 'vitest';
import { computeMatchRescoreInputs } from './match';

const game = (overrides: Partial<Parameters<typeof computeMatchRescoreInputs>[0]> = {}) => ({
  stage_code: 'group_matches',
  score_home: 2 as number | null,
  score_away: 1 as number | null,
  final_status: 'FINISHED' as string | null,
  finish_type: null as string | null,
  double_points: false,
  ...overrides,
});

describe('computeMatchRescoreInputs - cleared paths', () => {
  it('returns cleared/incomplete when score_home is null', () => {
    const out = computeMatchRescoreInputs(game({ score_home: null }), []);
    expect(out).toEqual({ kind: 'cleared', reason: 'incomplete' });
  });

  it('returns cleared/incomplete when score_away is null', () => {
    const out = computeMatchRescoreInputs(game({ score_away: null }), []);
    expect(out).toEqual({ kind: 'cleared', reason: 'incomplete' });
  });

  it('returns cleared/incomplete when final_status is null', () => {
    const out = computeMatchRescoreInputs(game({ final_status: null }), []);
    expect(out).toEqual({ kind: 'cleared', reason: 'incomplete' });
  });

  it('returns cleared/invalid_status when status is unknown vocabulary', () => {
    const out = computeMatchRescoreInputs(game({ final_status: 'GARBAGE' }), []);
    expect(out).toEqual({ kind: 'cleared', reason: 'invalid_status' });
  });

  it('returns cleared/non_result for POSTPONED', () => {
    const out = computeMatchRescoreInputs(game({ final_status: 'POSTPONED' }), []);
    expect(out).toEqual({ kind: 'cleared', reason: 'non_result' });
  });

  it('returns cleared/non_result for IN_PLAY (not yet final)', () => {
    const out = computeMatchRescoreInputs(game({ final_status: 'IN_PLAY' }), []);
    expect(out).toEqual({ kind: 'cleared', reason: 'non_result' });
  });
});

describe('computeMatchRescoreInputs - rescore paths', () => {
  it('scores 5 points for an exact-match prediction (no double-points)', () => {
    const out = computeMatchRescoreInputs(
      game({ score_home: 2, score_away: 1 }), // 1A: narrow home win
      [{ id: 'ug-1', prediction: '1A' }],
    );
    expect(out).toEqual({
      kind: 'rescore',
      result_code: '1A',
      rows: [{ user_game_id: 'ug-1', points: 5 }],
    });
  });

  it('scores 3 points for a winner-only match (right side, wrong margin)', () => {
    const out = computeMatchRescoreInputs(
      game({ score_home: 4, score_away: 0 }), // actual 1B
      [{ id: 'ug-1', prediction: '1A' }],
    );
    expect(out).toEqual({
      kind: 'rescore',
      result_code: '1B',
      rows: [{ user_game_id: 'ug-1', points: 3 }],
    });
  });

  it('scores 0 points for a missed direction', () => {
    const out = computeMatchRescoreInputs(
      game({ score_home: 0, score_away: 2 }), // actual 2A
      [{ id: 'ug-1', prediction: '1B' }],
    );
    expect(out).toEqual({
      kind: 'rescore',
      result_code: '2A',
      rows: [{ user_game_id: 'ug-1', points: 0 }],
    });
  });

  it('handles a draw correctly', () => {
    const out = computeMatchRescoreInputs(
      game({ score_home: 1, score_away: 1 }), // actual X
      [
        { id: 'ug-x', prediction: 'X' },
        { id: 'ug-1', prediction: '1A' },
      ],
    );
    expect(out).toEqual({
      kind: 'rescore',
      result_code: 'X',
      rows: [
        { user_game_id: 'ug-x', points: 5 },
        { user_game_id: 'ug-1', points: 0 },
      ],
    });
  });

  it('doubles points when double_points=true', () => {
    const out = computeMatchRescoreInputs(
      game({ score_home: 2, score_away: 1, double_points: true }),
      [
        { id: 'ug-exact', prediction: '1A' }, // 5 * 2 = 10
        { id: 'ug-winner', prediction: '1B' }, // 3 * 2 = 6
        { id: 'ug-miss', prediction: 'X' }, // 0 * 2 = 0
      ],
    );
    expect(out).toEqual({
      kind: 'rescore',
      result_code: '1A',
      rows: [
        { user_game_id: 'ug-exact', points: 10 },
        { user_game_id: 'ug-winner', points: 6 },
        { user_game_id: 'ug-miss', points: 0 },
      ],
    });
  });

  it('assigns null points to a row with invalid prediction text', () => {
    const out = computeMatchRescoreInputs(
      game({ score_home: 2, score_away: 1 }),
      [
        { id: 'ug-valid', prediction: '1A' },
        { id: 'ug-broken', prediction: 'OOPS' },
      ],
    );
    expect(out.kind).toBe('rescore');
    expect((out as { rows: unknown }).rows).toEqual([
      { user_game_id: 'ug-valid', points: 5 },
      { user_game_id: 'ug-broken', points: null },
    ]);
  });

  it('returns an empty rows array when there are no predictions', () => {
    const out = computeMatchRescoreInputs(
      game({ score_home: 3, score_away: 0 }),
      [],
    );
    expect(out).toEqual({ kind: 'rescore', result_code: '1B', rows: [] });
  });
});

describe('computeMatchRescoreInputs - knockout branch', () => {
  it('NORMAL_TIME home win → 1A regardless of margin', () => {
    const out = computeMatchRescoreInputs(
      game({
        stage_code: 'r32',
        score_home: 5,
        score_away: 0,
        finish_type: 'NORMAL_TIME',
      }),
      [
        { id: 'ug-exact', prediction: '1A' },
        { id: 'ug-winner-wrong-suffix', prediction: '1B' },
      ],
    );
    expect(out).toEqual({
      kind: 'rescore',
      result_code: '1A',
      rows: [
        { user_game_id: 'ug-exact', points: 5 },
        { user_game_id: 'ug-winner-wrong-suffix', points: 3 },
      ],
    });
  });

  it('EXTRA_TIME away win → 2B', () => {
    const out = computeMatchRescoreInputs(
      game({
        stage_code: 'qf',
        score_home: 1,
        score_away: 2,
        finish_type: 'EXTRA_TIME',
      }),
      [{ id: 'ug-1', prediction: '2B' }],
    );
    expect(out).toEqual({
      kind: 'rescore',
      result_code: '2B',
      rows: [{ user_game_id: 'ug-1', points: 5 }],
    });
  });

  it('PENALTIES home win via shootout score → 1B', () => {
    const out = computeMatchRescoreInputs(
      game({
        stage_code: 'sf',
        score_home: 4,
        score_away: 3,
        finish_type: 'PENALTIES',
      }),
      [{ id: 'ug-1', prediction: '1B' }],
    );
    expect(out).toEqual({
      kind: 'rescore',
      result_code: '1B',
      rows: [{ user_game_id: 'ug-1', points: 5 }],
    });
  });

  it('knockout with missing finish_type → cleared/missing_finish_type', () => {
    const out = computeMatchRescoreInputs(
      game({ stage_code: 'r16', finish_type: null }),
      [{ id: 'ug-1', prediction: '1A' }],
    );
    expect(out).toEqual({ kind: 'cleared', reason: 'missing_finish_type' });
  });

  it('knockout with invalid finish_type string → cleared/invalid_finish_type', () => {
    const out = computeMatchRescoreInputs(
      game({ stage_code: 'final', finish_type: 'GARBAGE' }),
      [],
    );
    expect(out).toEqual({ kind: 'cleared', reason: 'invalid_finish_type' });
  });

  it('knockout with equal scores → cleared/knockout_tie', () => {
    const out = computeMatchRescoreInputs(
      game({
        stage_code: 'final',
        score_home: 1,
        score_away: 1,
        finish_type: 'NORMAL_TIME',
      }),
      [{ id: 'ug-1', prediction: '1A' }],
    );
    expect(out).toEqual({ kind: 'cleared', reason: 'knockout_tie' });
  });

  it('knockout double_points doubles the points', () => {
    const out = computeMatchRescoreInputs(
      game({
        stage_code: 'final',
        score_home: 2,
        score_away: 1,
        finish_type: 'NORMAL_TIME',
        double_points: true,
      }),
      [
        { id: 'ug-exact', prediction: '1A' }, // 5 * 2 = 10
        { id: 'ug-winner', prediction: '1B' }, // 3 * 2 = 6
      ],
    );
    expect(out).toEqual({
      kind: 'rescore',
      result_code: '1A',
      rows: [
        { user_game_id: 'ug-exact', points: 10 },
        { user_game_id: 'ug-winner', points: 6 },
      ],
    });
  });

  it('group_matches stage_code preserves margin-based group mapping', () => {
    // Sanity: stage_code='group_matches' explicitly skips the knockout branch
    // even if finish_type is somehow set.
    const out = computeMatchRescoreInputs(
      game({
        stage_code: 'group_matches',
        score_home: 4,
        score_away: 0,
        finish_type: 'EXTRA_TIME', // ignored
      }),
      [{ id: 'ug-1', prediction: '1B' }],
    );
    expect(out).toEqual({
      kind: 'rescore',
      result_code: '1B',
      rows: [{ user_game_id: 'ug-1', points: 5 }],
    });
  });
});
