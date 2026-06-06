/**
 * Masks an email for display to anyone other than the owner. Shows the first
 * and last character of the local part and the full domain — enough for the
 * owner to recognize the address while not leaking it to other group members.
 *
 * Examples:
 *   "alex@gmail.com"   -> "a***x@gmail.com"
 *   "ab@gmail.com"     -> "**@gmail.com"
 *   "x@gmail.com"      -> "*@gmail.com"
 *   "no-at-sign"       -> "***"
 */
export function maskEmail(email: string): string {
  if (typeof email !== 'string') return '***';
  const at = email.indexOf('@');
  if (at <= 0 || at === email.length - 1) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!domain.includes('.')) return '***';

  if (local.length === 1) return `*@${domain}`;
  if (local.length === 2) return `**@${domain}`;

  const first = local[0];
  const last = local[local.length - 1];
  return `${first}***${last}@${domain}`;
}
