import { describe, expect, it, vi } from 'vitest';
import {
  loadPeerPredictionsCore,
  sortPeerRows,
  type GroupMemberRow,
  type LoadPeerPredictionsDeps,
  type PeerRow,
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

  it('S06: sortMode = "alphabetical" sorts peer rows by peerName, case-insensitive', async () => {
    const deps = makeDeps(
      [
        { user_id: 'u-viewer', username: 'Viewer' },
        { user_id: 'u-mart', username: 'Mart' },
        { user_id: 'u-anu', username: 'anu' },
        { user_id: 'u-juku', username: 'Juku' },
      ],
      'sys',
    );
    const rows = await loadPeerPredictionsCore<string>(
      {
        groupId: 'g-1',
        viewerUserId: 'u-viewer',
        loadPayloads: async () => new Map(),
        sortMode: 'alphabetical',
      },
      deps,
    );
    expect(rows.map((r) => r.peerName)).toEqual(['anu', 'Juku', 'Mart']);
  });

  it('S06: sortMode defaults to "insertion" (back-compat)', async () => {
    const deps = makeDeps(
      [
        { user_id: 'u-viewer', username: 'Viewer' },
        { user_id: 'u-zed', username: 'Zed' },
        { user_id: 'u-anu', username: 'Anu' },
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
    expect(rows.map((r) => r.peerName)).toEqual(['Zed', 'Anu']);
  });
});

describe('sortPeerRows (S06 enhancement #3)', () => {
  const row = (peerName: string, peerId = peerName): PeerRow<null> => ({
    peerId,
    peerName,
    submittedPayload: null,
  });

  it('insertion mode preserves input order (and returns a fresh array)', () => {
    const input = [row('Mart'), row('Anu'), row('Juku')];
    const out = sortPeerRows(input, 'insertion');
    expect(out.map((r) => r.peerName)).toEqual(['Mart', 'Anu', 'Juku']);
    expect(out).not.toBe(input);
  });

  it('alphabetical mode sorts ascending by peerName, case-insensitive', () => {
    const out = sortPeerRows(
      [row('mart'), row('Anu'), row('JUKU'), row('berit')],
      'alphabetical',
    );
    expect(out.map((r) => r.peerName)).toEqual([
      'Anu',
      'berit',
      'JUKU',
      'mart',
    ]);
  });

  it('alphabetical mode is stable: peers with the same name preserve input order', () => {
    const out = sortPeerRows(
      [
        row('Mart', 'm-1'),
        row('Anu', 'a-1'),
        row('Mart', 'm-2'),
        row('Anu', 'a-2'),
      ],
      'alphabetical',
    );
    expect(out.map((r) => r.peerId)).toEqual(['a-1', 'a-2', 'm-1', 'm-2']);
  });
});
