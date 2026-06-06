'use client';

import * as React from 'react';

import { PeerViewPopover } from '@/components/peer-predictions/peer-view-popover';
import { PeerViewTrigger } from '@/components/peer-predictions/peer-view-trigger';
import type { PeerRow } from '@/lib/peer-predictions/load-peer-predictions';
import type { FinalPeerPick } from '@/lib/peer-predictions/load-final-payloads';

export interface FinalPeerViewProps {
  groupName: string;
  peerRows: PeerRow<FinalPeerPick>[];
}

/**
 * E04-S05 — final-stage page-level peer-view trigger + popover.
 *
 * Designed to sit directly under the "Ennustab: <name>" banner on
 * `/predict/final`, aligned right. UX spec §2.2 "per-stage trigger" sizing
 * (`h-9 px-3`) + §2.3 "popover interior — ordered list" mode.
 *
 * Returns null when the group is a singleton (no peers) — same shape as the
 * shared `PeerViewTrigger`'s hidden state, so the surrounding layout flexbox
 * collapses cleanly.
 */
export function FinalPeerView({ groupName, peerRows }: FinalPeerViewProps) {
  const peerTotal = peerRows.length;
  if (peerTotal === 0) return null;

  const submittedCount = peerRows.filter(
    (r) => r.submittedPayload !== null,
  ).length;

  return (
    <PeerViewPopover<FinalPeerPick>
      groupName={groupName}
      peerRows={peerRows}
      renderPick={renderFinalPick}
      size="stage"
      trigger={
        <PeerViewTrigger n={submittedCount} m={peerTotal} size="stage" />
      }
    />
  );
}

/**
 * Ordered-list mode: render F1 → F4 each on its own line. Uses the same
 * border-default chip styling the final form itself uses for its medal-slot
 * cards (`rounded-md border …`), kept compact so four rows fit comfortably
 * in the popover content area.
 */
function renderFinalPick(payload: FinalPeerPick): React.ReactNode {
  return (
    <ol className="flex flex-col gap-1 text-right">
      {payload.map((entry) => (
        <li
          key={entry.slot}
          className="flex items-center justify-end gap-2 text-xs"
        >
          <span className="font-medium text-text-muted">{entry.slot}</span>
          <span className="text-text-body">{entry.teamName}</span>
        </li>
      ))}
    </ol>
  );
}
