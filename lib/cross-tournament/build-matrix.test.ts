import { describe, expect, it } from 'vitest';
import {
  buildCrossTournamentMatrix,
  type CrossTournamentCellInput,
  type CrossTournamentColumn,
  type CrossTournamentTotalInput,
} from './build-matrix';

const TOURNAMENTS: CrossTournamentColumn[] = [
  { id: 't-em12', code: 'EM2012', name: 'UEFA Euro 2012' },
  { id: 't-wc14', code: 'WC2014', name: 'FIFA World Cup 2014' },
  { id: 't-wc26', code: 'WC2026', name: 'FIFA World Cup 2026' },
];

describe('buildCrossTournamentMatrix', () => {
  it('builds a player × tournament matrix in the order given by inputs', () => {
    const totals: CrossTournamentTotalInput[] = [
      { user_id: 'u-mart', username: 'Mart', total_points: 145 },
      { user_id: 'u-mati', username: 'Mati', total_points: 102 },
    ];
    const cells: CrossTournamentCellInput[] = [
      // Shuffled on purpose to prove it is column-id-driven, not insertion-order.
      {
        user_id: 'u-mart',
        username: 'Mart',
        tournament_id: 't-wc26',
        total_points: 20,
        finishing_position: null,
      },
      {
        user_id: 'u-mart',
        username: 'Mart',
        tournament_id: 't-em12',
        total_points: 70,
        finishing_position: 1,
      },
      {
        user_id: 'u-mart',
        username: 'Mart',
        tournament_id: 't-wc14',
        total_points: 55,
        finishing_position: 2,
      },
      {
        user_id: 'u-mati',
        username: 'Mati',
        tournament_id: 't-em12',
        total_points: 60,
        finishing_position: 2,
      },
      {
        user_id: 'u-mati',
        username: 'Mati',
        tournament_id: 't-wc26',
        total_points: 42,
        finishing_position: null,
      },
    ];

    const matrix = buildCrossTournamentMatrix(TOURNAMENTS, cells, totals);

    expect(matrix.tournaments.map((t) => t.code)).toEqual(['EM2012', 'WC2014', 'WC2026']);
    expect(matrix.rows).toHaveLength(2);

    const mart = matrix.rows[0];
    expect(mart.user_id).toBe('u-mart');
    expect(mart.username).toBe('Mart');
    expect(mart.total_points).toBe(145);
    expect(mart.cells).toEqual([
      { points: 70, position: 1 },
      { points: 55, position: 2 },
      { points: 20, position: null },
    ]);

    const mati = matrix.rows[1];
    expect(mati.cells).toEqual([
      { points: 60, position: 2 },
      null, // Mati did not play WC2014 — blank, NOT { points: 0 }, NOT 0.
      { points: 42, position: null },
    ]);
  });

  it('returns null (not 0, not { points: 0 }) for a tournament a player did not play', () => {
    const totals: CrossTournamentTotalInput[] = [
      { user_id: 'u-1', username: 'A', total_points: 30 },
    ];
    const cells: CrossTournamentCellInput[] = [
      {
        user_id: 'u-1',
        username: 'A',
        tournament_id: 't-em12',
        total_points: 30,
        finishing_position: 3,
      },
    ];

    const matrix = buildCrossTournamentMatrix(TOURNAMENTS, cells, totals);

    expect(matrix.rows[0].cells[1]).toBeNull();
    expect(matrix.rows[0].cells[2]).toBeNull();
    expect(matrix.rows[0].cells[0]).toEqual({ points: 30, position: 3 });
  });

  it('keeps a tournament column even when no player has cells for it', () => {
    const totals: CrossTournamentTotalInput[] = [
      { user_id: 'u-1', username: 'A', total_points: 30 },
    ];
    const cells: CrossTournamentCellInput[] = [
      {
        user_id: 'u-1',
        username: 'A',
        tournament_id: 't-em12',
        total_points: 30,
        finishing_position: 3,
      },
    ];

    const matrix = buildCrossTournamentMatrix(TOURNAMENTS, cells, totals);

    expect(matrix.tournaments).toHaveLength(3);
    expect(matrix.rows[0].cells).toHaveLength(3);
  });

  it('row order follows totals input order (which is sorted by SQL Query C)', () => {
    const totals: CrossTournamentTotalInput[] = [
      { user_id: 'u-c', username: 'C', total_points: 200 },
      { user_id: 'u-a', username: 'A', total_points: 150 },
      { user_id: 'u-b', username: 'B', total_points: 100 },
    ];
    const cells: CrossTournamentCellInput[] = [
      // Insertion order intentionally different from totals order.
      {
        user_id: 'u-a',
        username: 'A',
        tournament_id: 't-em12',
        total_points: 50,
        finishing_position: 2,
      },
      {
        user_id: 'u-b',
        username: 'B',
        tournament_id: 't-em12',
        total_points: 30,
        finishing_position: 3,
      },
      {
        user_id: 'u-c',
        username: 'C',
        tournament_id: 't-em12',
        total_points: 70,
        finishing_position: 1,
      },
    ];

    const matrix = buildCrossTournamentMatrix(TOURNAMENTS, cells, totals);

    expect(matrix.rows.map((r) => r.username)).toEqual(['C', 'A', 'B']);
  });

  it('carries finishing_position through faithfully (null for live tournament, number for legacy)', () => {
    const totals: CrossTournamentTotalInput[] = [
      { user_id: 'u-1', username: 'A', total_points: 100 },
    ];
    const cells: CrossTournamentCellInput[] = [
      {
        user_id: 'u-1',
        username: 'A',
        tournament_id: 't-em12',
        total_points: 60,
        finishing_position: 1,
      },
      {
        user_id: 'u-1',
        username: 'A',
        tournament_id: 't-wc26',
        total_points: 40,
        finishing_position: null,
      },
    ];

    const matrix = buildCrossTournamentMatrix(TOURNAMENTS, cells, totals);

    expect(matrix.rows[0].cells[0]).toEqual({ points: 60, position: 1 });
    expect(matrix.rows[0].cells[2]).toEqual({ points: 40, position: null });
  });

  it('ignores cells for users not in the totals input (defensive)', () => {
    const totals: CrossTournamentTotalInput[] = [
      { user_id: 'u-1', username: 'A', total_points: 30 },
    ];
    const cells: CrossTournamentCellInput[] = [
      {
        user_id: 'u-1',
        username: 'A',
        tournament_id: 't-em12',
        total_points: 30,
        finishing_position: 3,
      },
      {
        user_id: 'u-ghost',
        username: 'Ghost',
        tournament_id: 't-em12',
        total_points: 99,
        finishing_position: 1,
      },
    ];

    const matrix = buildCrossTournamentMatrix(TOURNAMENTS, cells, totals);

    expect(matrix.rows).toHaveLength(1);
    expect(matrix.rows[0].username).toBe('A');
  });
});
