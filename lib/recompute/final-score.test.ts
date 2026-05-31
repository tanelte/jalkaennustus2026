import { describe, expect, it } from 'vitest';
import {
  computeFinalsRescoreInputs,
  groupPlayerFinalsByUser,
  validateOfficialFinals,
  type FinalPickRow,
} from './final-score';
import type { FinalSlotPicks } from '@/lib/scoring/final-score';

const OFFICIAL: FinalSlotPicks = {
  F1: 'team-gold',
  F2: 'team-silver',
  F3: 'team-bronze',
  F4: 'team-fourth',
};

describe('validateOfficialFinals', () => {
  it('accepts a complete set of four distinct teams', () => {
    const out = validateOfficialFinals(OFFICIAL);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.slots).toEqual(OFFICIAL);
    }
  });

  it('rejects when a slot is missing', () => {
    expect(
      validateOfficialFinals({ F1: 'a', F2: 'b', F3: 'c' }),
    ).toEqual({ ok: false, reason: 'missing_slot' });
  });

  it('rejects when a slot is empty', () => {
    expect(
      validateOfficialFinals({ F1: 'a', F2: '', F3: 'c', F4: 'd' }),
    ).toEqual({ ok: false, reason: 'missing_slot' });
  });

  it('rejects duplicate teams across slots', () => {
    expect(
      validateOfficialFinals({ F1: 'a', F2: 'a', F3: 'c', F4: 'd' }),
    ).toEqual({ ok: false, reason: 'duplicate_team' });
  });
});

describe('groupPlayerFinalsByUser', () => {
  it('keeps only users with all four slots', () => {
    const rows: FinalPickRow[] = [
      { id: 'r-1', user_id: 'u-1', slot: 'F1', team_id: 'a' },
      { id: 'r-2', user_id: 'u-1', slot: 'F2', team_id: 'b' },
      { id: 'r-3', user_id: 'u-1', slot: 'F3', team_id: 'c' },
      { id: 'r-4', user_id: 'u-1', slot: 'F4', team_id: 'd' },
      { id: 'r-5', user_id: 'u-2', slot: 'F1', team_id: 'a' },
      { id: 'r-6', user_id: 'u-2', slot: 'F2', team_id: 'b' },
    ];
    const out = groupPlayerFinalsByUser(rows);
    expect(out.size).toBe(1);
    expect(out.get('u-1')).toEqual({ F1: 'a', F2: 'b', F3: 'c', F4: 'd' });
    expect(out.has('u-2')).toBe(false);
  });

  it('handles empty input', () => {
    expect(groupPlayerFinalsByUser([]).size).toBe(0);
  });
});

describe('computeFinalsRescoreInputs', () => {
  it('awards locked weights to matching rows for complete pickers', () => {
    const rows: FinalPickRow[] = [
      { id: 'r-1', user_id: 'u-1', slot: 'F1', team_id: 'team-gold' },
      { id: 'r-2', user_id: 'u-1', slot: 'F2', team_id: 'team-silver' },
      { id: 'r-3', user_id: 'u-1', slot: 'F3', team_id: 'team-bronze' },
      { id: 'r-4', user_id: 'u-1', slot: 'F4', team_id: 'team-fourth' },
    ];
    expect(computeFinalsRescoreInputs(rows, OFFICIAL)).toEqual([
      { id: 'r-1', points: 60 },
      { id: 'r-2', points: 40 },
      { id: 'r-3', points: 30 },
      { id: 'r-4', points: 20 },
    ]);
  });

  it('scores 0 for users without all four slots', () => {
    const rows: FinalPickRow[] = [
      { id: 'r-1', user_id: 'u-1', slot: 'F1', team_id: 'team-gold' },
      { id: 'r-2', user_id: 'u-1', slot: 'F2', team_id: 'team-silver' },
    ];
    expect(computeFinalsRescoreInputs(rows, OFFICIAL)).toEqual([
      { id: 'r-1', points: 0 },
      { id: 'r-2', points: 0 },
    ]);
  });

  it('scores per-slot independently within a complete picker', () => {
    const rows: FinalPickRow[] = [
      { id: 'r-1', user_id: 'u-1', slot: 'F1', team_id: 'team-gold' },
      { id: 'r-2', user_id: 'u-1', slot: 'F2', team_id: 'team-x' },
      { id: 'r-3', user_id: 'u-1', slot: 'F3', team_id: 'team-bronze' },
      { id: 'r-4', user_id: 'u-1', slot: 'F4', team_id: 'team-x2' },
    ];
    expect(computeFinalsRescoreInputs(rows, OFFICIAL)).toEqual([
      { id: 'r-1', points: 60 },
      { id: 'r-2', points: 0 },
      { id: 'r-3', points: 30 },
      { id: 'r-4', points: 0 },
    ]);
  });

  it('handles empty input', () => {
    expect(computeFinalsRescoreInputs([], OFFICIAL)).toEqual([]);
  });
});
