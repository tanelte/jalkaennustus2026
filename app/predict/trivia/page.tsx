import { and, asc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { requireCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { isStageOpen } from '@/lib/stages/is-stage-open';
import { getCurrentTournamentId } from '@/lib/tournaments/current';
import { questions, user_questions } from '@/db/schema';
import { TriviaForm, type TriviaQuestionRow } from './trivia-form';
import { TRIVIA_STAGE_CODE } from './constants';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Trivia — Jalkaennustus' };

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
    position: r.position,
    promptEt: r.prompt_et,
    answerShape: r.answer_shape,
    conditionalOnPosition: r.conditional_on_position,
    currentAnswer: r.answer ?? '',
  }));
}

export default async function TriviaPage() {
  const userId = await requireCurrentUserId();
  const tournamentId = await getCurrentTournamentId();
  const [items, gate] = await Promise.all([
    loadQuestionsWithAnswers(userId, tournamentId),
    isStageOpen(TRIVIA_STAGE_CODE, tournamentId),
  ]);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <header>
        <Link href="/" className="text-sm text-gray-500 hover:underline">
          ← Tagasi
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Trivia ennustus</h1>
      </header>

      <section className="mt-4 rounded border bg-gray-50 p-4 text-sm text-gray-700">
        <p className="font-medium">Kuidas trivia toimib?</p>
        <p className="mt-2">
          Vasta enne turniiri algust viiele küsimusele. Iga õige vastus annab{' '}
          <strong>14 punkti</strong> (kokku max 70). <strong>Q5 skoorib ainult juhul,
          kui Q4 on õige</strong> — kui Q4 läheb mööda, jääb ka Q5 punktidest ilma.
        </p>
      </section>

      <p
        className={`mt-4 inline-block rounded-full px-3 py-1 text-xs font-medium ${
          gate.open
            ? 'bg-green-100 text-green-800'
            : gate.reason === 'closed'
            ? 'bg-gray-200 text-gray-700'
            : 'bg-yellow-100 text-yellow-900'
        }`}
        role="status"
      >
        {gate.open
          ? 'Aken on avatud'
          : gate.reason === 'closed'
          ? 'Aken on suletud'
          : gate.reason === 'not_yet'
          ? `Aken avaneb ${gate.opensAt?.toISOString() ?? ''}`
          : 'Etappi ei leitud'}
      </p>

      <TriviaForm questions={items} disabled={!gate.open} />
    </main>
  );
}
