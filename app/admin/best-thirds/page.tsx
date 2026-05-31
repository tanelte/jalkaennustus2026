import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { getSystemUserId } from '@/lib/system-user';
import { getCurrentTournamentId } from '@/lib/tournaments/current';
import { user_best_thirds } from '@/db/schema';
import { BestThirdsConfirmForm } from './best-thirds-confirm-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Best-thirds kinnitus — Operaator' };

async function loadOfficialLetters(systemUserId: string, tournamentId: string): Promise<string[]> {
  const rows = await db
    .select({ group_letter: user_best_thirds.group_letter })
    .from(user_best_thirds)
    .where(
      and(
        eq(user_best_thirds.user_id, systemUserId),
        eq(user_best_thirds.tournament_id, tournamentId),
      ),
    )
    .orderBy(asc(user_best_thirds.group_letter));
  return rows.map((r) => r.group_letter);
}

export default async function AdminBestThirdsPage() {
  const tournamentId = await getCurrentTournamentId();
  const systemUserId = await getSystemUserId();
  const existing = await loadOfficialLetters(systemUserId, tournamentId);

  return (
    <article className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold">Best-thirds kinnitus</h2>
        <p className="mt-1 text-sm text-gray-600">
          Märgi ametlikud paremad kolmandad. Salvestada saab ühe haaval —
          tulemused arvutatakse ümber iga salvestuse järel. Kui kõik 8 on
          teada, on skoorimine lukus: õige tähe eest 8 punkti, vale eest 0.
        </p>
      </header>

      {existing.length > 0 && (
        <p className="text-sm text-gray-700">
          Praegune ametlik komplekt ({existing.length}/8):{' '}
          <strong>{existing.join(', ')}</strong>
        </p>
      )}

      <BestThirdsConfirmForm initialLetters={existing} />
    </article>
  );
}
