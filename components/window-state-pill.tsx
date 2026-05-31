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

/**
 * UX spec §8.1 — window-state pill rendered at the top of every `/predict/*`
 * page. Text always carries the state for screen-reader / colour-blind users;
 * colour is purely an accent.
 */
export function WindowStatePill({ gate }: WindowStatePillProps) {
  if (gate.open) {
    return (
      <p
        role="status"
        className="inline-flex items-center gap-2 rounded-full border border-green-300 bg-green-50 px-3 py-1 text-sm text-green-900"
      >
        <span aria-hidden="true">🟢</span>
        <span className="font-medium uppercase tracking-wide">Avatud</span>
        <span>— sulgub {fmt(gate.closesAt)}</span>
      </p>
    );
  }

  if (gate.reason === 'closed') {
    return (
      <p
        role="status"
        className="inline-flex items-center gap-2 rounded-full border border-red-300 bg-red-50 px-3 py-1 text-sm text-red-900"
      >
        <span aria-hidden="true">🔴</span>
        <span className="font-medium uppercase tracking-wide">Suletud</span>
        <span>— aken sulgus {fmt(gate.closesAt)}</span>
      </p>
    );
  }

  if (gate.reason === 'not_yet') {
    return (
      <p
        role="status"
        className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm text-amber-900"
      >
        <span aria-hidden="true">⏳</span>
        <span className="font-medium uppercase tracking-wide">Ei ole veel avatud</span>
        <span>— avaneb {fmt(gate.opensAt)}</span>
      </p>
    );
  }

  return (
    <p
      role="alert"
      className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-sm text-gray-900"
    >
      <span aria-hidden="true">⚠️</span>
      <span>Etappi ei leitud — võta ühendust korraldajaga.</span>
    </p>
  );
}
