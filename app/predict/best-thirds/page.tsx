import { and, asc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { EnnustabBanner } from '@/components/ennustab-banner';
import { TopBar } from '@/components/top-bar';
import { Card, CardContent } from '@/components/ui/card';
import { WindowStatePill } from '@/components/window-state-pill';
import { auth, signOut } from '@/lib/auth';
import {
  clearCurrentUserCookie,
  requireCurrentUserId,
} from '@/lib/current-user';
import { db } from '@/lib/db';
import { getMaskedRecoveryEmailForUser } from '@/lib/pin/recovery';
import { isStageOpen } from '@/lib/stages/is-stage-open';
import { resolveTournamentCode, getCurrentTournamentId } from '@/lib/tournaments/current';
import { user_best_thirds, users } from '@/db/schema';
import { loadBestThirdsPeerRows } from '@/lib/peer-predictions/load-best-thirds-payloads';
import { BestThirdsForm } from './best-thirds-form';
import { BestThirdsPeerBar } from './best-thirds-peer-bar';
import { BEST_THIRDS_STAGE_CODE } from './constants';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Best-thirds — Jalkaennustus' };

async function logoutAction() {
  'use server';
  await clearCurrentUserCookie();
  await signOut({ redirectTo: '/login' });
}

async function loadPlayerContext(
  userId: string,
): Promise<{ playerName: string; isOperator: boolean }> {
  const rows = await db
    .select({ username: users.username, is_operator: users.is_operator })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return {
    playerName: rows[0]?.username ?? 'tundmatu mängija',
    isOperator: rows[0]?.is_operator ?? false,
  };
}

async function loadCurrentPicks(userId: string, tournamentId: string): Promise<string[]> {
  const rows = await db
    .select({ group_letter: user_best_thirds.group_letter })
    .from(user_best_thirds)
    .where(
      and(
        eq(user_best_thirds.user_id, userId),
        eq(user_best_thirds.tournament_id, tournamentId),
      ),
    )
    .orderBy(asc(user_best_thirds.group_letter));
  return rows.map((r) => r.group_letter);
}

/**
 * UX spec §15.4 — shared prediction shell wraps the best-thirds tile grid.
 * The exactly-8 server-side validation rule is preserved (see story S05
 * §Out and §20.4); this page only re-skins the surface.
 */
export default async function BestThirdsPage() {
  const session = await auth();
  if (!session?.user?.group_id) redirect('/login');

  const userId = await requireCurrentUserId();
  const tournamentId = await getCurrentTournamentId();
  const tournamentChip = resolveTournamentCode();

  const [picks, gate, { playerName, isOperator }, maskedRecoveryEmail, peerRows] =
    await Promise.all([
      loadCurrentPicks(userId, tournamentId),
      isStageOpen(BEST_THIRDS_STAGE_CODE, tournamentId),
      loadPlayerContext(userId),
      getMaskedRecoveryEmailForUser(userId),
      // E04-S03 — page-level peer-view rows; submitted-only gate (= 8 letters)
      // is enforced in the loader. One batched query against user_best_thirds.
      loadBestThirdsPeerRows(tournamentId, {
        groupId: session.user.group_id,
        viewerUserId: userId,
      }),
    ]);

  return (
    <>
      <TopBar
        groupName={session.user.username}
        playerName={playerName}
        isOperator={isOperator}
        tournamentChip={tournamentChip}
        logoutAction={logoutAction}
      />
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
        <nav aria-label="Asukoht" className="text-sm text-text-muted">
          <Link href="/" className="hover:underline">
            Avaleht
          </Link>
          <span aria-hidden="true"> / </span>
          <span>Best-thirds</span>
        </nav>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <WindowStatePill gate={gate} />
          <EnnustabBanner playerName={playerName} />
        </div>

        {/*
         * E04-S03 — page-level peer-view trigger sits directly under the
         * "Ennustab: <name>" banner, right-aligned per UX spec §2.2.
         */}
        <BestThirdsPeerBar
          groupName={session.user.username}
          peerRows={peerRows}
          viewerPick={picks}
        />

        <header>
          <h1 className="text-3xl font-semibold text-text-primary">
            Best-thirds ennustus
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            MM 2026 alagrupiturniiril mängib 12 alagruppi (A–L). Lisaks 16-paari
            faasi pääseb <strong>8 paremat kolmandat kohta</strong>. Märgi
            tabelist täpselt 8 grupi tähte — iga õige tähe eest{' '}
            <strong>8 punkti</strong> (kokku max 64).
          </p>
        </header>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <BestThirdsForm
              initialPicks={picks}
              disabled={!gate.open}
              gateClosed={!gate.open}
              userId={userId}
              maskedRecoveryEmail={maskedRecoveryEmail}
            />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
