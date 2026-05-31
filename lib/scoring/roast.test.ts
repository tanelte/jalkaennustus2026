import { describe, expect, it } from 'vitest';
import { buildRoast, type PredictionRow } from './roast';

const MART = 'mart-id';
const LIISA = 'liisa-id';
const ANTS = 'ants-id';

function row(overrides: Partial<PredictionRow>): PredictionRow {
  return {
    predictionKind: 'match',
    predictionId: 'g1',
    userId: MART,
    username: 'Mart',
    label: 'Hispaania – Saksamaa',
    points: 0,
    ...overrides,
  };
}

describe('buildRoast — empty / single-player inputs', () => {
  it('returns null bestPick and empty arrays when no predictions exist', () => {
    const result = buildRoast({ focusUserId: MART, predictions: [] });
    expect(result).toEqual({
      bestPick: null,
      soloWrong: [],
      groupWrong: [],
      soloCorrect: [],
    });
  });

  it('returns null bestPick when focus user has no rows but others do', () => {
    const result = buildRoast({
      focusUserId: MART,
      predictions: [row({ userId: LIISA, username: 'Liisa', points: 5 })],
    });
    expect(result.bestPick).toBeNull();
    expect(result.soloWrong).toEqual([]);
    expect(result.groupWrong).toEqual([]);
    expect(result.soloCorrect).toEqual([]);
  });

  it('finds best pick when focus user is the only player; no roast lists fire', () => {
    const result = buildRoast({
      focusUserId: MART,
      predictions: [
        row({ predictionId: 'g1', points: 10, label: 'Hispaania – Saksamaa' }),
        row({ predictionId: 'g2', points: 0, label: 'Inglismaa – Prantsusmaa' }),
      ],
    });
    expect(result.bestPick).toMatchObject({ predictionId: 'g1', points: 10 });
    // No "others" exist, so none of the roast lists can fire.
    expect(result.soloWrong).toEqual([]);
    expect(result.groupWrong).toEqual([]);
    expect(result.soloCorrect).toEqual([]);
  });
});

describe('buildRoast — best pick selection', () => {
  it('picks the highest-scoring focus row across surfaces', () => {
    const result = buildRoast({
      focusUserId: MART,
      predictions: [
        row({ predictionKind: 'match', predictionId: 'g1', points: 5 }),
        row({ predictionKind: 'knockout', predictionId: 'k1', points: 22 }),
        row({ predictionKind: 'final', predictionId: 'f1', points: 60 }),
        row({ predictionKind: 'best_thirds', predictionId: 'bt1', points: 0 }),
        row({ predictionKind: 'trivia', predictionId: 'q1', points: 14 }),
      ],
    });
    expect(result.bestPick).toMatchObject({ predictionKind: 'final', predictionId: 'f1', points: 60 });
  });

  it('breaks ties deterministically by (kind, predictionId)', () => {
    const result = buildRoast({
      focusUserId: MART,
      predictions: [
        row({ predictionKind: 'match', predictionId: 'g9', points: 5 }),
        row({ predictionKind: 'match', predictionId: 'g1', points: 5 }),
        row({ predictionKind: 'match', predictionId: 'g5', points: 5 }),
        row({ predictionKind: 'knockout', predictionId: 'k1', points: 5 }),
      ],
    });
    // 'knockout' < 'match' alphabetically, so the knockout row wins the tiebreak.
    expect(result.bestPick).toMatchObject({ predictionKind: 'knockout', predictionId: 'k1' });
  });

  it('coerces negative or NaN points to zero when selecting best', () => {
    const result = buildRoast({
      focusUserId: MART,
      predictions: [
        row({ predictionId: 'g1', points: -5 }),
        row({ predictionId: 'g2', points: Number.NaN }),
        row({ predictionId: 'g3', points: 3 }),
      ],
    });
    expect(result.bestPick).toMatchObject({ predictionId: 'g3', points: 3 });
  });
});

describe('buildRoast — group-wrong detection', () => {
  it('surfaces a match where focus user and every other player scored zero', () => {
    const result = buildRoast({
      focusUserId: MART,
      predictions: [
        row({ predictionId: 'g1', userId: MART, points: 0 }),
        row({ predictionId: 'g1', userId: LIISA, username: 'Liisa', points: 0 }),
        row({ predictionId: 'g1', userId: ANTS, username: 'Ants', points: 0 }),
        // Another match where someone scored — must not surface.
        row({ predictionId: 'g2', userId: MART, points: 0 }),
        row({ predictionId: 'g2', userId: LIISA, username: 'Liisa', points: 5 }),
      ],
    });
    expect(result.groupWrong).toHaveLength(1);
    expect(result.groupWrong[0]).toMatchObject({ predictionId: 'g1' });
  });

  it('does not surface group-wrong when the focus user is the only player on the row', () => {
    const result = buildRoast({
      focusUserId: MART,
      predictions: [row({ predictionId: 'g1', points: 0 })],
    });
    expect(result.groupWrong).toEqual([]);
  });

  it('does not surface group-wrong when at least one other player scored', () => {
    const result = buildRoast({
      focusUserId: MART,
      predictions: [
        row({ predictionId: 'g1', userId: MART, points: 0 }),
        row({ predictionId: 'g1', userId: LIISA, username: 'Liisa', points: 3 }),
      ],
    });
    expect(result.groupWrong).toEqual([]);
  });

  it('does not surface group-wrong when focus user scored', () => {
    const result = buildRoast({
      focusUserId: MART,
      predictions: [
        row({ predictionId: 'g1', userId: MART, points: 5 }),
        row({ predictionId: 'g1', userId: LIISA, username: 'Liisa', points: 0 }),
      ],
    });
    expect(result.groupWrong).toEqual([]);
  });

  it('sorts multiple group-wrong items deterministically', () => {
    const result = buildRoast({
      focusUserId: MART,
      predictions: [
        row({ predictionKind: 'match', predictionId: 'g9', userId: MART, points: 0 }),
        row({ predictionKind: 'match', predictionId: 'g9', userId: LIISA, username: 'Liisa', points: 0 }),
        row({ predictionKind: 'match', predictionId: 'g1', userId: MART, points: 0 }),
        row({ predictionKind: 'match', predictionId: 'g1', userId: LIISA, username: 'Liisa', points: 0 }),
        row({ predictionKind: 'trivia', predictionId: 'q3', userId: MART, points: 0 }),
        row({ predictionKind: 'trivia', predictionId: 'q3', userId: LIISA, username: 'Liisa', points: 0 }),
      ],
    });
    expect(result.groupWrong.map((g) => `${g.predictionKind}:${g.predictionId}`)).toEqual([
      'match:g1',
      'match:g9',
      'trivia:q3',
    ]);
  });
});

describe('buildRoast — solo-correct detection', () => {
  it('surfaces a pick where only the focus user scored', () => {
    const result = buildRoast({
      focusUserId: MART,
      predictions: [
        row({ predictionId: 'g1', userId: MART, points: 5 }),
        row({ predictionId: 'g1', userId: LIISA, username: 'Liisa', points: 0 }),
        row({ predictionId: 'g1', userId: ANTS, username: 'Ants', points: 0 }),
      ],
    });
    expect(result.soloCorrect).toHaveLength(1);
    expect(result.soloCorrect[0]).toMatchObject({ predictionId: 'g1', points: 5 });
  });

  it('does not count a row where the focus user is the only predictor', () => {
    const result = buildRoast({
      focusUserId: MART,
      predictions: [row({ predictionId: 'g1', userId: MART, points: 5 })],
    });
    expect(result.soloCorrect).toEqual([]);
  });

  it('does not count a row where another player also scored', () => {
    const result = buildRoast({
      focusUserId: MART,
      predictions: [
        row({ predictionId: 'g1', userId: MART, points: 5 }),
        row({ predictionId: 'g1', userId: LIISA, username: 'Liisa', points: 3 }),
      ],
    });
    expect(result.soloCorrect).toEqual([]);
  });

  it('sorts multiple solo-correct items deterministically', () => {
    const result = buildRoast({
      focusUserId: MART,
      predictions: [
        row({ predictionKind: 'trivia', predictionId: 'q5', userId: MART, points: 14 }),
        row({ predictionKind: 'trivia', predictionId: 'q5', userId: LIISA, username: 'Liisa', points: 0 }),
        row({ predictionKind: 'match', predictionId: 'g2', userId: MART, points: 5 }),
        row({ predictionKind: 'match', predictionId: 'g2', userId: LIISA, username: 'Liisa', points: 0 }),
      ],
    });
    expect(result.soloCorrect.map((s) => `${s.predictionKind}:${s.predictionId}`)).toEqual([
      'match:g2',
      'trivia:q5',
    ]);
  });
});

describe('buildRoast — solo-wrong detection', () => {
  it('surfaces a pick where everyone else scored but the focus user did not', () => {
    const result = buildRoast({
      focusUserId: MART,
      predictions: [
        row({ predictionId: 'g1', userId: MART, points: 0 }),
        row({ predictionId: 'g1', userId: LIISA, username: 'Liisa', points: 5 }),
        row({ predictionId: 'g1', userId: ANTS, username: 'Ants', points: 3 }),
      ],
    });
    expect(result.soloWrong).toHaveLength(1);
    expect(result.soloWrong[0]).toMatchObject({ predictionId: 'g1', points: 0 });
  });

  it('does not surface solo-wrong when the focus user is the only predictor', () => {
    const result = buildRoast({
      focusUserId: MART,
      predictions: [row({ predictionId: 'g1', userId: MART, points: 0 })],
    });
    expect(result.soloWrong).toEqual([]);
  });

  it('does not surface solo-wrong when any other player also missed', () => {
    const result = buildRoast({
      focusUserId: MART,
      predictions: [
        row({ predictionId: 'g1', userId: MART, points: 0 }),
        row({ predictionId: 'g1', userId: LIISA, username: 'Liisa', points: 5 }),
        row({ predictionId: 'g1', userId: ANTS, username: 'Ants', points: 0 }),
      ],
    });
    expect(result.soloWrong).toEqual([]);
  });

  it('does not surface solo-wrong when the focus user also scored', () => {
    const result = buildRoast({
      focusUserId: MART,
      predictions: [
        row({ predictionId: 'g1', userId: MART, points: 3 }),
        row({ predictionId: 'g1', userId: LIISA, username: 'Liisa', points: 5 }),
      ],
    });
    expect(result.soloWrong).toEqual([]);
  });

  it('sorts multiple solo-wrong items deterministically', () => {
    const result = buildRoast({
      focusUserId: MART,
      predictions: [
        row({ predictionKind: 'trivia', predictionId: 'q4', userId: MART, points: 0 }),
        row({ predictionKind: 'trivia', predictionId: 'q4', userId: LIISA, username: 'Liisa', points: 14 }),
        row({ predictionKind: 'match', predictionId: 'g7', userId: MART, points: 0 }),
        row({ predictionKind: 'match', predictionId: 'g7', userId: LIISA, username: 'Liisa', points: 5 }),
      ],
    });
    expect(result.soloWrong.map((s) => `${s.predictionKind}:${s.predictionId}`)).toEqual([
      'match:g7',
      'trivia:q4',
    ]);
  });
});

describe('buildRoast — cross-surface integration', () => {
  it('combines best, solo-wrong, group-wrong, and solo-correct in a realistic mix', () => {
    const result = buildRoast({
      focusUserId: MART,
      predictions: [
        // Final pick — best (and solo-correct: Liisa missed)
        row({ predictionKind: 'final', predictionId: 'F1', userId: MART, points: 60, label: 'F1: Brasiilia' }),
        row({ predictionKind: 'final', predictionId: 'F1', userId: LIISA, username: 'Liisa', points: 0, label: 'F1: Brasiilia' }),
        // Group-wrong group-stage
        row({ predictionKind: 'match', predictionId: 'g42', userId: MART, points: 0, label: 'Maroko – Belgia' }),
        row({ predictionKind: 'match', predictionId: 'g42', userId: LIISA, username: 'Liisa', points: 0, label: 'Maroko – Belgia' }),
        // Solo-correct trivia
        row({ predictionKind: 'trivia', predictionId: 'q3', userId: MART, points: 14, label: 'Q3 — turniiri parim mängija' }),
        row({ predictionKind: 'trivia', predictionId: 'q3', userId: LIISA, username: 'Liisa', points: 0, label: 'Q3 — turniiri parim mängija' }),
        // Solo-wrong best-thirds — everyone else got grupp C right, Mart didn't
        row({ predictionKind: 'best_thirds', predictionId: 'C', userId: MART, points: 0, label: 'Grupp C — 3. koht' }),
        row({ predictionKind: 'best_thirds', predictionId: 'C', userId: LIISA, username: 'Liisa', points: 8, label: 'Grupp C — 3. koht' }),
        row({ predictionKind: 'best_thirds', predictionId: 'C', userId: ANTS, username: 'Ants', points: 8, label: 'Grupp C — 3. koht' }),
      ],
    });

    expect(result.bestPick).toMatchObject({ predictionKind: 'final', predictionId: 'F1' });
    expect(result.groupWrong).toHaveLength(1);
    expect(result.groupWrong[0]).toMatchObject({ predictionId: 'g42' });
    expect(result.soloCorrect.map((s) => `${s.predictionKind}:${s.predictionId}`)).toEqual([
      'final:F1',
      'trivia:q3',
    ]);
    expect(result.soloWrong).toHaveLength(1);
    expect(result.soloWrong[0]).toMatchObject({ predictionKind: 'best_thirds', predictionId: 'C' });
  });
});
