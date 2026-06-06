/**
 * Pure pivot helper for the per-league cross-tournament leaderboard (S15).
 *
 * Pivots three long-form query results into a renderable player × tournament
 * matrix. Index lookups only — no arithmetic. Per-tournament totals are
 * pre-aggregated in SQL (Constitution Rule 6 + S15 AC "no aggregation logic
 * in TypeScript").
 */

export type CrossTournamentColumn = {
  id: string;
  code: string;
  name: string;
};

export type CrossTournamentCellInput = {
  user_id: string;
  username: string;
  tournament_id: string;
  total_points: number;
  finishing_position: number | null;
};

export type CrossTournamentTotalInput = {
  user_id: string;
  username: string;
  total_points: number;
};

export type CrossTournamentCell = {
  points: number;
  position: number | null;
} | null;

export type CrossTournamentRow = {
  user_id: string;
  username: string;
  cells: CrossTournamentCell[];
  total_points: number;
};

export type CrossTournamentMatrix = {
  tournaments: CrossTournamentColumn[];
  rows: CrossTournamentRow[];
};

export function buildCrossTournamentMatrix(
  tournaments: CrossTournamentColumn[],
  cells: CrossTournamentCellInput[],
  totals: CrossTournamentTotalInput[],
): CrossTournamentMatrix {
  const tournamentIndexById = new Map<string, number>();
  tournaments.forEach((t, idx) => tournamentIndexById.set(t.id, idx));

  const cellsByUser = new Map<string, CrossTournamentCell[]>();
  for (const total of totals) {
    cellsByUser.set(total.user_id, new Array(tournaments.length).fill(null));
  }

  for (const cell of cells) {
    const userCells = cellsByUser.get(cell.user_id);
    if (!userCells) continue;
    const colIdx = tournamentIndexById.get(cell.tournament_id);
    if (colIdx === undefined) continue;
    userCells[colIdx] = {
      points: cell.total_points,
      position: cell.finishing_position,
    };
  }

  const rows: CrossTournamentRow[] = totals.map((total) => ({
    user_id: total.user_id,
    username: total.username,
    cells: cellsByUser.get(total.user_id) ?? new Array(tournaments.length).fill(null),
    total_points: total.total_points,
  }));

  return { tournaments, rows };
}
