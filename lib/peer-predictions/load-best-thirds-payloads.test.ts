import { describe, expect, it, vi } from 'vitest';
import {
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
        { user_id: 'u-a', group_letter: 'H' },
        { user_id: 'u-a', group_letter: 'A' },
        { user_id: 'u-a', group_letter: 'D' },
        { user_id: 'u-a', group_letter: 'B' },
        { user_id: 'u-a', group_letter: 'F' },
        { user_id: 'u-a', group_letter: 'C' },
        { user_id: 'u-a', group_letter: 'L' },
        { user_id: 'u-a', group_letter: 'I' },
      ],
    });
    expect(out.get('u-a')).toEqual(['A', 'B', 'C', 'D', 'F', 'H', 'I', 'L']);
  });

  it('drops a peer who has fewer than 8 letters (partial)', async () => {
    const out = await loadBestThirdsPayloadsCore('t-1', ['u-a'], {
      findBestThirdsForPeers: async () => [
        { user_id: 'u-a', group_letter: 'A' },
        { user_id: 'u-a', group_letter: 'B' },
        { user_id: 'u-a', group_letter: 'C' },
        { user_id: 'u-a', group_letter: 'D' },
        { user_id: 'u-a', group_letter: 'E' },
      ],
    });
    expect(out.has('u-a')).toBe(false);
  });

  it('drops a peer with zero rows', async () => {
    const out = await loadBestThirdsPayloadsCore('t-1', ['u-a', 'u-b'], {
      findBestThirdsForPeers: async () => [
        { user_id: 'u-b', group_letter: 'A' },
        { user_id: 'u-b', group_letter: 'B' },
        { user_id: 'u-b', group_letter: 'C' },
        { user_id: 'u-b', group_letter: 'D' },
        { user_id: 'u-b', group_letter: 'E' },
        { user_id: 'u-b', group_letter: 'F' },
        { user_id: 'u-b', group_letter: 'G' },
        { user_id: 'u-b', group_letter: 'H' },
      ],
    });
    expect(out.has('u-a')).toBe(false);
    expect(out.get('u-b')).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
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
      { user_id: 'u-mart', group_letter: 'C' },
      { user_id: 'u-mart', group_letter: 'A' },
      { user_id: 'u-mart', group_letter: 'B' },
      { user_id: 'u-mart', group_letter: 'D' },
      { user_id: 'u-mart', group_letter: 'E' },
      { user_id: 'u-mart', group_letter: 'F' },
      { user_id: 'u-mart', group_letter: 'G' },
      { user_id: 'u-mart', group_letter: 'H' },
      // u-anu has only 5 — partial, must NOT surface
      { user_id: 'u-anu', group_letter: 'A' },
      { user_id: 'u-anu', group_letter: 'B' },
      { user_id: 'u-anu', group_letter: 'C' },
      { user_id: 'u-anu', group_letter: 'D' },
      { user_id: 'u-anu', group_letter: 'E' },
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
        submittedPayload: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
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
