import { describe, expect, it, vi } from 'vitest';
import { filterOpenWindows, getOpenStages, type StageRow } from './open-windows';

const ROWS: StageRow[] = [
  {
    code: 'trivia',
    position: 1,
    opens_at: new Date('2026-06-01T00:00:00Z'),
    closes_at: new Date('2026-06-11T13:00:00Z'),
  },
  {
    code: 'group_matches',
    position: 2,
    opens_at: new Date('2026-06-01T00:00:00Z'),
    closes_at: new Date('2026-06-11T13:00:00Z'),
  },
  {
    code: 'best_thirds',
    position: 3,
    opens_at: new Date('2026-06-25T18:00:00Z'),
    closes_at: new Date('2026-06-26T18:00:00Z'),
  },
];

describe('filterOpenWindows', () => {
  it('returns no rows before any window opens', () => {
    expect(filterOpenWindows(ROWS, new Date('2026-05-31T00:00:00Z'))).toHaveLength(0);
  });

  it('returns pre-kickoff stages while they are open', () => {
    const out = filterOpenWindows(ROWS, new Date('2026-06-10T00:00:00Z'));
    expect(out.map((r) => r.code)).toEqual(['trivia', 'group_matches']);
  });

  it('returns only best_thirds during its short window', () => {
    const out = filterOpenWindows(ROWS, new Date('2026-06-26T00:00:00Z'));
    expect(out.map((r) => r.code)).toEqual(['best_thirds']);
  });

  it('is inclusive of opens_at and closes_at', () => {
    expect(filterOpenWindows(ROWS, ROWS[2]!.opens_at)).toHaveLength(1);
    expect(filterOpenWindows(ROWS, ROWS[2]!.closes_at)).toHaveLength(1);
  });
});

describe('getOpenStages', () => {
  it('delegates to findStages and applies the now() filter', async () => {
    const findStages = vi.fn(async () => ROWS);
    const out = await getOpenStages('t-1', {
      findStages,
      now: () => new Date('2026-06-10T00:00:00Z'),
    });
    expect(findStages).toHaveBeenCalledWith('t-1');
    expect(out.map((r) => r.code)).toEqual(['trivia', 'group_matches']);
  });

  it('returns empty when no windows are open', async () => {
    const out = await getOpenStages('t-1', {
      findStages: async () => ROWS,
      now: () => new Date('2026-06-15T00:00:00Z'),
    });
    expect(out).toEqual([]);
  });
});
