'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { getCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { log } from '@/lib/log';
import { isStageOpen } from '@/lib/stages/is-stage-open';
import { getCurrentTournamentId } from '@/lib/tournaments/current';
import { questions, teams, user_questions } from '@/db/schema';
import { ANSWER_MAX_LEN, REQUIRED_ANSWERS, TRIVIA_STAGE_CODE } from './constants';

export type SubmitTriviaError =
  | 'no_session'
  | 'no_user'
  | 'invalid_count'
  | 'invalid_position'
  | 'empty_answer'
  | 'invalid_integer'
  | 'invalid_team'
  | 'too_long'
  | 'unknown_question'
  | 'stage_closed'
  | 'stage_not_yet'
  | 'stage_not_found';

export interface SubmitTriviaState {
  ok?: boolean;
  error?: SubmitTriviaError;
}

interface ParsedAnswer {
  position: number;
  answer: string;
}

function parseFormAnswers(formData: FormData): ParsedAnswer[] | SubmitTriviaError {
  const parsed: ParsedAnswer[] = [];
  const seen = new Set<number>();

  for (let pos = 1; pos <= REQUIRED_ANSWERS; pos++) {
    const raw = formData.get(`answer_${pos}`);
    if (raw === null) {
      return 'invalid_count';
    }
    const answer = String(raw).trim();
    if (answer.length === 0) {
      return 'empty_answer';
    }
    if (answer.length > ANSWER_MAX_LEN) {
      return 'too_long';
    }
    if (seen.has(pos)) {
      return 'invalid_position';
    }
    seen.add(pos);
    parsed.push({ position: pos, answer });
  }
  return parsed;
}

export async function submitTrivia(
  _prev: SubmitTriviaState,
  formData: FormData,
): Promise<SubmitTriviaState> {
  const session = await auth();
  if (!session?.user?.group_id) {
    return { error: 'no_session' };
  }
  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: 'no_user' };
  }

  const parsed = parseFormAnswers(formData);
  if (typeof parsed === 'string') {
    return { error: parsed };
  }

  const tournamentId = await getCurrentTournamentId();

  const gate = await isStageOpen(TRIVIA_STAGE_CODE, tournamentId);
  if (!gate.open) {
    log.warn({
      operation: 'submit_trivia',
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
        inArray(
          questions.position,
          parsed.map((p) => p.position),
        ),
      ),
    );

  if (questionRows.length !== REQUIRED_ANSWERS) {
    return { error: 'unknown_question' };
  }

  const questionByPosition = new Map(questionRows.map((q) => [q.position, q]));
  const hasTeamShape = questionRows.some((q) => q.answer_shape === 'team');
  const validTeamCodes = hasTeamShape
    ? new Set(
        (
          await db
            .select({ code: teams.code })
            .from(teams)
            .where(eq(teams.tournament_id, tournamentId))
        ).map((t) => t.code),
      )
    : new Set<string>();
  for (const p of parsed) {
    const q = questionByPosition.get(p.position);
    if (!q) {
      return { error: 'unknown_question' };
    }
    if (q.answer_shape === 'integer' && !/^-?\d+$/.test(p.answer)) {
      return { error: 'invalid_integer' };
    }
    if (q.answer_shape === 'team' && !validTeamCodes.has(p.answer)) {
      return { error: 'invalid_team' };
    }
  }

  await db.transaction(async (tx) => {
    for (const p of parsed) {
      const q = questionByPosition.get(p.position)!;
      // Resetting `points` to null on re-submit invalidates any stale scoring
      // until the operator's next recompute. Constitution Rule 6: scoring
      // math lives in lib/scoring/, not here.
      await tx
        .insert(user_questions)
        .values({
          user_id: userId,
          question_id: q.id,
          answer: p.answer,
          points: null,
        })
        .onConflictDoUpdate({
          target: [user_questions.user_id, user_questions.question_id],
          set: {
            answer: p.answer,
            points: null,
            updated_at: new Date(),
          },
        });
    }
  });

  log.info({
    operation: 'submit_trivia',
    outcome: 'ok',
    user_id: userId,
    tournament_id: tournamentId,
    group_id: session.user.group_id,
    answers_written: parsed.length,
  });

  return { ok: true };
}
