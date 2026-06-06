import Link from 'next/link';
import {
  HelpCircle,
  Shield,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  formatDeadlineAbsolute,
  formatDeadlineRelative,
  type StageCode,
  type UpcomingWindowCard,
} from '@/lib/home';

export interface UpcomingRowProps {
  window: UpcomingWindowCard;
}

const STAGE_ICON: Record<StageCode, LucideIcon> = {
  trivia: HelpCircle,
  group_matches: Users,
  best_thirds: Shield,
  r32: Shield,
  r16: Shield,
  qf: Shield,
  sf: Shield,
  final: Trophy,
};

/**
 * One row inside the home page's "Tulekul" card. Mirrors ClosedWindowRow's
 * layout: stage icon medallion, label, opens-at timestamp, and an outline
 * "Eelvaade" link into the surface. No "Sinu seis" line — an upcoming window
 * always has 0 submitted, so the count adds no signal.
 */
export function UpcomingRow({ window }: UpcomingRowProps) {
  const Icon = STAGE_ICON[window.code];
  const now = new Date();
  const absolute = formatDeadlineAbsolute(window.opensAt);
  const relative = formatDeadlineRelative(window.opensAt, now);

  return (
    <li className="flex items-start gap-3 py-3">
      <span
        aria-hidden="true"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-bg-app text-text-muted"
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium leading-snug text-text-primary">
          {window.labelEt}
        </p>
        <p className="text-xs text-text-muted">
          Avaneb <span className="tabular-nums">{absolute}</span>
          {relative ? ` (${relative})` : ''}
        </p>
      </div>
      <Button asChild variant="outline" size="sm" className="shrink-0">
        <Link href={window.ctaHref}>Eelvaade →</Link>
      </Button>
    </li>
  );
}
