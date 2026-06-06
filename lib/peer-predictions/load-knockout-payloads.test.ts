import { describe, expect, it, vi } from 'vitest';
import { loadAllKnockoutPeerRowsForSlotsCore } from './load-knockout-payloads';

const TWO_GAMES = ['g-1', 'g-2'];
const MATCH_ROWS = [
  {
    game_id: 'g-1',
    team_home_id: 'team-brazil',
    team_away_id: 'team-germany',
    home_name_et: 'Brasiilia',
    away_name_et: 'Saksamaa',
  },
  {
    game_id: 'g-2',
    team_home_id: 'team-france',
    team_away_id: 'team-spain',
    home_name_et: 'Prantsusmaa',
    away_name_et: 'Hispaania',
  },
];

describe('loadAllKnockoutPeerRowsForSlotsCore', () => {
  it('returns a Map keyed by gameId with one PeerRow per peer per game', async () => {
    const findGroupMembers = vi.fn(async () => [
      { user_id: 'u-viewer', username: 'Viewer' },
      { user_id: 'u-mart', username: 'Mart' },
      { user_id: 'u-anu', username: 'Anu' },
      { user_id: 'sys', username: 'tegelikud tulemused' },
    ]);
    const findSystemUserId = vi.fn(async () => 'sys');
    const findMatchesForRound = vi.fn(async () => MATCH_ROWS);
    const findPredictionsForGames = vi.fn(async () => [
      // Mart picks home on g-1 (1A) and away on g-2 (2B).
      { user_id: 'u-mart', game_id: 'g-1', prediction: '1A', points: 5 },
      { user_id: 'u-mart', game_id: 'g-2', prediction: '2B', points: null },
      // Anu picks away on g-1 (2A) only — no pick on g-2.
      { user_id: 'u-anu', game_id: 'g-1', prediction: '2A', points: 0 },
    ]);

    const out = await loadAllKnockoutPeerRowsForSlotsCore(
      'r32',
      TWO_GAMES,
      { groupId: 'group-1', viewerUserId: 'u-viewer' },
      {
        findGroupMembers,
        findSystemUserId,
        findMatchesForRound,
        findPredictionsForGames,
      },
    );

    // g-1: Mart → Brazil (home), Anu → Germany (away).
    expect(out.get('g-1')).toEqual([
      {
        peerId: 'u-mart',
        peerName: 'Mart',
        submittedPayload: {
          teamId: 'team-brazil',
          teamName: 'Brasiilia',
          points: 5,
        },
      },
      {
        peerId: 'u-anu',
        peerName: 'Anu',
        submittedPayload: {
          teamId: 'team-germany',
          teamName: 'Saksamaa',
          points: 0,
        },
      },
    ]);
    // g-2: Mart → Spain (away), Anu → null (no pick).
    expect(out.get('g-2')).toEqual([
      {
        peerId: 'u-mart',
        peerName: 'Mart',
        submittedPayload: {
          teamId: 'team-spain',
          teamName: 'Hispaania',
          points: null,
        },
      },
      { peerId: 'u-anu', peerName: 'Anu', submittedPayload: null },
    ]);

    expect(findMatchesForRound).toHaveBeenCalledOnce();
    expect(findMatchesForRound).toHaveBeenCalledWith('r32', TWO_GAMES);
    expect(findPredictionsForGames).toHaveBeenCalledOnce();
    expect(findPredictionsForGames).toHaveBeenCalledWith(TWO_GAMES, [
      'u-mart',
      'u-anu',
    ]);
  });

  it('excludes the viewer from peer rows', async () => {
    const out = await loadAllKnockoutPeerRowsForSlotsCore(
      'r32',
      ['g-1'],
      { groupId: 'group-1', viewerUserId: 'u-viewer' },
      {
        findGroupMembers: async () => [
          { user_id: 'u-viewer', username: 'Viewer' },
          { user_id: 'u-mart', username: 'Mart' },
        ],
        findSystemUserId: async () => 'sys',
        findMatchesForRound: async () => MATCH_ROWS.slice(0, 1),
        findPredictionsForGames: async () => [
          { user_id: 'u-mart', game_id: 'g-1', prediction: '1A', points: null },
          // Viewer prediction must NOT appear even if returned by the SQL.
          { user_id: 'u-viewer', game_id: 'g-1', prediction: '2A', points: null },
        ],
      },
    );
    const rows = out.get('g-1')!;
    expect(rows).toHaveLength(1);
    expect(rows[0].peerId).toBe('u-mart');
  });

  it('excludes the tegelikud tulemused system singleton via the seam', async () => {
    const out = await loadAllKnockoutPeerRowsForSlotsCore(
      'r32',
      ['g-1'],
      { groupId: 'group-1', viewerUserId: 'u-viewer' },
      {
        findGroupMembers: async () => [
          { user_id: 'u-viewer', username: 'Viewer' },
          { user_id: 'u-mart', username: 'Mart' },
          { user_id: 'sys', username: 'tegelikud tulemused' },
        ],
        findSystemUserId: async () => 'sys',
        findMatchesForRound: async () => MATCH_ROWS.slice(0, 1),
        findPredictionsForGames: async () => [
          { user_id: 'sys', game_id: 'g-1', prediction: '1A', points: null },
          { user_id: 'u-mart', game_id: 'g-1', prediction: '2A', points: null },
        ],
      },
    );
    const rows = out.get('g-1')!;
    expect(rows.map((r) => r.peerId)).toEqual(['u-mart']);
    expect(rows.map((r) => r.peerName)).not.toContain('tegelikud tulemused');
  });

  it('returns null payload for peers who have not submitted a pick on a slot', async () => {
    const out = await loadAllKnockoutPeerRowsForSlotsCore(
      'r32',
      TWO_GAMES,
      { groupId: 'group-1', viewerUserId: 'u-viewer' },
      {
        findGroupMembers: async () => [
          { user_id: 'u-viewer', username: 'Viewer' },
          { user_id: 'u-mart', username: 'Mart' },
          { user_id: 'u-anu', username: 'Anu' },
        ],
        findSystemUserId: async () => 'sys',
        findMatchesForRound: async () => MATCH_ROWS,
        findPredictionsForGames: async () => [
          // No predictions at all on g-2.
          { user_id: 'u-mart', game_id: 'g-1', prediction: '1A', points: null },
        ],
      },
    );
    expect(out.get('g-2')).toEqual([
      { peerId: 'u-mart', peerName: 'Mart', submittedPayload: null },
      { peerId: 'u-anu', peerName: 'Anu', submittedPayload: null },
    ]);
  });

  it('returns a pre-seeded entry per requested gameId even when peers exist but no predictions match', async () => {
    const out = await loadAllKnockoutPeerRowsForSlotsCore(
      'r32',
      ['g-1', 'g-2', 'g-3'],
      { groupId: 'group-1', viewerUserId: 'u-viewer' },
      {
        findGroupMembers: async () => [
          { user_id: 'u-viewer', username: 'Viewer' },
          { user_id: 'u-mart', username: 'Mart' },
        ],
        findSystemUserId: async () => 'sys',
        findMatchesForRound: async () => MATCH_ROWS, // only g-1, g-2
        findPredictionsForGames: async () => [],
      },
    );
    expect(out.size).toBe(3);
    expect(out.get('g-1')).toEqual([
      { peerId: 'u-mart', peerName: 'Mart', submittedPayload: null },
    ]);
    expect(out.get('g-2')).toEqual([
      { peerId: 'u-mart', peerName: 'Mart', submittedPayload: null },
    ]);
    expect(out.get('g-3')).toEqual([
      { peerId: 'u-mart', peerName: 'Mart', submittedPayload: null },
    ]);
  });

  it('returns empty arrays per gameId when the viewer is the only peer (singleton group)', async () => {
    const findPredictionsForGames = vi.fn();
    const findMatchesForRound = vi.fn();
    const out = await loadAllKnockoutPeerRowsForSlotsCore(
      'r32',
      ['g-1', 'g-2'],
      { groupId: 'group-1', viewerUserId: 'u-viewer' },
      {
        findGroupMembers: async () => [
          { user_id: 'u-viewer', username: 'Viewer' },
          { user_id: 'sys', username: 'tegelikud tulemused' },
        ],
        findSystemUserId: async () => 'sys',
        findMatchesForRound,
        findPredictionsForGames,
      },
    );
    expect(out.get('g-1')).toEqual([]);
    expect(out.get('g-2')).toEqual([]);
    // Short-circuit: no need to query matches/predictions if there are no peers.
    expect(findMatchesForRound).not.toHaveBeenCalled();
    expect(findPredictionsForGames).not.toHaveBeenCalled();
  });

  it('returns an empty (pre-seeded) map when no gameIds are passed', async () => {
    const findMatchesForRound = vi.fn();
    const findPredictionsForGames = vi.fn();
    const out = await loadAllKnockoutPeerRowsForSlotsCore(
      'r32',
      [],
      { groupId: 'group-1', viewerUserId: 'u-viewer' },
      {
        findGroupMembers: vi.fn(),
        findSystemUserId: vi.fn(),
        findMatchesForRound,
        findPredictionsForGames,
      },
    );
    expect(out.size).toBe(0);
    expect(findMatchesForRound).not.toHaveBeenCalled();
    expect(findPredictionsForGames).not.toHaveBeenCalled();
  });

  it('drops predictions with unrecognised codes (treats peer as not-submitted)', async () => {
    const out = await loadAllKnockoutPeerRowsForSlotsCore(
      'r32',
      ['g-1'],
      { groupId: 'group-1', viewerUserId: 'u-viewer' },
      {
        findGroupMembers: async () => [
          { user_id: 'u-viewer', username: 'Viewer' },
          { user_id: 'u-mart', username: 'Mart' },
        ],
        findSystemUserId: async () => 'sys',
        findMatchesForRound: async () => MATCH_ROWS.slice(0, 1),
        findPredictionsForGames: async () => [
          { user_id: 'u-mart', game_id: 'g-1', prediction: 'Z', points: null },
        ],
      },
    );
    expect(out.get('g-1')).toEqual([
      { peerId: 'u-mart', peerName: 'Mart', submittedPayload: null },
    ]);
  });
});
