import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';

async function checkDatabase(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db.execute(sql`select 1`);
    log.info({ operation: 'home_page_health_check', outcome: 'ok' });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    log.error({ operation: 'home_page_health_check', outcome: 'error', message });
    return { ok: false, error: message };
  }
}

export default async function Home() {
  const status = await checkDatabase();

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">Jalkaennustus</h1>
      <p className="mt-2 text-gray-600">WC2026 platform skeleton (S01).</p>
      <section className="mt-6 rounded border p-4" aria-live="polite">
        <h2 className="text-lg font-medium">Database</h2>
        {status.ok ? (
          <p className="mt-1 text-green-700">DB connected</p>
        ) : (
          <p className="mt-1 text-red-700">DB error: {status.error}</p>
        )}
      </section>
    </main>
  );
}
