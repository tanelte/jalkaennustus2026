/**
 * S18 pre-kickoff gate: confirm WC2026 is in the football-data.org free-tier
 * coverage. Per ADR-02, this must run by 2026-06-08; failure triggers the
 * backup-provider swap or activates the manual-only path.
 *
 * Usage: pnpm tsx scripts/verify-feed-coverage.ts
 * Reads: FOOTBALL_DATA_API_KEY, FOOTBALL_DATA_BASE_URL (optional),
 *        FOOTBALL_DATA_COMPETITION_CODE (default 'WC').
 *
 * Exits 0 on coverage confirmed; non-zero otherwise.
 */
import { config } from 'dotenv';

config({ path: '.env.local' });

interface CompetitionRow {
  code?: string;
  name?: string;
  plan?: string;
}

async function main() {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  const baseUrl = (process.env.FOOTBALL_DATA_BASE_URL ?? 'https://api.football-data.org').replace(
    /\/$/,
    '',
  );
  const competitionCode = process.env.FOOTBALL_DATA_COMPETITION_CODE ?? 'WC';

  if (!apiKey) {
    console.log(
      JSON.stringify({
        operation: 'verify_feed_coverage',
        outcome: 'error',
        reason: 'missing_api_key',
      }),
    );
    process.exit(1);
  }

  const url = `${baseUrl}/v4/competitions`;
  const res = await fetch(url, { headers: { 'X-Auth-Token': apiKey } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.log(
      JSON.stringify({
        operation: 'verify_feed_coverage',
        outcome: 'error',
        upstream_status: res.status,
        body_excerpt: body.slice(0, 200),
      }),
    );
    process.exit(1);
  }

  const json = (await res.json()) as { competitions?: CompetitionRow[] };
  const hit = (json.competitions ?? []).find((c) => c.code === competitionCode);
  if (!hit) {
    console.log(
      JSON.stringify({
        operation: 'verify_feed_coverage',
        outcome: 'rejected',
        reason: 'competition_not_in_free_tier',
        competition_code: competitionCode,
        available_codes: (json.competitions ?? []).map((c) => c.code).filter(Boolean),
      }),
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify({
      operation: 'verify_feed_coverage',
      outcome: 'ok',
      competition_code: competitionCode,
      name: hit.name ?? null,
      plan: hit.plan ?? null,
    }),
  );
}

main().catch((err) => {
  console.log(
    JSON.stringify({
      operation: 'verify_feed_coverage',
      outcome: 'error',
      message: err instanceof Error ? err.message : String(err),
    }),
  );
  process.exit(1);
});
