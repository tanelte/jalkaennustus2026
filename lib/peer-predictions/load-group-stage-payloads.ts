import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { user_games } from '@/db/schema';
import {
  loadPeerPredictionsCore,
  type GroupMemberRow,
  type LoadPeerPredictionsDeps,
  type PeerRow,
} from './load-peer-predictions';
import { getSystemUserId } from '@/lib/system-user';
import { user_groups, users } from '@/db/schema';
import { asc, isNull } from 'drizzle-orm';

/**
 * The shape the group-stage popover renders per peer. Mirrors the row's own
 * 1/X/2 picker exactly — the popover-side `renderPick` reads only this value.
 *
 * Note: the group-stage prediction column accepts the platform's expanded
 * five-code form (`1A`, `1B`, `X`, `2A`, `2B`); the popover collapses these
 * into the user-visible 1 / X / 2 shape for parity with the row chip.
 */
export type GroupStagePeerPick = '1' | 'X' | '2';

export interface LoadGroupStagePayloadsDeps {
  findPredictionsForGame: (
    gameId: string,
    peerIds: string[],
  ) => Promise<Array<{ user_id: string; prediction: string }>>;
}

export interface LoadAllGroupStagePayloadsDeps {
  findPredictionsForGames: (
    gameIds: string[],
    peerIds: string[],
  ) => Promise<Array<{ user_id: string; game_id: string; prediction: string }>>;
}

function collapsePrediction(raw: string | null | undefined): GroupStagePeerPick | null {
  if (!raw) return null;
  if (raw === 'X') return 'X';
  const head = raw[0];
  if (head === '1') return '1';
  if (head === '2') return '2';
  return null;
}

/**
 * DI-friendly: returns `Map<peerId, GroupStagePeerPick>` for one match.
 */
export async function loadGroupStagePayloadsCore(
  gameId: string,
  peerIds: string[],
  deps: LoadGroupStagePayloadsDeps,
): Promise<Map<string, GroupStagePeerPick>> {
  if (peerIds.length === 0) return new Map();
  const rows = await deps.findPredictionsForGame(gameId, peerIds);
  const out = new Map<string, GroupStagePeerPick>();
  for (const r of rows) {
    const collapsed = collapsePrediction(r.prediction);
    if (collapsed) out.set(r.user_id, collapsed);
  }
  return out;
}

async function findPredictionsForGameDb(
  gameId: string,
  peerIds: string[],
): Promise<Array<{ user_id: string; prediction: string }>> {
  if (peerIds.length === 0) return [];
  return db
    .select({
      user_id: user_games.user_id,
      prediction: user_games.prediction,
    })
    .from(user_games)
    .where(
      and(
        eq(user_games.game_id, gameId),
        inArray(user_games.user_id, peerIds),
      ),
    );
}

/**
 * Production single-game loader. Use this when only one match is in view.
 */
export async function loadGroupStagePayloads(
  gameId: string,
  peerIds: string[],
): Promise<Map<string, GroupStagePeerPick>> {
  return loadGroupStagePayloadsCore(gameId, peerIds, {
    findPredictionsForGame: findPredictionsForGameDb,
  });
}

/**
 * DI-friendly batch loader. Returns `Map<gameId, PeerRow[]>` for every game
 * id passed in. Behaves like the single-game seam but does one DB round-trip
 * across N matches — required for the group-stage page (104 matches in WC).
 */
export async function loadAllGroupStagePeerRowsForMatchesCore(
  gameIds: string[],
  opts: {
    groupId: string;
    viewerUserId: string;
  },
  deps: LoadPeerPredictionsDeps & LoadAllGroupStagePayloadsDeps,
): Promise<Map<string, PeerRow<GroupStagePeerPick>[]>> {
  const empty = new Map<string, PeerRow<GroupStagePeerPick>[]>();
  for (const id of gameIds) empty.set(id, []);
  if (gameIds.length === 0) return empty;

  // Resolve peer ids once (group members minus viewer minus system user).
  // We reuse `loadPeerPredictionsCore` with a placeholder loader to apply the
  // exact same exclusion rules; then refetch payloads in one batch.
  const placeholder = await loadPeerPredictionsCore<GroupStagePeerPick>(
    {
      groupId: opts.groupId,
      viewerUserId: opts.viewerUserId,
      loadPayloads: async () => new Map(),
    },
    deps,
  );

  const peerIds = placeholder.map((p) => p.peerId);
  if (peerIds.length === 0) return empty;

  const rows = await deps.findPredictionsForGames(gameIds, peerIds);
  const byGame = new Map<string, Map<string, GroupStagePeerPick>>();
  for (const id of gameIds) byGame.set(id, new Map());
  for (const r of rows) {
    const collapsed = collapsePrediction(r.prediction);
    if (collapsed) byGame.get(r.game_id)?.set(r.user_id, collapsed);
  }

  const result = new Map<string, PeerRow<GroupStagePeerPick>[]>();
  for (const gameId of gameIds) {
    const picks = byGame.get(gameId) ?? new Map();
    result.set(
      gameId,
      placeholder.map((p) => ({
        peerId: p.peerId,
        peerName: p.peerName,
        submittedPayload: picks.get(p.peerId) ?? null,
      })),
    );
  }
  return result;
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

async function findPredictionsForGamesDb(
  gameIds: string[],
  peerIds: string[],
): Promise<Array<{ user_id: string; game_id: string; prediction: string }>> {
  if (gameIds.length === 0 || peerIds.length === 0) return [];
  return db
    .select({
      user_id: user_games.user_id,
      game_id: user_games.game_id,
      prediction: user_games.prediction,
    })
    .from(user_games)
    .where(
      and(
        inArray(user_games.game_id, gameIds),
        inArray(user_games.user_id, peerIds),
      ),
    );
}

export async function loadAllGroupStagePeerRowsForMatches(
  gameIds: string[],
  opts: { groupId: string; viewerUserId: string },
): Promise<Map<string, PeerRow<GroupStagePeerPick>[]>> {
  return loadAllGroupStagePeerRowsForMatchesCore(gameIds, opts, {
    findGroupMembers: findGroupMembersDb,
    findSystemUserId: getSystemUserId,
    findPredictionsForGames: findPredictionsForGamesDb,
  });
}
