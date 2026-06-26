import { log } from '@/lib/log';
import type { FeedProvider, MatchResult } from './types';

export interface GameRow {
  id: string;
  match_id: string | null;
  score_home: number | null;
  score_away: number | null;
  final_status: string | null;
  finish_type: string | null;
  result_source: string | null;
  stage_code: string;
  team_home_id: string | null;
  team_away_id: string | null;
}

export interface ApplyFeedInput {
  game_id: string;
  match_id: string;
  score_home: number | null;
  score_away: number | null;
  final_status: string;
  finish_type: string | null;
}

export interface PollRepo {
  /** Returns the internal tournament UUID for a given short code (e.g. 'WC2026'), or null. */
  findTournamentIdByCode(code: string): Promise<string | null>;
  /**
   * Resolve the games row this feed match maps to. Look up by (tournament_id,
   * match_id) first; fall back to (tournament_id, team_home_code, team_away_code)
   * via the teams table. Knockout rows whose team UUIDs are NULL won't match the
   * fallback and will return null - they're skipped until the bracket fills.
   */
  findGameForMatch(input: {
    tournament_id: string;
    match_id: string;
    team_home_code: string | null;
    team_away_code: string | null;
  }): Promise<GameRow | null>;
  /**
   * Atomic: update the games row with feed-sourced score/status/finish_type,
   * link the match_id, mark result_source='feed', then trigger per-match
   * re-scoring (S06's path).
   */
  applyFeedResult(input: ApplyFeedInput): Promise<{ rescored: number; result_code: string | null }>;
  /** Link match_id only, without touching scores. Used in operator-conflict + first-discovery cases. */
  linkMatchId(input: { game_id: string; match_id: string }): Promise<void>;
  /** Resolve a tournament-scoped team code (TLA) to its internal UUID, or null. */
  findTeamIdByCode(input: { tournament_id: string; code: string }): Promise<string | null>;
  /**
   * Populate a knockout game's team slot(s) from the resolved bracket. Writes
   * only the provided side(s), and only where the column is currently NULL, so
   * an operator-set team is never clobbered (concurrency-safe via SQL guard).
   */
  fillKnockoutTeams(input: {
    game_id: string;
    team_home_id?: string;
    team_away_id?: string;
  }): Promise<void>;
}

export interface PollDeps {
  provider: FeedProvider;
  repo: PollRepo;
}

export interface PollSummary {
  matches_fetched: number;
  matches_updated: number;
  matches_unchanged: number;
  matches_conflicted: number;
  matches_unknown: number;
  knockout_teams_filled: number;
  rate_limit_remaining_minute: number | null;
}

const KNOCKOUT_STAGES = new Set(['r32', 'r16', 'qf', 'sf', 'final']);

interface MatchDecision {
  kind: 'updated' | 'unchanged' | 'conflicted' | 'unknown';
}

function fieldsMatch(existing: GameRow, m: MatchResult): boolean {
  const expectedFinishType = KNOCKOUT_STAGES.has(existing.stage_code) ? m.finish_type : null;
  return (
    existing.match_id === m.match_id &&
    existing.score_home === m.score_home &&
    existing.score_away === m.score_away &&
    existing.final_status === m.final_status &&
    existing.finish_type === expectedFinishType
  );
}

/**
 * Auto-fill a knockout game's NULL team slots from the feed once the bracket
 * resolves. Fills each side independently (the feed reveals matchups
 * incrementally as the group stage / earlier rounds finish), only into NULL
 * slots — an already-set team (operator or prior feed) is never overwritten;
 * a feed code that disagrees with a set slot is logged, not applied. Returns
 * the number of slots filled (0, 1, or 2).
 */
async function maybeFillKnockoutTeams(
  m: MatchResult,
  existing: GameRow,
  tournamentId: string,
  repo: PollRepo,
): Promise<number> {
  if (!KNOCKOUT_STAGES.has(existing.stage_code)) return 0;

  const fill: { team_home_id?: string; team_away_id?: string } = {};

  const sides = [
    { label: 'home', currentId: existing.team_home_id, code: m.team_home_code },
    { label: 'away', currentId: existing.team_away_id, code: m.team_away_code },
  ] as const;

  for (const side of sides) {
    if (!side.code) continue; // feed slot still TBD — nothing to fill yet

    if (side.currentId !== null) {
      // Slot already set. Surface a disagreement but never overwrite.
      const resolved = await repo.findTeamIdByCode({ tournament_id: tournamentId, code: side.code });
      if (resolved && resolved !== side.currentId) {
        log.warn({
          operation: 'cron.results_poller.bracket',
          outcome: 'rejected',
          reason: 'bracket_conflict',
          game_id: existing.id,
          feed_match_id: m.match_id,
          side: side.label,
          existing_team_id: side.currentId,
          feed_team_code: side.code,
          feed_team_id: resolved,
        });
      }
      continue;
    }

    const teamId = await repo.findTeamIdByCode({ tournament_id: tournamentId, code: side.code });
    if (!teamId) {
      log.warn({
        operation: 'cron.results_poller.bracket',
        outcome: 'skipped',
        reason: 'unresolved_team_code',
        game_id: existing.id,
        feed_match_id: m.match_id,
        side: side.label,
        feed_team_code: side.code,
      });
      continue;
    }
    if (side.label === 'home') fill.team_home_id = teamId;
    else fill.team_away_id = teamId;
  }

  const filledCount = (fill.team_home_id ? 1 : 0) + (fill.team_away_id ? 1 : 0);
  if (filledCount === 0) return 0;

  await repo.fillKnockoutTeams({ game_id: existing.id, ...fill });
  // Reflect the write locally so a same-poll result-application sees the teams.
  if (fill.team_home_id) existing.team_home_id = fill.team_home_id;
  if (fill.team_away_id) existing.team_away_id = fill.team_away_id;

  log.info({
    operation: 'cron.results_poller.bracket',
    outcome: 'filled',
    game_id: existing.id,
    feed_match_id: m.match_id,
    stage_code: existing.stage_code,
    team_home_code: fill.team_home_id ? m.team_home_code : undefined,
    team_away_code: fill.team_away_id ? m.team_away_code : undefined,
    slots_filled: filledCount,
  });
  return filledCount;
}

async function decide(
  m: MatchResult,
  existing: GameRow,
  repo: PollRepo,
): Promise<MatchDecision> {
  const isKnockout = KNOCKOUT_STAGES.has(existing.stage_code);
  const incomingFinishType = isKnockout ? m.finish_type : null;

  const differs =
    existing.score_home !== m.score_home ||
    existing.score_away !== m.score_away ||
    existing.final_status !== m.final_status ||
    existing.finish_type !== incomingFinishType;

  if (existing.result_source === 'operator' && differs) {
    log.warn({
      operation: 'cron.results_poller.match',
      outcome: 'rejected',
      reason: 'feed_conflict',
      game_id: existing.id,
      feed_match_id: m.match_id,
      operator_score: `${existing.score_home ?? '-'}-${existing.score_away ?? '-'}`,
      feed_score: `${m.score_home ?? '-'}-${m.score_away ?? '-'}`,
      operator_final_status: existing.final_status,
      feed_final_status: m.final_status,
      operator_finish_type: existing.finish_type,
      feed_finish_type: incomingFinishType,
    });
    if (existing.match_id === null) {
      await repo.linkMatchId({ game_id: existing.id, match_id: m.match_id });
    }
    return { kind: 'conflicted' };
  }

  if (fieldsMatch(existing, m)) {
    return { kind: 'unchanged' };
  }

  await repo.applyFeedResult({
    game_id: existing.id,
    match_id: m.match_id,
    score_home: m.score_home,
    score_away: m.score_away,
    final_status: m.final_status,
    finish_type: incomingFinishType,
  });
  return { kind: 'updated' };
}

export async function pollResultsOnce(
  deps: PollDeps,
  opts: { competitionCode: string; tournamentCode: string },
): Promise<PollSummary> {
  const tournamentId = await deps.repo.findTournamentIdByCode(opts.tournamentCode);
  if (!tournamentId) {
    throw new Error(`pollResultsOnce: tournament code '${opts.tournamentCode}' not found`);
  }

  const fetched = await deps.provider.fetchTournamentMatches({
    competitionCode: opts.competitionCode,
  });

  const summary: PollSummary = {
    matches_fetched: fetched.matches.length,
    matches_updated: 0,
    matches_unchanged: 0,
    matches_conflicted: 0,
    matches_unknown: 0,
    knockout_teams_filled: 0,
    rate_limit_remaining_minute: fetched.rate_limit.remaining_minute,
  };

  for (const m of fetched.matches) {
    const existing = await deps.repo.findGameForMatch({
      tournament_id: tournamentId,
      match_id: m.match_id,
      team_home_code: m.team_home_code,
      team_away_code: m.team_away_code,
    });
    if (!existing) {
      summary.matches_unknown += 1;
      log.info({
        operation: 'cron.results_poller.match',
        outcome: 'skipped',
        reason: 'unknown_match',
        feed_match_id: m.match_id,
        team_home_code: m.team_home_code,
        team_away_code: m.team_away_code,
      });
      continue;
    }
    // Structural bracket fill is independent of result application: a knockout
    // match discovered already finished both fills its teams and applies its
    // result in the same iteration.
    summary.knockout_teams_filled += await maybeFillKnockoutTeams(
      m,
      existing,
      tournamentId,
      deps.repo,
    );

    const decision = await decide(m, existing, deps.repo);
    switch (decision.kind) {
      case 'updated':
        summary.matches_updated += 1;
        break;
      case 'unchanged':
        summary.matches_unchanged += 1;
        break;
      case 'conflicted':
        summary.matches_conflicted += 1;
        break;
      case 'unknown':
        summary.matches_unknown += 1;
        break;
    }
  }

  return summary;
}
