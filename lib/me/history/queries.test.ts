/**
 * Integration test for getPlayerHistory (S14). Asserts the helper returns
 * every legacy row for the (user, group) pair, ordered newest-first, with no
 * cross-user / cross-group leakage, and that non-participated tournaments are
 * absent.
 *
 * Opt-in: set INTEGRATION_DB_URL to a live Postgres (e.g. Supabase CLI at
 * 127.0.0.1:54322). Pointed at the same URL via DATABASE_URL so the helper's
 * pool connects to the same DB the fixture is written through. Fixtures are
 * not wrapped in a transaction (the helper's own pool would not see
 * uncommitted rows); cleanup is scoped by FIXTURE_TAG in afterAll.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';

const url = process.env.INTEGRATION_DB_URL;
if (url) {
  // Override the stub from vitest.setup.ts before lib/db.ts is imported.
  process.env.DATABASE_URL = url;
}

const FIXTURE_TAG = `s14-test-${Date.now()}`;
const describeOrSkip = url ? describe : describe.skip;

describeOrSkip('getPlayerHistory (integration)', () => {
  let client!: Client;
  let groupId!: string;
  let otherGroupId!: string;
  let u1!: string;
  let u2!: string;
  let t1!: string; // 2012
  let t2!: string; // 2016
  let t3!: string; // 2024 (newest)
  let getPlayerHistory!: typeof import('./queries').getPlayerHistory;

  beforeAll(async () => {
    if (!url) return;
    ({ getPlayerHistory } = await import('./queries'));

    client = new Client({ connectionString: url });
    await client.connect();

    const t1Row = await client.query<{ id: string }>(
      `insert into tournaments (code, name, starts_at, ends_at)
       values ($1, $2, '2012-06-01', '2012-07-01') returning id`,
      [`${FIXTURE_TAG}-T1`, `${FIXTURE_TAG} t1`],
    );
    t1 = t1Row.rows[0]!.id;

    const t2Row = await client.query<{ id: string }>(
      `insert into tournaments (code, name, starts_at, ends_at)
       values ($1, $2, '2016-06-01', '2016-07-01') returning id`,
      [`${FIXTURE_TAG}-T2`, `${FIXTURE_TAG} t2`],
    );
    t2 = t2Row.rows[0]!.id;

    const t3Row = await client.query<{ id: string }>(
      `insert into tournaments (code, name, starts_at, ends_at)
       values ($1, $2, '2024-06-01', '2024-07-01') returning id`,
      [`${FIXTURE_TAG}-T3`, `${FIXTURE_TAG} t3`],
    );
    t3 = t3Row.rows[0]!.id;

    const gRow = await client.query<{ id: string }>(
      `insert into groups (username, password_hash) values ($1, $2) returning id`,
      [`${FIXTURE_TAG}-G`, 'x'],
    );
    groupId = gRow.rows[0]!.id;

    const otherGroup = await client.query<{ id: string }>(
      `insert into groups (username, password_hash) values ($1, $2) returning id`,
      [`${FIXTURE_TAG}-G2`, 'x'],
    );
    otherGroupId = otherGroup.rows[0]!.id;

    const u1Row = await client.query<{ id: string }>(
      `insert into users (username) values ($1) returning id`,
      [`${FIXTURE_TAG}-u1`],
    );
    u1 = u1Row.rows[0]!.id;

    const u2Row = await client.query<{ id: string }>(
      `insert into users (username) values ($1) returning id`,
      [`${FIXTURE_TAG}-u2`],
    );
    u2 = u2Row.rows[0]!.id;

    await client.query(
      `insert into user_groups (user_id, group_id) values ($1, $3), ($2, $3)`,
      [u1, u2, groupId],
    );

    // u1 plays all 3 tournaments; u2 only T2. Plus an other-group row for u1
    // in T1 to exercise the cross-group isolation assertion.
    await client.query(
      `insert into legacy_tournament_scores
         (group_id, tournament_id, user_id, total_points, finishing_position)
       values
         ($1, $2, $5, 50, 4),
         ($1, $3, $5, 70, 2),
         ($1, $4, $5, 90, 1),
         ($1, $3, $6, 30, 5),
         ($7, $2, $5, 999, 1)`,
      [groupId, t1, t2, t3, u1, u2, otherGroupId],
    );
  });

  afterAll(async () => {
    if (!client) return;
    try {
      // Scope cleanup by the tag; cascade FKs handle child rows where present.
      await client.query(
        `delete from legacy_tournament_scores
           where tournament_id in (
             select id from tournaments where code like $1
           )`,
        [`${FIXTURE_TAG}-%`],
      );
      await client.query(
        `delete from user_groups
           where user_id in (select id from users where username like $1)`,
        [`${FIXTURE_TAG}-%`],
      );
      await client.query(`delete from users where username like $1`, [`${FIXTURE_TAG}-%`]);
      await client.query(`delete from groups where username like $1`, [`${FIXTURE_TAG}-%`]);
      await client.query(`delete from tournaments where code like $1`, [`${FIXTURE_TAG}-%`]);
    } finally {
      await client.end();
    }
  });

  it('returns every tournament for (user, group), newest-first', async () => {
    const rows = await getPlayerHistory(u1, groupId);
    expect(rows.map((r) => r.tournamentCode)).toEqual([
      `${FIXTURE_TAG}-T3`,
      `${FIXTURE_TAG}-T2`,
      `${FIXTURE_TAG}-T1`,
    ]);
    expect(rows.map((r) => r.totalPoints)).toEqual([90, 70, 50]);
    expect(rows.map((r) => r.finishingPosition)).toEqual([1, 2, 4]);
  });

  it('omits tournaments the user did not participate in', async () => {
    const rows = await getPlayerHistory(u2, groupId);
    expect(rows.map((r) => r.tournamentCode)).toEqual([`${FIXTURE_TAG}-T2`]);
    expect(rows[0]!.totalPoints).toBe(30);
    expect(rows[0]!.finishingPosition).toBe(5);
  });

  it('does not leak rows from another group', async () => {
    const rows = await getPlayerHistory(u1, groupId);
    expect(rows.find((r) => r.totalPoints === 999)).toBeUndefined();
  });
});
