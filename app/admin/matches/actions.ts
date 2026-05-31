'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { log } from '@/lib/log';
import { checkOperator } from '@/lib/operator/require-operator';
import { recomputeMatch, GROUP_STAGE_CODE } from '@/lib/recompute/match';
import { games } from '@/db/schema';

const ALLOWED_FINAL_STATUSES = new Set([
  'FINISHED',
  'AWARDED',
  'POSTPONED',
  'CANCELLED',
  'SUSPENDED',
  'IN_PLAY',
  'PAUSED',
  'TIMED',
  'SCHEDULED',
]);

const ALLOWED_FINISH_TYPES = new Set(['NORMAL_TIME', 'EXTRA_TIME', 'PENALTIES']);

export type SubmitMatchResultError =
  | 'no_session'
  | 'not_operator'
  | 'game_not_found'
  | 'invalid_score'
  | 'invalid_status'
  | 'missing_finish_type'
  | 'invalid_finish_type';

export interface SubmitMatchResultState {
  ok?: boolean;
  error?: SubmitMatchResultError;
  game_id?: string;
}

function parseScore(raw: FormDataEntryValue | null): number | null | 'invalid' {
  if (raw === null) return null;
  const text = String(raw).trim();
  if (text === '') return null;
  const n = Number(text);
  if (!Number.isInteger(n) || n < 0 || n > 99) return 'invalid';
  return n;
}

export async function submitMatchResult(
  _prev: SubmitMatchResultState,
  formData: FormData,
): Promise<SubmitMatchResultState> {
  const gameId = String(formData.get('game_id') ?? '').trim();
  if (!gameId) {
    return { error: 'game_not_found' };
  }

  const currentUserId = await getCurrentUserId();
  const gate = await checkOperator(currentUserId);
  if (!gate.ok) {
    log.warn({
      operation: 'admin_submit_match_result',
      outcome: 'rejected',
      reason: gate.reason ?? 'unknown',
      game_id: gameId,
      user_id: currentUserId ?? null,
    });
    return { error: gate.reason === 'no_user' ? 'no_session' : 'not_operator', game_id: gameId };
  }

  const scoreHome = parseScore(formData.get('score_home'));
  const scoreAway = parseScore(formData.get('score_away'));
  const finalStatusRaw = formData.get('final_status');
  const finalStatus =
    finalStatusRaw === null || String(finalStatusRaw).trim() === ''
      ? null
      : String(finalStatusRaw).trim();
  const finishTypeRaw = formData.get('finish_type');
  const finishType =
    finishTypeRaw === null || String(finishTypeRaw).trim() === ''
      ? null
      : String(finishTypeRaw).trim();

  if (scoreHome === 'invalid' || scoreAway === 'invalid') {
    return { error: 'invalid_score', game_id: gameId };
  }
  if (finalStatus !== null && !ALLOWED_FINAL_STATUSES.has(finalStatus)) {
    return { error: 'invalid_status', game_id: gameId };
  }
  if (finishType !== null && !ALLOWED_FINISH_TYPES.has(finishType)) {
    return { error: 'invalid_finish_type', game_id: gameId };
  }

  const result = await db.transaction(async (tx) => {
    const existingRows = await tx
      .select({
        stage_code: games.stage_code,
        score_home: games.score_home,
        score_away: games.score_away,
        final_status: games.final_status,
        finish_type: games.finish_type,
        result_code: games.result_code,
      })
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1);
    const existing = existingRows[0];
    if (!existing) {
      return { kind: 'not_found' as const };
    }

    // Knockout rows require an explicit finish_type when a final status is set.
    // Group-stage rows store NULL regardless of any incoming value (the
    // recompute branch ignores it).
    const isKnockout = existing.stage_code !== GROUP_STAGE_CODE;
    const persistedFinishType = isKnockout ? finishType : null;

    await tx
      .update(games)
      .set({
        score_home: scoreHome,
        score_away: scoreAway,
        final_status: finalStatus,
        finish_type: persistedFinishType,
      })
      .where(eq(games.id, gameId));

    const rescore = await recomputeMatch(gameId, tx);
    return { kind: 'ok' as const, existing, rescore };
  });

  if (result.kind === 'not_found') {
    log.warn({
      operation: 'admin_submit_match_result',
      outcome: 'rejected',
      reason: 'game_not_found',
      operator_user_id: gate.userId ?? null,
      game_id: gameId,
    });
    return { error: 'game_not_found', game_id: gameId };
  }

  const persistedFinishType =
    result.existing.stage_code !== GROUP_STAGE_CODE ? finishType : null;
  log.info({
    operation: 'admin_submit_match_result',
    outcome: 'ok',
    operator_user_id: gate.userId ?? null,
    game_id: gameId,
    stage_code: result.existing.stage_code,
    prior_score: `${result.existing.score_home ?? '-'}-${result.existing.score_away ?? '-'}`,
    new_score: `${scoreHome ?? '-'}-${scoreAway ?? '-'}`,
    prior_result_code: result.existing.result_code ?? null,
    new_result_code: result.rescore.result_code,
    final_status: finalStatus,
    prior_finish_type: result.existing.finish_type ?? null,
    new_finish_type: persistedFinishType,
    predictions_rescored: result.rescore.rescored,
    rescore_outcome: result.rescore.outcome,
    clear_reason: result.rescore.clear_reason ?? null,
  });

  revalidatePath('/admin/matches');

  // The DB write succeeded, but the recompute couldn't derive a result_code
  // because the operator needs to fix one more input. Surface this to them.
  if (result.rescore.outcome === 'cleared') {
    if (result.rescore.clear_reason === 'missing_finish_type') {
      return { error: 'missing_finish_type', game_id: gameId };
    }
  }

  return { ok: true, game_id: gameId };
}
