import { and, asc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { requireCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { isStageOpen } from '@/lib/stages/is-stage-open';
import { getCurrentTournamentId } from '@/lib/tournaments/current';
import { user_best_thirds } from '@/db/schema';
import { BestThirdsForm } from './best-thirds-form';
import { BEST_THIRDS_STAGE_CODE } from './constants';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Best-thirds — Jalkaennustus' };

async function loadCurrentPicks(userId: string, tournamentId: string): Promise<string[]> {
  const rows = await db
    .select({ group_letter: user_best_thirds.group_letter })
    .from(user_best_thirds)
    .where(
      and(
        eq(user_best_thirds.user_id, userId),
        eq(user_best_thirds.tournament_id, tournamentId),
      ),
    )
    .orderBy(asc(user_best_thirds.group_letter));
  return rows.map((r) => r.group_letter);
}

export default async function BestThirdsPage() {
  const userId = await requireCurrentUserId();
  const tournamentId = await getCurrentTournamentId();
  const [picks, gate] = await Promise.all([
    loadCurrentPicks(userId, tournamentId),
    isStageOpen(BEST_THIRDS_STAGE_CODE, tournamentId),
  ]);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <header>
        <Link href="/" className="text-sm text-gray-500 hover:underline">
          ← Tagasi
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Best-thirds ennustus</h1>
      </header>

      <section className="mt-4 rounded border bg-gray-50 p-4 text-sm text-gray-700">
        <p className="font-medium">Kuidas best-thirds toimib?</p>
        <p className="mt-2">
          MM 2026 alagrupiturniiril mängib 12 alagruppi (A–L), millest igast pääseb
          edasi 2 paremat. Lisaks pääseb 16-paari faasi (Round of 32) 8 paremat
          kolmandat kohta kõigist alagruppidest, mida FIFA hindab võitude, väravate
          vahe ja löödud väravate alusel.
        </p>
        <p className="mt-2">
          Märgi tabelist <strong>täpselt 8 grupi tähte</strong>, mille kolmas koht
          sinu hinnangul edasi pääseb. Iga õige tähe eest saad{' '}
          <strong>8 punkti</strong> (kokku max 64).
        </p>
      </section>

      {!gate.open && (
        <p role="alert" className="mt-4 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
          {gate.reason === 'closed'
            ? 'Aken on suletud — uusi valikuid enam vastu ei võeta.'
            : gate.reason === 'not_yet'
            ? `Aken avaneb ${gate.opensAt?.toISOString() ?? ''}.`
            : 'Best-thirds etappi ei leitud.'}
        </p>
      )}

      <BestThirdsForm initialPicks={picks} />
    </main>
  );
}
