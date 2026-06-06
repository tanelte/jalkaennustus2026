import { and, asc, eq } from 'drizzle-orm';
import { ListChecks } from 'lucide-react';

import { SectionHeader } from '@/components/section-header';
import { Card, CardContent } from '@/components/ui/card';
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
    <section className="space-y-6">
      <header className="space-y-2">
        <SectionHeader as="h1" icon={ListChecks} title="Best-thirds kinnitus" />
        <p className="text-sm text-text-muted">
          Märgi ametlikud paremad kolmandad. Salvestada saab ühe haaval —
          tulemused arvutatakse ümber iga salvestuse järel. Kui kõik 8 on
          teada, on skoorimine lukus: õige tähe eest 8 punkti, vale eest 0.
        </p>
        {existing.length > 0 && (
          <p className="text-sm text-text-muted">
            Praegune ametlik komplekt ({existing.length}/8):{' '}
            <strong className="text-text-primary">{existing.join(', ')}</strong>
          </p>
        )}
      </header>

      <Card>
        <CardContent className="p-5 sm:p-6">
          <BestThirdsConfirmForm initialLetters={existing} />
        </CardContent>
      </Card>
    </section>
  );
}
