import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { auth, signOut } from '@/lib/auth';
import { clearCurrentUserCookie, getCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { log } from '@/lib/log';
import { users } from '@/db/schema';

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

async function loadUsername(userId: string): Promise<string | null> {
  const rows = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.username ?? null;
}

async function logoutAction() {
  'use server';
  await clearCurrentUserCookie();
  await signOut({ redirectTo: '/login' });
}

export default async function Home() {
  const session = await auth();
  const currentUserId = await getCurrentUserId();
  const [status, currentUsername] = await Promise.all([
    checkDatabase(),
    currentUserId ? loadUsername(currentUserId) : Promise.resolve(null),
  ]);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Jalkaennustus</h1>
        {session?.user?.username && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-600">
              Grupp: <strong>{session.user.username}</strong>
            </span>
            {currentUsername && (
              <span className="text-gray-600">
                Kasutaja: <strong>{currentUsername}</strong>
              </span>
            )}
            <Link href="/select-user" className="rounded border px-3 py-1">
              Vaheta kasutajat
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="rounded border px-3 py-1">
                Logi välja
              </button>
            </form>
          </div>
        )}
      </header>
      <p className="mt-2 text-gray-600">WC2026 platvormi skelett.</p>

      <nav className="mt-6">
        <h2 className="text-lg font-medium">Ennustused</h2>
        <ul className="mt-2 space-y-1 text-sm">
          <li>
            <Link href="/predict/best-thirds" className="text-blue-700 hover:underline">
              Best-thirds (8 paremat kolmandat)
            </Link>
          </li>
        </ul>
      </nav>

      <section className="mt-6 rounded border p-4" aria-live="polite">
        <h2 className="text-lg font-medium">Andmebaas</h2>
        {status.ok ? (
          <p className="mt-1 text-green-700">DB connected</p>
        ) : (
          <p className="mt-1 text-red-700">DB error: {status.error}</p>
        )}
      </section>
    </main>
  );
}
