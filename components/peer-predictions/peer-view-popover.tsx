'use client';

import * as React from 'react';

import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  defaultIsConsensus,
  type PeerRow,
} from '@/lib/peer-predictions/load-peer-predictions';

export interface PeerViewPopoverProps<TPayload> {
  groupName: string;
  peerRows: PeerRow<TPayload>[];
  renderPick: (payload: TPayload) => React.ReactNode;
  /** A `<PeerViewTrigger>` (or any element). Wrapped via Radix `asChild`. */
  trigger: React.ReactNode;
  /** `row` → narrower popover; `stage` → wider for richer payloads. */
  size?: 'row' | 'stage';
  /**
   * S06 enhancement #1 — per-peer score annotation. When supplied, the
   * popover renders `renderPoints(payload)` to the right of `renderPick`
   * for each submitted row (and nothing when the call returns `null`).
   * Surfaces with no scored data simply omit this prop.
   */
  renderPoints?: (payload: TPayload) => React.ReactNode | null;
  /**
   * S06 enhancement #2 — consensus marker. The viewer's own pick (in the
   * same payload shape as the peer rows). When provided alongside
   * `isConsensus`, rows where the predicate returns `true` are visually
   * distinguished using existing brand tokens (no new color introduced).
   */
  viewerPick?: TPayload | null;
  /**
   * Per-surface equality predicate. Defaults to deep-JSON equality, which
   * handles the simple shapes (strings, small objects, ordered arrays of
   * primitives) used by every current surface. Pass a custom predicate
   * when payload semantics need it (e.g. unordered set comparison).
   */
  isConsensus?: (peer: TPayload, viewer: TPayload) => boolean;
}

export function PeerViewPopover<TPayload>({
  groupName,
  peerRows,
  renderPick,
  trigger,
  size = 'row',
  renderPoints,
  viewerPick,
  isConsensus,
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
            {submitted.map((p) => {
              const payload = p.submittedPayload as TPayload;
              // Consensus marker — only meaningful when the viewer has a pick
              // to compare against. Uses an existing brand token (the soft
              // green surface tint already in the design system); no new
              // color is introduced.
              const consensus =
                viewerPick != null &&
                (isConsensus ?? defaultIsConsensus)(payload, viewerPick);
              const points = renderPoints ? renderPoints(payload) : null;
              return (
                <li
                  key={p.peerId}
                  className={cn(
                    'flex items-center justify-between gap-3 py-2 text-sm',
                    consensus &&
                      '-mx-1 rounded-md border-l-2 border-brand-green bg-brand-green-soft px-1',
                  )}
                  data-consensus={consensus ? 'true' : undefined}
                >
                  <span className="font-medium text-text-primary">
                    {p.peerName}
                  </span>
                  <span className="flex items-center text-text-body">
                    {renderPick(payload)}
                    {points}
                  </span>
                </li>
              );
            })}
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
