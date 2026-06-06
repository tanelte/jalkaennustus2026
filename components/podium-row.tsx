import { Medal } from 'lucide-react';
import type { CrossTournamentRow } from '@/lib/home';

export interface PodiumRowProps {
  row: CrossTournamentRow;
  rank: number;
}

function medalTint(rank: number): { container: string; medal: string } {
  switch (rank) {
    case 1:
      return {
        container: 'bg-amber-100 text-amber-700',
        medal: 'text-amber-600',
      };
    case 2:
      return {
        container: 'bg-slate-100 text-slate-600',
        medal: 'text-slate-500',
      };
    case 3:
      return {
        container: 'bg-orange-100 text-orange-700',
        medal: 'text-orange-600',
      };
    default:
      return {
        container: 'bg-bg-app text-text-muted',
        medal: 'text-text-muted',
      };
  }
}

/**
 * UX spec §14.2 — single row in the cross-tournament podium preview. Medal-
 * tinted container for ranks 1/2/3 (gold/silver/bronze), neutral for 4+.
 */
export function PodiumRow({ row, rank }: PodiumRowProps) {
  const tint = medalTint(rank);
  return (
    <li className="flex items-center gap-3 py-1.5">
      <span
        aria-hidden="true"
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${tint.container}`}
      >
        <Medal className={`h-5 w-5 ${tint.medal}`} />
      </span>
      <span className="text-xs tabular-nums text-text-muted w-5">{rank}.</span>
      <span className="flex-1 truncate text-sm font-medium text-text-primary">
        {row.username}
      </span>
      <span className="text-sm tabular-nums text-text-body">
        {row.totalPoints} p
      </span>
    </li>
  );
}
