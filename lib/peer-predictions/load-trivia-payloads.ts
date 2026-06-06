import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { user_groups, user_questions, users } from '@/db/schema';
import {
  loadPeerPredictionsCore,
  type GroupMemberRow,
  type LoadPeerPredictionsDeps,
  type PeerRow,
} from './load-peer-predictions';
import { getSystemUserId } from '@/lib/system-user';

/**
 * The shape the trivia popover renders per peer — the peer's submitted answer
 * as a free-text string (the `user_questions.answer` column is `text NOT NULL`).
 *
 * Trivia answers come in three answer_shapes (`team`, `integer`, free text),
 * but the popover treats them uniformly — it just renders whatever string the
 * peer submitted. The scoring engine handles per-shape comparison elsewhere.
 *
 * Per S02 acceptance criteria: the peer view shows what the peer submitted
 * regardless of Q4/Q5 outcome — the Q5-conditional-on-Q4 scoring trick is
 * NOT relitigated on the peer-view side. We therefore render answers verbatim
 * without any conditional gating in this loader or in the popover.
 */
export type TriviaPeerAnswer = string;

export interface LoadAllTriviaPayloadsDeps {
  findAnswersForQuestions: (
    questionIds: string[],
    peerIds: string[],
  ) => Promise<Array<{ user_id: string; question_id: string; answer: string }>>;
}

/**
 * DI-friendly batch loader. Returns `Map<questionId, PeerRow[]>` for every
 * question id passed in. One DB round-trip across N questions.
 */
export async function loadAllTriviaPeerRowsForQuestionsCore(
  questionIds: string[],
  opts: {
    groupId: string;
    viewerUserId: string;
  },
  deps: LoadPeerPredictionsDeps & LoadAllTriviaPayloadsDeps,
): Promise<Map<string, PeerRow<TriviaPeerAnswer>[]>> {
  const empty = new Map<string, PeerRow<TriviaPeerAnswer>[]>();
  for (const id of questionIds) empty.set(id, []);
  if (questionIds.length === 0) return empty;

  // Resolve peer ids once via the seam, applying the standard exclusion rules
  // (viewer + system singleton). Same pattern as group-stage's batch loader.
  const placeholder = await loadPeerPredictionsCore<TriviaPeerAnswer>(
    {
      groupId: opts.groupId,
      viewerUserId: opts.viewerUserId,
      loadPayloads: async () => new Map(),
    },
    deps,
  );

  const peerIds = placeholder.map((p) => p.peerId);
  if (peerIds.length === 0) return empty;

  const rows = await deps.findAnswersForQuestions(questionIds, peerIds);
  const byQuestion = new Map<string, Map<string, TriviaPeerAnswer>>();
  for (const id of questionIds) byQuestion.set(id, new Map());
  for (const r of rows) {
    // Treat empty strings as "not submitted" — same semantics as the form's
    // own validation rejects empty answers, so an empty string in the column
    // would be an anomaly. Defensive: omit it from the submitted set.
    if (r.answer && r.answer.length > 0) {
      byQuestion.get(r.question_id)?.set(r.user_id, r.answer);
    }
  }

  const result = new Map<string, PeerRow<TriviaPeerAnswer>[]>();
  for (const questionId of questionIds) {
    const answers = byQuestion.get(questionId) ?? new Map();
    result.set(
      questionId,
      placeholder.map((p) => ({
        peerId: p.peerId,
        peerName: p.peerName,
        submittedPayload: answers.get(p.peerId) ?? null,
      })),
    );
  }
  return result;
}

async function findGroupMembersDb(groupId: string): Promise<GroupMemberRow[]> {
  return db
    .select({ user_id: user_groups.user_id, username: users.username })
    .from(user_groups)
    .innerJoin(users, eq(users.id, user_groups.user_id))
    .where(
      and(eq(user_groups.group_id, groupId), isNull(user_groups.deleted_at)),
    )
    .orderBy(asc(user_groups.created_at));
}

async function findAnswersForQuestionsDb(
  questionIds: string[],
  peerIds: string[],
): Promise<Array<{ user_id: string; question_id: string; answer: string }>> {
  if (questionIds.length === 0 || peerIds.length === 0) return [];
  return db
    .select({
      user_id: user_questions.user_id,
      question_id: user_questions.question_id,
      answer: user_questions.answer,
    })
    .from(user_questions)
    .where(
      and(
        inArray(user_questions.question_id, questionIds),
        inArray(user_questions.user_id, peerIds),
      ),
    );
}

/**
 * Production batch loader bound to the real Drizzle handle + system-user
 * lookup. Use from `/predict/trivia` page.
 *
 * Constitution Rule 1: the literal `'tegelikud tulemused'` string is never
 * referenced here — exclusion is resolved through `getSystemUserId()` inside
 * the seam.
 * Constitution Rule 2: `groupId` MUST come from the session, never from URL
 * input. Callers are responsible.
 */
export async function loadAllTriviaPeerRowsForQuestions(
  questionIds: string[],
  opts: { groupId: string; viewerUserId: string },
): Promise<Map<string, PeerRow<TriviaPeerAnswer>[]>> {
  return loadAllTriviaPeerRowsForQuestionsCore(questionIds, opts, {
    findGroupMembers: findGroupMembersDb,
    findSystemUserId: getSystemUserId,
    findAnswersForQuestions: findAnswersForQuestionsDb,
  });
}
