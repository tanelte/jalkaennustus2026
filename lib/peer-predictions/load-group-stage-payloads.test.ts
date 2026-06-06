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
          { user_id: 'u-a', prediction: '1A' },
          { user_id: 'u-b', prediction: '1B' },
          { user_id: 'u-c', prediction: 'X' },
          { user_id: 'u-d', prediction: '2A' },
          { user_id: 'u-e', prediction: '2B' },
        ],
      },
    );
    expect(out.get('u-a')).toBe('1');
    expect(out.get('u-b')).toBe('1');
    expect(out.get('u-c')).toBe('X');
    expect(out.get('u-d')).toBe('2');
    expect(out.get('u-e')).toBe('2');
  });

  it('drops unrecognised prediction codes', async () => {
    const out = await loadGroupStagePayloadsCore('game-1', ['u-a', 'u-b'], {
      findPredictionsForGame: async () => [
        { user_id: 'u-a', prediction: 'Z' },
        { user_id: 'u-b', prediction: '1A' },
      ],
    });
    expect(out.has('u-a')).toBe(false);
    expect(out.get('u-b')).toBe('1');
  });
});

describe('loadAllGroupStagePeerRowsForMatchesCore', () => {
  it('returns a Map keyed by gameId with PeerRow[] in insertion order', async () => {
    const findGroupMembers = vi.fn(async () => [
      { user_id: 'u-viewer', username: 'Viewer' },
      { user_id: 'u-mart', username: 'Mart' },
      { user_id: 'u-anu', username: 'Anu' },
      { user_id: 'sys', username: 'tegelikud tulemused' },
    ]);
    const findSystemUserId = vi.fn(async () => 'sys');
    const findPredictionsForGames = vi.fn(async () => [
      { user_id: 'u-mart', game_id: 'g-1', prediction: '1A' },
      { user_id: 'u-mart', game_id: 'g-2', prediction: 'X' },
      { user_id: 'u-anu', game_id: 'g-1', prediction: '2B' },
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
      { peerId: 'u-mart', peerName: 'Mart', submittedPayload: '1' },
      { peerId: 'u-anu', peerName: 'Anu', submittedPayload: '2' },
    ]);
    expect(out.get('g-2')).toEqual([
      { peerId: 'u-mart', peerName: 'Mart', submittedPayload: 'X' },
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
