/**
 * Leaderboard read queries. Pure data-access helpers; no presentation concerns.
 * Ranking and summing live in SQL (Constitution Rules 6/7) — TS only marshals rows.
 */
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

export type LeaderboardRow = {
  user_id: string;
  username: string;
  total_points: number;
  position: number;
};

export async function getTournamentIdByCode(code: string): Promise<string | null> {
  const { rows } = await db.execute<{ id: string }>(
    sql`select id from tournaments where code = ${code} limit 1`,
  );
  return rows[0]?.id ?? null;
}

export async function getTournamentNameByCode(code: string): Promise<string | null> {
  const { rows } = await db.execute<{ name: string }>(
    sql`select name from tournaments where code = ${code} limit 1`,
  );
  return rows[0]?.name ?? null;
}

export async function getGroupLeaderboard(
  groupId: string,
  tournamentId: string,
): Promise<LeaderboardRow[]> {
  const { rows } = await db.execute<LeaderboardRow>(sql`
    select
      vup.user_id,
      u.username,
      vup.total_points,
      vup.position
    from v_user_points vup
    join users u on u.id = vup.user_id
    where vup.group_id = ${groupId}
      and vup.tournament_id = ${tournamentId}
    order by vup.position asc, u.username asc
  `);
  return rows.map((r) => ({
    user_id: r.user_id,
    username: r.username,
    total_points: Number(r.total_points),
    position: Number(r.position),
  }));
}
