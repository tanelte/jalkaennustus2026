'use client';

import * as React from 'react';

import { PeerViewPopover } from '@/components/peer-predictions/peer-view-popover';
import { PeerViewTrigger } from '@/components/peer-predictions/peer-view-trigger';
import type { PeerRow } from '@/lib/peer-predictions/load-peer-predictions';
import {
  isBestThirdsConsensus,
  type BestThirdsPeerPick,
} from '@/lib/peer-predictions/load-best-thirds-payloads';

export interface BestThirdsPeerBarProps {
  groupName: string;
  peerRows: PeerRow<BestThirdsPeerPick>[];
  /** Viewer's own 8-letter pick (or null if they haven't yet finished). */
  viewerPick?: readonly string[] | null;
}

/**
 * UX spec §2.3 (grid mode) — render each peer's 8-letter set as a row of
 * small pill chips. Mirrors the visual language of the form's own A–L tiles
 * (rounded, brand-green when selected) but at popover scale.
 */
function renderBestThirdsPick(payload: BestThirdsPeerPick) {
  return (
    <span
      className="inline-flex flex-wrap justify-end gap-1"
      aria-label={`Valitud grupid: ${payload.groupLetters.join(', ')}`}
    >
      {payload.groupLetters.map((letter) => (
        <span
          key={letter}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-brand-green text-xs font-semibold text-white tabular-nums"
        >
          {letter}
        </span>
      ))}
    </span>
  );
}

/** S06 per-peer score annotation. Verbatim summed `user_best_thirds.points`. */
function renderBestThirdsPoints(payload: BestThirdsPeerPick) {
  if (payload.points === null) return null;
  return (
    <span className="ml-2 inline-flex h-6 items-center rounded-md bg-bg-app px-1.5 text-xs font-medium tabular-nums text-text-muted">
      {payload.points} p
    </span>
  );
}

/**
 * E04-S03 — page-level peer-view trigger for `/predict/best-thirds`.
 *
 * UX spec §2.2: per-stage trigger, `h-9 px-3` button (NOT a row-end chip),
 * placed directly under the "Ennustab: <name>" banner, aligned to the right.
 *
 * Submitted-only gate: the loader treats a peer as "submitted" only if they
 * have the full 8-letter set; partial selections render as
 * "ei ole veel ennustanud" (handled by PeerViewPopover).
 */
export function BestThirdsPeerBar({
  groupName,
  peerRows,
  viewerPick,
}: BestThirdsPeerBarProps) {
  const peerTotal = peerRows.length;
  if (peerTotal === 0) return null;

  const submittedCount = peerRows.filter(
    (p) => p.submittedPayload !== null,
  ).length;

  // Promote the viewer's letters into the same shape the peer rows use; the
  // consensus predicate is set-based so the input letter order is irrelevant.
  // We only mark consensus when the viewer has submitted a full 8.
  const viewerPayload: BestThirdsPeerPick | null =
    viewerPick && viewerPick.length === 8
      ? { groupLetters: viewerPick, points: null }
      : null;

  return (
    <div className="flex justify-end">
      <PeerViewPopover<BestThirdsPeerPick>
        groupName={groupName}
        peerRows={peerRows}
        renderPick={renderBestThirdsPick}
        renderPoints={renderBestThirdsPoints}
        viewerPick={viewerPayload}
        isConsensus={isBestThirdsConsensus}
        size="stage"
        trigger={
          <PeerViewTrigger n={submittedCount} m={peerTotal} size="stage" />
        }
      />
    </div>
  );
}
