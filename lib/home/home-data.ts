/**
 * Home dashboard composer. One function per UX-spec §5 block. The Server
 * Component at `app/page.tsx` calls `getHomeData()` and renders the view-model;
 * no aggregation lives in TS.
 *
 * The composer is dep-injected so unit tests can drive empty-state branches
 * without a database.
 */
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { getPlayerHistory } from '@/lib/me/history/queries';
import { isFinalEnded as isFinalEndedDb } from '@/lib/roast/queries';
import { users } from '@/db/schema';
import {
  getClosedStages,
  getOpenStages,
  getUpcomingStages,
  type StageCode,
  type StageRow,
} from './open-windows';
import {
  formatProgress,
  getStageProgress,
  type StageProgress,
} from './progress';

export interface OpenWindowCard {
  code: StageCode;
  labelEt: string;
  ctaHref: string;
  closesAt: Date;
  progress: StageProgress;
  progressLabel: string;
}

export interface UpcomingWindowCard {
  code: StageCode;
  labelEt: string;
  ctaHref: string;
  opensAt: Date;
}

/**
 * Stage whose prediction window has already closed. The surface stays
 * reachable in read-only mode via `ctaHref`; the home dashboard renders one
 * of these rows in the "Suletud aknad" card per UX spec §6 follow-up.
 */
export interface ClosedWindowCard {
  code: StageCode;
  labelEt: string;
  ctaHref: string;
  closesAt: Date;
  progress: StageProgress;
  progressLabel: string;
}

export interface LegacyHistoryRow {
  tournamentName: string;
  tournamentCode: string;
  totalPoints: number;
  finishingPosition: number;
}

export interface CrossTournamentRow {
  userId: string;
  username: string;
  totalPoints: number;
}

export interface CurrentScore {
  totalPoints: number;
  position: number | null;
}

export interface HomeData {
  greeting: { playerName: string; groupName: string };
  openWindows: OpenWindowCard[];
  upcomingWindows: UpcomingWindowCard[];
  closedWindows: ClosedWindowCard[];
  roastUnlocked: boolean;
  currentScore: CurrentScore;
  legacyPreview: LegacyHistoryRow[];
  crossTournamentPreview: CrossTournamentRow[];
}

export const STAGE_LABEL_ET: Record<StageCode, string> = {
  trivia: 'Trivia',
  group_matches: 'Grupimängude ennustused',
  best_thirds: '8 parima kolmanda valik',
  r32: '16-paari faasi (R32) meeskondade valik',
  r16: 'Veerandfinaali-eel (R16) meeskondade valik',
  qf: 'Veerandfinaalide (QF) meeskondade valik',
  sf: 'Poolfinaalide (SF) meeskondade valik',
  final: 'Finaali ennustus (F1/F2/F3/F4)',
};

const STAGE_CTA_HREF: Record<StageCode, string> = {
  trivia: '/predict/trivia',
  group_matches: '/predict/group-stage',
  best_thirds: '/predict/best-thirds',
  r32: '/predict/knockout/r32',
  r16: '/predict/knockout/r16',
  qf: '/predict/knockout/qf',
  sf: '/predict/knockout/sf',
  final: '/predict/final',
};

export interface HomeDataDeps {
  loadPlayerName: (userId: string) => Promise<string>;
  loadOpenStages: (tournamentId: string) => Promise<StageRow[]>;
  loadUpcomingStages: (tournamentId: string) => Promise<StageRow[]>;
  loadClosedStages: (tournamentId: string) => Promise<StageRow[]>;
  loadStageProgress: (
    code: StageCode,
    userId: string,
    tournamentId: string,
  ) => Promise<StageProgress>;
  isFinalEnded: (tournamentId: string) => Promise<boolean>;
  loadCurrentScore: (
    userId: string,
    groupId: string,
    tournamentId: string,
  ) => Promise<CurrentScore>;
  loadLegacyPreview: (
    userId: string,
    groupId: string,
  ) => Promise<LegacyHistoryRow[]>;
  loadCrossTournamentPreview: (groupId: string) => Promise<CrossTournamentRow[]>;
}

export interface HomeInput {
  userId: string;
  groupId: string;
  groupName: string;
  tournamentId: string;
}

export async function getHomeData(
  input: HomeInput,
  deps: HomeDataDeps = defaultDeps,
): Promise<HomeData> {
  const [
    playerName,
    openStageRows,
    upcomingStageRows,
    closedStageRows,
    roastUnlocked,
    currentScore,
    legacyPreview,
    crossTournamentPreview,
  ] = await Promise.all([
    deps.loadPlayerName(input.userId),
    deps.loadOpenStages(input.tournamentId),
    deps.loadUpcomingStages(input.tournamentId),
    deps.loadClosedStages(input.tournamentId),
    deps.isFinalEnded(input.tournamentId),
    deps.loadCurrentScore(input.userId, input.groupId, input.tournamentId),
    deps.loadLegacyPreview(input.userId, input.groupId),
    deps.loadCrossTournamentPreview(input.groupId),
  ]);

  const openWindows = await Promise.all(
    openStageRows.map(async (row): Promise<OpenWindowCard> => {
      const progress = await deps.loadStageProgress(row.code, input.userId, input.tournamentId);
      return {
        code: row.code,
        labelEt: STAGE_LABEL_ET[row.code],
        ctaHref: STAGE_CTA_HREF[row.code],
        closesAt: row.closes_at,
        progress,
        progressLabel: formatProgress(progress),
      };
    }),
  );

  const upcomingWindows: UpcomingWindowCard[] = upcomingStageRows.map((row) => ({
    code: row.code,
    labelEt: STAGE_LABEL_ET[row.code],
    ctaHref: STAGE_CTA_HREF[row.code],
    opensAt: row.opens_at,
  }));

  const closedWindows = await Promise.all(
    closedStageRows.map(async (row): Promise<ClosedWindowCard> => {
      const progress = await deps.loadStageProgress(row.code, input.userId, input.tournamentId);
      return {
        code: row.code,
        labelEt: STAGE_LABEL_ET[row.code],
        ctaHref: STAGE_CTA_HREF[row.code],
        closesAt: row.closes_at,
        progress,
        progressLabel: formatProgress(progress),
      };
    }),
  );

  return {
    greeting: { playerName, groupName: input.groupName },
    openWindows,
    upcomingWindows,
    closedWindows,
    roastUnlocked,
    currentScore,
    legacyPreview,
    crossTournamentPreview,
  };
}

// ---- default DB-backed deps ---------------------------------------------

async function loadPlayerNameDb(userId: string): Promise<string> {
  const rows = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.username ?? 'mängija';
}

async function loadCurrentScoreDb(
  userId: string,
  groupId: string,
  tournamentId: string,
): Promise<CurrentScore> {
  const { rows } = await db.execute<{ total_points: number | string; position: number | string }>(sql`
    select total_points, position
      from v_user_points
     where user_id = ${userId}
       and group_id = ${groupId}
       and tournament_id = ${tournamentId}
     limit 1
  `);
  const row = rows[0];
  if (!row) return { totalPoints: 0, position: null };
  return { totalPoints: Number(row.total_points), position: Number(row.position) };
}

async function loadLegacyPreviewDb(
  userId: string,
  groupId: string,
): Promise<LegacyHistoryRow[]> {
  const rows = await getPlayerHistory(userId, groupId);
  return rows.slice(0, 3).map((r) => ({
    tournamentName: r.tournamentName,
    tournamentCode: r.tournamentCode,
    totalPoints: r.totalPoints,
    finishingPosition: r.finishingPosition,
  }));
}

async function loadCrossTournamentPreviewDb(
  groupId: string,
): Promise<CrossTournamentRow[]> {
  const { rows } = await db.execute<{
    user_id: string;
    username: string;
    total_points: number | string;
  }>(sql`
    select
      vct.user_id,
      u.username,
      sum(vct.total_points)::int as total_points
    from v_user_cross_tournament vct
    join users u on u.id = vct.user_id
    where vct.group_id = ${groupId}
      and u.is_system_user = false
    group by vct.user_id, u.username
    order by total_points desc, u.username asc
    limit 3
  `);
  return rows.map((r) => ({
    userId: r.user_id,
    username: r.username,
    totalPoints: Number(r.total_points),
  }));
}

const defaultDeps: HomeDataDeps = {
  loadPlayerName: loadPlayerNameDb,
  loadOpenStages: (tournamentId) => getOpenStages(tournamentId),
  loadUpcomingStages: (tournamentId) => getUpcomingStages(tournamentId),
  loadClosedStages: (tournamentId) => getClosedStages(tournamentId),
  loadStageProgress: (code, userId, tournamentId) =>
    getStageProgress(code, userId, tournamentId),
  isFinalEnded: isFinalEndedDb,
  loadCurrentScore: loadCurrentScoreDb,
  loadLegacyPreview: loadLegacyPreviewDb,
  loadCrossTournamentPreview: loadCrossTournamentPreviewDb,
};
