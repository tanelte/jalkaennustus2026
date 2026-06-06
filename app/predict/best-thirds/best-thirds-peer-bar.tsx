'use client';

import * as React from 'react';

import { PeerViewPopover } from '@/components/peer-predictions/peer-view-popover';
import { PeerViewTrigger } from '@/components/peer-predictions/peer-view-trigger';
import type { PeerRow } from '@/lib/peer-predictions/load-peer-predictions';
import type { BestThirdsPeerPick } from '@/lib/peer-predictions/load-best-thirds-payloads';

export interface BestThirdsPeerBarProps {
  groupName: string;
  peerRows: PeerRow<BestThirdsPeerPick>[];
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
      aria-label={`Valitud grupid: ${payload.join(', ')}`}
    >
      {payload.map((letter) => (
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
}: BestThirdsPeerBarProps) {
  const peerTotal = peerRows.length;
  if (peerTotal === 0) return null;

  const submittedCount = peerRows.filter(
    (p) => p.submittedPayload !== null,
  ).length;

  return (
    <div className="flex justify-end">
      <PeerViewPopover<BestThirdsPeerPick>
        groupName={groupName}
        peerRows={peerRows}
        renderPick={renderBestThirdsPick}
        size="stage"
        trigger={
          <PeerViewTrigger n={submittedCount} m={peerTotal} size="stage" />
        }
      />
    </div>
  );
}
