import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { user_groups, users } from '@/db/schema';
import { getSystemUserId } from '@/lib/system-user';

/**
 * A peer row in a peer-predictions popover.
 *
 * `submittedPayload` is null when the peer has not yet submitted a prediction
 * for the surface being viewed; otherwise it carries whatever surface-specific
 * payload the surface loader chose to expose.
 */
export type PeerRow<TPayload> = {
  peerId: string;
  peerName: string;
  submittedPayload: TPayload | null;
};

/**
 * Internal row returned by the group-members finder. Lives outside the public
 * surface so per-surface payload loaders can be tested in isolation.
 */
export interface GroupMemberRow {
  user_id: string;
  username: string;
}

export interface LoadPeerPredictionsDeps {
  findGroupMembers: (groupId: string) => Promise<GroupMemberRow[]>;
  findSystemUserId: () => Promise<string>;
}

/**
 * Peer-list ordering mode. Selected once per surface (S06 enhancement #3 —
 * AC: "the chosen sort is consistent across every surface").
 *
 * - `insertion` (legacy default): preserves the order returned by
 *   `findGroupMembers` (DB-side `ORDER BY user_groups.created_at ASC`).
 *   Kept as the seam default so existing call sites and tests are unaffected.
 * - `alphabetical`: case-insensitive ascending by `peerName` (Estonian locale).
 *   The five production surface loaders (group-stage, trivia, best-thirds,
 *   knockouts, final) pass this explicitly so the chosen sort is uniform
 *   across every surface.
 */
export type PeerSortMode = 'insertion' | 'alphabetical';

export interface LoadPeerPredictionsOpts<TPayload> {
  groupId: string;
  viewerUserId: string;
  loadPayloads: (peerIds: string[]) => Promise<Map<string, TPayload>>;
  /** See `PeerSortMode`. Default `'insertion'` for backward compatibility. */
  sortMode?: PeerSortMode;
}

/**
 * Default peer-vs-viewer equality predicate. Deep-equal via JSON for the
 * small payload shapes the surfaces use (1/X/2-collapsed strings,
 * `{teamId, teamName, points}` objects, ordered F1–F4 arrays). Best-thirds
 * and the final stage pass custom predicates because their semantics need
 * order-insensitive (set) and ordered (sequence) comparison respectively.
 *
 * Pure; no I/O. Lives here next to the seam so it has a stable home for
 * unit-testing under `lib/`.
 */
export function defaultIsConsensus<TPayload>(
  peer: TPayload,
  viewer: TPayload,
): boolean {
  if (peer === viewer) return true;
  try {
    return JSON.stringify(peer) === JSON.stringify(viewer);
  } catch {
    return false;
  }
}

/**
 * Pure: returns a new array with peers sorted per `mode`. Stable: ties in
 * `alphabetical` (e.g. duplicate names) preserve the input order.
 */
export function sortPeerRows<TPayload>(
  rows: readonly PeerRow<TPayload>[],
  mode: PeerSortMode,
): PeerRow<TPayload>[] {
  if (mode === 'insertion') return rows.slice();
  // `Array.prototype.sort` is stable in all modern engines. We pair with index
  // before sorting only if we needed defensive stability across engines; not
  // required here, but keeps the contract explicit for future readers.
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const cmp = a.r.peerName.localeCompare(b.r.peerName, 'et', {
        sensitivity: 'base',
      });
      return cmp !== 0 ? cmp : a.i - b.i;
    })
    .map(({ r }) => r);
}

/**
 * Core (DI-friendly) implementation. Pure of any global state — tests pass
 * fakes for the two dependencies. The public `loadPeerPredictions` export
 * binds the real DB-backed implementations.
 */
export async function loadPeerPredictionsCore<TPayload>(
  opts: LoadPeerPredictionsOpts<TPayload>,
  deps: LoadPeerPredictionsDeps,
): Promise<PeerRow<TPayload>[]> {
  const { groupId, viewerUserId, sortMode = 'insertion' } = opts;

  const [members, systemUserId] = await Promise.all([
    deps.findGroupMembers(groupId),
    deps.findSystemUserId(),
  ]);

  // Filter the viewer and the system singleton out client-side after the DB
  // read. Keeps the SQL trivially readable; the exclusion rule is explicit
  // here, where the constitution rule it enforces is also documented.
  const peers = members.filter(
    (m) => m.user_id !== viewerUserId && m.user_id !== systemUserId,
  );

  if (peers.length === 0) return [];

  const payloads = await opts.loadPayloads(peers.map((p) => p.user_id));

  const rows: PeerRow<TPayload>[] = peers.map((p) => ({
    peerId: p.user_id,
    peerName: p.username,
    submittedPayload: payloads.get(p.user_id) ?? null,
  }));

  return sortPeerRows(rows, sortMode);
}

async function findGroupMembersDb(groupId: string): Promise<GroupMemberRow[]> {
  const rows = await db
    .select({
      user_id: user_groups.user_id,
      username: users.username,
    })
    .from(user_groups)
    .innerJoin(users, eq(users.id, user_groups.user_id))
    .where(
      and(eq(user_groups.group_id, groupId), isNull(user_groups.deleted_at)),
    )
    .orderBy(asc(user_groups.created_at));
  return rows;
}

/**
 * Production loader bound to the real Drizzle handle + system-user lookup.
 *
 * Constitution Rule 1: the literal `'tegelikud tulemused'` username is never
 * referenced here — exclusion is resolved through `getSystemUserId()`.
 * Constitution Rule 2: `groupId` MUST come from the session, never from URL
 * input. Callers are responsible for that guarantee; this function trusts it.
 */
export async function loadPeerPredictions<TPayload>(
  opts: LoadPeerPredictionsOpts<TPayload>,
): Promise<PeerRow<TPayload>[]> {
  return loadPeerPredictionsCore(opts, {
    findGroupMembers: findGroupMembersDb,
    findSystemUserId: getSystemUserId,
  });
}
