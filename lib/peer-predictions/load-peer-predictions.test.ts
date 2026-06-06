import { describe, expect, it, vi } from 'vitest';
import {
  loadPeerPredictionsCore,
  type GroupMemberRow,
  type LoadPeerPredictionsDeps,
} from './load-peer-predictions';

function makeDeps(
  members: GroupMemberRow[],
  systemUserId: string,
): LoadPeerPredictionsDeps {
  return {
    findGroupMembers: vi.fn(async () => members),
    findSystemUserId: vi.fn(async () => systemUserId),
  };
}

describe('loadPeerPredictionsCore', () => {
  it('returns peer rows for a multi-member group in insertion order', async () => {
    const deps = makeDeps(
      [
        { user_id: 'u-viewer', username: 'Viewer' },
        { user_id: 'u-mart', username: 'Mart' },
        { user_id: 'u-anu', username: 'Anu' },
        { user_id: 'u-juku', username: 'Juku' },
      ],
      'sys',
    );

    const loadPayloads = vi.fn(
      async () =>
        new Map([
          ['u-mart', '1'],
          ['u-anu', 'X'],
        ]),
    );

    const rows = await loadPeerPredictionsCore<string>(
      {
        groupId: 'g-1',
        viewerUserId: 'u-viewer',
        loadPayloads,
      },
      deps,
    );

    expect(rows).toEqual([
      { peerId: 'u-mart', peerName: 'Mart', submittedPayload: '1' },
      { peerId: 'u-anu', peerName: 'Anu', submittedPayload: 'X' },
      { peerId: 'u-juku', peerName: 'Juku', submittedPayload: null },
    ]);
    expect(loadPayloads).toHaveBeenCalledOnce();
    expect(loadPayloads).toHaveBeenCalledWith(['u-mart', 'u-anu', 'u-juku']);
  });

  it('excludes the viewer from the returned list', async () => {
    const deps = makeDeps(
      [
        { user_id: 'u-mart', username: 'Mart' },
        { user_id: 'u-viewer', username: 'Viewer' },
      ],
      'sys',
    );
    const rows = await loadPeerPredictionsCore<string>(
      {
        groupId: 'g-1',
        viewerUserId: 'u-viewer',
        loadPayloads: async () => new Map(),
      },
      deps,
    );
    expect(rows.map((r) => r.peerId)).toEqual(['u-mart']);
  });

  it('excludes the system singleton (tegelikud tulemused)', async () => {
    const deps = makeDeps(
      [
        { user_id: 'u-mart', username: 'Mart' },
        { user_id: 'sys', username: 'tegelikud tulemused' },
      ],
      'sys',
    );
    const rows = await loadPeerPredictionsCore<string>(
      {
        groupId: 'g-1',
        viewerUserId: 'u-viewer',
        loadPayloads: async () => new Map(),
      },
      deps,
    );
    expect(rows.map((r) => r.peerId)).toEqual(['u-mart']);
  });

  it('returns [] for a singleton group (viewer is the only member after exclusions)', async () => {
    const deps = makeDeps(
      [
        { user_id: 'u-viewer', username: 'Viewer' },
        { user_id: 'sys', username: 'tegelikud tulemused' },
      ],
      'sys',
    );
    const loadPayloads = vi.fn(async () => new Map());
    const rows = await loadPeerPredictionsCore<string>(
      {
        groupId: 'g-1',
        viewerUserId: 'u-viewer',
        loadPayloads,
      },
      deps,
    );
    expect(rows).toEqual([]);
    expect(loadPayloads).not.toHaveBeenCalled();
  });

  it('returns submittedPayload: null for peers absent from the payload map', async () => {
    const deps = makeDeps(
      [
        { user_id: 'u-viewer', username: 'Viewer' },
        { user_id: 'u-mart', username: 'Mart' },
        { user_id: 'u-anu', username: 'Anu' },
      ],
      'sys',
    );

    const rows = await loadPeerPredictionsCore<string>(
      {
        groupId: 'g-1',
        viewerUserId: 'u-viewer',
        loadPayloads: async () => new Map([['u-mart', '2']]),
      },
      deps,
    );

    expect(rows).toEqual([
      { peerId: 'u-mart', peerName: 'Mart', submittedPayload: '2' },
      { peerId: 'u-anu', peerName: 'Anu', submittedPayload: null },
    ]);
  });

  it('returns the payload value for peers present in the map', async () => {
    const deps = makeDeps(
      [
        { user_id: 'u-viewer', username: 'Viewer' },
        { user_id: 'u-mart', username: 'Mart' },
      ],
      'sys',
    );
    const rows = await loadPeerPredictionsCore<{ pick: string }>(
      {
        groupId: 'g-1',
        viewerUserId: 'u-viewer',
        loadPayloads: async () => new Map([['u-mart', { pick: 'X' }]]),
      },
      deps,
    );
    expect(rows[0]?.submittedPayload).toEqual({ pick: 'X' });
  });
});
