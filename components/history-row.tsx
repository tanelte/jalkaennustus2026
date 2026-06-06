import type { LegacyHistoryRow } from '@/lib/home';

export interface HistoryRowProps {
  row: LegacyHistoryRow;
}

/**
 * UX spec §14.2 — single row inside "Sinu ajalugu" card. Tournament code
 * (mono / strong) · em-dash · tournament name (muted) · right-aligned points
 * + finishing position. The faint trophy watermark belongs to the parent
 * card composition.
 */
export function HistoryRow({ row }: HistoryRowProps) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-2 py-1 text-sm">
      <span>
        <strong className="font-mono text-text-primary">
          {row.tournamentCode}
        </strong>{' '}
        <span className="text-text-muted">— {row.tournamentName}</span>
      </span>
      <span className="tabular-nums text-text-body">
        {row.totalPoints} p — {row.finishingPosition}. koht
      </span>
    </li>
  );
}
