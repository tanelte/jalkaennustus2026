import { describe, expect, it, vi } from 'vitest';
import {
  groupFinalsByPeer,
  loadFinalPeerRowsCore,
} from './load-final-payloads';

describe('groupFinalsByPeer', () => {
  it('returns ordered F1→F4 picks for a peer with all 4 slots filled', () => {
    const out = groupFinalsByPeer([
      // Insert out of order on purpose — the loader must sort by slot.
      { user_id: 'u-a', slot: 'F3', team_id: 't-3', team_name: 'Portugal' },
      { user_id: 'u-a', slot: 'F1', team_id: 't-1', team_name: 'Inglismaa' },
      { user_id: 'u-a', slot: 'F4', team_id: 't-4', team_name: 'Hispaania' },
      { user_id: 'u-a', slot: 'F2', team_id: 't-2', team_name: 'Brasiilia' },
    ]);
    expect(out.get('u-a')).toEqual([
      { slot: 'F1', teamId: 't-1', teamName: 'Inglismaa' },
      { slot: 'F2', teamId: 't-2', teamName: 'Brasiilia' },
      { slot: 'F3', teamId: 't-3', teamName: 'Portugal' },
      { slot: 'F4', teamId: 't-4', teamName: 'Hispaania' },
    ]);
  });

  it('omits a peer with only F1 + F2 (partial ordering = not-submitted)', () => {
    const out = groupFinalsByPeer([
      { user_id: 'u-partial', slot: 'F1', team_id: 't-1', team_name: 'A' },
      { user_id: 'u-partial', slot: 'F2', team_id: 't-2', team_name: 'B' },
    ]);
    expect(out.has('u-partial')).toBe(false);
  });

  it('omits a peer with three slots filled (still partial)', () => {
    const out = groupFinalsByPeer([
      { user_id: 'u-3', slot: 'F1', team_id: 't-1', team_name: 'A' },
      { user_id: 'u-3', slot: 'F2', team_id: 't-2', team_name: 'B' },
      { user_id: 'u-3', slot: 'F3', team_id: 't-3', team_name: 'C' },
    ]);
    expect(out.has('u-3')).toBe(false);
  });

  it('omits a peer with zero picks', () => {
    const out = groupFinalsByPeer([]);
    expect(out.size).toBe(0);
  });

  it('ignores rows whose slot is not a recognised final slot', () => {
    const out = groupFinalsByPeer([
      { user_id: 'u-x', slot: 'F1', team_id: 't-1', team_name: 'A' },
      { user_id: 'u-x', slot: 'F2', team_id: 't-2', team_name: 'B' },
      { user_id: 'u-x', slot: 'F3', team_id: 't-3', team_name: 'C' },
      { user_id: 'u-x', slot: 'F4', team_id: 't-4', team_name: 'D' },
      // Bogus slot — should not bump the count past 4.
      { user_id: 'u-x', slot: 'BOGUS', team_id: 't-9', team_name: 'Z' },
    ]);
    expect(out.get('u-x')).toHaveLength(4);
  });

  it('keeps full peers and drops partial peers in the same batch', () => {
    const out = groupFinalsByPeer([
      // Full ordering for u-full
      { user_id: 'u-full', slot: 'F1', team_id: 't-1', team_name: 'A' },
      { user_id: 'u-full', slot: 'F2', team_id: 't-2', team_name: 'B' },
      { user_id: 'u-full', slot: 'F3', team_id: 't-3', team_name: 'C' },
      { user_id: 'u-full', slot: 'F4', team_id: 't-4', team_name: 'D' },
      // Partial for u-partial
      { user_id: 'u-partial', slot: 'F1', team_id: 't-1', team_name: 'A' },
    ]);
    expect(out.has('u-full')).toBe(true);
    expect(out.has('u-partial')).toBe(false);
  });
});

describe('loadFinalPeerRowsCore', () => {
  const fullRows = (userId: string) => [
    { user_id: userId, slot: 'F1', team_id: 't-1', team_name: 'Inglismaa' },
    { user_id: userId, slot: 'F2', team_id: 't-2', team_name: 'Brasiilia' },
    { user_id: userId, slot: 'F3', team_id: 't-3', team_name: 'Portugal' },
    { user_id: userId, slot: 'F4', team_id: 't-4', team_name: 'Hispaania' },
  ];

  it('returns PeerRow[] with submittedPayload set for fully submitted peers', async () => {
    const findGroupMembers = vi.fn(async () => [
      { user_id: 'u-viewer', username: 'Viewer' },
      { user_id: 'u-mart', username: 'Mart' },
      { user_id: 'u-anu', username: 'Anu' },
      { user_id: 'sys', username: 'tegelikud tulemused' },
    ]);
    const findSystemUserId = vi.fn(async () => 'sys');
    const findFinalsForTournament = vi.fn(async () => [
      ...fullRows('u-mart'),
      ...fullRows('u-anu'),
    ]);

    const out = await loadFinalPeerRowsCore(
      't-2026',
      { groupId: 'group-1', viewerUserId: 'u-viewer' },
      { findGroupMembers, findSystemUserId, findFinalsForTournament },
    );

    expect(out).toEqual([
      {
        peerId: 'u-mart',
        peerName: 'Mart',
        submittedPayload: [
          { slot: 'F1', teamId: 't-1', teamName: 'Inglismaa' },
          { slot: 'F2', teamId: 't-2', teamName: 'Brasiilia' },
          { slot: 'F3', teamId: 't-3', teamName: 'Portugal' },
          { slot: 'F4', teamId: 't-4', teamName: 'Hispaania' },
        ],
      },
      {
        peerId: 'u-anu',
        peerName: 'Anu',
        submittedPayload: [
          { slot: 'F1', teamId: 't-1', teamName: 'Inglismaa' },
          { slot: 'F2', teamId: 't-2', teamName: 'Brasiilia' },
          { slot: 'F3', teamId: 't-3', teamName: 'Portugal' },
          { slot: 'F4', teamId: 't-4', teamName: 'Hispaania' },
        ],
      },
    ]);
    expect(findFinalsForTournament).toHaveBeenCalledOnce();
    expect(findFinalsForTournament).toHaveBeenCalledWith('t-2026', [
      'u-mart',
      'u-anu',
    ]);
  });

  it('returns submittedPayload=null for a peer with fewer than 4 picks (F1+F2 only = partial)', async () => {
    const out = await loadFinalPeerRowsCore(
      't-2026',
      { groupId: 'group-1', viewerUserId: 'u-viewer' },
      {
        findGroupMembers: async () => [
          { user_id: 'u-viewer', username: 'Viewer' },
          { user_id: 'u-partial', username: 'Partial' },
        ],
        findSystemUserId: async () => 'sys',
        findFinalsForTournament: async () => [
          { user_id: 'u-partial', slot: 'F1', team_id: 't-1', team_name: 'A' },
          { user_id: 'u-partial', slot: 'F2', team_id: 't-2', team_name: 'B' },
        ],
      },
    );
    expect(out).toEqual([
      { peerId: 'u-partial', peerName: 'Partial', submittedPayload: null },
    ]);
  });

  it('returns submittedPayload=null for a peer with zero picks', async () => {
    const out = await loadFinalPeerRowsCore(
      't-2026',
      { groupId: 'group-1', viewerUserId: 'u-viewer' },
      {
        findGroupMembers: async () => [
          { user_id: 'u-viewer', username: 'Viewer' },
          { user_id: 'u-zero', username: 'Zero' },
        ],
        findSystemUserId: async () => 'sys',
        findFinalsForTournament: async () => [],
      },
    );
    expect(out).toEqual([
      { peerId: 'u-zero', peerName: 'Zero', submittedPayload: null },
    ]);
  });

  it('excludes the viewer and the system singleton (tegelikud tulemused)', async () => {
    const findFinalsForTournament = vi.fn(async () => [
      ...fullRows('u-viewer'), // viewer's own picks must never appear
      ...fullRows('sys'),
      ...fullRows('u-mart'),
    ]);
    const out = await loadFinalPeerRowsCore(
      't-2026',
      { groupId: 'group-1', viewerUserId: 'u-viewer' },
      {
        findGroupMembers: async () => [
          { user_id: 'u-viewer', username: 'Viewer' },
          { user_id: 'sys', username: 'tegelikud tulemused' },
          { user_id: 'u-mart', username: 'Mart' },
        ],
        findSystemUserId: async () => 'sys',
        findFinalsForTournament,
      },
    );

    expect(out.map((r) => r.peerId)).toEqual(['u-mart']);
    // Viewer + system singleton must not be passed to the payload loader.
    expect(findFinalsForTournament).toHaveBeenCalledWith('t-2026', ['u-mart']);
  });

  it('orders each peer payload F1 → F4 regardless of DB row order', async () => {
    const out = await loadFinalPeerRowsCore(
      't-2026',
      { groupId: 'group-1', viewerUserId: 'u-viewer' },
      {
        findGroupMembers: async () => [
          { user_id: 'u-viewer', username: 'Viewer' },
          { user_id: 'u-mart', username: 'Mart' },
        ],
        findSystemUserId: async () => 'sys',
        findFinalsForTournament: async () => [
          // Scrambled
          { user_id: 'u-mart', slot: 'F4', team_id: 't-4', team_name: 'D' },
          { user_id: 'u-mart', slot: 'F2', team_id: 't-2', team_name: 'B' },
          { user_id: 'u-mart', slot: 'F1', team_id: 't-1', team_name: 'A' },
          { user_id: 'u-mart', slot: 'F3', team_id: 't-3', team_name: 'C' },
        ],
      },
    );

    expect(out[0]?.submittedPayload).toEqual([
      { slot: 'F1', teamId: 't-1', teamName: 'A' },
      { slot: 'F2', teamId: 't-2', teamName: 'B' },
      { slot: 'F3', teamId: 't-3', teamName: 'C' },
      { slot: 'F4', teamId: 't-4', teamName: 'D' },
    ]);
  });

  it('returns [] for a singleton group (viewer is the only non-system member)', async () => {
    const findFinalsForTournament = vi.fn();
    const out = await loadFinalPeerRowsCore(
      't-2026',
      { groupId: 'group-1', viewerUserId: 'u-viewer' },
      {
        findGroupMembers: async () => [
          { user_id: 'u-viewer', username: 'Viewer' },
          { user_id: 'sys', username: 'tegelikud tulemused' },
        ],
        findSystemUserId: async () => 'sys',
        findFinalsForTournament,
      },
    );
    expect(out).toEqual([]);
    // No peers → never even hit the payload loader.
    expect(findFinalsForTournament).not.toHaveBeenCalled();
  });
});
