import { and, asc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { TopBar } from '@/components/top-bar';
import { Card, CardContent } from '@/components/ui/card';
import { WindowStatePill } from '@/components/window-state-pill';
import { auth, signOut } from '@/lib/auth';
import {
  clearCurrentUserCookie,
  requireCurrentUserId,
} from '@/lib/current-user';
import { db } from '@/lib/db';
import { resolveEditMode } from '@/lib/pin/edit-mode';
import { getMaskedRecoveryEmailForUser } from '@/lib/pin/recovery';
import { isStageOpen } from '@/lib/stages/is-stage-open';
import { resolveTournamentCode, getCurrentTournamentId } from '@/lib/tournaments/current';
import { questions, teams, user_questions, users } from '@/db/schema';
import { TriviaForm, type TeamOption, type TriviaQuestionRow } from './trivia-form';
import { TRIVIA_STAGE_CODE } from './constants';
import { loadAllTriviaPeerRowsForQuestions } from '@/lib/peer-predictions/load-trivia-payloads';
import type { TriviaPeerAnswer } from '@/lib/peer-predictions/load-trivia-payloads';
import type { PeerRow } from '@/lib/peer-predictions/load-peer-predictions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Trivia — Jalkaennustus' };

async function logoutAction() {
  'use server';
  await clearCurrentUserCookie();
  await signOut({ redirectTo: '/login' });
}

async function loadPlayerContext(
  userId: string,
): Promise<{ playerName: string; isOperator: boolean }> {
  const rows = await db
    .select({ username: users.username, is_operator: users.is_operator })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return {
    playerName: rows[0]?.username ?? 'tundmatu mängija',
    isOperator: rows[0]?.is_operator ?? false,
  };
}

async function loadQuestionsWithAnswers(
  userId: string,
  tournamentId: string,
): Promise<TriviaQuestionRow[]> {
  const rows = await db
    .select({
      id: questions.id,
      position: questions.position,
      prompt_et: questions.prompt_et,
      answer_shape: questions.answer_shape,
      conditional_on_position: questions.conditional_on_position,
      answer: user_questions.answer,
    })
    .from(questions)
    .leftJoin(
      user_questions,
      and(
        eq(user_questions.question_id, questions.id),
        eq(user_questions.user_id, userId),
      ),
    )
    .where(eq(questions.tournament_id, tournamentId))
    .orderBy(asc(questions.position));

  return rows.map((r) => ({
    id: r.id,
    position: r.position,
    promptEt: r.prompt_et,
    answerShape: r.answer_shape,
    conditionalOnPosition: r.conditional_on_position,
    currentAnswer: r.answer ?? '',
  }));
}

async function loadTeams(tournamentId: string): Promise<TeamOption[]> {
  return db
    .select({ code: teams.code, name_et: teams.name_et })
    .from(teams)
    .where(eq(teams.tournament_id, tournamentId))
    .orderBy(asc(teams.name_et));
}

/**
 * UX spec §15.4 — shared prediction shell: dark sticky `AppHeader`,
 * breadcrumb + h1, `WindowStatePill`, prediction `Card`,
 * and a right-aligned submit footer. Trivia keeps the existing five
 * `QuestionBlock`s; Q5's conditional-on-Q4 trick is described inline via
 * `aria-describedby` per §18.
 */
export default async function TriviaPage() {
  const session = await auth();
  if (!session?.user?.group_id) redirect('/login');

  const userId = await requireCurrentUserId();
  const tournamentId = await getCurrentTournamentId();
  const tournamentChip = resolveTournamentCode();

  const [items, gate, teamOptions, { playerName, isOperator }, maskedRecoveryEmail] =
    await Promise.all([
      loadQuestionsWithAnswers(userId, tournamentId),
      isStageOpen(TRIVIA_STAGE_CODE, tournamentId),
      loadTeams(tournamentId),
      loadPlayerContext(userId),
      getMaskedRecoveryEmailForUser(userId),
    ]);

  const editMode = await resolveEditMode({ userId, stageGate: gate });

  // E04-S02 — peer-predictions view on trivia. One batched query across every
  // question in view; per-question results are passed into the existing
  // client form so its in-progress state is never disturbed by the read-side
  // decoration.
  const peerRowsByQuestionId = await loadAllTriviaPeerRowsForQuestions(
    items.map((q) => q.id),
    { groupId: session.user.group_id, viewerUserId: userId },
  );
  const peerRowsRecord: Record<string, PeerRow<TriviaPeerAnswer>[]> = {};
  for (const [questionId, rows] of peerRowsByQuestionId.entries()) {
    peerRowsRecord[questionId] = rows;
  }

  return (
    <>
      <TopBar
        groupName={session.user.username}
        playerName={playerName}
        isOperator={isOperator}
        tournamentChip={tournamentChip}
        logoutAction={logoutAction}
      />
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
        <nav aria-label="Asukoht" className="text-sm text-text-muted">
          <Link href="/" className="hover:underline">
            Avaleht
          </Link>
          <span aria-hidden="true"> / </span>
          <span>Trivia ennustus</span>
        </nav>

        <WindowStatePill gate={gate} />

        <header>
          <h1 className="text-3xl font-semibold text-text-primary">
            Trivia ennustus
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Vasta enne turniiri algust viiele küsimusele. Iga täpne vastus annab{' '}
            <strong>14 punkti</strong> (kokku max 70). Arvküsimuste (punased
            kaardid, väravaküti väravad) puhul saad{' '}
            <strong>14 miinus erinevus</strong> õigest arvust (min 0) — nt õige
            10, sinu 9 annab 13. Q5 skoorib ainult juhul, kui Q4 on õige.
          </p>
        </header>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <TriviaForm
              questions={items}
              teams={teamOptions}
              mode={editMode}
              userId={userId}
              maskedRecoveryEmail={maskedRecoveryEmail}
              groupName={session.user.username}
              peerRowsByQuestionId={peerRowsRecord}
            />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
