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

export interface LoadPeerPredictionsOpts<TPayload> {
  groupId: string;
  viewerUserId: string;
  loadPayloads: (peerIds: string[]) => Promise<Map<string, TPayload>>;
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
  const { groupId, viewerUserId } = opts;

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

  return peers.map((p) => ({
    peerId: p.user_id,
    peerName: p.username,
    submittedPayload: payloads.get(p.user_id) ?? null,
  }));
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
