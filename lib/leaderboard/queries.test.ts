/**
 * Integration test for v_user_points — the leaderboard view shape and SQL
 * rank-tie semantics required by S07.
 *
 * Requires a running local Postgres (Supabase CLI). Skipped automatically when
 * neither DATABASE_URL_ADMIN nor DATABASE_URL is set, so CI without a DB still
 * passes. Sets up its own ephemeral fixture (tournament + group + users) under
 * unique codes and cleans up in afterAll.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';

const url = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL;
const FIXTURE_TAG = `s07-test-${Date.now()}`;

const describeOrSkip = url ? describe : describe.skip;

describeOrSkip('v_user_points (integration)', () => {
  const client = new Client({ connectionString: url });
  let tournamentId!: string;
  let groupId!: string;
  const userIds: string[] = [];

  beforeAll(async () => {
    await client.connect();
    await client.query('begin');

    const t = await client.query<{ id: string }>(
      `insert into tournaments (code, name, starts_at, ends_at)
       values ($1, $2, now(), now() + interval '30 days')
       returning id`,
      [`${FIXTURE_TAG}-T`, `${FIXTURE_TAG} tournament`],
    );
    tournamentId = t.rows[0]!.id;

    const g = await client.query<{ id: string }>(
      `insert into groups (username, password_hash)
       values ($1, $2)
       returning id`,
      [`${FIXTURE_TAG}-G`, 'x'],
    );
    groupId = g.rows[0]!.id;

    // Insert 5 users; assign all to the group.
    for (let i = 1; i <= 5; i++) {
      const u = await client.query<{ id: string }>(
        `insert into users (username) values ($1) returning id`,
        [`${FIXTURE_TAG}-u${i}`],
      );
      const uid = u.rows[0]!.id;
      userIds.push(uid);
      await client.query(
        `insert into user_groups (user_id, group_id) values ($1, $2)`,
        [uid, groupId],
      );
    }

    // Best-thirds rows with points that produce ranks 1, 2, 3, 3, 5.
    const points = [80, 60, 50, 50, 40];
    for (let i = 0; i < 5; i++) {
      await client.query(
        `insert into user_best_thirds (user_id, tournament_id, group_letter, points)
         values ($1, $2, $3, $4)`,
        [userIds[i], tournamentId, 'A', points[i]],
      );
    }
  });

  afterAll(async () => {
    try {
      await client.query('rollback');
    } finally {
      await client.end();
    }
  });

  it('exposes user_id, group_id, tournament_id, total_points, position columns', async () => {
    const res = await client.query(
      `select column_name from information_schema.columns
        where table_name = 'v_user_points'`,
    );
    const cols = res.rows.map((r) => r.column_name).sort();
    expect(cols).toEqual(
      ['group_id', 'position', 'total_points', 'tournament_id', 'user_id'].sort(),
    );
  });

  it('excludes the tegelikud tulemused singleton', async () => {
    const res = await client.query<{ user_id: string }>(
      `select vup.user_id
         from v_user_points vup
         join users u on u.id = vup.user_id
        where u.is_system_user = true`,
    );
    expect(res.rows).toEqual([]);
  });

  it('ranks ties at the same position with a gap to the next (1, 2, 3, 3, 5)', async () => {
    const res = await client.query<{ total_points: string; position: string }>(
      `select total_points, position
         from v_user_points
        where group_id = $1 and tournament_id = $2
        order by position asc, total_points desc`,
      [groupId, tournamentId],
    );
    const positions = res.rows.map((r) => Number(r.position));
    const totals = res.rows.map((r) => Number(r.total_points));
    expect(totals).toEqual([80, 60, 50, 50, 40]);
    expect(positions).toEqual([1, 2, 3, 3, 5]);
  });

  it('scopes rows to the requested group', async () => {
    const res = await client.query<{ group_id: string }>(
      `select distinct group_id
         from v_user_points
        where tournament_id = $1`,
      [tournamentId],
    );
    expect(res.rows.length).toBe(1);
    expect(res.rows[0]!.group_id).toBe(groupId);
  });
});
