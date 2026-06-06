import { describe, expect, it, vi } from 'vitest';
import {
  isBestThirdsConsensus,
  loadBestThirdsPayloadsCore,
  loadBestThirdsPeerRowsCore,
} from './load-best-thirds-payloads';

describe('loadBestThirdsPayloadsCore', () => {
  it('returns an empty map when there are no peers', async () => {
    const find = vi.fn();
    const out = await loadBestThirdsPayloadsCore('t-1', [], {
      findBestThirdsForPeers: find,
    });
    expect(out.size).toBe(0);
    expect(find).not.toHaveBeenCalled();
  });

  it('returns the sorted 8-letter array for a peer with exactly 8 rows', async () => {
    const out = await loadBestThirdsPayloadsCore('t-1', ['u-a'], {
      findBestThirdsForPeers: async () => [
        { user_id: 'u-a', group_letter: 'H', points: null },
        { user_id: 'u-a', group_letter: 'A', points: null },
        { user_id: 'u-a', group_letter: 'D', points: null },
        { user_id: 'u-a', group_letter: 'B', points: null },
        { user_id: 'u-a', group_letter: 'F', points: null },
        { user_id: 'u-a', group_letter: 'C', points: null },
        { user_id: 'u-a', group_letter: 'L', points: null },
        { user_id: 'u-a', group_letter: 'I', points: null },
      ],
    });
    expect(out.get('u-a')).toEqual({
      groupLetters: ['A', 'B', 'C', 'D', 'F', 'H', 'I', 'L'],
      points: null,
    });
  });

  it('drops a peer who has fewer than 8 letters (partial)', async () => {
    const out = await loadBestThirdsPayloadsCore('t-1', ['u-a'], {
      findBestThirdsForPeers: async () => [
        { user_id: 'u-a', group_letter: 'A', points: null },
        { user_id: 'u-a', group_letter: 'B', points: null },
        { user_id: 'u-a', group_letter: 'C', points: null },
        { user_id: 'u-a', group_letter: 'D', points: null },
        { user_id: 'u-a', group_letter: 'E', points: null },
      ],
    });
    expect(out.has('u-a')).toBe(false);
  });

  it('drops a peer with zero rows', async () => {
    const out = await loadBestThirdsPayloadsCore('t-1', ['u-a', 'u-b'], {
      findBestThirdsForPeers: async () => [
        { user_id: 'u-b', group_letter: 'A', points: null },
        { user_id: 'u-b', group_letter: 'B', points: null },
        { user_id: 'u-b', group_letter: 'C', points: null },
        { user_id: 'u-b', group_letter: 'D', points: null },
        { user_id: 'u-b', group_letter: 'E', points: null },
        { user_id: 'u-b', group_letter: 'F', points: null },
        { user_id: 'u-b', group_letter: 'G', points: null },
        { user_id: 'u-b', group_letter: 'H', points: null },
      ],
    });
    expect(out.has('u-a')).toBe(false);
    expect(out.get('u-b')).toEqual({
      groupLetters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      points: null,
    });
  });

  it('S06: sums per-row points into a per-peer total (treats null contributions as 0 once any row is scored)', async () => {
    const out = await loadBestThirdsPayloadsCore('t-1', ['u-a'], {
      findBestThirdsForPeers: async () => [
        { user_id: 'u-a', group_letter: 'A', points: 3 },
        { user_id: 'u-a', group_letter: 'B', points: 0 },
        { user_id: 'u-a', group_letter: 'C', points: 3 },
        { user_id: 'u-a', group_letter: 'D', points: null },
        { user_id: 'u-a', group_letter: 'E', points: null },
        { user_id: 'u-a', group_letter: 'F', points: null },
        { user_id: 'u-a', group_letter: 'G', points: null },
        { user_id: 'u-a', group_letter: 'H', points: null },
      ],
    });
    expect(out.get('u-a')).toEqual({
      groupLetters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      points: 6,
    });
  });
});

describe('loadBestThirdsPeerRowsCore', () => {
  it('returns PeerRow[] excluding viewer and system singleton, with sorted 8-letter payloads', async () => {
    const findGroupMembers = vi.fn(async () => [
      { user_id: 'u-viewer', username: 'Viewer' },
      { user_id: 'u-mart', username: 'Mart' },
      { user_id: 'u-anu', username: 'Anu' },
      { user_id: 'sys', username: 'tegelikud tulemused' },
    ]);
    const findSystemUserId = vi.fn(async () => 'sys');
    const findBestThirdsForPeers = vi.fn(async () => [
      // u-mart submitted full 8
      { user_id: 'u-mart', group_letter: 'C', points: null },
      { user_id: 'u-mart', group_letter: 'A', points: null },
      { user_id: 'u-mart', group_letter: 'B', points: null },
      { user_id: 'u-mart', group_letter: 'D', points: null },
      { user_id: 'u-mart', group_letter: 'E', points: null },
      { user_id: 'u-mart', group_letter: 'F', points: null },
      { user_id: 'u-mart', group_letter: 'G', points: null },
      { user_id: 'u-mart', group_letter: 'H', points: null },
      // u-anu has only 5 — partial, must NOT surface
      { user_id: 'u-anu', group_letter: 'A', points: null },
      { user_id: 'u-anu', group_letter: 'B', points: null },
      { user_id: 'u-anu', group_letter: 'C', points: null },
      { user_id: 'u-anu', group_letter: 'D', points: null },
      { user_id: 'u-anu', group_letter: 'E', points: null },
    ]);

    const out = await loadBestThirdsPeerRowsCore(
      't-1',
      { groupId: 'group-1', viewerUserId: 'u-viewer' },
      {
        findGroupMembers,
        findSystemUserId,
        findBestThirdsForPeers,
      },
    );

    expect(out).toEqual([
      {
        peerId: 'u-mart',
        peerName: 'Mart',
        submittedPayload: {
          groupLetters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
          points: null,
        },
      },
      // u-anu had a partial pick — surfaces as null per submitted-only gate.
      { peerId: 'u-anu', peerName: 'Anu', submittedPayload: null },
    ]);
    expect(findBestThirdsForPeers).toHaveBeenCalledOnce();
    expect(findBestThirdsForPeers).toHaveBeenCalledWith('t-1', [
      'u-mart',
      'u-anu',
    ]);
  });

  it('returns [] for a singleton group (only the viewer + system user)', async () => {
    const findBestThirdsForPeers = vi.fn();
    const out = await loadBestThirdsPeerRowsCore(
      't-1',
      { groupId: 'group-1', viewerUserId: 'u-viewer' },
      {
        findGroupMembers: async () => [
          { user_id: 'u-viewer', username: 'Viewer' },
          { user_id: 'sys', username: 'tegelikud tulemused' },
        ],
        findSystemUserId: async () => 'sys',
        findBestThirdsForPeers,
      },
    );
    expect(out).toEqual([]);
    expect(findBestThirdsForPeers).not.toHaveBeenCalled();
  });

  it('renders a peer with zero best-thirds rows as null (not yet submitted)', async () => {
    const out = await loadBestThirdsPeerRowsCore(
      't-1',
      { groupId: 'group-1', viewerUserId: 'u-viewer' },
      {
        findGroupMembers: async () => [
          { user_id: 'u-viewer', username: 'Viewer' },
          { user_id: 'u-mart', username: 'Mart' },
        ],
        findSystemUserId: async () => 'sys',
        findBestThirdsForPeers: async () => [],
      },
    );
    expect(out).toEqual([
      { peerId: 'u-mart', peerName: 'Mart', submittedPayload: null },
    ]);
  });
});

describe('isBestThirdsConsensus (S06)', () => {
  it('returns true for two identical 8-letter sets regardless of input order', () => {
    expect(
      isBestThirdsConsensus(
        {
          groupLetters: ['H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'],
          points: null,
        },
        {
          groupLetters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
          points: 12,
        },
      ),
    ).toBe(true);
  });

  it('returns false when the sets differ by even one letter', () => {
    expect(
      isBestThirdsConsensus(
        {
          groupLetters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
          points: null,
        },
        {
          groupLetters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'I'],
          points: null,
        },
      ),
    ).toBe(false);
  });
});
