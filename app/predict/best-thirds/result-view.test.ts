import { describe, expect, it } from 'vitest';
import { buildBestThirdsResultView } from './result-view';
import { GROUP_LETTERS } from './constants';

// Official set used across most cases: the first 8 letters (A–H).
const OFFICIAL: readonly string[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function statusOf(view: ReturnType<typeof buildBestThirdsResultView>, letter: string) {
  return view.letters.find((l) => l.letter === letter)!;
}

describe('buildBestThirdsResultView — boundaries', () => {
  it('all 8 picks correct => 64 points, every official letter is correct', () => {
    const view = buildBestThirdsResultView([...OFFICIAL], OFFICIAL);
    expect(view.totalPoints).toBe(64);
    expect(view.maxPoints).toBe(64);
    expect(view.correctCount).toBe(8);
    expect(view.officialLetters).toEqual([...OFFICIAL]);
    for (const letter of OFFICIAL) {
      const cell = statusOf(view, letter);
      expect(cell.status).toBe('correct');
      expect(cell.points).toBe(8);
    }
  });

  it('all 8 picks wrong => 0 points; picks are `wrong`, officials are `missed`', () => {
    const picks = ['I', 'J', 'K', 'L'];
    const view = buildBestThirdsResultView(picks, OFFICIAL);
    expect(view.totalPoints).toBe(0);
    expect(view.correctCount).toBe(0);
    for (const letter of picks) {
      expect(statusOf(view, letter).status).toBe('wrong');
    }
    for (const letter of OFFICIAL) {
      expect(statusOf(view, letter).status).toBe('missed');
    }
  });
});

describe('buildBestThirdsResultView — partial matches', () => {
  // Wrong picks don't affect correctCount, so just append the official slice to
  // a fixed pool of non-official letters and assert k correct => k×8.
  const NON_OFFICIAL = ['I', 'J', 'K', 'L'];
  for (let k = 0; k <= 8; k++) {
    it(`${k} correct picks => ${k * 8} points`, () => {
      const picks = [...OFFICIAL.slice(0, k), ...NON_OFFICIAL];
      const view = buildBestThirdsResultView(picks, OFFICIAL);
      expect(view.correctCount).toBe(k);
      expect(view.totalPoints).toBe(k * 8);
    });
  }
});

describe('buildBestThirdsResultView — letter classification', () => {
  it('flags missed official letters and neutral non-picks', () => {
    // Picks A (correct), I (wrong). Official: A–H. Misses B–H. J,K,L neutral.
    const view = buildBestThirdsResultView(['A', 'I'], OFFICIAL);
    expect(statusOf(view, 'A').status).toBe('correct');
    expect(statusOf(view, 'I').status).toBe('wrong');
    expect(statusOf(view, 'B').status).toBe('missed');
    expect(statusOf(view, 'J').status).toBe('neutral');
    expect(statusOf(view, 'J').points).toBe(0);
  });

  it('returns one cell per group letter in canonical order', () => {
    const view = buildBestThirdsResultView(['A'], OFFICIAL);
    expect(view.letters.map((l) => l.letter)).toEqual([...GROUP_LETTERS]);
  });
});

describe('buildBestThirdsResultView — empty official set', () => {
  it('every letter is neutral and total is 0 when results are not in', () => {
    const view = buildBestThirdsResultView(['A', 'B', 'C'], []);
    expect(view.totalPoints).toBe(0);
    expect(view.correctCount).toBe(0);
    expect(view.officialLetters).toEqual([]);
    for (const cell of view.letters) {
      expect(cell.status).toBe('neutral');
      expect(cell.points).toBe(0);
    }
  });
});
