import { redirect } from 'next/navigation';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import type { ReactNode } from 'react';
import { auth } from '@/lib/auth';
import { getCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { log } from '@/lib/log';
import { checkOperator } from '@/lib/operator/require-operator';
import { users } from '@/db/schema';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Operaatori vaade — Jalkaennustus' };

async function loadUsername(userId: string): Promise<string | null> {
  const rows = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.username ?? null;
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user?.group_id) {
    redirect('/login');
  }

  const currentUserId = await getCurrentUserId();
  const gate = await checkOperator(currentUserId);
  if (!gate.ok) {
    log.warn({
      operation: 'admin_gate',
      outcome: 'rejected',
      reason: gate.reason ?? 'unknown',
      user_id: currentUserId ?? null,
    });
    if (gate.reason === 'no_user') {
      redirect('/select-user');
    }
    redirect('/');
  }

  const operatorUsername = currentUserId ? await loadUsername(currentUserId) : null;

  return (
    <main className="mx-auto max-w-4xl p-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div>
          <Link href="/" className="text-sm text-gray-500 hover:underline">
            ← Tagasi
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Operaatori vaade</h1>
        </div>
        <div className="text-sm text-gray-700">
          <span>
            Ennustab:{' '}
            <strong>{operatorUsername ?? '—'}</strong>{' '}
            <Link href="/select-user" className="underline">
              [vaheta mängijat]
            </Link>
          </span>
        </div>
      </header>

      <nav className="mt-4 flex gap-4 text-sm" aria-label="Operaatori menüü">
        <Link href="/admin" className="underline">
          Avaleht
        </Link>
        <Link href="/admin/matches" className="underline">
          Mängude tulemused
        </Link>
        <Link href="/admin/best-thirds" className="underline">
          Best-thirds kinnitus
        </Link>
        <Link href="/admin/finals" className="underline">
          Finaali kinnitus
        </Link>
      </nav>

      <section className="mt-6">{children}</section>
    </main>
  );
}
