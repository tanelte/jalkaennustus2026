import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { games, teams, user_games, user_groups, users } from '@/db/schema';
import {
  loadPeerPredictionsCore,
  type GroupMemberRow,
  type LoadPeerPredictionsDeps,
  type PeerRow,
} from './load-peer-predictions';
import { getSystemUserId } from '@/lib/system-user';

/**
 * The shape the knockout popover renders per peer. Mirrors the team-pick
 * chip on the round form: a peer picked which team to advance from the
 * bracket pair (encoded as `1A`/`1B` = home team, `2A`/`2B` = away team).
 *
 * The popover-side `renderPick` reads only `teamName`. `teamId` is included
 * so future stories (e.g. consensus marker in S06) can colour-key without
 * re-fetching.
 */
export type KnockoutPeerPick = {
  teamId: string;
  teamName: string;
  finish: 'norm' | 'lisa';
};

interface MatchTeamRow {
  game_id: string;
  team_home_id: string | null;
  team_away_id: string | null;
  home_name_et: string | null;
  away_name_et: string | null;
}

export interface LoadAllKnockoutPayloadsDeps {
  findMatchesForRound: (
    round: string,
    gameIds: string[],
  ) => Promise<MatchTeamRow[]>;
  findPredictionsForGames: (
    gameIds: string[],
    peerIds: string[],
  ) => Promise<Array<{ user_id: string; game_id: string; prediction: string }>>;
}

/**
 * Map a knockout prediction code (1A/1B/2A/2B) to the team id + name of the
 * picked team. Returns null for any unrecognised code so we don't render
 * garbage in the popover.
 */
function pickedTeamFromCode(
  prediction: string | null | undefined,
  match: MatchTeamRow,
): KnockoutPeerPick | null {
  if (!prediction) return null;
  const head = prediction[0];
  // Suffix `A` = normal time (normaalaeg); anything else = extra time /
  // penalties (lisaaeg / penaltid). Mirrors the round form's own mapping.
  const finish = prediction[1] === 'A' ? 'norm' : 'lisa';
  if (head === '1') {
    if (!match.team_home_id || !match.home_name_et) return null;
    return { teamId: match.team_home_id, teamName: match.home_name_et, finish };
  }
  if (head === '2') {
    if (!match.team_away_id || !match.away_name_et) return null;
    return { teamId: match.team_away_id, teamName: match.away_name_et, finish };
  }
  return null;
}

/**
 * DI-friendly batch loader. Returns `Map<gameId, PeerRow[]>` for every game
 * id passed in. One DB round-trip for predictions across all matches in the
 * round — at most 16 matches on R32, so this stays well under any limit.
 *
 * Behaviour parity with `loadAllGroupStagePeerRowsForMatchesCore`:
 *  - Excludes the viewer and the `tegelikud tulemused` singleton via the
 *    shared peer-predictions seam.
 *  - Returns an entry for every requested game id, even if empty.
 *  - Preserves group-member order (asc by `user_groups.created_at`).
 */
export async function loadAllKnockoutPeerRowsForSlotsCore(
  round: string,
  gameIds: string[],
  opts: {
    groupId: string;
    viewerUserId: string;
  },
  deps: LoadPeerPredictionsDeps & LoadAllKnockoutPayloadsDeps,
): Promise<Map<string, PeerRow<KnockoutPeerPick>[]>> {
  const empty = new Map<string, PeerRow<KnockoutPeerPick>[]>();
  for (const id of gameIds) empty.set(id, []);
  if (gameIds.length === 0) return empty;

  // Resolve peer ids once (same exclusion rules as the group-stage loader).
  const placeholder = await loadPeerPredictionsCore<KnockoutPeerPick>(
    {
      groupId: opts.groupId,
      viewerUserId: opts.viewerUserId,
      loadPayloads: async () => new Map(),
    },
    deps,
  );

  const peerIds = placeholder.map((p) => p.peerId);
  if (peerIds.length === 0) return empty;

  const [matchRows, predictionRows] = await Promise.all([
    deps.findMatchesForRound(round, gameIds),
    deps.findPredictionsForGames(gameIds, peerIds),
  ]);

  const matchById = new Map<string, MatchTeamRow>();
  for (const m of matchRows) matchById.set(m.game_id, m);

  // gameId → (peerId → pick)
  const byGame = new Map<string, Map<string, KnockoutPeerPick>>();
  for (const id of gameIds) byGame.set(id, new Map());
  for (const r of predictionRows) {
    const match = matchById.get(r.game_id);
    if (!match) continue;
    const pick = pickedTeamFromCode(r.prediction, match);
    if (pick) byGame.get(r.game_id)?.set(r.user_id, pick);
  }

  const result = new Map<string, PeerRow<KnockoutPeerPick>[]>();
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

async function findMatchesForRoundDb(
  round: string,
  gameIds: string[],
): Promise<MatchTeamRow[]> {
  if (gameIds.length === 0) return [];
  const homeTeams = teams;
  // Two separate lookups would be required for both home + away team names
  // via a single JOIN — Drizzle aliasing per join is verbose. We instead
  // fetch the matches in one query (home name), then patch in away names
  // through a second pass. The total bracket-pair count per round is small
  // (≤16) so two cheap reads stay well within budget.
  const baseRows = await db
    .select({
      game_id: games.id,
      team_home_id: games.team_home_id,
      team_away_id: games.team_away_id,
      home_name_et: homeTeams.name_et,
    })
    .from(games)
    .leftJoin(homeTeams, eq(homeTeams.id, games.team_home_id))
    .where(and(eq(games.stage_code, round), inArray(games.id, gameIds)));

  const awayIds = baseRows
    .map((r) => r.team_away_id)
    .filter((id): id is string => id !== null);
  const awayRows =
    awayIds.length === 0
      ? []
      : await db
          .select({ id: teams.id, name_et: teams.name_et })
          .from(teams)
          .where(inArray(teams.id, awayIds));
  const awayNameById = new Map(awayRows.map((t) => [t.id, t.name_et]));

  return baseRows.map((r) => ({
    game_id: r.game_id,
    team_home_id: r.team_home_id,
    team_away_id: r.team_away_id,
    home_name_et: r.home_name_et,
    away_name_et: r.team_away_id ? awayNameById.get(r.team_away_id) ?? null : null,
  }));
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

/**
 * Production knockout-round loader. Returns `Map<gameId, PeerRow[]>` keyed
 * by game id (one bracket pair per row on the round page).
 *
 * Constitution Rule 1: the `'tegelikud tulemused'` exclusion is handled
 * inside the seam — never referenced literally here.
 * Constitution Rule 2: `groupId` MUST come from the session, never URL input.
 */
export async function loadAllKnockoutPeerRowsForSlots(
  round: string,
  gameIds: string[],
  opts: { groupId: string; viewerUserId: string },
): Promise<Map<string, PeerRow<KnockoutPeerPick>[]>> {
  return loadAllKnockoutPeerRowsForSlotsCore(round, gameIds, opts, {
    findGroupMembers: findGroupMembersDb,
    findSystemUserId: getSystemUserId,
    findMatchesForRound: findMatchesForRoundDb,
    findPredictionsForGames: findPredictionsForGamesDb,
  });
}
