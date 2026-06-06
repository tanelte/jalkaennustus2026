import Link from 'next/link';
import { ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface EnnustabBannerProps {
  playerName: string;
}

/**
 * UX spec §8.2 — "Ennustab: <name> [ Vaheta mängijat ]" banner shown directly
 * under the window-state pill on every `/predict/*` page. Removes ambiguity
 * when multiple league members share a session.
 */
export function EnnustabBanner({ playerName }: EnnustabBannerProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border-default bg-surface-card px-4 py-2 text-sm">
      <span>
        Ennustab: <strong className="text-text-primary">{playerName}</strong>
      </span>
      <Button variant="outline" size="sm" asChild>
        <Link href="/select-user">
          <ArrowLeftRight aria-hidden="true" />
          Vaheta mängijat
        </Link>
      </Button>
    </div>
  );
}
