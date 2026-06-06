'use client';

import * as React from 'react';
import { Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import { classifyTriggerVariant } from '@/lib/peer-predictions/trigger-variant';

export type PeerViewTriggerSize = 'row' | 'stage';

export interface PeerViewTriggerProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  /** Number of peers who have submitted a prediction. */
  n: number;
  /** Total peers in the group (excluding viewer + system singleton). */
  m: number;
  /** `row` = per-match chip (h-7); `stage` = per-stage button (h-9). */
  size?: PeerViewTriggerSize;
  /** Override aria-label; default is an Estonian description per UX §4. */
  ariaLabel?: string;
}

/**
 * The peer-view affordance. Renders nothing when `m === 0` (singleton group).
 *
 * Designed to sit inside `<Popover><PopoverTrigger asChild>{<PeerViewTrigger
 * .../>}</PopoverTrigger>...</Popover>` so Radix can wire focus + open state
 * to the underlying `<button>`.
 */
export const PeerViewTrigger = React.forwardRef<
  HTMLButtonElement,
  PeerViewTriggerProps
>(function PeerViewTrigger(props, ref) {
  const { n, m, size = 'row', ariaLabel, className, ...rest } = props;
  const v = classifyTriggerVariant({ n, m });
  if (v.hidden) return null;

  const sizeClass =
    size === 'stage' ? 'h-9 px-3 text-sm' : 'h-7 px-2 text-xs';

  const label =
    ariaLabel ??
    `Vaata kaaslaste pakkumisi — ${n} kaaslast ${m}-st on esitanud`;

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50',
        sizeClass,
        v.surfaceClass,
        className,
      )}
      {...rest}
    >
      <Users aria-hidden="true" className="size-3.5 shrink-0" />
      <span className={v.countClass}>
        {n}/{m}
      </span>
    </button>
  );
});
