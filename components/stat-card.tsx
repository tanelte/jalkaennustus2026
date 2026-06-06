import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';

export interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  secondary?: string;
  /**
   * When set, the card becomes a focusable link to this route. A hover tint,
   * focus ring, and a small chevron next to the value signal interactivity.
   */
  href?: string;
  /** Optional accessible name override for the link (defaults to `${label} — ${value}`). */
  ariaLabel?: string;
}

/**
 * UX spec §14.2 — Avaleht stat card. Icon medallion on the left, label (muted)
 * above the value (large, tabular-nums) on the right. Becomes a link when
 * `href` is provided.
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  secondary,
  href,
  ariaLabel,
}: StatCardProps) {
  const interactive = Boolean(href);
  const cardClasses = `flex items-center gap-4 p-4 transition-colors ${
    interactive
      ? 'hover:border-brand-green hover:bg-brand-green-soft/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2'
      : ''
  }`;

  const body = (
    <Card className={cardClasses}>
      <span
        aria-hidden="true"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-green-soft text-brand-green"
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text-muted">{label}</p>
        <p className="flex items-baseline gap-1 text-3xl font-bold tabular-nums text-text-primary">
          <span>{value}</span>
          {interactive && (
            <ChevronRight
              aria-hidden="true"
              className="h-5 w-5 self-center text-text-muted"
            />
          )}
        </p>
        {secondary && (
          <p className={`text-xs ${interactive ? 'text-brand-green' : 'text-text-muted'}`}>
            {secondary}
          </p>
        )}
      </div>
    </Card>
  );

  if (!href) return body;

  return (
    <Link
      href={href}
      aria-label={ariaLabel ?? `${label} — ${value}`}
      className="block rounded-xl"
    >
      {body}
    </Link>
  );
}
