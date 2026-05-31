/**
 * Pure transforms turning parsed legacy COPY rows into the seed-data shape
 * the runtime seeder consumes. No I/O; fully unit-testable.
 *
 * Constitution:
 *   - Critical Rule 1: the literal `'tegelikud tulemused'` is the singleton
 *     marker. Per-tournament magic-user rows in legacy collapse to the new
 *     system singleton (is_system_user = true), keyed in scores as the literal
 *     marker `'singleton'`.
 */

import type { CopyRow } from './dump-parser';

export const SINGLETON_NAME = 'tegelikud tulemused';
export const SINGLETON_KEY = 'singleton' as const;

export interface LegacyTournament {
  id: number;
  name: string;
  type: string;
}

export interface LegacyGroup {
  id: number;
  username: string;
  encryptedPassword: string;
}

export interface LegacyUser {
  id: number;
  name: string;
}

export interface LegacyUserGroup {
  id: number;
  userId: number;
  groupId: number;
}

export interface LegacyUserResult {
  id: number;
  tournamentId: number;
  points: number | null;
  userGroupId: number;
}

export interface SeedTournament {
  code: string;
  name: string;
  startsAt: string;
  endsAt: string;
  legacyId: number;
}

export interface SeedGroup {
  username: string;
  passwordHash: string;
  legacyId: number;
}

export interface SeedUser {
  legacyId: number;
  username: string;
  groupUsernames: string[];
}

export interface SeedScore {
  groupUsername: string;
  tournamentCode: string;
  userKey: number | typeof SINGLETON_KEY;
  totalPoints: number;
  finishingPosition: number;
}

export interface ReconciliationCategory {
  count: number;
  pointsSum: number;
}

export interface ReconciliationCell {
  groupUsername: string;
  tournamentCode: string;
  legacyRows: number;
  legacyPointsSum: number;
  produced: ReconciliationCategory;
  excludedNullPoints: ReconciliationCategory;
  collapsedSingletonDuplicates: ReconciliationCategory;
  orphanRefs: ReconciliationCategory;
  unknownTournament: ReconciliationCategory;
  balanced: boolean;
}

export interface ReconciliationReport {
  cells: ReconciliationCell[];
  totals: {
    legacyRows: number;
    produced: number;
    excludedNullPoints: number;
    collapsedSingletonDuplicates: number;
    orphanRefs: number;
    unknownTournament: number;
  };
  ok: boolean;
}

/**
 * Real tournament dates. Used by the build tool to seed historical
 * `public.tournaments` rows so legacy_tournament_scores FKs resolve.
 *
 * Codes follow the platform convention: EM<year> for UEFA Euro, WC<year>
 * for FIFA World Cup. Legacy `tournaments.type` uses `MM` for World Cup; the
 * mapping below re-codes accordingly.
 */
export const HISTORICAL_TOURNAMENTS: Readonly<Record<number, SeedTournament>> = {
  1: {
    code: 'EM2012',
    name: 'UEFA Euro 2012',
    startsAt: '2012-06-08',
    endsAt: '2012-07-01',
    legacyId: 1,
  },
  2: {
    code: 'WC2014',
    name: 'FIFA World Cup 2014',
    startsAt: '2014-06-12',
    endsAt: '2014-07-13',
    legacyId: 2,
  },
  3: {
    code: 'EM2016',
    name: 'UEFA Euro 2016',
    startsAt: '2016-06-10',
    endsAt: '2016-07-10',
    legacyId: 3,
  },
  4: {
    code: 'WC2018',
    name: 'FIFA World Cup 2018',
    startsAt: '2018-06-14',
    endsAt: '2018-07-15',
    legacyId: 4,
  },
  5: {
    code: 'EM2020',
    name: 'UEFA Euro 2020',
    startsAt: '2021-06-11',
    endsAt: '2021-07-11',
    legacyId: 5,
  },
  6: {
    code: 'WC2022',
    name: 'FIFA World Cup 2022',
    startsAt: '2022-11-20',
    endsAt: '2022-12-18',
    legacyId: 6,
  },
  7: {
    code: 'EM2024',
    name: 'UEFA Euro 2024',
    startsAt: '2024-06-14',
    endsAt: '2024-07-14',
    legacyId: 7,
  },
};

// ---------- row coercion ----------

function int(row: CopyRow, col: string): number {
  const v = row[col];
  if (v === null || v === undefined) {
    throw new Error(`Expected ${col} to be non-null, got null`);
  }
  return Number.parseInt(v, 10);
}

function intOrNull(row: CopyRow, col: string): number | null {
  const v = row[col];
  return v === null || v === undefined ? null : Number.parseInt(v, 10);
}

function str(row: CopyRow, col: string): string {
  const v = row[col];
  if (v === null || v === undefined) {
    throw new Error(`Expected ${col} to be non-null, got null`);
  }
  return v;
}

export function asLegacyTournaments(rows: CopyRow[]): LegacyTournament[] {
  return rows.map((r) => ({
    id: int(r, 'id'),
    name: str(r, 'name'),
    type: str(r, 'type'),
  }));
}

export function asLegacyGroups(rows: CopyRow[]): LegacyGroup[] {
  return rows.map((r) => ({
    id: int(r, 'id'),
    username: str(r, 'username'),
    encryptedPassword: str(r, 'encrypted_password'),
  }));
}

export function asLegacyUsers(rows: CopyRow[]): LegacyUser[] {
  return rows.map((r) => ({
    id: int(r, 'id'),
    name: r.name ?? '',
  }));
}

export function asLegacyUserGroups(rows: CopyRow[]): LegacyUserGroup[] {
  // Legacy schema allows null user_id / group_id; those rows are dangling
  // (membership half-deleted) and can't link to anything, so they're dropped
  // at coercion time. Soft-deleted memberships (deleted_at not null) are
  // still kept: the historical scores attached to them are real.
  const out: LegacyUserGroup[] = [];
  for (const r of rows) {
    const userId = intOrNull(r, 'user_id');
    const groupId = intOrNull(r, 'group_id');
    if (userId === null || groupId === null) continue;
    out.push({ id: int(r, 'id'), userId, groupId });
  }
  return out;
}

export function asLegacyUserResults(rows: CopyRow[]): LegacyUserResult[] {
  // Legacy schema allows null tournament_id / user_group_id; those rows are
  // orphans. Keep them with sentinel -1 so the orphan bucket in the
  // reconciliation report counts them, then transformScores skips them.
  return rows.map((r) => ({
    id: int(r, 'id'),
    tournamentId: intOrNull(r, 'tournament_id') ?? -1,
    points: intOrNull(r, 'points'),
    userGroupId: intOrNull(r, 'user_group_id') ?? -1,
  }));
}

// ---------- transforms ----------

export function transformGroups(legacy: LegacyGroup[]): SeedGroup[] {
  const seen = new Set<string>();
  const out: SeedGroup[] = [];
  for (const g of legacy) {
    if (seen.has(g.username)) {
      // Legacy `groups.username` is unique in the dump; defensive guard.
      continue;
    }
    seen.add(g.username);
    out.push({
      username: g.username,
      passwordHash: g.encryptedPassword,
      legacyId: g.id,
    });
  }
  return out;
}

export interface TransformUsersResult {
  users: SeedUser[];
  /** legacy user_id → 'singleton' for tegelikud-tulemused rows; otherwise the same legacy id */
  userKeyByLegacyId: Map<number, number | typeof SINGLETON_KEY>;
}

export function transformUsers(
  legacyUsers: LegacyUser[],
  legacyUserGroups: LegacyUserGroup[],
  legacyGroupUsernameById: Map<number, string>,
): TransformUsersResult {
  const userKeyByLegacyId = new Map<number, number | typeof SINGLETON_KEY>();
  const users: SeedUser[] = [];

  // Map legacy user_id → set of group usernames (via user_groups + groups).
  const groupsByUser = new Map<number, Set<string>>();
  for (const ug of legacyUserGroups) {
    const gName = legacyGroupUsernameById.get(ug.groupId);
    if (!gName) continue;
    let set = groupsByUser.get(ug.userId);
    if (!set) {
      set = new Set<string>();
      groupsByUser.set(ug.userId, set);
    }
    set.add(gName);
  }

  for (const u of legacyUsers) {
    if (u.name === SINGLETON_NAME) {
      userKeyByLegacyId.set(u.id, SINGLETON_KEY);
      continue;
    }
    const username = u.name.length > 0 ? u.name : `legacy_user_${u.id}`;
    const groupUsernames = Array.from(groupsByUser.get(u.id) ?? []).sort();
    users.push({ legacyId: u.id, username, groupUsernames });
    userKeyByLegacyId.set(u.id, u.id);
  }

  // Deterministic order for stable diffs across rebuilds.
  users.sort((a, b) => a.legacyId - b.legacyId);

  return { users, userKeyByLegacyId };
}

export interface TransformScoresInput {
  results: LegacyUserResult[];
  userGroups: LegacyUserGroup[];
  legacyUserKeyByLegacyId: Map<number, number | typeof SINGLETON_KEY>;
  legacyGroupUsernameById: Map<number, string>;
  legacyTournamentCodeById: Map<number, string>;
}

export interface TransformScoresResult {
  scores: SeedScore[];
  report: ReconciliationReport;
}

interface Bucket {
  /** key: `${groupUsername} ${tournamentCode}` */
  legacyRows: number;
  legacyPointsSum: number;
  excludedNullPoints: ReconciliationCategory;
  orphanRefs: ReconciliationCategory;
  unknownTournament: ReconciliationCategory;
  collapsedSingletonDuplicates: ReconciliationCategory;
  /** keyed by userKey → kept score (after singleton collapse) */
  keptByUserKey: Map<number | typeof SINGLETON_KEY, { points: number; legacyResultId: number }>;
}

function zeroCat(): ReconciliationCategory {
  return { count: 0, pointsSum: 0 };
}

function bumpCat(cat: ReconciliationCategory, points: number | null): void {
  cat.count += 1;
  if (points !== null) cat.pointsSum += points;
}

export function transformScores(input: TransformScoresInput): TransformScoresResult {
  const {
    results,
    userGroups,
    legacyUserKeyByLegacyId,
    legacyGroupUsernameById,
    legacyTournamentCodeById,
  } = input;

  const userGroupById = new Map<number, LegacyUserGroup>();
  for (const ug of userGroups) userGroupById.set(ug.id, ug);

  /** Per (legacy_group_id, legacy_tournament_id) bucket — keyed by groupUsername|tournamentCode for stable reporting */
  const cellByKey = new Map<string, Bucket>();
  /** Orphan rows can't resolve to a group/tournament; tracked under a synthetic "unknown" cell */
  const ORPHAN_KEY = '__orphan__ __orphan__';

  function bucket(key: string): Bucket {
    let b = cellByKey.get(key);
    if (!b) {
      b = {
        legacyRows: 0,
        legacyPointsSum: 0,
        excludedNullPoints: zeroCat(),
        orphanRefs: zeroCat(),
        unknownTournament: zeroCat(),
        collapsedSingletonDuplicates: zeroCat(),
        keptByUserKey: new Map(),
      };
      cellByKey.set(key, b);
    }
    return b;
  }

  for (const r of results) {
    const ug = userGroupById.get(r.userGroupId);
    if (!ug) {
      const b = bucket(ORPHAN_KEY);
      b.legacyRows += 1;
      if (r.points !== null) b.legacyPointsSum += r.points;
      bumpCat(b.orphanRefs, r.points);
      continue;
    }
    const groupUsername = legacyGroupUsernameById.get(ug.groupId);
    const tournamentCode = legacyTournamentCodeById.get(r.tournamentId);
    if (!groupUsername || !tournamentCode) {
      const b = bucket(ORPHAN_KEY);
      b.legacyRows += 1;
      if (r.points !== null) b.legacyPointsSum += r.points;
      if (!tournamentCode) bumpCat(b.unknownTournament, r.points);
      else bumpCat(b.orphanRefs, r.points);
      continue;
    }

    const key = `${groupUsername} ${tournamentCode}`;
    const b = bucket(key);
    b.legacyRows += 1;
    if (r.points !== null) b.legacyPointsSum += r.points;

    if (r.points === null) {
      bumpCat(b.excludedNullPoints, r.points);
      continue;
    }

    const userKey = legacyUserKeyByLegacyId.get(ug.userId);
    if (userKey === undefined) {
      bumpCat(b.orphanRefs, r.points);
      continue;
    }

    const existing = b.keptByUserKey.get(userKey);
    if (!existing) {
      b.keptByUserKey.set(userKey, { points: r.points, legacyResultId: r.id });
    } else if (userKey === SINGLETON_KEY) {
      // Collapse multiple per-tournament magic-user rows into one — keep MAX(points).
      bumpCat(b.collapsedSingletonDuplicates, r.points);
      if (r.points > existing.points) {
        b.keptByUserKey.set(userKey, { points: r.points, legacyResultId: r.id });
      }
    } else {
      // Same non-singleton user appearing twice for the same (group, tournament) —
      // shouldn't happen in clean data. Keep MAX and count as duplicate.
      bumpCat(b.collapsedSingletonDuplicates, r.points);
      if (r.points > existing.points) {
        b.keptByUserKey.set(userKey, { points: r.points, legacyResultId: r.id });
      }
    }
  }

  // Emit scores + ranks.
  const scores: SeedScore[] = [];
  const cellReports: ReconciliationCell[] = [];

  for (const [key, b] of cellByKey) {
    const [groupUsername, tournamentCode] = key.split(' ') as [string, string];

    if (key === ORPHAN_KEY) {
      cellReports.push({
        groupUsername: '<orphan>',
        tournamentCode: '<orphan>',
        legacyRows: b.legacyRows,
        legacyPointsSum: b.legacyPointsSum,
        produced: zeroCat(),
        excludedNullPoints: b.excludedNullPoints,
        collapsedSingletonDuplicates: b.collapsedSingletonDuplicates,
        orphanRefs: b.orphanRefs,
        unknownTournament: b.unknownTournament,
        balanced:
          b.legacyRows ===
          b.excludedNullPoints.count +
            b.collapsedSingletonDuplicates.count +
            b.orphanRefs.count +
            b.unknownTournament.count,
      });
      continue;
    }

    const kept = Array.from(b.keptByUserKey.entries()).map(([userKey, info]) => ({
      userKey,
      points: info.points,
    }));
    // Standard tournament-style RANK: ties share rank; next rank skips.
    kept.sort((a, b2) => b2.points - a.points);

    let lastPoints = Number.NaN;
    let lastRank = 0;
    let produced = 0;
    let producedSum = 0;
    kept.forEach((row, idx) => {
      const rank = row.points === lastPoints ? lastRank : idx + 1;
      lastRank = rank;
      lastPoints = row.points;
      scores.push({
        groupUsername,
        tournamentCode,
        userKey: row.userKey,
        totalPoints: row.points,
        finishingPosition: rank,
      });
      produced += 1;
      producedSum += row.points;
    });

    cellReports.push({
      groupUsername,
      tournamentCode,
      legacyRows: b.legacyRows,
      legacyPointsSum: b.legacyPointsSum,
      produced: { count: produced, pointsSum: producedSum },
      excludedNullPoints: b.excludedNullPoints,
      collapsedSingletonDuplicates: b.collapsedSingletonDuplicates,
      orphanRefs: b.orphanRefs,
      unknownTournament: b.unknownTournament,
      balanced:
        b.legacyRows ===
        produced +
          b.excludedNullPoints.count +
          b.collapsedSingletonDuplicates.count +
          b.orphanRefs.count +
          b.unknownTournament.count,
    });
  }

  // Deterministic ordering: by (groupUsername, tournamentCode, finishingPosition, userKey).
  scores.sort((a, b) => {
    if (a.groupUsername !== b.groupUsername) return a.groupUsername < b.groupUsername ? -1 : 1;
    if (a.tournamentCode !== b.tournamentCode)
      return a.tournamentCode < b.tournamentCode ? -1 : 1;
    if (a.finishingPosition !== b.finishingPosition)
      return a.finishingPosition - b.finishingPosition;
    const aK = a.userKey === SINGLETON_KEY ? -1 : a.userKey;
    const bK = b.userKey === SINGLETON_KEY ? -1 : b.userKey;
    return aK - bK;
  });
  cellReports.sort((a, b) => {
    if (a.groupUsername !== b.groupUsername) return a.groupUsername < b.groupUsername ? -1 : 1;
    return a.tournamentCode < b.tournamentCode ? -1 : 1;
  });

  const totals = {
    legacyRows: 0,
    produced: 0,
    excludedNullPoints: 0,
    collapsedSingletonDuplicates: 0,
    orphanRefs: 0,
    unknownTournament: 0,
  };
  for (const c of cellReports) {
    totals.legacyRows += c.legacyRows;
    totals.produced += c.produced.count;
    totals.excludedNullPoints += c.excludedNullPoints.count;
    totals.collapsedSingletonDuplicates += c.collapsedSingletonDuplicates.count;
    totals.orphanRefs += c.orphanRefs.count;
    totals.unknownTournament += c.unknownTournament.count;
  }

  const ok = cellReports.every((c) => c.balanced);

  return {
    scores,
    report: { cells: cellReports, totals, ok },
  };
}
