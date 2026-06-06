import { AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { StageGateResult } from '@/lib/stages/is-stage-open';

export interface WindowStatePillProps {
  gate: StageGateResult;
}

const DATE_FORMATTER = new Intl.DateTimeFormat('et-EE', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Tallinn',
});

function fmt(date: Date | undefined): string {
  if (!date) return '';
  return DATE_FORMATTER.format(date);
}

const PILL_BASE =
  'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium';

/**
 * UX spec §16.1 — window-state pill rendered at the top of every `/predict/*`
 * page. Text always carries the state for screen-reader / colour-blind users;
 * colour and the lucide icon are accents. Accessibility per §18:
 *   - open / not_yet / closed → `role="status"` (polite live region)
 *   - not_found / error      → `role="alert"` (assertive)
 */
export function WindowStatePill({ gate }: WindowStatePillProps) {
  if (gate.open) {
    return (
      <p
        role="status"
        className={`${PILL_BASE} bg-brand-green-soft text-brand-green`}
      >
        <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
        <span className="uppercase tracking-wide">Avatud</span>
        <span>— sulgub {fmt(gate.closesAt)}</span>
      </p>
    );
  }

  if (gate.reason === 'closed') {
    return (
      <p
        role="status"
        className={`${PILL_BASE} bg-state-closed-bg text-state-closed-text`}
      >
        <XCircle aria-hidden="true" className="h-4 w-4" />
        <span className="uppercase tracking-wide">Suletud</span>
        <span>— aken sulgus {fmt(gate.closesAt)}</span>
      </p>
    );
  }

  if (gate.reason === 'not_yet') {
    return (
      <p
        role="status"
        className={`${PILL_BASE} bg-state-upcoming-bg text-state-upcoming-text`}
      >
        <Clock aria-hidden="true" className="h-4 w-4" />
        <span className="uppercase tracking-wide">Ei ole veel avatud</span>
        <span>— avaneb {fmt(gate.opensAt)}</span>
      </p>
    );
  }

  return (
    <p
      role="alert"
      className={`${PILL_BASE} bg-state-error-bg text-state-error-text`}
    >
      <AlertTriangle aria-hidden="true" className="h-4 w-4" />
      <span>Etappi ei leitud. Võta ühendust korraldajaga.</span>
    </p>
  );
}
