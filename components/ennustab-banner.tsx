import Link from 'next/link';

export interface EnnustabBannerProps {
  playerName: string;
}

/**
 * UX spec §8.2 — "Ennustab: <name> [ vaheta mängijat ]" banner shown directly
 * under the window-state pill on every `/predict/*` page. Removes ambiguity
 * when multiple league members share a session.
 */
export function EnnustabBanner({ playerName }: EnnustabBannerProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-700">
      <span>
        Ennustab: <strong className="text-gray-900">{playerName}</strong>
      </span>
      <Link
        href="/select-user"
        className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50"
      >
        vaheta mängijat
      </Link>
    </div>
  );
}
