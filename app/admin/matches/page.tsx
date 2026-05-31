import { alias } from 'drizzle-orm/pg-core';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { getCurrentTournamentId } from '@/lib/tournaments/current';
import { games, teams } from '@/db/schema';
import { MatchResultForm } from './match-result-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mängude tulemused — Operaator' };

interface GameRow {
  id: string;
  stage_code: string;
  round_label: string;
  kickoff_at: Date;
  home_name: string | null;
  away_name: string | null;
  score_home: number | null;
  score_away: number | null;
  final_status: string | null;
  finish_type: string | null;
  result_code: string | null;
  double_points: boolean;
}

async function loadGames(tournamentId: string): Promise<GameRow[]> {
  const homeTeams = alias(teams, 'home_teams');
  const awayTeams = alias(teams, 'away_teams');
  return db
    .select({
      id: games.id,
      stage_code: games.stage_code,
      round_label: games.round_label,
      kickoff_at: games.kickoff_at,
      home_name: homeTeams.name_et,
      away_name: awayTeams.name_et,
      score_home: games.score_home,
      score_away: games.score_away,
      final_status: games.final_status,
      finish_type: games.finish_type,
      result_code: games.result_code,
      double_points: games.double_points,
    })
    .from(games)
    .leftJoin(homeTeams, eq(games.team_home_id, homeTeams.id))
    .leftJoin(awayTeams, eq(games.team_away_id, awayTeams.id))
    .where(eq(games.tournament_id, tournamentId))
    .orderBy(asc(games.kickoff_at), asc(games.round_label));
}

function groupByStage(rows: GameRow[]): Array<{ stage: string; games: GameRow[] }> {
  const map = new Map<string, GameRow[]>();
  for (const row of rows) {
    const list = map.get(row.stage_code) ?? [];
    list.push(row);
    map.set(row.stage_code, list);
  }
  return Array.from(map.entries()).map(([stage, gs]) => ({ stage, games: gs }));
}

export default async function AdminMatchesPage() {
  const tournamentId = await getCurrentTournamentId();
  const rows = await loadGames(tournamentId);
  const grouped = groupByStage(rows);

  return (
    <article className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold">Mängude tulemused</h2>
        <p className="mt-1 text-sm text-gray-600">
          Sisesta või paranda skoor ja vali staatus. Salvestamisel arvutatakse
          mõjutatud mängijate punktid ümber automaatselt.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Knockoutmängude puhul vali ka <strong>Lõpetus</strong>:
          normaalaeg → kood A; lisaaeg või penaltid → kood B. Penalti-mängu
          puhul märgi skooriks penaltisuhe (nt 4–3).
        </p>
      </header>

      {grouped.length === 0 && (
        <p className="text-sm text-gray-600">Ühtegi mängu ei leitud.</p>
      )}

      {grouped.map((g) => (
        <section key={g.stage} aria-label={`Staadium ${g.stage}`}>
          <h3 className="mt-4 text-lg font-medium capitalize">{g.stage.replace(/_/g, ' ')}</h3>
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-gray-600">
              <tr>
                <th className="py-1 pr-3">Mäng</th>
                <th className="py-1 pr-3">Kickoff (UTC)</th>
                <th className="py-1 pr-3">2×</th>
                <th className="py-1 pr-3">Kood</th>
                <th className="py-1">Sisesta tulemus</th>
              </tr>
            </thead>
            <tbody>
              {g.games.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="py-2 pr-3">
                    <span className="font-medium">
                      {row.home_name ?? '—'} – {row.away_name ?? '—'}
                    </span>
                    <span className="ml-2 text-xs text-gray-500">{row.round_label}</span>
                  </td>
                  <td className="py-2 pr-3 text-xs text-gray-600">
                    {row.kickoff_at.toISOString().replace('T', ' ').slice(0, 16)}
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    {row.double_points ? '2×' : ''}
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    {row.result_code ?? '—'}
                  </td>
                  <td className="py-2">
                    <MatchResultForm
                      gameId={row.id}
                      stageCode={row.stage_code}
                      initialScoreHome={row.score_home}
                      initialScoreAway={row.score_away}
                      initialFinalStatus={row.final_status}
                      initialFinishType={row.finish_type}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </article>
  );
}
