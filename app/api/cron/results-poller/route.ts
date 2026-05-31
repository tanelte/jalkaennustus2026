import { NextResponse, type NextRequest } from 'next/server';
import { log } from '@/lib/log';

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
  log.info({ operation: 'cron.results_poller', outcome: 'stub' });
  return NextResponse.json({ status: 'stub' });
}
