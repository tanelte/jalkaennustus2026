'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Mobile collapse of the AppHeader primary nav per UX §17. Extracted as a
 * Client Component because the shadcn `dropdown-menu` (Radix primitive) needs
 * client interactivity; keeping it out of `AppHeader` lets that file remain a
 * Server Component and continue accepting Server Action props.
 */
export function AppHeaderMobileNav({ isOperator }: { isOperator: boolean }) {
  return (
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
      <DropdownMenuContent align="start" className="min-w-[10rem]">
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
