import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { questions, user_questions } from '@/db/schema';
import { scoreTrivia, type TriviaAnswerInput, type TriviaPosition } from '@/lib/scoring/trivia-score';
import { TRIVIA_QUESTION_COUNT } from '@/lib/scoring/weights';

const TRIVIA_POSITIONS = [1, 2, 3, 4, 5] as const satisfies readonly TriviaPosition[];

export interface OfficialQuestion {
  position: TriviaPosition;
  answer_shape: string;
  correct_answer: string | null;
  conditional_on_position: TriviaPosition | null;
}

export interface PlayerAnswerRow {
  id: string;
  user_id: string;
  position: TriviaPosition;
  answer: string;
}

export interface TriviaRescoreRow {
  id: string;
  points: number | null;
}

/**
 * Compare one player's answer to the official correct answer, respecting the
 * answer's `answer_shape`. Returns `null` if the official answer is not yet
 * known (the operator hasn't entered it). Equality is case-insensitive and
 * whitespace-trimmed for text/team; integer is parsed both sides.
 */
export function judgeAnswer(
  playerAnswer: string,
  official: string | null,
  answerShape: string,
): boolean | null {
  if (official === null) return null;
  const o = official.trim();
  const p = playerAnswer.trim();
  if (o.length === 0) return null;

  if (answerShape === 'integer') {
    const op = Number.parseInt(o, 10);
    const pp = Number.parseInt(p, 10);
    if (Number.isNaN(op) || Number.isNaN(pp)) return false;
    return op === pp;
  }
  return o.toLowerCase() === p.toLowerCase();
}

/**
 * Pure: given the 5 official questions and one player's 5 answer rows, return
 * the points each row should be re-written to. `null` means we can't judge yet
 * (one or more official answers not entered). When all 5 officials exist we
 * delegate to `scoreTrivia` which applies the Q5-conditional-on-Q4 trick.
 */
export function computePointsForPlayerAnswers(
  officials: readonly OfficialQuestion[],
  playerRows: readonly PlayerAnswerRow[],
): TriviaRescoreRow[] {
  const officialByPosition = new Map(officials.map((o) => [o.position, o]));
  const rowByPosition = new Map(playerRows.map((r) => [r.position, r]));

  const judgements = new Map<TriviaPosition, boolean | null>();
  for (const pos of TRIVIA_POSITIONS) {
    const off = officialByPosition.get(pos);
    const row = rowByPosition.get(pos);
    if (!off || !row) {
      judgements.set(pos, null);
      continue;
    }
    judgements.set(pos, judgeAnswer(row.answer, off.correct_answer, off.answer_shape));
  }

  // If any official is still missing for a position the player has, that
  // row's points stay null. We still try to score the rows we can judge.
  const allKnown = TRIVIA_POSITIONS.every((p) => judgements.get(p) !== null);
  if (!allKnown) {
    return playerRows.map((r) => ({
      id: r.id,
      points: null,
    }));
  }

  const inputs: TriviaAnswerInput[] = TRIVIA_POSITIONS.map((pos) => ({
    position: pos,
    isCorrect: judgements.get(pos) === true,
    conditionalOnPosition: officialByPosition.get(pos)?.conditional_on_position ?? null,
  }));

  const scored = scoreTrivia(inputs);
  const pointsByPosition = new Map(scored.perAnswer.map((s) => [s.position, s.points]));

  return playerRows.map((r) => ({
    id: r.id,
    points: pointsByPosition.get(r.position) ?? 0,
  }));
}

export interface RecomputeTriviaResult {
  rescored: number;
  affectedUsers: number;
}

type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Orchestrator. Loads the 5 official questions for the tournament + every
 * player's `user_questions` rows; writes back updated points.
 *
 * Constitution Rule 8: invoked from the operator-confirm Server Action after
 * `questions.correct_answer` is updated. Scope is tournament-wide (trivia is
 * a tournament-scoped surface, not per-match).
 */
export async function recomputeTrivia(
  tournamentId: string,
  tx?: DbExecutor,
): Promise<RecomputeTriviaResult> {
  if (!tx) {
    return db.transaction((innerTx) => recomputeTrivia(tournamentId, innerTx));
  }

  const officialRows = await tx
    .select({
      id: questions.id,
      position: questions.position,
      answer_shape: questions.answer_shape,
      correct_answer: questions.correct_answer,
      conditional_on_position: questions.conditional_on_position,
    })
    .from(questions)
    .where(eq(questions.tournament_id, tournamentId));

  if (officialRows.length !== TRIVIA_QUESTION_COUNT) {
    throw new Error(
      `recomputeTrivia: expected ${TRIVIA_QUESTION_COUNT} questions for tournament ${tournamentId}, got ${officialRows.length}`,
    );
  }

  const officials: OfficialQuestion[] = officialRows.map((r) => ({
    position: r.position as TriviaPosition,
    answer_shape: r.answer_shape,
    correct_answer: r.correct_answer,
    conditional_on_position:
      (r.conditional_on_position as TriviaPosition | null) ?? null,
  }));

  const questionIds = officialRows.map((r) => r.id);

  const allPlayerRows = await tx
    .select({
      id: user_questions.id,
      user_id: user_questions.user_id,
      question_id: user_questions.question_id,
      answer: user_questions.answer,
    })
    .from(user_questions);

  const tournamentQuestionIdSet = new Set(questionIds);
  const positionByQuestionId = new Map(officialRows.map((r) => [r.id, r.position]));

  const rowsByUser = new Map<string, PlayerAnswerRow[]>();
  for (const r of allPlayerRows) {
    if (!tournamentQuestionIdSet.has(r.question_id)) continue;
    const pos = positionByQuestionId.get(r.question_id);
    if (pos === undefined) continue;
    const arr = rowsByUser.get(r.user_id) ?? [];
    arr.push({
      id: r.id,
      user_id: r.user_id,
      position: pos as TriviaPosition,
      answer: r.answer,
    });
    rowsByUser.set(r.user_id, arr);
  }

  let rescored = 0;
  for (const [, playerRows] of rowsByUser) {
    const updates = computePointsForPlayerAnswers(officials, playerRows);
    for (const u of updates) {
      await tx
        .update(user_questions)
        .set({ points: u.points, updated_at: new Date() })
        .where(eq(user_questions.id, u.id));
      rescored += 1;
    }
  }

  return { rescored, affectedUsers: rowsByUser.size };
}
