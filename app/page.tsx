import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { TopBar } from '@/components/top-bar';
import { auth, signOut } from '@/lib/auth';
import { clearCurrentUserCookie, requireCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import {
  formatDeadlineAbsolute,
  formatDeadlineRelative,
  getHomeData,
  type OpenWindowCard,
  type UpcomingWindowCard,
} from '@/lib/home';
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

  const showOpenWindowsBlock = data.openWindows.length > 0 || data.roastUnlocked;

  return (
    <>
      <TopBar
        groupName={data.greeting.groupName}
        playerName={data.greeting.playerName}
        isOperator={isOperator}
        tournamentChip={tournamentChip}
        logoutAction={logoutAction}
      />
      <main className="mx-auto max-w-3xl space-y-8 p-4 sm:p-8">
        <section aria-labelledby="tervitus">
          <h1 id="tervitus" className="text-2xl font-semibold">
            Tere, {data.greeting.playerName}. Liiga: {data.greeting.groupName}.
          </h1>
        </section>

        {showOpenWindowsBlock && (
          <section aria-labelledby="avatud-aknad" className="space-y-3">
            <h2 id="avatud-aknad" className="text-lg font-medium">
              Avatud aknad
            </h2>
            {data.roastUnlocked && <RoastTile />}
            {data.openWindows.map((window) => (
              <OpenWindowCardView key={window.code} card={window} />
            ))}
          </section>
        )}

        {data.upcomingWindows.length > 0 && (
          <section aria-labelledby="tulekul" className="rounded border p-4">
            <h2 id="tulekul" className="text-lg font-medium">
              Tulekul
            </h2>
            <ul className="mt-2 space-y-1 text-sm">
              {data.upcomingWindows.map((window) => (
                <UpcomingWindowRow key={window.code} card={window} />
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="sinu-seis" className="rounded border p-4">
          <h2 id="sinu-seis" className="text-lg font-medium">
            Sinu seis
          </h2>
          <p className="mt-2 text-sm text-gray-700">
            Hetke punktid {tournamentChip}:{' '}
            <strong className="tabular-nums">{data.currentScore.totalPoints}</strong>
            {'  '}
            Asetus liigas:{' '}
            <strong className="tabular-nums">
              {data.currentScore.position ?? '—'}
            </strong>
          </p>
          <p className="mt-3 text-sm">
            <Link href="/leaderboard" className="text-blue-700 hover:underline">
              Vaata tabelit →
            </Link>
          </p>
        </section>

        <section aria-labelledby="sinu-ajalugu" className="rounded border p-4">
          <h2 id="sinu-ajalugu" className="text-lg font-medium">
            Sinu ajalugu
          </h2>
          {data.legacyPreview.length === 0 ? (
            <p className="mt-2 text-sm text-gray-600">
              Esimene turniir — kogu ajalugu algab siit.
            </p>
          ) : (
            <>
              <ul className="mt-2 space-y-1 text-sm">
                {data.legacyPreview.map((row) => (
                  <li
                    key={row.tournamentCode}
                    className="flex flex-wrap items-baseline justify-between gap-2"
                  >
                    <span>
                      <strong>{row.tournamentCode}</strong> — {row.tournamentName}
                    </span>
                    <span className="tabular-nums text-gray-700">
                      {row.totalPoints} p — {row.finishingPosition}. koht
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm">
                <Link href="/me/history" className="text-blue-700 hover:underline">
                  Vaata kogu ajalugu →
                </Link>
              </p>
            </>
          )}
        </section>

        <section aria-labelledby="cross-tournament" className="rounded border p-4">
          <h2 id="cross-tournament" className="text-lg font-medium">
            {data.greeting.groupName} läbi aegade
          </h2>
          {data.crossTournamentPreview.length === 0 ? (
            <p className="mt-2 text-sm text-gray-600">
              Liiga ajalugu pole veel — kogume andmeid esimese turniiri jooksul.
            </p>
          ) : (
            <>
              <ol className="mt-2 space-y-1 text-sm">
                {data.crossTournamentPreview.map((row, index) => (
                  <li
                    key={row.userId}
                    className="flex flex-wrap items-baseline justify-between gap-2"
                  >
                    <span>
                      <span className="tabular-nums text-gray-500">{index + 1}.</span>{' '}
                      <strong>{row.username}</strong>
                    </span>
                    <span className="tabular-nums text-gray-700">{row.totalPoints} p</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-sm">
                <Link href="/group/cross-tournament" className="text-blue-700 hover:underline">
                  Vaata terviktabelit →
                </Link>
              </p>
            </>
          )}
        </section>
      </main>
    </>
  );
}

function RoastTile() {
  return (
    <article className="rounded border border-amber-300 bg-amber-50 p-4">
      <h3 className="text-base font-medium">🔥 Sinu WC2026 Roast on valmis</h3>
      <p className="mt-1 text-sm text-amber-900">Loe oma parim ja halvim pakkumine.</p>
      <p className="mt-3 text-sm">
        <Link href="/roast" className="font-medium text-amber-900 underline">
          Ava roast →
        </Link>
      </p>
    </article>
  );
}

function UpcomingWindowRow({ card }: { card: UpcomingWindowCard }) {
  const now = new Date();
  const relative = formatDeadlineRelative(card.opensAt, now);
  const absolute = formatDeadlineAbsolute(card.opensAt);
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-2">
      <span>{card.labelEt}</span>
      <span className="tabular-nums text-gray-700">
        Avaneb {absolute}
        {relative ? ` (${relative})` : ''}
      </span>
    </li>
  );
}

function OpenWindowCardView({ card }: { card: OpenWindowCard }) {
  const now = new Date();
  const relative = formatDeadlineRelative(card.closesAt, now);
  const absolute = formatDeadlineAbsolute(card.closesAt);
  return (
    <article className="rounded border border-green-300 bg-green-50 p-4">
      <h3 className="text-base font-medium text-green-900">
        🟢 {card.labelEt} — AVATUD
      </h3>
      <p className="mt-1 text-sm text-green-900">
        Sulgub {absolute}
        {relative ? ` (${relative})` : ''}.
      </p>
      <p className="mt-1 text-sm text-green-900">
        Sinu seis: <strong>{card.progressLabel}</strong>.
      </p>
      <p className="mt-3 text-sm">
        <Link href={card.ctaHref} className="font-medium text-green-900 underline">
          Ennusta nüüd →
        </Link>
      </p>
    </article>
  );
}
