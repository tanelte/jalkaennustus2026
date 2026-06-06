import { describe, expect, it } from 'vitest';
import { defaultIsConsensus } from './load-peer-predictions';

describe('defaultIsConsensus (S06 enhancement #2)', () => {
  it('returns true for identical primitive payloads', () => {
    expect(defaultIsConsensus('X', 'X')).toBe(true);
    expect(defaultIsConsensus(7, 7)).toBe(true);
  });

  it('returns false for distinct primitive payloads', () => {
    expect(defaultIsConsensus('1', '2')).toBe(false);
  });

  it('returns true for deeply-equal object payloads', () => {
    expect(
      defaultIsConsensus(
        { teamId: 't-1', teamName: 'A', points: null },
        { teamId: 't-1', teamName: 'A', points: null },
      ),
    ).toBe(true);
  });

  it('returns false when ordered array entries differ', () => {
    expect(
      defaultIsConsensus(
        [
          { slot: 'F1', teamId: 't-1' },
          { slot: 'F2', teamId: 't-2' },
        ],
        [
          { slot: 'F1', teamId: 't-2' },
          { slot: 'F2', teamId: 't-1' },
        ],
      ),
    ).toBe(false);
  });

  it('treats two structurally identical objects with the same key order as equal', () => {
    const a = { pick: 'X', points: 5 };
    const b = { pick: 'X', points: 5 };
    expect(defaultIsConsensus(a, b)).toBe(true);
  });
});
