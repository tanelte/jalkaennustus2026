import { config } from 'dotenv';
import { Client } from 'pg';

config({ path: '.env.local' });

async function main() {
  const url = process.env.DATABASE_URL_ADMIN;
  if (!url) throw new Error('DATABASE_URL_ADMIN missing');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const r = await client.query<{
      round_label: string;
      kickoff: string;
      home: string;
      away: string;
    }>(`
      select g.round_label,
             to_char(g.kickoff_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') as kickoff,
             th.code as home, ta.code as away
      from games g
      join teams th on th.id = g.team_home_id
      join teams ta on ta.id = g.team_away_id
      where g.double_points = true and g.stage_code = 'group_matches'
      order by g.round_label;
    `);
    console.log(`Total double-points group games: ${r.rowCount}`);
    for (const row of r.rows) {
      console.log(`  ${row.round_label}  ${row.kickoff}  ${row.home} vs ${row.away}`);
    }
  } finally {
    await client.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
