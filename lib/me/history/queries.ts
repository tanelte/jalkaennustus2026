/**
 * Per-player history-trail read query (S14). Joins frozen-as-scored legacy
 * totals onto tournament metadata, scoped to one (user, group) per the
 * group-as-login invariant. No aggregation in TS (Constitution Rule 7).
 */
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { legacy_tournament_scores, tournaments } from '@/db/schema';

export interface HistoryRow {
  tournamentCode: string;
  tournamentName: string;
  startsAt: Date;
  totalPoints: number;
  finishingPosition: number;
}

export async function getPlayerHistory(
  userId: string,
  groupId: string,
): Promise<HistoryRow[]> {
  const rows = await db
    .select({
      tournamentCode: tournaments.code,
      tournamentName: tournaments.name,
      startsAt: tournaments.starts_at,
      totalPoints: legacy_tournament_scores.total_points,
      finishingPosition: legacy_tournament_scores.finishing_position,
    })
    .from(legacy_tournament_scores)
    .innerJoin(
      tournaments,
      eq(tournaments.id, legacy_tournament_scores.tournament_id),
    )
    .where(
      and(
        eq(legacy_tournament_scores.user_id, userId),
        eq(legacy_tournament_scores.group_id, groupId),
      ),
    )
    .orderBy(desc(tournaments.starts_at));

  return rows.map((r) => ({
    tournamentCode: r.tournamentCode,
    tournamentName: r.tournamentName,
    startsAt: r.startsAt,
    totalPoints: r.totalPoints,
    finishingPosition: r.finishingPosition,
  }));
}
