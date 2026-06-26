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
    team_home_id: null,
    team_away_id: null,
    ...overrides,
  };
}

interface RepoSpyState {
  findGameRows: Map<string, GameRow | null>; // keyed by match_id; null means "no match"
  applyFeedCalls: Array<{ game_id: string; match_id: string }>;
  linkCalls: Array<{ game_id: string; match_id: string }>;
  fillCalls: Array<{ game_id: string; team_home_id?: string; team_away_id?: string }>;
}

// Codes the fake teams table can resolve. A code outside this set resolves to
// null (exercises the unresolved_team_code path). Resolution is deterministic:
// code 'USA' -> 'team-USA'.
const KNOWN_TEAM_CODES = new Set(['USA', 'MEX', 'RSA', 'CAN', 'BRA', 'ARG']);

function makeRepo(
  initial: GameRow[],
  opts: { knownCodes?: Set<string> } = {},
): { repo: PollRepo; state: RepoSpyState } {
  const knownCodes = opts.knownCodes ?? KNOWN_TEAM_CODES;
  const state: RepoSpyState = {
    findGameRows: new Map(),
    applyFeedCalls: [],
    linkCalls: [],
    fillCalls: [],
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
    async findTeamIdByCode(input) {
      return knownCodes.has(input.code) ? `team-${input.code}` : null;
    },
    async fillKnockoutTeams(input) {
      state.fillCalls.push(input);
      const row = rowsByGameId.get(input.game_id);
      if (row) {
        // Mirror the SQL NULL-guard: only fill a slot that is currently NULL.
        if (input.team_home_id && row.team_home_id === null) row.team_home_id = input.team_home_id;
        if (input.team_away_id && row.team_away_id === null) row.team_away_id = input.team_away_id;
      }
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
      async findTeamIdByCode() {
        return null;
      },
      async fillKnockoutTeams() {},
    };
    await expect(
      pollResultsOnce(
        { provider: makeProvider([]), repo },
        { competitionCode: 'WC', tournamentCode: 'NOPE' },
      ),
    ).rejects.toThrow(/tournament code 'NOPE' not found/);
  });
});

describe('pollResultsOnce — knockout bracket auto-fill', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    logSpy.mockRestore();
  });

  // A knockout game already linked by match_id (the seed links these) whose
  // result fields equal the feed's — so the result path stays 'unchanged' and
  // the test isolates the team-fill behaviour.
  function makeKnockoutRow(overrides: Partial<GameRow> = {}): GameRow {
    return makeGameRow({
      id: 'k1',
      match_id: 'K1',
      stage_code: 'r32',
      score_home: null,
      score_away: null,
      final_status: 'TIMED',
      finish_type: null,
      result_source: 'feed',
      team_home_id: null,
      team_away_id: null,
      ...overrides,
    });
  }
  // Feed payload matching the row's result fields (so decide() -> unchanged),
  // carrying the now-resolved bracket codes.
  function makeKnockoutMatch(overrides: Partial<MatchResult> = {}): MatchResult {
    return makeMatch({
      match_id: 'K1',
      final_status: 'TIMED',
      finish_type: null,
      score_home: null,
      score_away: null,
      team_home_code: 'RSA',
      team_away_code: 'CAN',
      ...overrides,
    });
  }

  function logLines() {
    return logSpy.mock.calls.map((c) => JSON.parse(c[0] as string));
  }

  it('fills both NULL slots when the feed resolves both teams', async () => {
    const { repo, state } = makeRepo([makeKnockoutRow()]);
    const summary = await pollResultsOnce(
      { provider: makeProvider([makeKnockoutMatch()]), repo },
      { competitionCode: 'WC', tournamentCode: 'WC2026' },
    );
    expect(summary.knockout_teams_filled).toBe(2);
    expect(summary.matches_unchanged).toBe(1);
    expect(state.fillCalls).toEqual([
      { game_id: 'k1', team_home_id: 'team-RSA', team_away_id: 'team-CAN' },
    ]);
    expect(state.applyFeedCalls).toEqual([]);
  });

  it('fills only the NULL side, leaving an already-set team untouched (incremental draw)', async () => {
    // RSA already known; opponent resolves later in the feed.
    const { repo, state } = makeRepo([makeKnockoutRow({ team_home_id: 'team-RSA' })]);
    const summary = await pollResultsOnce(
      { provider: makeProvider([makeKnockoutMatch()]), repo },
      { competitionCode: 'WC', tournamentCode: 'WC2026' },
    );
    expect(summary.knockout_teams_filled).toBe(1);
    expect(state.fillCalls).toEqual([{ game_id: 'k1', team_away_id: 'team-CAN' }]);
  });

  it('fills nothing when both slots are already set (idempotent re-poll)', async () => {
    const { repo, state } = makeRepo([
      makeKnockoutRow({ team_home_id: 'team-RSA', team_away_id: 'team-CAN' }),
    ]);
    const summary = await pollResultsOnce(
      { provider: makeProvider([makeKnockoutMatch()]), repo },
      { competitionCode: 'WC', tournamentCode: 'WC2026' },
    );
    expect(summary.knockout_teams_filled).toBe(0);
    expect(state.fillCalls).toEqual([]);
  });

  it('skips an unresolvable team code (logs unresolved_team_code) and fills the resolvable side', async () => {
    const { repo, state } = makeRepo([makeKnockoutRow()]);
    const summary = await pollResultsOnce(
      // 'ZZZ' is not a known team code; 'CAN' resolves.
      { provider: makeProvider([makeKnockoutMatch({ team_home_code: 'ZZZ' })]), repo },
      { competitionCode: 'WC', tournamentCode: 'WC2026' },
    );
    expect(summary.knockout_teams_filled).toBe(1);
    expect(state.fillCalls).toEqual([{ game_id: 'k1', team_away_id: 'team-CAN' }]);
    expect(
      logLines().some(
        (l) => l.outcome === 'skipped' && l.reason === 'unresolved_team_code' && l.side === 'home',
      ),
    ).toBe(true);
  });

  it('never fills a group-stage game even when feed carries team codes', async () => {
    const { repo, state } = makeRepo([
      makeKnockoutRow({ stage_code: 'group_matches', match_id: 'G1' }),
    ]);
    const summary = await pollResultsOnce(
      { provider: makeProvider([makeKnockoutMatch({ match_id: 'G1' })]), repo },
      { competitionCode: 'WC', tournamentCode: 'WC2026' },
    );
    expect(summary.knockout_teams_filled).toBe(0);
    expect(state.fillCalls).toEqual([]);
  });

  it('logs a bracket_conflict and does not overwrite when the feed disagrees with a set slot', async () => {
    // Home is already CAN-equivalent? No — set to USA; feed says BRA for home.
    const { repo, state } = makeRepo([
      makeKnockoutRow({ team_home_id: 'team-USA', team_away_id: 'team-CAN' }),
    ]);
    const summary = await pollResultsOnce(
      { provider: makeProvider([makeKnockoutMatch({ team_home_code: 'BRA' })]), repo },
      { competitionCode: 'WC', tournamentCode: 'WC2026' },
    );
    expect(summary.knockout_teams_filled).toBe(0);
    expect(state.fillCalls).toEqual([]);
    expect(
      logLines().some(
        (l) =>
          l.outcome === 'rejected' &&
          l.reason === 'bracket_conflict' &&
          l.side === 'home' &&
          l.existing_team_id === 'team-USA' &&
          l.feed_team_id === 'team-BRA',
      ),
    ).toBe(true);
  });
});
