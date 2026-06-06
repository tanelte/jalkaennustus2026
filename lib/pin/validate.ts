/**
 * Pure validation helpers for PIN-enable / verify flows. Kept I/O-free and
 * dependency-free so they run in any context (Server Action, Edge, test).
 */

const PIN_REGEX = /^[0-9]{4}$/;
// RFC-lite: one local part, one @, one domain with a dot. Good enough for our
// "recoverable email" requirement; the real validity check is whether the user
// can read mail at it.
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function isValidPin(raw: unknown): raw is string {
  return typeof raw === 'string' && PIN_REGEX.test(raw);
}

export function isValidEmail(raw: unknown): raw is string {
  return typeof raw === 'string' && EMAIL_REGEX.test(raw);
}
