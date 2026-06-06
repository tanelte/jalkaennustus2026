import Link from 'next/link';
import { Flame } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export interface RoastTileProps {
  href?: string;
}

/**
 * UX spec §14.2 / §16 — amber-tinted RoastTile shown on Avaleht once the
 * Final has ended. Reuses the upcoming-state tokens.
 */
export function RoastTile({ href = '/roast' }: RoastTileProps) {
  return (
    <Card className="flex h-full flex-col gap-3 border-transparent bg-state-upcoming-bg p-4 text-state-upcoming-text">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/60 text-state-upcoming-text"
        >
          <Flame className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug">
            Sinu WC2026 Roast on valmis
          </h3>
        </div>
      </div>
      <p className="text-sm">Loe oma parim ja halvim pakkumine.</p>
      <div className="mt-auto pt-2">
        <Button
          asChild
          variant="outline"
          className="w-full border-state-upcoming-text bg-transparent text-state-upcoming-text hover:bg-white/40 hover:text-state-upcoming-text"
        >
          <Link href={href}>Ava roast →</Link>
        </Button>
      </div>
    </Card>
  );
}
