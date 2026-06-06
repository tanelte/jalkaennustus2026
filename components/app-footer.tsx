import { CircleDot } from 'lucide-react';

/**
 * UX spec §14.2 / §19.1 — centred, muted application footer present on every
 * route. Mounted globally in `app/layout.tsx`. Decorative only: the football
 * glyph is `aria-hidden` and there are no interactive controls.
 */
export function AppFooter() {
  return (
    <footer className="border-t border-border-default bg-surface-card text-text-muted">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-6 text-xs">
        <CircleDot aria-hidden="true" className="h-4 w-4 text-brand-green" />
        <span className="font-semibold tracking-tight text-text-body">
          Jalkaennustus WC2026
        </span>
        <span aria-hidden="true">·</span>
        <span className="italic">Ennusta. Võrdle. Vali parim.</span>
      </div>
    </footer>
  );
}
