/**
 * Runtime legacy seeder. Idempotently writes:
 *   - historical tournaments (codes EM2012, WC2014, …, EM2024)
 *   - legacy groups (bcrypt hash carried verbatim from Devise)
 *   - legacy users (one per legacyId; users.username is no longer globally unique
 *     so we use `legacy_user_seed_map` to keep legacyId → uuid stable across
 *     re-seeds)
 *   - per-tournament total-score rows into `public.legacy_tournament_scores`
 *
 * Called from `scripts/seed.ts` inside the existing transaction. Connects
 * via the same DATABASE_URL_ADMIN client passed in (Constitution Critical
 * Rule 4).
 */
import type { Client } from 'pg';
import { legacyGroups } from './groups';
import { legacyScores } from './scores';
import { legacyTournaments } from './tournaments';
import { legacyUsers } from './users';

export interface SeedLegacyCounts {
  tournaments: number;
  groups: number;
  users: number;
  scores: number;
}

export async function seedLegacy(client: Client): Promise<SeedLegacyCounts> {
  // 1. Historical tournaments.
  for (const t of legacyTournaments) {
    await client.query(
      `insert into tournaments (code, name, starts_at, ends_at)
       values ($1, $2, $3, $4)
       on conflict (code) do nothing`,
      [t.code, t.name, t.startsAt, t.endsAt],
    );
  }

  // 2. Legacy groups (carry bcrypt hash from Devise verbatim).
  for (const g of legacyGroups) {
    await client.query(
      `insert into groups (username, password_hash)
       values ($1, $2)
       on conflict (username) do nothing`,
      [g.username, g.passwordHash],
    );
  }

  // 3. Singleton lookup.
  // Critical Rule 1: the literal string is sacred. Bootstrapped by migration
  // 0001; we just resolve its uuid.
  const singletonRow = await client.query<{ id: string }>(
    `select id from users where is_system_user = true limit 1`,
  );
  const singletonUserId = singletonRow.rows[0]?.id;
  if (!singletonUserId) {
    throw new Error(
      'System singleton not found. Migration 0001_seed_singleton must run first.',
    );
  }

  // 4. Legacy users. `users.username` is no longer globally unique (migration
  // 0008), so we can't use ON CONFLICT — we de-duplicate via legacy_user_seed_map.
  const mapRows = await client.query<{ legacy_id: number; user_id: string }>(
    `select legacy_id, user_id from legacy_user_seed_map`,
  );
  const userIdByLegacyId = new Map<number, string>();
  for (const r of mapRows.rows) userIdByLegacyId.set(r.legacy_id, r.user_id);

  for (const u of legacyUsers) {
    if (userIdByLegacyId.has(u.legacyId)) continue;

    const inserted = await client.query<{ id: string }>(
      `insert into users (username) values ($1) returning id`,
      [u.username],
    );
    const newUserId = inserted.rows[0]!.id;
    userIdByLegacyId.set(u.legacyId, newUserId);
    await client.query(
      `insert into legacy_user_seed_map (legacy_id, user_id) values ($1, $2)`,
      [u.legacyId, newUserId],
    );
  }

  // 5. Attach user → group memberships. Required so the per-player history
  // trail (S14) can list a user's predecessor groups; also keeps the schema's
  // assumption that scored users have a `user_groups` row intact.
  const groupIdRows = await client.query<{ id: string; username: string }>(
    `select id, username from groups`,
  );
  const groupIdByUsername = new Map<string, string>(
    groupIdRows.rows.map((r) => [r.username, r.id]),
  );

  for (const u of legacyUsers) {
    const userUuid = userIdByLegacyId.get(u.legacyId);
    if (!userUuid) continue;
    for (const { username: groupUsername, deletedAt } of u.groups) {
      const groupUuid = groupIdByUsername.get(groupUsername);
      if (!groupUuid) continue;
      // ON CONFLICT DO UPDATE so re-runs converge to the latest deletedAt
      // state when the seed file changes (composite PK is (user_id, group_id)).
      await client.query(
        `insert into user_groups (user_id, group_id, deleted_at)
         values ($1, $2, $3)
         on conflict (user_id, group_id) do update set deleted_at = excluded.deleted_at`,
        [userUuid, groupUuid, deletedAt],
      );
    }
  }

  // 6. legacy_tournament_scores.
  const tournamentIdRows = await client.query<{ id: string; code: string }>(
    `select id, code from tournaments`,
  );
  const tournamentIdByCode = new Map<string, string>(
    tournamentIdRows.rows.map((r) => [r.code, r.id]),
  );

  for (const s of legacyScores) {
    const groupId = groupIdByUsername.get(s.groupUsername);
    const tournamentId = tournamentIdByCode.get(s.tournamentCode);
    const userId =
      s.userKey === 'singleton' ? singletonUserId : userIdByLegacyId.get(s.userKey);
    if (!groupId || !tournamentId || !userId) continue;

    await client.query(
      `insert into legacy_tournament_scores
         (group_id, tournament_id, user_id, total_points, finishing_position)
       values ($1, $2, $3, $4, $5)
       on conflict (group_id, tournament_id, user_id) do nothing`,
      [groupId, tournamentId, userId, s.totalPoints, s.finishingPosition],
    );
  }

  return {
    tournaments: legacyTournaments.length,
    groups: legacyGroups.length,
    users: legacyUsers.length,
    scores: legacyScores.length,
  };
}
