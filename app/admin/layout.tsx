import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import type { ReactNode } from 'react';

import { AdminModeBanner } from '@/components/admin-mode-banner';
import { TopBar } from '@/components/top-bar';
import { auth, signOut } from '@/lib/auth';
import { clearCurrentUserCookie, getCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { log } from '@/lib/log';
import { checkOperator } from '@/lib/operator/require-operator';
import { resolveTournamentCode } from '@/lib/tournaments/current';
import { users } from '@/db/schema';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Operaatori vaade — Jalkaennustus' };

async function logoutAction() {
  'use server';
  await clearCurrentUserCookie();
  await signOut({ redirectTo: '/login' });
}

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
  const tournamentChip = resolveTournamentCode();

  return (
    <>
      <TopBar
        groupName={session.user.username}
        playerName={operatorUsername}
        isOperator={true}
        tournamentChip={tournamentChip}
        logoutAction={logoutAction}
      />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <AdminModeBanner />
        {children}
      </main>
    </>
  );
}
