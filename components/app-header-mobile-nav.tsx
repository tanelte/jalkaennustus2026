'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { ArrowLeftRight, KeyRound, LogOut, Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Mobile collapse of the AppHeader primary nav per UX §17. Extracted as a
 * Client Component because the shadcn `dropdown-menu` (Radix primitive) needs
 * client interactivity; keeping it out of `AppHeader` lets that file remain a
 * Server Component and continue accepting Server Action props.
 *
 * Below `md` this menu also absorbs the three account/session actions
 * (Minu konto / Vaheta mängijat / Logi välja) that otherwise overflow the
 * 16-rem header row on phone widths.
 */
export function AppHeaderMobileNav({
  isOperator,
  logoutAction,
}: {
  isOperator: boolean;
  logoutAction: () => Promise<void>;
}) {
  const logoutFormRef = useRef<HTMLFormElement>(null);

  return (
    <>
      {/* Form lives outside DropdownMenuContent's portal so it isn't unmounted
          when the menu closes on selection — without this, the Server Action
          never reaches the network on touch devices. */}
      <form ref={logoutFormRef} action={logoutAction} className="hidden" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label="Ava navigatsioonimenüü"
            className="border-white/20 text-text-on-dark hover:bg-white/10 hover:text-text-on-dark bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-green focus-visible:ring-offset-surface-card-dark"
          >
            <Menu aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[12rem]">
          <DropdownMenuItem asChild>
            <Link href="/">Avaleht</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/leaderboard">Tabel</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/me/history">Ajalugu</Link>
          </DropdownMenuItem>
          {isOperator && (
            <DropdownMenuItem asChild>
              <Link href="/admin">Admin</Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/me">
              <KeyRound aria-hidden="true" />
              Minu konto
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/select-user">
              <ArrowLeftRight aria-hidden="true" />
              Vaheta mängijat
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <button
              type="button"
              onClick={() => logoutFormRef.current?.requestSubmit()}
              className="flex w-full items-center gap-2 text-left"
            >
              <LogOut aria-hidden="true" />
              Logi välja
            </button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
