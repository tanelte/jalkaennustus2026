import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { user_best_thirds, user_groups, users } from '@/db/schema';
import {
  loadPeerPredictionsCore,
  type GroupMemberRow,
  type LoadPeerPredictionsDeps,
  type PeerRow,
  type PeerSortMode,
} from './load-peer-predictions';
import { getSystemUserId } from '@/lib/system-user';

/**
 * The shape the best-thirds popover renders per peer: the full set of 8 group
 * letters (A–L) the peer ticked. Sorted alphabetically for stable display.
 *
 * Submitted-only gate (E04-S03 AC): a peer counts as "submitted" only if they
 * have the full combined pick — exactly 8 letters. Partial in-flight state is
 * deliberately NOT surfaced to peers; the loader treats < 8 rows as not yet
 * submitted (no entry in the returned Map → seam yields `null`).
 */
/**
 * S06: the best-thirds popover now carries the peer's score alongside the
 * 8-letter set. `groupLetters` is the sorted set; `points` is the sum the
 * scoring engine already wrote to `user_best_thirds.points` (one row per
 * letter — the per-row points sum is the per-peer best-thirds total).
 */
export interface BestThirdsPeerPick {
  groupLetters: readonly string[];
  points: number | null;
}

export const REQUIRED_BEST_THIRDS_PICKS = 8;

export interface LoadBestThirdsPayloadsDeps {
  findBestThirdsForPeers: (
    tournamentId: string,
    peerIds: string[],
  ) => Promise<
    Array<{ user_id: string; group_letter: string; points: number | null }>
  >;
}

/**
 * DI-friendly: returns `Map<peerId, BestThirdsPeerPick>` for one tournament.
 *
 * Only peers with exactly `REQUIRED_BEST_THIRDS_PICKS` (8) letters appear in
 * the output. Peers with 0..7 letters are intentionally absent — the seam in
 * `loadPeerPredictionsCore` will emit `submittedPayload: null` for them.
 */
export async function loadBestThirdsPayloadsCore(
  tournamentId: string,
  peerIds: string[],
  deps: LoadBestThirdsPayloadsDeps,
): Promise<Map<string, BestThirdsPeerPick>> {
  if (peerIds.length === 0) return new Map();
  const rows = await deps.findBestThirdsForPeers(tournamentId, peerIds);

  // Group rows by user, then keep only users with exactly 8 letters.
  // S06 — also accumulate the per-row `points` into a per-peer total. If
  // every row is null we surface `null` (stage not scored yet); otherwise
  // null per-row contributions are treated as 0 so the partial-scored case
  // doesn't collapse a real running tally to null.
  type Agg = { letters: string[]; sum: number | null };
  const byUser = new Map<string, Agg>();
  for (const r of rows) {
    let agg = byUser.get(r.user_id);
    if (!agg) {
      agg = { letters: [], sum: null };
      byUser.set(r.user_id, agg);
    }
    agg.letters.push(r.group_letter);
    if (r.points !== null) {
      agg.sum = (agg.sum ?? 0) + r.points;
    }
  }

  const out = new Map<string, BestThirdsPeerPick>();
  for (const [userId, agg] of byUser.entries()) {
    if (agg.letters.length !== REQUIRED_BEST_THIRDS_PICKS) continue;
    const sorted = [...agg.letters].sort();
    out.set(userId, { groupLetters: sorted, points: agg.sum });
  }
  return out;
}

async function findGroupMembersDb(groupId: string): Promise<GroupMemberRow[]> {
  return db
    .select({ user_id: user_groups.user_id, username: users.username })
    .from(user_groups)
    .innerJoin(users, eq(users.id, user_groups.user_id))
    .where(
      and(eq(user_groups.group_id, groupId), isNull(user_groups.deleted_at)),
    )
    .orderBy(asc(user_groups.created_at));
}

async function findBestThirdsForPeersDb(
  tournamentId: string,
  peerIds: string[],
): Promise<
  Array<{ user_id: string; group_letter: string; points: number | null }>
> {
  if (peerIds.length === 0) return [];
  return db
    .select({
      user_id: user_best_thirds.user_id,
      group_letter: user_best_thirds.group_letter,
      points: user_best_thirds.points,
    })
    .from(user_best_thirds)
    .where(
      and(
        eq(user_best_thirds.tournament_id, tournamentId),
        inArray(user_best_thirds.user_id, peerIds),
      ),
    );
}

/**
 * DI-friendly: returns `PeerRow<BestThirdsPeerPick>[]` for the page-level
 * best-thirds peer view. One batched DB query against `user_best_thirds`.
 */
export async function loadBestThirdsPeerRowsCore(
  tournamentId: string,
  opts: { groupId: string; viewerUserId: string; sortMode?: PeerSortMode },
  deps: LoadPeerPredictionsDeps & LoadBestThirdsPayloadsDeps,
): Promise<PeerRow<BestThirdsPeerPick>[]> {
  return loadPeerPredictionsCore<BestThirdsPeerPick>(
    {
      groupId: opts.groupId,
      viewerUserId: opts.viewerUserId,
      loadPayloads: (peerIds) =>
        loadBestThirdsPayloadsCore(tournamentId, peerIds, deps),
      sortMode: opts.sortMode,
    },
    deps,
  );
}

/**
 * Production page-level loader. Constitution Rule 2: `groupId` MUST come from
 * the session, never from URL input. Callers guarantee that.
 */
export async function loadBestThirdsPeerRows(
  tournamentId: string,
  opts: { groupId: string; viewerUserId: string; sortMode?: PeerSortMode },
): Promise<PeerRow<BestThirdsPeerPick>[]> {
  return loadBestThirdsPeerRowsCore(
    tournamentId,
    { ...opts, sortMode: opts.sortMode ?? 'alphabetical' },
    {
      findGroupMembers: findGroupMembersDb,
      findSystemUserId: getSystemUserId,
      findBestThirdsForPeers: findBestThirdsForPeersDb,
    },
  );
}

/**
 * S06 — best-thirds-specific consensus predicate. Two peers agree iff their
 * 8-letter sets are identical *as sets* (order-insensitive). Compares the
 * sorted, deduplicated arrays via string equality.
 *
 * Exported for the page consumer.
 */
export function isBestThirdsConsensus(
  peer: BestThirdsPeerPick,
  viewer: BestThirdsPeerPick,
): boolean {
  if (peer.groupLetters.length !== viewer.groupLetters.length) return false;
  const a = [...peer.groupLetters].sort().join('');
  const b = [...viewer.groupLetters].sort().join('');
  return a === b;
}
