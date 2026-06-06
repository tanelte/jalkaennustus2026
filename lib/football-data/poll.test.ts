import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pollResultsOnce, type GameRow, type PollRepo } from './poll';
import type { FeedProvider, FetchOutcome, MatchResult } from './types';

function makeProvider(matches: MatchResult[], remainingMinute: number | null = 5): FeedProvider {
  return {
    async fetchTournamentMatches(): Promise<FetchOutcome> {
      return { matches, rate_limit: { remaining_minute: remainingMinute } };
    },
  };
}

function makeMatch(overrides: Partial<MatchResult> = {}): MatchResult {
  return {
    match_id: 'M1',
    team_home_code: 'USA',
    team_away_code: 'MEX',
    kickoff_at: '2026-06-11T20:00:00Z',
    final_status: 'FINISHED',
    finish_type: 'NORMAL_TIME',
    score_home: 2,
    score_away: 1,
    ...overrides,
  };
}

function makeGameRow(overrides: Partial<GameRow> = {}): GameRow {
  return {
    id: 'game-1',
    match_id: null,
    score_home: null,
    score_away: null,
    final_status: null,
    finish_type: null,
    result_source: null,
    stage_code: 'group_matches',
    ...overrides,
  };
}

interface RepoSpyState {
  findGameRows: Map<string, GameRow | null>; // keyed by match_id; null means "no match"
  applyFeedCalls: Array<{ game_id: string; match_id: string }>;
  linkCalls: Array<{ game_id: string; match_id: string }>;
}

function makeRepo(initial: GameRow[]): { repo: PollRepo; state: RepoSpyState } {
  const state: RepoSpyState = {
    findGameRows: new Map(),
    applyFeedCalls: [],
    linkCalls: [],
  };
  for (const row of initial) {
    if (row.match_id) state.findGameRows.set(row.match_id, row);
  }
  const rowsByGameId = new Map(initial.map((r) => [r.id, r]));

  const repo: PollRepo = {
    async findTournamentIdByCode() {
      return 'tournament-1';
    },
    async findGameForMatch(input) {
      // First try by match_id
      const byId = state.findGameRows.get(input.match_id);
      if (byId) return byId;
      // Fallback: scan initial rows by team codes (requires teams data; for tests
      // we approximate by checking a side-channel - here we just lookup the
      // row that was registered without a match_id under a synthetic key).
      return state.findGameRows.get(`${input.team_home_code}/${input.team_away_code}`) ?? null;
    },
    async applyFeedResult(input) {
      state.applyFeedCalls.push({ game_id: input.game_id, match_id: input.match_id });
      const row = rowsByGameId.get(input.game_id);
      if (row) {
        row.match_id = input.match_id;
        row.score_home = input.score_home;
        row.score_away = input.score_away;
        row.final_status = input.final_status;
        row.finish_type = input.finish_type;
        row.result_source = 'feed';
        state.findGameRows.set(input.match_id, row);
      }
      return { rescored: 3, result_code: '1A' };
    },
    async linkMatchId(input) {
      state.linkCalls.push(input);
      const row = rowsByGameId.get(input.game_id);
      if (row) {
        row.match_id = input.match_id;
        state.findGameRows.set(input.match_id, row);
      }
    },
  };
  return { repo, state };
}

describe('pollResultsOnce', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    logSpy.mockRestore();
  });

  it('writes a fresh feed result and triggers recompute', async () => {
    const row = makeGameRow({ id: 'g1' });
    const { repo, state } = makeRepo([]);
    // register a team-code fallback hit (no match_id yet)
    state.findGameRows.set('USA/MEX', row);

    const summary = await pollResultsOnce(
      { provider: makeProvider([makeMatch()]), repo },
      { competitionCode: 'WC', tournamentCode: 'WC2026' },
    );

    expect(summary.matches_fetched).toBe(1);
    expect(summary.matches_updated).toBe(1);
    expect(summary.matches_unchanged).toBe(0);
    expect(state.applyFeedCalls).toEqual([{ game_id: 'g1', match_id: 'M1' }]);
  });

  it('reports unchanged on a no-op re-invocation (idempotency)', async () => {
    const row = makeGameRow({
      id: 'g1',
      match_id: 'M1',
      score_home: 2,
      score_away: 1,
      final_status: 'FINISHED',
      // Group stage rows persist finish_type as NULL (operator path mirrors this);
      // the orchestrator's fieldsMatch ignores incoming finish_type for group games.
      finish_type: null,
      result_source: 'feed',
    });
    const { repo, state } = makeRepo([row]);

    const summary = await pollResultsOnce(
      { provider: makeProvider([makeMatch()]), repo },
      { competitionCode: 'WC', tournamentCode: 'WC2026' },
    );

    expect(summary.matches_unchanged).toBe(1);
    expect(summary.matches_updated).toBe(0);
    expect(state.applyFeedCalls).toEqual([]);
  });

  it('preserves operator value on conflict, logs feed_conflict, links match_id if missing', async () => {
    const row = makeGameRow({
      id: 'g1',
      match_id: null,
      score_home: 3,
      score_away: 0,
      final_status: 'FINISHED',
      finish_type: 'NORMAL_TIME',
      result_source: 'operator',
    });
    const { repo, state } = makeRepo([]);
    state.findGameRows.set('USA/MEX', row);

    const summary = await pollResultsOnce(
      { provider: makeProvider([makeMatch({ score_home: 2, score_away: 1 })]), repo },
      { competitionCode: 'WC', tournamentCode: 'WC2026' },
    );

    expect(summary.matches_conflicted).toBe(1);
    expect(summary.matches_updated).toBe(0);
    expect(state.applyFeedCalls).toEqual([]);
    expect(state.linkCalls).toEqual([{ game_id: 'g1', match_id: 'M1' }]);
    // Verify a feed_conflict log line was emitted
    const lines = logSpy.mock.calls.map((c) => JSON.parse(c[0] as string));
    expect(lines.some((l) => l.outcome === 'rejected' && l.reason === 'feed_conflict')).toBe(true);
  });

  it('counts unknown matches when no games row resolves', async () => {
    const { repo } = makeRepo([]);
    const summary = await pollResultsOnce(
      { provider: makeProvider([makeMatch({ team_home_code: 'XXX', team_away_code: 'YYY' })]), repo },
      { competitionCode: 'WC', tournamentCode: 'WC2026' },
    );
    expect(summary.matches_unknown).toBe(1);
    expect(summary.matches_updated).toBe(0);
  });

  it('surfaces rate-limit remaining_minute on the summary', async () => {
    const { repo } = makeRepo([]);
    const summary = await pollResultsOnce(
      { provider: makeProvider([], 3), repo },
      { competitionCode: 'WC', tournamentCode: 'WC2026' },
    );
    expect(summary.rate_limit_remaining_minute).toBe(3);
  });

  it('does not overwrite an operator-set value even when scores happen to match status', async () => {
    // Operator entered 2-1 FINISHED NORMAL_TIME; feed returns the same -> no conflict, just unchanged.
    const row = makeGameRow({
      id: 'g1',
      match_id: 'M1',
      score_home: 2,
      score_away: 1,
      final_status: 'FINISHED',
      finish_type: null, // group_matches: persisted finish_type is NULL
      result_source: 'operator',
    });
    const { repo, state } = makeRepo([row]);
    const summary = await pollResultsOnce(
      { provider: makeProvider([makeMatch()]), repo },
      { competitionCode: 'WC', tournamentCode: 'WC2026' },
    );
    expect(summary.matches_unchanged).toBe(1);
    expect(summary.matches_conflicted).toBe(0);
    expect(state.applyFeedCalls).toEqual([]);
  });

  it('honours finish_type for knockout rows on the unchanged path', async () => {
    const row = makeGameRow({
      id: 'g1',
      match_id: 'K1',
      stage_code: 'qf',
      score_home: 1,
      score_away: 0,
      final_status: 'FINISHED',
      finish_type: 'EXTRA_TIME',
      result_source: 'feed',
    });
    const { repo, state } = makeRepo([row]);
    const summary = await pollResultsOnce(
      {
        provider: makeProvider([
          makeMatch({ match_id: 'K1', finish_type: 'EXTRA_TIME', score_home: 1, score_away: 0 }),
        ]),
        repo,
      },
      { competitionCode: 'WC', tournamentCode: 'WC2026' },
    );
    expect(summary.matches_unchanged).toBe(1);
    expect(state.applyFeedCalls).toEqual([]);
  });

  it('flags a conflict when knockout finish_type differs from operator value', async () => {
    const row = makeGameRow({
      id: 'g1',
      match_id: 'K2',
      stage_code: 'sf',
      score_home: 2,
      score_away: 1,
      final_status: 'FINISHED',
      finish_type: 'NORMAL_TIME',
      result_source: 'operator',
    });
    const { repo, state } = makeRepo([row]);
    const summary = await pollResultsOnce(
      {
        provider: makeProvider([
          makeMatch({ match_id: 'K2', finish_type: 'EXTRA_TIME', score_home: 2, score_away: 1 }),
        ]),
        repo,
      },
      { competitionCode: 'WC', tournamentCode: 'WC2026' },
    );
    expect(summary.matches_conflicted).toBe(1);
    expect(state.applyFeedCalls).toEqual([]);
  });

  it('throws when the tournament code is unknown', async () => {
    const repo: PollRepo = {
      async findTournamentIdByCode() {
        return null;
      },
      async findGameForMatch() {
        return null;
      },
      async applyFeedResult() {
        return { rescored: 0, result_code: null };
      },
      async linkMatchId() {},
    };
    await expect(
      pollResultsOnce(
        { provider: makeProvider([]), repo },
        { competitionCode: 'WC', tournamentCode: 'NOPE' },
      ),
    ).rejects.toThrow(/tournament code 'NOPE' not found/);
  });
});
