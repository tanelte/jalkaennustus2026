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
