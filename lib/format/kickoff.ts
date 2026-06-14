/**
 * Kickoff time formatter for match cards and the admin matches table.
 *
 * Default (no `timeZone` argument) renders in the runtime's local timezone —
 * appropriate for Client Components, where the viewer's browser is the
 * source of truth. Server Components pass `'Europe/Tallinn'` explicitly,
 * since there is no browser timezone available server-side.
 *
 * Returns the shape `"DD.MM HH:mm"`. We compose from `formatToParts` rather
 * than relying on a locale's default short-format string, because Estonian
 * conventions use periods in times (`17.00`) and we want a colon.
 */
export function formatKickoff(input: string | Date, timeZone?: string): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}.${get('month')} ${get('hour')}:${get('minute')}`;
}
