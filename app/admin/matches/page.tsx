import { alias } from 'drizzle-orm/pg-core';
import { asc, eq } from 'drizzle-orm';
import { Trophy } from 'lucide-react';

import { SectionHeader } from '@/components/section-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

function prettyStage(stageCode: string): string {
  return stageCode.replace(/_/g, ' ');
}

export default async function AdminMatchesPage() {
  const tournamentId = await getCurrentTournamentId();
  const rows = await loadGames(tournamentId);
  const grouped = groupByStage(rows);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <SectionHeader as="h1" icon={Trophy} title="Mängude tulemused" />
        <p className="text-sm text-text-muted">
          Sisesta või paranda skoor ja vali staatus. Salvestamisel arvutatakse
          mõjutatud mängijate punktid ümber automaatselt.
        </p>
        <p className="text-xs text-text-muted">
          Knockoutmängude puhul vali ka <strong>Lõpetus</strong>: normaalaeg →
          kood A; lisaaeg või penaltid → kood B. Penalti-mängu puhul märgi
          skooriks penaltisuhe (nt 4–3).
        </p>
      </header>

      {grouped.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-text-muted">
            Ühtegi mängu ei leitud.
          </CardContent>
        </Card>
      )}

      {grouped.map((g) => (
        <Card key={g.stage}>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
              <h2 className="text-sm font-semibold capitalize text-text-primary">
                {prettyStage(g.stage)}
              </h2>
              <span className="text-xs text-text-muted">
                {g.games.length} mängu
              </span>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      scope="col"
                      className="sticky left-0 z-10 bg-surface-card"
                    >
                      Mäng
                    </TableHead>
                    <TableHead scope="col" className="whitespace-nowrap">
                      Kickoff (UTC)
                    </TableHead>
                    <TableHead scope="col" className="text-center">
                      2×
                    </TableHead>
                    <TableHead scope="col" className="text-center">
                      Kood
                    </TableHead>
                    <TableHead scope="col">Sisesta tulemus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.games.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="sticky left-0 z-10 bg-surface-card">
                        <div className="flex flex-col">
                          <span className="font-medium text-text-primary">
                            {row.home_name ?? '—'} – {row.away_name ?? '—'}
                          </span>
                          <span className="text-xs text-text-muted">
                            {row.round_label}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs tabular-nums text-text-muted">
                        {row.kickoff_at.toISOString().replace('T', ' ').slice(0, 16)}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {row.double_points ? (
                          <Badge
                            variant="outline"
                            className="border-brand-green/40 bg-brand-green-soft text-brand-green"
                          >
                            2×
                          </Badge>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-xs tabular-nums text-text-muted">
                        {row.result_code ?? '—'}
                      </TableCell>
                      <TableCell>
                        <MatchResultForm
                          gameId={row.id}
                          stageCode={row.stage_code}
                          initialScoreHome={row.score_home}
                          initialScoreAway={row.score_away}
                          initialFinalStatus={row.final_status}
                          initialFinishType={row.finish_type}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
