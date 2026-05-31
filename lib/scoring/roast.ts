/**
 * Roast roll-up (S12). Pure aggregation across every scored prediction row
 * for the focus user's group. The /roast page reads from existing views
 * (v_user_games, v_user_teams, v_user_finals_teams, plus user_best_thirds /
 * user_questions) and feeds normalised PredictionRow[] into the functions
 * below; no aggregation lives in the route.
 *
 * No I/O. Tested at 100% (lib/scoring/** gate).
 */

export type PredictionKind = 'match' | 'knockout' | 'final' | 'best_thirds' | 'trivia';

export interface PredictionRow {
  /** Which surface the row came from. */
  predictionKind: PredictionKind;
  /**
   * Stable identifier for the predicted target — typically game_id (for
   * match/knockout/final) or `${tournamentId}:${groupLetter}` for best-thirds
   * or `${tournamentId}:Q${position}` for trivia. Same target across players
   * MUST yield the same predictionId so group-wrong / solo-correct can compare.
   */
  predictionId: string;
  userId: string;
  username: string;
  /** Human-readable label for plain-text output (e.g. "Hispaania – Saksamaa"). */
  label: string;
  /** Already-scored points for this row. Negative inputs treated as 0. */
  points: number;
}

export interface RoastPick {
  predictionKind: PredictionKind;
  predictionId: string;
  label: string;
  points: number;
}

export interface RoastResult {
  bestPick: RoastPick | null;
  worstPick: RoastPick | null;
  groupWrong: RoastPick[];
  soloCorrect: RoastPick[];
}

export interface RoastInput {
  focusUserId: string;
  predictions: readonly PredictionRow[];
}

export function buildRoast(input: RoastInput): RoastResult {
  const { focusUserId, predictions } = input;

  const focusRows = predictions.filter((p) => p.userId === focusUserId);

  const bestPick = pickByExtreme(focusRows, 'max');
  const worstPick = pickByExtreme(focusRows, 'min');

  const byPrediction = groupByPrediction(predictions);

  const groupWrong: RoastPick[] = [];
  const soloCorrect: RoastPick[] = [];

  for (const [, rows] of byPrediction) {
    const focusRow = rows.find((r) => r.userId === focusUserId);
    if (!focusRow) continue;

    const others = rows.filter((r) => r.userId !== focusUserId);
    const focusPoints = nonNegative(focusRow.points);
    const allOthersScoredZero = others.length > 0 && others.every((r) => nonNegative(r.points) === 0);

    if (focusPoints === 0 && allOthersScoredZero) {
      groupWrong.push(toRoastPick(focusRow));
    } else if (focusPoints > 0 && allOthersScoredZero) {
      soloCorrect.push(toRoastPick(focusRow));
    }
  }

  groupWrong.sort(compareByIdentity);
  soloCorrect.sort(compareByIdentity);

  return { bestPick, worstPick, groupWrong, soloCorrect };
}

function pickByExtreme(rows: readonly PredictionRow[], mode: 'max' | 'min'): RoastPick | null {
  if (rows.length === 0) return null;
  let best = rows[0]!;
  for (let i = 1; i < rows.length; i += 1) {
    const candidate = rows[i]!;
    const cPoints = nonNegative(candidate.points);
    const bPoints = nonNegative(best.points);
    const winsOnPoints = mode === 'max' ? cPoints > bPoints : cPoints < bPoints;
    const tieBreak = cPoints === bPoints && compareByIdentity(candidate, best) < 0;
    if (winsOnPoints || tieBreak) best = candidate;
  }
  return toRoastPick(best);
}

function groupByPrediction(
  predictions: readonly PredictionRow[],
): Map<string, PredictionRow[]> {
  const map = new Map<string, PredictionRow[]>();
  for (const row of predictions) {
    const key = `${row.predictionKind}:${row.predictionId}`;
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  return map;
}

function toRoastPick(row: PredictionRow): RoastPick {
  return {
    predictionKind: row.predictionKind,
    predictionId: row.predictionId,
    label: row.label,
    points: nonNegative(row.points),
  };
}

function nonNegative(n: number): number {
  return n < 0 || Number.isNaN(n) ? 0 : n;
}

function compareByIdentity(
  a: Pick<PredictionRow, 'predictionKind' | 'predictionId'>,
  b: Pick<PredictionRow, 'predictionKind' | 'predictionId'>,
): number {
  if (a.predictionKind !== b.predictionKind) return a.predictionKind < b.predictionKind ? -1 : 1;
  return a.predictionId < b.predictionId ? -1 : 1;
}
