import { describe, expect, it, vi } from 'vitest';
import {
  loadGroupStagePayloadsCore,
  loadAllGroupStagePeerRowsForMatchesCore,
} from './load-group-stage-payloads';

describe('loadGroupStagePayloadsCore', () => {
  it('returns an empty map when there are no peers', async () => {
    const find = vi.fn();
    const out = await loadGroupStagePayloadsCore('game-1', [], {
      findPredictionsForGame: find,
    });
    expect(out.size).toBe(0);
    expect(find).not.toHaveBeenCalled();
  });

  it('collapses 1A/1B/X/2A/2B to 1/X/2', async () => {
    const out = await loadGroupStagePayloadsCore(
      'game-1',
      ['u-a', 'u-b', 'u-c', 'u-d', 'u-e'],
      {
        findPredictionsForGame: async () => [
          { user_id: 'u-a', prediction: '1A', points: null },
          { user_id: 'u-b', prediction: '1B', points: null },
          { user_id: 'u-c', prediction: 'X', points: null },
          { user_id: 'u-d', prediction: '2A', points: null },
          { user_id: 'u-e', prediction: '2B', points: null },
        ],
      },
    );
    expect(out.get('u-a')?.pick).toBe('1');
    expect(out.get('u-b')?.pick).toBe('1');
    expect(out.get('u-c')?.pick).toBe('X');
    expect(out.get('u-d')?.pick).toBe('2');
    expect(out.get('u-e')?.pick).toBe('2');
  });

  it('drops unrecognised prediction codes', async () => {
    const out = await loadGroupStagePayloadsCore('game-1', ['u-a', 'u-b'], {
      findPredictionsForGame: async () => [
        { user_id: 'u-a', prediction: 'Z', points: null },
        { user_id: 'u-b', prediction: '1A', points: null },
      ],
    });
    expect(out.has('u-a')).toBe(false);
    expect(out.get('u-b')?.pick).toBe('1');
  });

  it('S06: surfaces the existing user_games.points value verbatim', async () => {
    const out = await loadGroupStagePayloadsCore(
      'game-1',
      ['u-a', 'u-b', 'u-c'],
      {
        findPredictionsForGame: async () => [
          { user_id: 'u-a', prediction: '1A', points: 5 },
          { user_id: 'u-b', prediction: 'X', points: 0 },
          { user_id: 'u-c', prediction: '2B', points: null },
        ],
      },
    );
    expect(out.get('u-a')).toEqual({ pick: '1', points: 5 });
    expect(out.get('u-b')).toEqual({ pick: 'X', points: 0 });
    expect(out.get('u-c')).toEqual({ pick: '2', points: null });
  });
});

describe('loadAllGroupStagePeerRowsForMatchesCore', () => {
  it('returns a Map keyed by gameId with PeerRow[] in insertion order (default sortMode)', async () => {
    const findGroupMembers = vi.fn(async () => [
      { user_id: 'u-viewer', username: 'Viewer' },
      { user_id: 'u-mart', username: 'Mart' },
      { user_id: 'u-anu', username: 'Anu' },
      { user_id: 'sys', username: 'tegelikud tulemused' },
    ]);
    const findSystemUserId = vi.fn(async () => 'sys');
    const findPredictionsForGames = vi.fn(async () => [
      { user_id: 'u-mart', game_id: 'g-1', prediction: '1A', points: 5 },
      { user_id: 'u-mart', game_id: 'g-2', prediction: 'X', points: null },
      { user_id: 'u-anu', game_id: 'g-1', prediction: '2B', points: 0 },
    ]);

    const out = await loadAllGroupStagePeerRowsForMatchesCore(
      ['g-1', 'g-2', 'g-3'],
      { groupId: 'group-1', viewerUserId: 'u-viewer' },
      {
        findGroupMembers,
        findSystemUserId,
        findPredictionsForGames,
      },
    );

    expect(out.get('g-1')).toEqual([
      {
        peerId: 'u-mart',
        peerName: 'Mart',
        submittedPayload: { pick: '1', points: 5 },
      },
      {
        peerId: 'u-anu',
        peerName: 'Anu',
        submittedPayload: { pick: '2', points: 0 },
      },
    ]);
    expect(out.get('g-2')).toEqual([
      {
        peerId: 'u-mart',
        peerName: 'Mart',
        submittedPayload: { pick: 'X', points: null },
      },
      { peerId: 'u-anu', peerName: 'Anu', submittedPayload: null },
    ]);
    expect(out.get('g-3')).toEqual([
      { peerId: 'u-mart', peerName: 'Mart', submittedPayload: null },
      { peerId: 'u-anu', peerName: 'Anu', submittedPayload: null },
    ]);
    expect(findPredictionsForGames).toHaveBeenCalledOnce();
    expect(findPredictionsForGames).toHaveBeenCalledWith(
      ['g-1', 'g-2', 'g-3'],
      ['u-mart', 'u-anu'],
    );
  });

  it('S06: sorts peers alphabetically when sortMode = alphabetical', async () => {
    const out = await loadAllGroupStagePeerRowsForMatchesCore(
      ['g-1'],
      {
        groupId: 'group-1',
        viewerUserId: 'u-viewer',
        sortMode: 'alphabetical',
      },
      {
        findGroupMembers: async () => [
          { user_id: 'u-viewer', username: 'Viewer' },
          { user_id: 'u-mart', username: 'Mart' },
          { user_id: 'u-anu', username: 'Anu' },
          { user_id: 'u-juku', username: 'Juku' },
        ],
        findSystemUserId: async () => 'sys',
        findPredictionsForGames: async () => [
          { user_id: 'u-mart', game_id: 'g-1', prediction: '1A', points: null },
          { user_id: 'u-anu', game_id: 'g-1', prediction: 'X', points: null },
        ],
      },
    );
    expect(out.get('g-1')?.map((r) => r.peerName)).toEqual([
      'Anu',
      'Juku',
      'Mart',
    ]);
  });

  it('returns empty arrays per gameId when the viewer is the only peer (singleton group)', async () => {
    const out = await loadAllGroupStagePeerRowsForMatchesCore(
      ['g-1', 'g-2'],
      { groupId: 'group-1', viewerUserId: 'u-viewer' },
      {
        findGroupMembers: async () => [
          { user_id: 'u-viewer', username: 'Viewer' },
          { user_id: 'sys', username: 'tegelikud tulemused' },
        ],
        findSystemUserId: async () => 'sys',
        findPredictionsForGames: vi.fn(),
      },
    );
    expect(out.get('g-1')).toEqual([]);
    expect(out.get('g-2')).toEqual([]);
  });

  it('returns an empty (pre-seeded) map when no gameIds are passed', async () => {
    const findPredictionsForGames = vi.fn();
    const out = await loadAllGroupStagePeerRowsForMatchesCore(
      [],
      { groupId: 'group-1', viewerUserId: 'u-viewer' },
      {
        findGroupMembers: vi.fn(),
        findSystemUserId: vi.fn(),
        findPredictionsForGames,
      },
    );
    expect(out.size).toBe(0);
    expect(findPredictionsForGames).not.toHaveBeenCalled();
  });
});
