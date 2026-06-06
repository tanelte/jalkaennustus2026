import { describe, expect, it, vi } from 'vitest';
import {
  filterClosedWindows,
  filterOpenWindows,
  filterUpcomingWindows,
  getClosedStages,
  getOpenStages,
  getUpcomingStages,
  type StageRow,
} from './open-windows';

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

describe('filterUpcomingWindows', () => {
  it('returns all stages when now is before every opens_at', () => {
    const out = filterUpcomingWindows(ROWS, new Date('2026-05-31T00:00:00Z'));
    expect(out.map((r) => r.code)).toEqual(['trivia', 'group_matches', 'best_thirds']);
  });

  it('excludes stages whose opens_at is in the past or equal to now', () => {
    const out = filterUpcomingWindows(ROWS, new Date('2026-06-10T00:00:00Z'));
    expect(out.map((r) => r.code)).toEqual(['best_thirds']);
  });

  it('treats opens_at === now as already opened (not upcoming)', () => {
    const out = filterUpcomingWindows(ROWS, ROWS[2]!.opens_at);
    expect(out).toHaveLength(0);
  });

  it('returns empty once now is past every opens_at', () => {
    const out = filterUpcomingWindows(ROWS, new Date('2026-07-01T00:00:00Z'));
    expect(out).toEqual([]);
  });
});

describe('getUpcomingStages', () => {
  it('delegates to findStages and applies the upcoming filter', async () => {
    const findStages = vi.fn(async () => ROWS);
    const out = await getUpcomingStages('t-1', {
      findStages,
      now: () => new Date('2026-06-10T00:00:00Z'),
    });
    expect(findStages).toHaveBeenCalledWith('t-1');
    expect(out.map((r) => r.code)).toEqual(['best_thirds']);
  });
});

describe('filterClosedWindows', () => {
  it('returns no rows before any window closes', () => {
    expect(filterClosedWindows(ROWS, new Date('2026-05-31T00:00:00Z'))).toHaveLength(0);
  });

  it('returns pre-kickoff stages once their close timestamp is past', () => {
    const out = filterClosedWindows(ROWS, new Date('2026-06-20T00:00:00Z'));
    expect(out.map((r) => r.code)).toEqual(['trivia', 'group_matches']);
  });

  it('orders most-recently-closed first', () => {
    const mixed: StageRow[] = [
      {
        code: 'trivia',
        position: 1,
        opens_at: new Date('2026-06-01T00:00:00Z'),
        closes_at: new Date('2026-06-11T12:00:00Z'),
      },
      {
        code: 'group_matches',
        position: 2,
        opens_at: new Date('2026-06-01T00:00:00Z'),
        closes_at: new Date('2026-06-11T16:00:00Z'),
      },
    ];
    const out = filterClosedWindows(mixed, new Date('2026-06-12T00:00:00Z'));
    expect(out.map((r) => r.code)).toEqual(['group_matches', 'trivia']);
  });

  it('treats closes_at === now as still-open (not closed)', () => {
    expect(filterClosedWindows(ROWS, ROWS[0]!.closes_at)).toHaveLength(0);
  });
});

describe('getClosedStages', () => {
  it('delegates to findStages and applies the closed filter', async () => {
    const findStages = vi.fn(async () => ROWS);
    const out = await getClosedStages('t-1', {
      findStages,
      now: () => new Date('2026-06-27T00:00:00Z'),
    });
    expect(findStages).toHaveBeenCalledWith('t-1');
    expect(out.map((r) => r.code)).toEqual(['best_thirds', 'trivia', 'group_matches']);
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
