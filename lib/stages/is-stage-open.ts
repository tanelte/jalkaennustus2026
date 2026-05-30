import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { stages } from '@/db/schema';

export type StageGateReason = 'not_yet' | 'closed' | 'not_found';

export interface StageGateResult {
  open: boolean;
  reason?: StageGateReason;
  opensAt?: Date;
  closesAt?: Date;
}

export interface StageWindow {
  opens_at: Date;
  closes_at: Date;
}

/**
 * Evaluate a stage window against a clock. Pure given the row. Exported so callers
 * (and tests) can reason about state independently of the db read.
 */
export function evaluateStageWindow(
  window: StageWindow | null,
  now: Date,
): StageGateResult {
  if (!window) return { open: false, reason: 'not_found' };
  if (now < window.opens_at) {
    return {
      open: false,
      reason: 'not_yet',
      opensAt: window.opens_at,
      closesAt: window.closes_at,
    };
  }
  if (now > window.closes_at) {
    return {
      open: false,
      reason: 'closed',
      opensAt: window.opens_at,
      closesAt: window.closes_at,
    };
  }
  return { open: true, opensAt: window.opens_at, closesAt: window.closes_at };
}

export interface IsStageOpenDeps {
  findStageWindow: (
    stageCode: string,
    tournamentId: string,
  ) => Promise<StageWindow | null>;
  now?: () => Date;
}

async function findStageWindowDb(
  stageCode: string,
  tournamentId: string,
): Promise<StageWindow | null> {
  const rows = await db
    .select({ opens_at: stages.opens_at, closes_at: stages.closes_at })
    .from(stages)
    .where(and(eq(stages.code, stageCode), eq(stages.tournament_id, tournamentId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Constitution Critical Rule 5: every prediction-write Server Action consults
 * this gate server-side before persisting. Pass a stage code (e.g. 'best_thirds')
 * and the current tournament id.
 */
export async function isStageOpen(
  stageCode: string,
  tournamentId: string,
  deps: IsStageOpenDeps = { findStageWindow: findStageWindowDb },
): Promise<StageGateResult> {
  const window = await deps.findStageWindow(stageCode, tournamentId);
  const now = (deps.now ?? (() => new Date()))();
  return evaluateStageWindow(window, now);
}
