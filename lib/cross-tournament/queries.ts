/**
 * Cross-tournament leaderboard read queries (S15).
 *
 * Aggregation (SUM, ranking) lives in SQL per Constitution Rule 6 and the S15 AC
 * "the leaderboard query reads from v_user_cross_tournament — no aggregation
 * logic in TypeScript". The pure pivot helper in ./build-matrix.ts only does
 * structural index lookups.
 */
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import type {
  CrossTournamentCellInput,
  CrossTournamentColumn,
  CrossTournamentTotalInput,
} from './build-matrix';

export async function getGroupTournaments(
  groupId: string,
): Promise<CrossTournamentColumn[]> {
  const { rows } = await db.execute<{
    id: string;
    code: string;
    name: string;
  }>(sql`
    select distinct t.id, t.code, t.name, t.starts_at
    from v_user_cross_tournament vct
    join tournaments t on t.id = vct.tournament_id
    where vct.group_id = ${groupId}
    order by t.starts_at asc, t.code asc
  `);
  return rows.map((r) => ({ id: r.id, code: r.code, name: r.name }));
}

export async function getGroupCrossTournamentCells(
  groupId: string,
): Promise<CrossTournamentCellInput[]> {
  const { rows } = await db.execute<{
    user_id: string;
    username: string;
    tournament_id: string;
    total_points: number | string;
    finishing_position: number | string | null;
  }>(sql`
    select vct.user_id,
           u.username,
           vct.tournament_id,
           vct.total_points,
           vct.finishing_position
    from v_user_cross_tournament vct
    join users u on u.id = vct.user_id
    where vct.group_id = ${groupId}
      and u.is_system_user = false
  `);
  return rows.map((r) => ({
    user_id: r.user_id,
    username: r.username,
    tournament_id: r.tournament_id,
    total_points: Number(r.total_points),
    finishing_position: r.finishing_position == null ? null : Number(r.finishing_position),
  }));
}

export async function getGroupCrossTournamentTotals(
  groupId: string,
): Promise<CrossTournamentTotalInput[]> {
  const { rows } = await db.execute<{
    user_id: string;
    username: string;
    total_points: number | string;
  }>(sql`
    select vct.user_id,
           u.username,
           sum(vct.total_points)::int as total_points
    from v_user_cross_tournament vct
    join users u on u.id = vct.user_id
    where vct.group_id = ${groupId}
      and u.is_system_user = false
    group by vct.user_id, u.username
    having sum(vct.total_points) > 0
    order by total_points desc, u.username asc
  `);
  return rows.map((r) => ({
    user_id: r.user_id,
    username: r.username,
    total_points: Number(r.total_points),
  }));
}
