import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { teams, user_groups, user_teams, users } from '@/db/schema';
import {
  loadPeerPredictionsCore,
  type GroupMemberRow,
  type LoadPeerPredictionsDeps,
  type PeerRow,
} from './load-peer-predictions';
import { getSystemUserId } from '@/lib/system-user';

/**
 * Per-peer payload for the final-stage popover: the ordered F1 → F4 selection
 * with each slot's team id + name (the popover renders team names directly,
 * so we resolve them server-side in one JOIN rather than re-fetching client-
 * side per slot).
 *
 * Sorted F1 → F4 stably by `slot`.
 */
export type FinalSlotCode = 'F1' | 'F2' | 'F3' | 'F4';

export type FinalPeerPick = readonly {
  slot: FinalSlotCode;
  teamId: string;
  teamName: string;
}[];

const FINAL_ROUND_VALUE = 'final';
const FINAL_SLOT_ORDER: readonly FinalSlotCode[] = ['F1', 'F2', 'F3', 'F4'];
const FULL_ORDERING_SIZE = FINAL_SLOT_ORDER.length;

function isFinalSlot(value: string): value is FinalSlotCode {
  return (FINAL_SLOT_ORDER as readonly string[]).includes(value);
}

interface FinalsRow {
  user_id: string;
  slot: string;
  team_id: string;
  team_name: string;
}

export interface LoadFinalPayloadsDeps {
  findFinalsForTournament: (
    tournamentId: string,
    peerIds: string[],
  ) => Promise<FinalsRow[]>;
}

/**
 * DI-friendly: groups raw user_teams rows (filtered to round = 'final') into
 * one ordered F1–F4 list per peer. The submitted-only gate (S05 AC) is
 * implemented here as the single chokepoint: a peer is included in the
 * returned map ONLY if they have exactly 4 picks covering F1/F2/F3/F4.
 * Partial orderings (1, 2, or 3 picks) come back as absent from the map and
 * surface as `submittedPayload: null` via the seam.
 */
export function groupFinalsByPeer(
  rows: readonly FinalsRow[],
): Map<string, FinalPeerPick> {
  const byPeer = new Map<string, Map<FinalSlotCode, { teamId: string; teamName: string }>>();
  for (const r of rows) {
    if (!isFinalSlot(r.slot)) continue;
    let slots = byPeer.get(r.user_id);
    if (!slots) {
      slots = new Map();
      byPeer.set(r.user_id, slots);
    }
    // Defensive: if duplicate rows for the same (user, slot) somehow exist,
    // last-write-wins is harmless because the DB enforces a UNIQUE on
    // (user_id, tournament_id, round, slot).
    slots.set(r.slot, { teamId: r.team_id, teamName: r.team_name });
  }

  const out = new Map<string, FinalPeerPick>();
  for (const [userId, slots] of byPeer) {
    if (slots.size !== FULL_ORDERING_SIZE) continue; // partial ordering → not-submitted
    const ordered: FinalPeerPick = FINAL_SLOT_ORDER.map((slot) => {
      const entry = slots.get(slot);
      // Safety: with size === 4 and all keys in FINAL_SLOT_ORDER, every slot
      // must exist. Cast asserted here so the type stays clean.
      return {
        slot,
        teamId: entry!.teamId,
        teamName: entry!.teamName,
      };
    });
    out.set(userId, ordered);
  }
  return out;
}

export interface LoadFinalPeerRowsOpts {
  groupId: string;
  viewerUserId: string;
}

/**
 * DI-friendly core. Pure of global state — tests pass fake deps. The public
 * `loadFinalPeerRows` export below binds the real DB-backed implementations.
 */
export async function loadFinalPeerRowsCore(
  tournamentId: string,
  opts: LoadFinalPeerRowsOpts,
  deps: LoadPeerPredictionsDeps & LoadFinalPayloadsDeps,
): Promise<PeerRow<FinalPeerPick>[]> {
  return loadPeerPredictionsCore<FinalPeerPick>(
    {
      groupId: opts.groupId,
      viewerUserId: opts.viewerUserId,
      loadPayloads: async (peerIds) => {
        if (peerIds.length === 0) return new Map();
        const rows = await deps.findFinalsForTournament(tournamentId, peerIds);
        return groupFinalsByPeer(rows);
      },
    },
    deps,
  );
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

async function findFinalsForTournamentDb(
  tournamentId: string,
  peerIds: string[],
): Promise<FinalsRow[]> {
  if (peerIds.length === 0) return [];
  return db
    .select({
      user_id: user_teams.user_id,
      slot: user_teams.slot,
      team_id: user_teams.team_id,
      team_name: teams.name_et,
    })
    .from(user_teams)
    .innerJoin(teams, eq(teams.id, user_teams.team_id))
    .where(
      and(
        eq(user_teams.tournament_id, tournamentId),
        eq(user_teams.round, FINAL_ROUND_VALUE),
        inArray(user_teams.user_id, peerIds),
      ),
    );
}

/**
 * Production loader. Returns one `PeerRow<FinalPeerPick>` per groupmate
 * (excluding the viewer + the `tegelikud tulemused` singleton). Peers with
 * fewer than 4 picks come back as `submittedPayload: null` (submitted-only
 * gate per S05 AC — partial ordering renders as "ei ole veel ennustanud").
 *
 * Constitution Rule 1: the literal `'tegelikud tulemused'` username is never
 * referenced here — exclusion is resolved through `getSystemUserId()`.
 * Constitution Rule 2: `groupId` MUST come from the session, never URL input.
 */
export async function loadFinalPeerRows(
  tournamentId: string,
  opts: LoadFinalPeerRowsOpts,
): Promise<PeerRow<FinalPeerPick>[]> {
  return loadFinalPeerRowsCore(tournamentId, opts, {
    findGroupMembers: findGroupMembersDb,
    findSystemUserId: getSystemUserId,
    findFinalsForTournament: findFinalsForTournamentDb,
  });
}
