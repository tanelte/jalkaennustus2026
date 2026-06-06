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
  type ClosedWindowCard,
  type StageCode,
} from '@/lib/home';

export interface ClosedWindowRowProps {
  window: ClosedWindowCard;
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
 * One row inside the home page's "Suletud aknad" card. Shows the stage icon
 * + title, close timestamp, the player's final submission count, and a link
 * into the prediction surface (which renders in read-only mode when closed).
 */
export function ClosedWindowRow({ window }: ClosedWindowRowProps) {
  const Icon = STAGE_ICON[window.code];
  const { submitted, expected, unit } = window.progress;
  const filledNothing = submitted === 0;

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
          Sulgus <span className="tabular-nums">{formatDeadlineAbsolute(window.closesAt)}</span>
        </p>
        <p className="text-xs">
          <span className="text-text-muted">Sinu seis: </span>
          <strong
            className={`tabular-nums ${
              filledNothing ? 'text-state-closed-text' : 'text-text-primary'
            }`}
          >
            {submitted} / {expected}
          </strong>{' '}
          <span className="text-text-muted">{unit}</span>
        </p>
      </div>
      <Button asChild variant="outline" size="sm" className="shrink-0">
        <Link href={window.ctaHref}>Vaata oma valikuid →</Link>
      </Button>
    </li>
  );
}
