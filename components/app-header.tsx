import Link from 'next/link';
import { ArrowLeftRight, KeyRound, LogOut } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AppHeaderMobileNav } from '@/components/app-header-mobile-nav';

export interface AppHeaderProps {
  groupName: string;
  playerName: string | null;
  isOperator: boolean;
  tournamentChip: string;
  logoutAction: () => Promise<void>;
}

/**
 * UX spec §15.1 / §19.1 — dark sticky application header shown on every
 * authenticated route. Replaces the prior light-variant `TopBar`. The prop
 * interface is intentionally identical so call sites do not change.
 *
 * Server Component. The mobile primary-nav collapse uses a shadcn
 * `dropdown-menu` (Radix primitive) which requires client interactivity; that
 * piece is extracted into `AppHeaderMobileNav` so this file can stay a Server
 * Component and continue accepting the `logoutAction` Server Action prop.
 */
export function AppHeader({
  groupName,
  playerName,
  isOperator,
  tournamentChip,
  logoutAction,
}: AppHeaderProps) {
  const focusRing =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-green focus-visible:ring-offset-surface-card-dark';
  const outlineOnDark =
    'border-white/20 text-text-on-dark hover:bg-white/10 hover:text-text-on-dark bg-transparent';

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-surface-card-dark text-text-on-dark">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        {/* Left: wordmark + active-tournament chip — stacked on mobile so the
            chip drops to a second line instead of competing with the action row. */}
        <Link
          href="/"
          className={`flex flex-col items-start gap-0.5 sm:flex-row sm:items-baseline sm:gap-2 rounded-md ${focusRing}`}
          aria-label="Avaleht"
        >
          <span className="text-lg font-semibold tracking-tight leading-none">Jalkaennustus</span>
          <Badge
            variant="secondary"
            className="bg-white/10 text-text-on-dark hover:bg-white/15 border-transparent uppercase tracking-wide"
          >
            {tournamentChip}
          </Badge>
        </Link>

        {/* Centre: primary nav (≥ md) */}
        <nav
          aria-label="Põhinavigatsioon"
          className="ml-4 hidden items-center gap-4 text-sm md:flex"
        >
          <Link href="/" className={`hover:underline ${focusRing} rounded-sm`}>
            Avaleht
          </Link>
          <Link href="/leaderboard" className={`hover:underline ${focusRing} rounded-sm`}>
            Tabel
          </Link>
          <Link href="/me/history" className={`hover:underline ${focusRing} rounded-sm`}>
            Ajalugu
          </Link>
          {isOperator && (
            <Link href="/admin" className={`hover:underline ${focusRing} rounded-sm`}>
              Admin
            </Link>
          )}
        </nav>

        {/* Right cluster — pushed to the end on every breakpoint. */}
        <div className="ml-auto flex items-center gap-2 sm:gap-3 text-sm">
          {/* Active-player chip remains visible on phones so the user still
              sees who they're logged in as; group chip is desktop-only. */}
          <span className="hidden text-text-on-dark-muted md:inline">
            Liiga: <strong className="text-text-on-dark">{groupName}</strong>
          </span>
          {playerName && (
            <span className="text-text-on-dark-muted">
              Sina: <strong className="text-text-on-dark">{playerName}</strong>
            </span>
          )}

          {/* Mobile (< md): the three account actions live inside this menu. */}
          <div className="md:hidden">
            <AppHeaderMobileNav isOperator={isOperator} logoutAction={logoutAction} />
          </div>

          {/* Desktop (≥ md): the three account actions render inline. */}
          <div className="hidden items-center gap-2 sm:gap-3 md:flex">

          <Button
            asChild
            variant="outline"
            size="sm"
            className={`${outlineOnDark} ${focusRing}`}
          >
            <Link href="/me">
              <KeyRound aria-hidden="true" />
              <span>Minu konto</span>
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className={`${outlineOnDark} ${focusRing}`}
          >
            <Link href="/select-user">
              <ArrowLeftRight aria-hidden="true" />
              <span>Vaheta mängijat</span>
            </Link>
          </Button>

          <form action={logoutAction}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className={`${outlineOnDark} ${focusRing}`}
            >
              <LogOut aria-hidden="true" />
              <span>Logi välja</span>
            </Button>
          </form>
          </div>
        </div>
      </div>
    </header>
  );
}
