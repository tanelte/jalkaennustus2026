import { and, asc, eq, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { requireCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { isStageOpen } from '@/lib/stages/is-stage-open';
import { getCurrentTournamentId } from '@/lib/tournaments/current';
import { games, teams, user_teams } from '@/db/schema';
import { FinalForm, type CandidateTeamView } from './final-form';
import {
  FINAL_ROUND_VALUE,
  FINAL_SLOTS,
  FINAL_STAGE_CODE,
  isFinalSlot,
  type FinalSlot,
} from './constants';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Finaali ennustus — Jalkaennustus' };

async function loadCandidateTeams(tournamentId: string): Promise<CandidateTeamView[]> {
  // The four semifinalists become known the moment SF pairings are set: both
  // SF games carry non-null home/away team IDs. Before that (during local-dev
  // validation), fall back to all 48 tournament teams per the S09 AC.
  const sfGames = await db
    .select({
      team_home_id: games.team_home_id,
      team_away_id: games.team_away_id,
    })
    .from(games)
    .where(and(eq(games.tournament_id, tournamentId), eq(games.stage_code, 'sf')));

  const sfTeamIds = sfGames
    .flatMap((g) => [g.team_home_id, g.team_away_id])
    .filter((id): id is string => id !== null);
  const allFourKnown = sfGames.length === 2 && sfTeamIds.length === 4;

  const rows = allFourKnown
    ? await db
        .select({ id: teams.id, code: teams.code, name_et: teams.name_et })
        .from(teams)
        .where(inArray(teams.id, sfTeamIds))
        .orderBy(asc(teams.name_et))
    : await db
        .select({ id: teams.id, code: teams.code, name_et: teams.name_et })
        .from(teams)
        .where(eq(teams.tournament_id, tournamentId))
        .orderBy(asc(teams.name_et));

  return rows;
}

async function loadCurrentPicks(
  userId: string,
  tournamentId: string,
): Promise<Partial<Record<FinalSlot, string>>> {
  const rows = await db
    .select({ slot: user_teams.slot, team_id: user_teams.team_id })
    .from(user_teams)
    .where(
      and(
        eq(user_teams.user_id, userId),
        eq(user_teams.tournament_id, tournamentId),
        eq(user_teams.round, FINAL_ROUND_VALUE),
      ),
    );
  const out: Partial<Record<FinalSlot, string>> = {};
  for (const row of rows) {
    if (isFinalSlot(row.slot)) out[row.slot] = row.team_id;
  }
  return out;
}

export default async function FinalPredictPage() {
  const userId = await requireCurrentUserId();
  const tournamentId = await getCurrentTournamentId();
  const [candidates, initialPicks, gate] = await Promise.all([
    loadCandidateTeams(tournamentId),
    loadCurrentPicks(userId, tournamentId),
    isStageOpen(FINAL_STAGE_CODE, tournamentId),
  ]);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <header>
        <Link href="/" className="text-sm text-gray-500 hover:underline">
          ← Tagasi
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Finaali ennustus</h1>
      </header>

      <section className="mt-4 rounded border bg-gray-50 p-4 text-sm text-gray-700">
        <p className="font-medium">Kuidas finaali ennustus toimib?</p>
        <p className="mt-2">
          Vali igale medalikohale meeskond: F1 kuld, F2 hõbe, F3 pronks,
          F4 neljas koht. Soovi korral võid taktikaliselt panna sama meeskonna
          mitmele kohale — punkte annab vaid see koht, kus meeskond ka päriselt
          finišeerib. Õige meeskond õigel kohal toob punktid (F1 = 60, F2 = 40,
          F3 = 30, F4 = 20).
        </p>
        {candidates.length === 4 ? (
          <p className="mt-2 text-gray-600">
            Valikus on 4 poolfinaali jõudnud meeskonda.
          </p>
        ) : (
          <p className="mt-2 text-gray-600">
            Poolfinaali paarid pole veel teada — valikus on kõik turniiri
            meeskonnad. Pärast veerandfinaale kitseneb valik 4 poolfinalistini.
          </p>
        )}
      </section>

      {!gate.open && (
        <p
          role="alert"
          className="mt-4 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900"
        >
          {gate.reason === 'closed'
            ? 'Aken on suletud — uusi valikuid enam vastu ei võeta.'
            : gate.reason === 'not_yet'
            ? `Aken avaneb ${gate.opensAt?.toISOString() ?? ''}.`
            : 'Finaali etappi ei leitud.'}
        </p>
      )}

      <FinalForm
        candidates={candidates}
        initialPicks={initialPicks}
        disabled={!gate.open}
        slotsOrder={FINAL_SLOTS}
      />
    </main>
  );
}
