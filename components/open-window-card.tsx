import Link from 'next/link';
import {
  HelpCircle,
  Shield,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  formatDeadlineAbsolute,
  formatDeadlineRelative,
  type OpenWindowCard as OpenWindowCardData,
  type StageCode,
} from '@/lib/home';

export interface OpenWindowCardProps {
  window: OpenWindowCardData;
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
 * UX spec §14.2 — Avaleht "Avatud aknad" card. Icon medallion + title →
 * deadline absolute (relative) → divider → "Sinu seis" progress + bar →
 * full-width green CTA.
 */
export function OpenWindowCard({ window }: OpenWindowCardProps) {
  const Icon = STAGE_ICON[window.code];
  const now = new Date();
  const absolute = formatDeadlineAbsolute(window.closesAt);
  const relative = formatDeadlineRelative(window.closesAt, now);

  const { submitted, expected, unit } = window.progress;
  const pct = expected > 0 ? Math.round((submitted / expected) * 100) : 0;

  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      {/* Top: icon + title */}
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-green-soft text-brand-green"
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug text-text-primary">
            {window.labelEt}
          </h3>
        </div>
      </div>

      {/* Deadline */}
      <p className="text-sm text-text-body">
        Sulgub <span className="tabular-nums">{absolute}</span>
        {relative ? <span className="text-text-muted"> ({relative})</span> : null}
      </p>

      <Separator />

      {/* Progress */}
      <div className="flex flex-col gap-2">
        <p className="text-sm text-text-body">
          Sinu seis:{' '}
          <strong className="tabular-nums">
            {submitted} / {expected}
          </strong>{' '}
          <span className="text-text-muted">{unit}</span>
        </p>
        <div className="flex items-center gap-3">
          <Progress value={pct} aria-label={`Progress: ${pct}%`} className="flex-1" />
          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-text-muted">
            {pct} %
          </span>
        </div>
      </div>

      {/* Spacer pushes CTA to bottom for visual alignment in 4-up grid */}
      <div className="mt-auto pt-2">
        <Button asChild className="w-full">
          <Link href={window.ctaHref}>Ennusta nüüd →</Link>
        </Button>
      </div>
    </Card>
  );
}
