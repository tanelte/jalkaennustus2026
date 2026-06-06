import { config } from 'dotenv';
import { Client } from 'pg';

config({ path: '.env.local' });

async function main() {
  const url = process.env.DATABASE_URL_ADMIN;
  if (!url) throw new Error('DATABASE_URL_ADMIN missing');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const rows = await client.query<{
      letter: string;
      round_label: string;
      kickoff: string;
      home: string;
      away: string;
    }>(`
      select
        th.group_letter as letter,
        g.round_label,
        to_char(g.kickoff_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') as kickoff,
        th.code as home,
        ta.code as away
      from games g
      join teams th on th.id = g.team_home_id
      join teams ta on ta.id = g.team_away_id
      where g.stage_code = 'group_matches'
      order by th.group_letter, g.round_label;
    `);
    let curLetter = '';
    for (const r of rows.rows) {
      if (r.letter !== curLetter) {
        console.log(`\n=== Group ${r.letter} ===`);
        curLetter = r.letter;
      }
      console.log(`  ${r.round_label}  ${r.kickoff}  ${r.home} vs ${r.away}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
