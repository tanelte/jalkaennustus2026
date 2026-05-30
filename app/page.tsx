import { sql } from 'drizzle-orm';
import Link from 'next/link';
import { auth, signOut } from '@/lib/auth';
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

async function logoutAction() {
  'use server';
  await signOut({ redirectTo: '/login' });
}

export default async function Home() {
  const session = await auth();
  const status = await checkDatabase();

  return (
    <main className="mx-auto max-w-2xl p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Jalkaennustus</h1>
        {session?.user?.username && (
          <form action={logoutAction} className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              Grupp: <strong>{session.user.username}</strong>
            </span>
            <button type="submit" className="rounded border px-3 py-1 text-sm">
              Logi välja
            </button>
          </form>
        )}
      </header>
      <p className="mt-2 text-gray-600">WC2026 platvormi skelett.</p>
      <section className="mt-6 rounded border p-4" aria-live="polite">
        <h2 className="text-lg font-medium">Andmebaas</h2>
        {status.ok ? (
          <p className="mt-1 text-green-700">DB connected</p>
        ) : (
          <p className="mt-1 text-red-700">DB error: {status.error}</p>
        )}
      </section>
      {session?.user?.group_id && (
        <nav className="mt-6">
          <Link href="/leaderboard" className="text-sm underline">
            Edetabel
          </Link>
        </nav>
      )}
    </main>
  );
}
