import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  BarChart3,
  Calendar,
  CheckCircle,
  Clock,
  Crown,
  Lock,
  Trophy,
} from 'lucide-react';

import { ClosedWindowRow } from '@/components/closed-window-row';
import { HeroGreeting } from '@/components/hero-greeting';
import { HistoryRow } from '@/components/history-row';
import { OpenWindowCard } from '@/components/open-window-card';
import { PodiumRow } from '@/components/podium-row';
import { RoastTile } from '@/components/roast-tile';
import { SectionHeader } from '@/components/section-header';
import { StatCard } from '@/components/stat-card';
import { TopBar } from '@/components/top-bar';
import { Card } from '@/components/ui/card';
import { UpcomingRow } from '@/components/upcoming-row';
import { auth, signOut } from '@/lib/auth';
import { clearCurrentUserCookie, requireCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { getHomeData } from '@/lib/home';
import { getCurrentTournamentId, resolveTournamentCode } from '@/lib/tournaments/current';
import { users } from '@/db/schema';

export const dynamic = 'force-dynamic';

async function logoutAction() {
  'use server';
  await clearCurrentUserCookie();
  await signOut({ redirectTo: '/login' });
}

async function loadIsOperator(userId: string): Promise<boolean> {
  const rows = await db
    .select({ is_operator: users.is_operator })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.is_operator ?? false;
}

export default async function Home() {
  const session = await auth();
  if (!session?.user?.group_id) redirect('/login');

  const userId = await requireCurrentUserId();
  const tournamentId = await getCurrentTournamentId();
  const tournamentChip = resolveTournamentCode();

  const [data, isOperator] = await Promise.all([
    getHomeData({
      userId,
      groupId: session.user.group_id,
      groupName: session.user.username,
      tournamentId,
    }),
    loadIsOperator(userId),
  ]);

  // Derive 4 stat-card values from the existing data shape — no helper
  // changes to lib/home/home-data.ts (per S03 Scope).
  const openWindowsCount = data.openWindows.length;
  const totalSubmitted = data.openWindows.reduce(
    (acc, w) => acc + w.progress.submitted,
    0,
  );
  const totalExpected = data.openWindows.reduce(
    (acc, w) => acc + w.progress.expected,
    0,
  );
  const totalRemaining = Math.max(totalExpected - totalSubmitted, 0);

  return (
    <>
      <TopBar
        groupName={data.greeting.groupName}
        playerName={data.greeting.playerName}
        isOperator={isOperator}
        tournamentChip={tournamentChip}
        logoutAction={logoutAction}
      />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Hero */}
        <HeroGreeting
          greeting={data.greeting.playerName}
          groupName={data.greeting.groupName}
        />

        {/* 4-up stat cards */}
        <section aria-label="Sinu number ülevaade">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
            <StatCard
              icon={Calendar}
              label="Avatud ennustused"
              value={`${openWindowsCount} ${openWindowsCount === 1 ? 'aken' : 'akent'}`}
            />
            <StatCard
              icon={CheckCircle}
              label="Täidetud"
              value={
                openWindowsCount > 0
                  ? `${totalSubmitted} / ${totalExpected}`
                  : '—'
              }
              secondary={
                openWindowsCount > 0
                  ? totalRemaining === 0
                    ? 'kõik täidetud'
                    : `${totalRemaining} veel täita`
                  : undefined
              }
            />
            <StatCard
              icon={Trophy}
              label="Punkte"
              value={`${data.currentScore.totalPoints} p`}
            />
            <StatCard
              icon={BarChart3}
              label="Koht liigas"
              value={data.currentScore.position?.toString() ?? '—'}
            />
          </div>
        </section>

        {/* Avatud aknad — section header + 4-up grid */}
        <section aria-labelledby="avatud-aknad" className="space-y-4">
          <SectionHeader
            icon={Calendar}
            title="Avatud aknad"
            id="avatud-aknad"
          />
          {data.openWindows.length === 0 && !data.roastUnlocked ? (
            <Card className="p-6 text-center text-sm text-text-muted">
              Hetkel pole ühtegi avatud akent.
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.roastUnlocked && <RoastTile href="/roast" />}
              {data.openWindows.map((window) => (
                <OpenWindowCard key={window.code} window={window} />
              ))}
            </div>
          )}
        </section>

        {/* 2-up: Tulekul + Suletud aknad */}
        <section
          aria-label="Tulekul ja suletud aknad"
          className="grid grid-cols-1 gap-4 lg:grid-cols-2"
        >
          <Card className="p-5">
            <SectionHeader icon={Clock} title="Tulekul" />
            {data.upcomingWindows.length === 0 ? (
              <p className="mt-3 text-sm text-text-muted">
                Ühtegi akent ei ole hetkel ootel.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border-default">
                {data.upcomingWindows.map((window) => (
                  <UpcomingRow key={window.code} window={window} />
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <SectionHeader icon={Lock} title="Suletud aknad" />
            {data.closedWindows.length === 0 ? (
              <p className="mt-3 text-sm text-text-muted">
                Veel ühtegi akent pole suletud.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border-default">
                {data.closedWindows.map((window) => (
                  <ClosedWindowRow key={window.code} window={window} />
                ))}
              </ul>
            )}
          </Card>
        </section>

        {/* 2-up: Sinu ajalugu + Cross-tournament podium */}
        <section
          aria-label="Ajalugu ja liiga koondtabel"
          className="grid grid-cols-1 gap-4 lg:grid-cols-2"
        >
          {/* Sinu ajalugu with watermark */}
          <Card className="relative overflow-hidden p-5">
            <Trophy
              aria-hidden="true"
              className="pointer-events-none absolute -right-4 -bottom-4 h-40 w-40 text-text-primary opacity-5"
              strokeWidth={1}
            />
            <div className="relative">
              <SectionHeader icon={Trophy} title="Sinu ajalugu" />
              {data.legacyPreview.length === 0 ? (
                <p className="mt-3 text-sm text-text-muted">
                  Esimene turniir — kogu ajalugu algab siit.
                </p>
              ) : (
                <>
                  <ul className="mt-3 divide-y divide-border-default">
                    {data.legacyPreview.map((row) => (
                      <HistoryRow key={row.tournamentCode} row={row} />
                    ))}
                  </ul>
                  <p className="mt-4 text-sm">
                    <Link
                      href="/me/history"
                      className="font-medium text-brand-green hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 rounded-sm"
                    >
                      Vaata kogu ajalugu →
                    </Link>
                  </p>
                </>
              )}
            </div>
          </Card>

          {/* Cross-tournament podium */}
          <Card className="p-5">
            <SectionHeader
              icon={Crown}
              title={`${data.greeting.groupName} läbi aegade`}
            />
            {data.crossTournamentPreview.length === 0 ? (
              <p className="mt-3 text-sm text-text-muted">
                Liiga ajalugu pole veel — kogume andmeid esimese turniiri jooksul.
              </p>
            ) : (
              <>
                <ol className="mt-3 space-y-1">
                  {data.crossTournamentPreview.map((row, idx) => (
                    <PodiumRow key={row.userId} row={row} rank={idx + 1} />
                  ))}
                </ol>
                <p className="mt-4 text-sm">
                  <Link
                    href="/group/cross-tournament"
                    className="font-medium text-brand-green hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 rounded-sm"
                  >
                    Vaata terviktabelit →
                  </Link>
                </p>
              </>
            )}
          </Card>
        </section>
      </main>
    </>
  );
}
