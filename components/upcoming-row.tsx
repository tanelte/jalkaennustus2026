import {
  formatDeadlineAbsolute,
  formatDeadlineRelative,
  type UpcomingWindowCard,
} from '@/lib/home';

export interface UpcomingRowProps {
  window: UpcomingWindowCard;
}

/**
 * UX spec §14.2 — single row inside the parent "Tulekul" Card: stage label on
 * the left, `Avaneb <abs> (<rel>)` muted on the right.
 */
export function UpcomingRow({ window }: UpcomingRowProps) {
  const now = new Date();
  const absolute = formatDeadlineAbsolute(window.opensAt);
  const relative = formatDeadlineRelative(window.opensAt, now);
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-2 py-1 text-sm">
      <span className="text-text-body">{window.labelEt}</span>
      <span className="tabular-nums text-text-muted">
        Avaneb {absolute}
        {relative ? ` (${relative})` : ''}
      </span>
    </li>
  );
}
