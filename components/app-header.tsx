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
        {/* Left: wordmark + active-tournament chip */}
        <Link
          href="/"
          className={`flex items-baseline gap-2 rounded-md ${focusRing}`}
          aria-label="Avaleht"
        >
          <span className="text-lg font-semibold tracking-tight">Jalkaennustus</span>
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

        {/* Mobile: dropdown nav (< md) */}
        <div className="md:hidden">
          <AppHeaderMobileNav isOperator={isOperator} />
        </div>

        {/* Right: chips + actions */}
        <div className="ml-auto flex items-center gap-2 sm:gap-3 text-sm">
          {/* League chip — hidden below sm per UX §17 */}
          <span className="hidden text-text-on-dark-muted sm:inline">
            Liiga: <strong className="text-text-on-dark">{groupName}</strong>
          </span>
          {playerName && (
            <span className="text-text-on-dark-muted">
              Sina: <strong className="text-text-on-dark">{playerName}</strong>
            </span>
          )}

          <Button
            asChild
            variant="outline"
            size="sm"
            className={`${outlineOnDark} ${focusRing}`}
          >
            <Link href="/me">
              <KeyRound aria-hidden="true" />
              <span className="hidden sm:inline">Minu konto</span>
              <span className="sr-only sm:hidden">Minu konto ja PIN</span>
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
              <span className="hidden sm:inline">Vaheta mängijat</span>
              <span className="sr-only sm:hidden">Vaheta mängijat</span>
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
              <span className="hidden sm:inline">Logi välja</span>
              <span className="sr-only sm:hidden">Logi välja</span>
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
