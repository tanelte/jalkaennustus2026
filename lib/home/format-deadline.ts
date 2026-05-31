/**
 * Deadline formatting for the home page's "Avatud aknad" cards.
 * "Sulgub 11.06 kl 16:00 (5 päeva 3 tundi)" — UX spec §5 block ②.
 *
 * Pure functions. The Intl formatter is module-scoped so it is constructed once.
 */

const DATE_FORMATTER = new Intl.DateTimeFormat('et-EE', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Tallinn',
});

export function formatDeadlineAbsolute(closesAt: Date): string {
  return DATE_FORMATTER.format(closesAt);
}

/**
 * Relative deadline ("5 päeva 3 tundi", "3 tundi 12 minutit", "12 minutit").
 * Trims to two units; falls through to minutes when below an hour. Returns
 * "kohe sulgumas" when the gap is under a minute (still positive).
 *
 * For negative gaps (clock past closes_at) returns null — the card would not
 * have been rendered as "open" in that case; the helper guards programmer error.
 */
export function formatDeadlineRelative(closesAt: Date, now: Date): string | null {
  const diffMs = closesAt.getTime() - now.getTime();
  if (diffMs < 0) return null;

  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes - days * 60 * 24) / 60);
  const minutes = totalMinutes - days * 60 * 24 - hours * 60;

  if (days > 0) {
    if (hours > 0) return `${days} ${pluralPaev(days)} ${hours} ${pluralTund(hours)}`;
    return `${days} ${pluralPaev(days)}`;
  }
  if (hours > 0) {
    if (minutes > 0) return `${hours} ${pluralTund(hours)} ${minutes} ${pluralMinut(minutes)}`;
    return `${hours} ${pluralTund(hours)}`;
  }
  if (minutes > 0) return `${minutes} ${pluralMinut(minutes)}`;
  return 'kohe sulgumas';
}

function pluralPaev(n: number): string {
  return n === 1 ? 'päev' : 'päeva';
}
function pluralTund(n: number): string {
  return n === 1 ? 'tund' : 'tundi';
}
function pluralMinut(n: number): string {
  return n === 1 ? 'minut' : 'minutit';
}
