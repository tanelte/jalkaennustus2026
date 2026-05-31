import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { getCurrentTournamentId } from '@/lib/tournaments/current';
import { questions } from '@/db/schema';
import { TriviaConfirmForm, type OfficialQuestionRow } from './trivia-confirm-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Trivia kinnitus — Operaator' };

async function loadOfficials(tournamentId: string): Promise<OfficialQuestionRow[]> {
  const rows = await db
    .select({
      position: questions.position,
      prompt_et: questions.prompt_et,
      answer_shape: questions.answer_shape,
      conditional_on_position: questions.conditional_on_position,
      correct_answer: questions.correct_answer,
    })
    .from(questions)
    .where(eq(questions.tournament_id, tournamentId))
    .orderBy(asc(questions.position));

  return rows.map((r) => ({
    position: r.position,
    promptEt: r.prompt_et,
    answerShape: r.answer_shape,
    conditionalOnPosition: r.conditional_on_position,
    currentCorrect: r.correct_answer ?? '',
  }));
}

export default async function AdminTriviaPage() {
  const tournamentId = await getCurrentTournamentId();
  const items = await loadOfficials(tournamentId);
  const known = items.filter((q) => q.currentCorrect.length > 0).length;

  return (
    <article className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold">Trivia kinnitus</h2>
        <p className="mt-1 text-sm text-gray-600">
          Sisesta ametlikud vastused viiele küsimusele. Salvestada saab ka osaliselt
          — punktid arvutatakse ümber iga salvestuse järel. Q5 skoorib ainult juhul,
          kui Q4 on õige.
        </p>
      </header>

      <p className="text-sm text-gray-700">
        Hetkel teada: <strong>{known}</strong> / {items.length}
      </p>

      <TriviaConfirmForm questions={items} />
    </article>
  );
}
