import { config } from 'dotenv';
import { Client } from 'pg';

config({ path: '.env.local' });

async function main() {
  const url = process.env.DATABASE_URL_ADMIN;
  if (!url) throw new Error('DATABASE_URL_ADMIN missing');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const tables = ['user_games', 'user_teams', 'user_best_thirds', 'user_questions'];
    for (const t of tables) {
      const r = await client.query<{ n: string }>(`select count(*) as n from ${t}`);
      console.log(`${t}: ${r.rows[0].n} rows`);
    }
    const stages = await client.query<{ code: string; opens_at: string; closes_at: string }>(
      `select code, opens_at::text as opens_at, closes_at::text as closes_at from stages order by opens_at`,
    );
    console.log('\nstages:');
    for (const s of stages.rows) console.log(`  ${s.code}  opens=${s.opens_at}  closes=${s.closes_at}`);
    const groups = await client.query<{ n: string }>(`select count(*) as n from groups`);
    const users = await client.query<{ n: string }>(`select count(*) as n from users where is_system_user is not true`);
    console.log(`\ngroups: ${groups.rows[0].n}  non-system users: ${users.rows[0].n}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
