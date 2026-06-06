import { Shield } from 'lucide-react';

/**
 * UX spec §15.9 — slim, persistent operator-mode reminder shown at the top of
 * every `/admin/*` main column. Muted amber background (`state-upcoming-*`
 * tokens), `Shield` lucide icon. Pure visual surface; no behaviour.
 */
export function AdminModeBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-2 rounded-md border border-state-upcoming-text/30 bg-state-upcoming-bg px-3 py-2 text-sm text-state-upcoming-text"
    >
      <Shield
        aria-hidden="true"
        className="mt-0.5 h-4 w-4 flex-shrink-0"
      />
      <p>Sa oled operaatori vaates. Mängijate ennustusi ei muudeta automaatselt.</p>
    </div>
  );
}
