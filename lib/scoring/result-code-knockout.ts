import type { KnockoutFeedMatch, MapResultOutcome } from './types';

/**
 * Map a knockout-stage feed payload to a result code.
 *
 * Knockout interpretation of the A/B suffix differs from group-stage: A means
 * the match was decided in normal time, B means it went to extra time or a
 * penalty shootout. Draws are not possible in knockouts -- equal scores yield
 * an explicit non-result so the operator must enter the deciding score (for a
 * penalty win, the convention is to enter the shootout score itself, e.g. 4-3).
 *
 * Pure function -- no I/O. Sibling to `result-code.ts` (the group-stage mapper).
 * Used by S06's operator admin today and by S08's knockout team-prediction
 * scoring once that story lands.
 */
export function mapKnockoutFeedToResultCode(match: KnockoutFeedMatch): MapResultOutcome {
  switch (match.status) {
    case 'FINISHED':
    case 'AWARDED': {
      if (match.homeScore === match.awayScore) {
        return { kind: 'no-result', reason: 'KNOCKOUT_TIE_INVALID' };
      }
      const normalTime = match.finishType === 'NORMAL_TIME';
      if (match.homeScore > match.awayScore) {
        return { kind: 'result', code: normalTime ? '1A' : '1B' };
      }
      return { kind: 'result', code: normalTime ? '2A' : '2B' };
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
