'use client';

import * as React from 'react';

import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { PeerRow } from '@/lib/peer-predictions/load-peer-predictions';

export interface PeerViewPopoverProps<TPayload> {
  groupName: string;
  peerRows: PeerRow<TPayload>[];
  renderPick: (payload: TPayload) => React.ReactNode;
  /** A `<PeerViewTrigger>` (or any element). Wrapped via Radix `asChild`. */
  trigger: React.ReactNode;
  /** `row` → narrower popover; `stage` → wider for richer payloads. */
  size?: 'row' | 'stage';
}

export function PeerViewPopover<TPayload>({
  groupName,
  peerRows,
  renderPick,
  trigger,
  size = 'row',
}: PeerViewPopoverProps<TPayload>) {
  // Singleton group: the trigger renders null and there's nothing to show.
  // Returning the bare trigger keeps the parent JSX uniform.
  if (peerRows.length === 0) return <>{trigger}</>;

  const submitted = peerRows.filter((p) => p.submittedPayload !== null);
  const pending = peerRows.filter((p) => p.submittedPayload === null);
  const noneSubmitted = submitted.length === 0;

  const widthClass =
    size === 'stage'
      ? 'min-w-[280px] sm:min-w-[360px]'
      : 'min-w-[280px] sm:min-w-[320px]';

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className={cn(
          'rounded-xl border border-border-default bg-white p-4 shadow-md',
          'max-w-[calc(100vw-24px)] max-h-[60vh] overflow-y-auto',
          widthClass,
        )}
      >
        <div className="mb-2 text-xs">
          <span className="text-text-body">{groupName}</span>
          <span className="text-text-muted"> · pakkumised</span>
        </div>

        {noneSubmitted ? (
          <p className="px-1 py-3 text-center text-sm text-text-muted">
            Veel keegi pole oma pakkumist esitanud.
            <br />
            Tule tagasi, kui kaaslased on valinud.
          </p>
        ) : (
          <ul className="divide-y divide-border-default">
            {submitted.map((p) => (
              <li
                key={p.peerId}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="font-medium text-text-primary">
                  {p.peerName}
                </span>
                <span className="text-text-body">
                  {renderPick(p.submittedPayload as TPayload)}
                </span>
              </li>
            ))}
            {pending.map((p) => (
              <li
                key={p.peerId}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="text-text-muted">{p.peerName}</span>
                <span className="text-xs italic text-text-muted">
                  ei ole veel ennustanud
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex justify-end">
          <PopoverClose asChild>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs text-text-muted hover:text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-1"
            >
              Sulge
            </button>
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  );
}
