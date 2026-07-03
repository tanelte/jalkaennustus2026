import { describe, expect, it } from 'vitest';
import { buildFinalSlotResults, type OfficialFinalSlot } from './result-view';
import type { FinalSlot } from './constants';

// Official medal standings: four distinct teams.
const OFFICIAL: Record<FinalSlot, OfficialFinalSlot> = {
  F1: { teamId: 'arg', teamName: 'Argentina' },
  F2: { teamId: 'fra', teamName: 'Prantsusmaa' },
  F3: { teamId: 'cro', teamName: 'Horvaatia' },
  F4: { teamId: 'mar', teamName: 'Maroko' },
};

describe('buildFinalSlotResults — incomplete official set', () => {
  it('returns null until all four slots are official', () => {
    const partial = { F1: OFFICIAL.F1, F2: OFFICIAL.F2, F3: OFFICIAL.F3 };
    expect(buildFinalSlotResults({ F1: 'arg' }, partial)).toBeNull();
  });

  it('returns null for an empty official set', () => {
    expect(buildFinalSlotResults({ F1: 'arg' }, {})).toBeNull();
  });
});

describe('buildFinalSlotResults — scoring', () => {
  it('all four slots correct => 60/40/30/20', () => {
    const view = buildFinalSlotResults(
      { F1: 'arg', F2: 'fra', F3: 'cro', F4: 'mar' },
      OFFICIAL,
    )!;
    expect(view.F1.points).toBe(60);
    expect(view.F2.points).toBe(40);
    expect(view.F3.points).toBe(30);
    expect(view.F4.points).toBe(20);
  });

  it('scores each correct slot independently, wrong slots score 0', () => {
    // Correct F1 (60) and F3 (30); F2/F4 wrong.
    const view = buildFinalSlotResults(
      { F1: 'arg', F2: 'cro', F3: 'cro', F4: 'fra' },
      OFFICIAL,
    )!;
    expect(view.F1.points).toBe(60);
    expect(view.F2.points).toBe(0);
    expect(view.F3.points).toBe(30);
    expect(view.F4.points).toBe(0);
  });

  it('a missing player pick for a slot scores 0', () => {
    const view = buildFinalSlotResults({ F1: 'arg' }, OFFICIAL)!;
    expect(view.F1.points).toBe(60);
    expect(view.F2.points).toBe(0);
    expect(view.F3.points).toBe(0);
    expect(view.F4.points).toBe(0);
  });

  it('exposes the official team that finished each slot', () => {
    const view = buildFinalSlotResults({}, OFFICIAL)!;
    expect(view.F1.officialTeamName).toBe('Argentina');
    expect(view.F4.officialTeamId).toBe('mar');
  });
});
