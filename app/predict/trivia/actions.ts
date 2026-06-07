'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { getCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { log } from '@/lib/log';
import { assertEditAllowedForUser } from '@/lib/pin/guard';
import { isStageOpen } from '@/lib/stages/is-stage-open';
import { getCurrentTournamentId } from '@/lib/tournaments/current';
import { questions, teams, user_questions } from '@/db/schema';
import { ANSWER_MAX_LEN, TRIVIA_STAGE_CODE } from './constants';

export type SaveTriviaAnswerError =
  | 'no_session'
  | 'no_user'
  | 'invalid_position'
  | 'too_long'
  | 'invalid_integer'
  | 'invalid_team'
  | 'unknown_question'
  | 'stage_closed'
  | 'stage_not_yet'
  | 'stage_not_found'
  | 'pin_required'
  | 'pin_rate_limited';

export interface SaveTriviaAnswerState {
  ok?: boolean;
  error?: SaveTriviaAnswerError;
}

/**
 * Per-question upsert. Empty/null `answer` deletes the row (player cleared the
 * field). Resets `points` to null on each write — the operator's next
 * recompute reassigns scoring. Constitution Rule 6 keeps scoring math in
 * `lib/scoring/`; this action only persists raw answers.
 */
export async function saveTriviaAnswer(
  position: number,
  answer: string | null,
): Promise<SaveTriviaAnswerState> {
  const session = await auth();
  if (!session?.user?.group_id) {
    return { error: 'no_session' };
  }
  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: 'no_user' };
  }

  if (!Number.isInteger(position) || position < 1) {
    return { error: 'invalid_position' };
  }

  const trimmed = answer === null ? '' : String(answer).trim();
  if (trimmed.length > ANSWER_MAX_LEN) {
    return { error: 'too_long' };
  }

  const tournamentId = await getCurrentTournamentId();

  const gate = await isStageOpen(TRIVIA_STAGE_CODE, tournamentId);
  if (!gate.open) {
    log.warn({
      operation: 'save_trivia_answer',
      outcome: 'rejected',
      reason: `stage_${gate.reason}`,
      user_id: userId,
      tournament_id: tournamentId,
    });
    return {
      error:
        gate.reason === 'closed'
          ? 'stage_closed'
          : gate.reason === 'not_yet'
          ? 'stage_not_yet'
          : 'stage_not_found',
    };
  }

  // E03 PIN guard sits AFTER the stage gate and BEFORE any DB read for writes.
  const pinGate = await assertEditAllowedForUser({
    groupId: session.user.group_id,
    userId,
  });
  if (!pinGate.ok) {
    log.warn({
      operation: 'save_trivia_answer',
      outcome: 'rejected',
      reason: pinGate.reason,
      user_id: userId,
      group_id: session.user.group_id,
      tournament_id: tournamentId,
    });
    return { error: pinGate.reason };
  }

  const questionRows = await db
    .select({
      id: questions.id,
      position: questions.position,
      answer_shape: questions.answer_shape,
    })
    .from(questions)
    .where(
      and(
        eq(questions.tournament_id, tournamentId),
        eq(questions.position, position),
      ),
    );

  if (questionRows.length === 0) {
    return { error: 'unknown_question' };
  }
  const q = questionRows[0];

  if (trimmed.length === 0) {
    await db
      .delete(user_questions)
      .where(
        and(eq(user_questions.user_id, userId), eq(user_questions.question_id, q.id)),
      );
    log.info({
      operation: 'save_trivia_answer',
      outcome: 'cleared',
      user_id: userId,
      tournament_id: tournamentId,
      group_id: session.user.group_id,
      position,
    });
    revalidatePath('/');
    revalidatePath('/leaderboard');
    return { ok: true };
  }

  if (q.answer_shape === 'integer' && !/^-?\d+$/.test(trimmed)) {
    return { error: 'invalid_integer' };
  }
  if (q.answer_shape === 'team') {
    const teamRows = await db
      .select({ code: teams.code })
      .from(teams)
      .where(and(eq(teams.tournament_id, tournamentId), eq(teams.code, trimmed)));
    if (teamRows.length === 0) {
      return { error: 'invalid_team' };
    }
  }

  await db
    .insert(user_questions)
    .values({
      user_id: userId,
      question_id: q.id,
      answer: trimmed,
      points: null,
    })
    .onConflictDoUpdate({
      target: [user_questions.user_id, user_questions.question_id],
      set: {
        answer: trimmed,
        points: null,
        updated_at: new Date(),
      },
    });

  log.info({
    operation: 'save_trivia_answer',
    outcome: 'ok',
    user_id: userId,
    tournament_id: tournamentId,
    group_id: session.user.group_id,
    position,
  });

  revalidatePath('/');
  revalidatePath('/leaderboard');

  return { ok: true };
}
