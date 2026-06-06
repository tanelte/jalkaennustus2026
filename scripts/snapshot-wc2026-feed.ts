/**
 * One-shot: fetch football-data.org WC2026 matches and write the raw payload
 * to db/seed-data/wc2026-fixtures.json. This snapshot is the source-of-truth
 * for the post-draw seed. Re-run only when the schedule actually changes
 * (e.g. postponed match, fixture re-draw, kick-off time amendment).
 */
import { config } from 'dotenv';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

config({ path: '.env.local' });

async function main() {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) throw new Error('FOOTBALL_DATA_API_KEY missing');
  const baseUrl = (process.env.FOOTBALL_DATA_BASE_URL ?? 'https://api.football-data.org').replace(
    /\/$/,
    '',
  );
  const competitionCode = process.env.FOOTBALL_DATA_COMPETITION_CODE ?? 'WC';
  const url = `${baseUrl}/v4/competitions/${encodeURIComponent(competitionCode)}/matches`;
  const res = await fetch(url, { headers: { 'X-Auth-Token': apiKey } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`feed fetch failed: status=${res.status} body=${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const outPath = join(process.cwd(), 'db', 'seed-data', 'wc2026-fixtures.json');
  writeFileSync(outPath, JSON.stringify(json, null, 2) + '\n');
  const n = Array.isArray((json as { matches?: unknown[] }).matches)
    ? (json as { matches: unknown[] }).matches.length
    : 0;
  console.log(
    JSON.stringify({ operation: 'snapshot_wc2026_feed', outcome: 'ok', matches: n, path: outPath }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
