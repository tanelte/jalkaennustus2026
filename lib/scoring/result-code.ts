import type { FeedMatch, MapResultOutcome } from './types';

/**
 * Map a normalised feed payload to a group-stage result code.
 *
 * Group-stage interpretation: a margin of >=3 goals separates the wide-win
 * codes (`1B`, `2B`) from the narrow-win codes (`1A`, `2A`); a 0 margin is
 * a draw (`X`). Knockout interpretation (where the first character flips to
 * mean normal-time vs extra-time/penalties) is out of scope for S03 and
 * lands in S08 alongside `team-score.ts`.
 *
 * Non-FINISHED statuses return an explicit `no-result` outcome rather than
 * silently falling back to a code -- consistent with the architecture's
 * "raise an explicit non-result code" requirement.
 */
export function mapFeedToResultCode(match: FeedMatch): MapResultOutcome {
  switch (match.status) {
    case 'FINISHED':
    case 'AWARDED': {
      const diff = match.homeScore - match.awayScore;
      if (diff === 0) return { kind: 'result', code: 'X' };
      if (diff >= 3) return { kind: 'result', code: '1B' };
      if (diff >= 1) return { kind: 'result', code: '1A' };
      if (diff <= -3) return { kind: 'result', code: '2B' };
      return { kind: 'result', code: '2A' };
    }
    case 'POSTPONED':
      return { kind: 'no-result', reason: 'POSTPONED' };
    case 'CANCELLED':
      return { kind: 'no-result', reason: 'CANCELLED' };
    case 'SUSPENDED':
      return { kind: 'no-result', reason: 'ABANDONED' };
    case 'SCHEDULED':
    case 'TIMED':
    case 'IN_PLAY':
    case 'PAUSED':
      return { kind: 'no-result', reason: 'NOT_FINAL' };
  }
}
