import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { getSystemUserId } from '@/lib/system-user';
import { getCurrentTournamentId } from '@/lib/tournaments/current';
import { games, teams, user_teams } from '@/db/schema';
import {
  FINAL_ROUND_VALUE,
  FINAL_SLOTS,
  isFinalSlot,
  type FinalSlot,
} from '@/app/predict/final/constants';
import { FinalsConfirmForm, type CandidateTeamView } from './finals-confirm-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Finaali kinnitus — Operaator' };

async function loadOfficialPicks(
  systemUserId: string,
  tournamentId: string,
): Promise<Partial<Record<FinalSlot, string>>> {
  const rows = await db
    .select({ slot: user_teams.slot, team_id: user_teams.team_id })
    .from(user_teams)
    .where(
      and(
        eq(user_teams.user_id, systemUserId),
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

async function loadCandidateTeams(tournamentId: string): Promise<CandidateTeamView[]> {
  // Same fallback logic as the player picker: prefer the 4 semifinalists, fall
  // back to all 48 tournament teams while SF pairings are TBD.
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

  if (allFourKnown) {
    return db
      .select({ id: teams.id, code: teams.code, name_et: teams.name_et })
      .from(teams)
      .where(inArray(teams.id, sfTeamIds))
      .orderBy(asc(teams.name_et));
  }
  return db
    .select({ id: teams.id, code: teams.code, name_et: teams.name_et })
    .from(teams)
    .where(eq(teams.tournament_id, tournamentId))
    .orderBy(asc(teams.name_et));
}

export default async function AdminFinalsPage() {
  const tournamentId = await getCurrentTournamentId();
  const systemUserId = await getSystemUserId();
  const [existing, candidates] = await Promise.all([
    loadOfficialPicks(systemUserId, tournamentId),
    loadCandidateTeams(tournamentId),
  ]);

  const completeness = FINAL_SLOTS.filter((s) => existing[s]).length;

  return (
    <article className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold">Finaali kinnitus</h2>
        <p className="mt-1 text-sm text-gray-600">
          Märgi ametlikud medalivõitjad: F1 (kuld), F2 (hõbe), F3 (pronks),
          F4 (neljas koht). Punktid arvutatakse ümber alles siis, kui kõik
          neli kohta on täidetud — kuni selle hetkeni võid salvestada osalise
          komplekti. Iga meeskond saab esineda ainult ühel kohal.
        </p>
      </header>

      {completeness > 0 && (
        <p className="text-sm text-gray-700">
          Praegu täidetud kohti: <strong>{completeness}/4</strong>.
        </p>
      )}

      <FinalsConfirmForm initialOfficial={existing} candidates={candidates} />
    </article>
  );
}
