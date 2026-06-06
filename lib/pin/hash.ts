/**
 * PIN hashing primitive. Wraps bcryptjs at cost 12 — same work factor used for
 * group passwords (`app/groups/new/actions.ts`, `BCRYPT_COST = 12`). Constitution
 * §2 requires every secret stored in this platform to be hashed with at least
 * this cost. The raw PIN never leaves this module's caller — never logged,
 * never persisted as anything other than its bcrypt digest.
 */
import bcryptjs from 'bcryptjs';

export const PIN_BCRYPT_COST = 12;

export async function hashPin(raw: string): Promise<string> {
  return bcryptjs.hash(raw, PIN_BCRYPT_COST);
}

export async function verifyPin(raw: string, hash: string): Promise<boolean> {
  if (!raw || !hash) return false;
  return bcryptjs.compare(raw, hash);
}
