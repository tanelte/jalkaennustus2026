import { NextResponse, type NextRequest } from 'next/server';
import { log } from '@/lib/log';
import {
  createFootballDataOrgProvider,
  drizzlePollRepo,
  FeedFetchError,
  pollResultsOnce,
} from '@/lib/football-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    log.warn({ operation: 'cron.results_poller', outcome: 'rejected', reason: 'unauthorized' });
    return new NextResponse(null, { status: 401 });
  }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    log.error({
      operation: 'cron.results_poller',
      outcome: 'error',
      reason: 'missing_api_key',
    });
    return NextResponse.json({ status: 'error', reason: 'missing_api_key' });
  }

  const baseUrl = process.env.FOOTBALL_DATA_BASE_URL ?? 'https://api.football-data.org';
  const competitionCode = process.env.FOOTBALL_DATA_COMPETITION_CODE ?? 'WC';
  const tournamentCode = process.env.FOOTBALL_DATA_TOURNAMENT_CODE ?? 'WC2026';

  const provider = createFootballDataOrgProvider({ apiKey, baseUrl });

  try {
    const summary = await pollResultsOnce(
      { provider, repo: drizzlePollRepo },
      { competitionCode, tournamentCode },
    );
    log.info({ operation: 'cron.results_poller', outcome: 'ok', ...summary });
    return NextResponse.json({ status: 'ok', ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isFeedErr = err instanceof FeedFetchError;
    log.error({
      operation: 'cron.results_poller',
      outcome: 'error',
      message,
      ...(isFeedErr ? { upstream_status: err.status, rate_limited: err.rate_limited } : {}),
    });
    // Return 200 so Vercel Cron doesn't mark a transient upstream issue as a
    // failing job; the next scheduled invocation retries naturally. Per S18 AC:
    // "logs the failure and exits cleanly with no in-handler retry loop".
    return NextResponse.json({
      status: 'error',
      reason: isFeedErr ? 'feed_unreachable' : 'internal',
    });
  }
}
