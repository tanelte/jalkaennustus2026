import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { TopBar } from '@/components/top-bar';
import { Card, CardContent } from '@/components/ui/card';
import { auth, signOut } from '@/lib/auth';
import { clearCurrentUserCookie, getCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { resolveTournamentCode } from '@/lib/tournaments/current';
import { users } from '@/db/schema';
import { JoinGroupForm } from './join-group-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Liitu teise grupiga' };

async function logoutAction() {
  'use server';
  await clearCurrentUserCookie();
  await signOut({ redirectTo: '/login' });
}

export default async function JoinGroupPage() {
  const session = await auth();
  if (!session?.user?.group_id) {
    redirect('/login');
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    redirect('/select-user');
  }

  const rows = await db
    .select({ username: users.username, is_operator: users.is_operator })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    redirect('/select-user');
  }

  const tournamentChip = resolveTournamentCode();

  return (
    <>
      <TopBar
        groupName={session.user.username}
        playerName={row.username}
        isOperator={row.is_operator}
        tournamentChip={tournamentChip}
        logoutAction={logoutAction}
      />
      <main className="mx-auto max-w-xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="space-y-1">
          <h1 className="text-3xl font-semibold">Liitu teise grupiga</h1>
          <p className="text-sm text-text-muted">
            Kui soovid liituda ka mõne teise ennustusgrupiga, siis lisa end siit
            selle liikmeks. Edaspidi saad sellesse gruppi tavapäraselt sisse
            logida.
          </p>
        </header>

        <Card>
          <CardContent className="pt-6">
            <JoinGroupForm />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
