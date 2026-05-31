import Link from 'next/link';

export interface TopBarProps {
  groupName: string;
  playerName: string | null;
  isOperator: boolean;
  tournamentChip: string;
  logoutAction: () => Promise<void>;
}

/**
 * UX spec §3 — persistent top bar shown on every authenticated route. Logo +
 * tournament chip on the left, persistent nav links in the centre, player
 * switcher + logout on the right. Operator users see an extra `Admin` link.
 *
 * Server Component: the parent loads `playerName` + `isOperator` and passes the
 * logout Server Action in. Mobile (per UX spec §8.6) collapses the centre links
 * via Tailwind responsive classes; no JS-driven hamburger this pass.
 */
export function TopBar({
  groupName,
  playerName,
  isOperator,
  tournamentChip,
  logoutAction,
}: TopBarProps) {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-lg font-semibold tracking-tight">Jalkaennustus</span>
          <span className="rounded-full border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-gray-700">
            {tournamentChip}
          </span>
        </Link>

        <nav aria-label="Põhinavigatsioon" className="ml-2 hidden gap-3 text-sm sm:flex">
          <Link href="/" className="hover:underline">
            Avaleht
          </Link>
          <Link href="/leaderboard" className="hover:underline">
            Tabel
          </Link>
          <Link href="/me/history" className="hover:underline">
            Ajalugu
          </Link>
          {isOperator && (
            <Link href="/admin" className="hover:underline">
              Admin
            </Link>
          )}
        </nav>

        <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
          <span className="text-gray-600">
            Liiga: <strong className="text-gray-900">{groupName}</strong>
          </span>
          {playerName && (
            <span className="text-gray-600">
              Sina: <strong className="text-gray-900">{playerName}</strong>
            </span>
          )}
          <Link
            href="/select-user"
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            Vaheta mängijat
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              Logi välja
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
