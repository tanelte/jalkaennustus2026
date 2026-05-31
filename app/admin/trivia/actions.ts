'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { log } from '@/lib/log';
import { checkOperator } from '@/lib/operator/require-operator';
import { recomputeTrivia } from '@/lib/recompute/trivia';
import { getCurrentTournamentId } from '@/lib/tournaments/current';
import { questions } from '@/db/schema';
import { REQUIRED_ANSWERS, ANSWER_MAX_LEN } from '@/app/predict/trivia/constants';

export type ConfirmTriviaError =
  | 'no_session'
  | 'not_operator'
  | 'invalid_position'
  | 'invalid_integer'
  | 'too_long';

export interface ConfirmTriviaState {
  ok?: boolean;
  error?: ConfirmTriviaError;
  rescored?: number;
}

interface ParsedOfficial {
  position: number;
  // Empty string means "clear this answer back to null".
  answer: string;
}

export async function confirmTriviaAnswers(
  _prev: ConfirmTriviaState,
  formData: FormData,
): Promise<ConfirmTriviaState> {
  const currentUserId = await getCurrentUserId();
  const gate = await checkOperator(currentUserId);
  if (!gate.ok) {
    log.warn({
      operation: 'admin_confirm_trivia',
      outcome: 'rejected',
      reason: gate.reason ?? 'unknown',
      user_id: currentUserId ?? null,
    });
    return { error: gate.reason === 'no_user' ? 'no_session' : 'not_operator' };
  }

  const parsed: ParsedOfficial[] = [];
  for (let pos = 1; pos <= REQUIRED_ANSWERS; pos++) {
    const raw = formData.get(`official_${pos}`);
    const answer = raw === null ? '' : String(raw).trim();
    if (answer.length > ANSWER_MAX_LEN) {
      return { error: 'too_long' };
    }
    parsed.push({ position: pos, answer });
  }

  const tournamentId = await getCurrentTournamentId();

  const questionRows = await db
    .select({
      id: questions.id,
      position: questions.position,
      answer_shape: questions.answer_shape,
    })
    .from(questions)
    .where(eq(questions.tournament_id, tournamentId));

  const byPosition = new Map(questionRows.map((q) => [q.position, q]));

  for (const p of parsed) {
    const q = byPosition.get(p.position);
    if (!q) {
      return { error: 'invalid_position' };
    }
    if (p.answer.length > 0 && q.answer_shape === 'integer' && !/^-?\d+$/.test(p.answer)) {
      return { error: 'invalid_integer' };
    }
  }

  let result: { rescored: number; affectedUsers: number };
  await db.transaction(async (tx) => {
    for (const p of parsed) {
      const q = byPosition.get(p.position)!;
      await tx
        .update(questions)
        .set({ correct_answer: p.answer.length > 0 ? p.answer : null })
        .where(
          and(
            eq(questions.id, q.id),
            eq(questions.tournament_id, tournamentId),
          ),
        );
    }
    result = await recomputeTrivia(tournamentId, tx);
  });

  log.info({
    operation: 'admin_confirm_trivia',
    outcome: 'ok',
    operator_user_id: gate.userId ?? null,
    tournament_id: tournamentId,
    answers_written: parsed.filter((p) => p.answer.length > 0).length,
    predictions_rescored: result!.rescored,
    affected_users: result!.affectedUsers,
  });

  revalidatePath('/admin/trivia');
  revalidatePath('/leaderboard');

  return { ok: true, rescored: result!.rescored };
}
