/**
 * Currently-open stage windows for the home page's "Avatud aknad" block.
 *
 * Reads `stages` rows for the active tournament where `now()` falls inside
 * `[opens_at, closes_at]`. Pattern mirrors lib/stages/is-stage-open.ts — pure
 * filtering on top of a thin DB getter so unit tests can stub the data layer.
 */
import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { stages, type Stage } from '@/db/schema';

export type StageCode =
  | 'trivia'
  | 'group_matches'
  | 'best_thirds'
  | 'r32'
  | 'r16'
  | 'qf'
  | 'sf'
  | 'final';

export interface StageRow {
  code: StageCode;
  position: number;
  opens_at: Date;
  closes_at: Date;
}

export function filterOpenWindows(rows: readonly StageRow[], now: Date): StageRow[] {
  return rows.filter((r) => now >= r.opens_at && now <= r.closes_at);
}

export function filterUpcomingWindows(rows: readonly StageRow[], now: Date): StageRow[] {
  return rows.filter((r) => now < r.opens_at);
}

/**
 * Stages whose prediction window has already closed. Used by the home page's
 * "Suletud aknad" card so a player can still reach the surface in read-only
 * mode after the gate has shut. Result is ordered most-recently-closed first.
 */
export function filterClosedWindows(rows: readonly StageRow[], now: Date): StageRow[] {
  return rows
    .filter((r) => now > r.closes_at)
    .slice()
    .sort((a, b) => b.closes_at.getTime() - a.closes_at.getTime());
}

export interface GetOpenStagesDeps {
  findStages: (tournamentId: string) => Promise<StageRow[]>;
  now?: () => Date;
}

async function findStagesDb(tournamentId: string): Promise<StageRow[]> {
  const rows = await db
    .select({
      code: stages.code,
      position: stages.position,
      opens_at: stages.opens_at,
      closes_at: stages.closes_at,
    })
    .from(stages)
    .where(eq(stages.tournament_id, tournamentId))
    .orderBy(asc(stages.position));
  return rows.map(toStageRow);
}

function toStageRow(row: Pick<Stage, 'code' | 'position' | 'opens_at' | 'closes_at'>): StageRow {
  return {
    code: row.code as StageCode,
    position: row.position,
    opens_at: row.opens_at,
    closes_at: row.closes_at,
  };
}

export async function getOpenStages(
  tournamentId: string,
  deps: GetOpenStagesDeps = { findStages: findStagesDb },
): Promise<StageRow[]> {
  const all = await deps.findStages(tournamentId);
  const now = (deps.now ?? (() => new Date()))();
  return filterOpenWindows(all, now);
}

export async function getUpcomingStages(
  tournamentId: string,
  deps: GetOpenStagesDeps = { findStages: findStagesDb },
): Promise<StageRow[]> {
  const all = await deps.findStages(tournamentId);
  const now = (deps.now ?? (() => new Date()))();
  return filterUpcomingWindows(all, now);
}

export async function getClosedStages(
  tournamentId: string,
  deps: GetOpenStagesDeps = { findStages: findStagesDb },
): Promise<StageRow[]> {
  const all = await deps.findStages(tournamentId);
  const now = (deps.now ?? (() => new Date()))();
  return filterClosedWindows(all, now);
}
