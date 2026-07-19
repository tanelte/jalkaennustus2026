import { describe, expect, it } from 'vitest';
import {
  computeFinalsRescoreInputs,
  validateOfficialFinals,
  type FinalPickRow,
  type OfficialFinalPicks,
} from './final-score';

const OFFICIAL: OfficialFinalPicks = {
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

  it('accepts a partial set (bronze/fourth known before the final)', () => {
    const out = validateOfficialFinals({ F3: 'team-bronze', F4: 'team-fourth' });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.slots).toEqual({ F3: 'team-bronze', F4: 'team-fourth' });
    }
  });

  it('accepts an empty set', () => {
    const out = validateOfficialFinals({});
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.slots).toEqual({});
    }
  });

  it('ignores empty-string slots', () => {
    const out = validateOfficialFinals({ F1: 'a', F2: '' });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.slots).toEqual({ F1: 'a' });
    }
  });

  it('rejects duplicate teams across filled slots', () => {
    expect(
      validateOfficialFinals({ F1: 'a', F2: 'a', F3: 'c', F4: 'd' }),
    ).toEqual({ ok: false, reason: 'duplicate_team' });
  });
});

describe('computeFinalsRescoreInputs', () => {
  it('awards locked weights to matching rows against a complete official set', () => {
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

  it('scores only the confirmed positions against a partial official set', () => {
    // Only F3/F4 official (bronze game played, final pending). A complete
    // picker earns bronze/fourth now; F1/F2 score 0 until confirmed.
    const rows: FinalPickRow[] = [
      { id: 'r-1', user_id: 'u-1', slot: 'F1', team_id: 'team-gold' },
      { id: 'r-2', user_id: 'u-1', slot: 'F2', team_id: 'team-silver' },
      { id: 'r-3', user_id: 'u-1', slot: 'F3', team_id: 'team-bronze' },
      { id: 'r-4', user_id: 'u-1', slot: 'F4', team_id: 'team-fourth' },
    ];
    expect(
      computeFinalsRescoreInputs(rows, { F3: 'team-bronze', F4: 'team-fourth' }),
    ).toEqual([
      { id: 'r-1', points: 0 },
      { id: 'r-2', points: 0 },
      { id: 'r-3', points: 30 },
      { id: 'r-4', points: 20 },
    ]);
  });

  it('scores a partial picker per-slot (independence — no all-four requirement)', () => {
    // Player predicted only bronze, correctly; earns 30 despite no other picks.
    const rows: FinalPickRow[] = [
      { id: 'r-1', user_id: 'u-1', slot: 'F3', team_id: 'team-bronze' },
      { id: 'r-2', user_id: 'u-2', slot: 'F3', team_id: 'team-wrong' },
    ];
    expect(computeFinalsRescoreInputs(rows, OFFICIAL)).toEqual([
      { id: 'r-1', points: 30 },
      { id: 'r-2', points: 0 },
    ]);
  });

  it('scores per-slot independently within a picker', () => {
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
