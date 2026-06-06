/**
 * E03 S02 — `pin_unlocked` cookie.
 *
 * Edge-safe HMAC-SHA-256 signed cookie that carries the set of users who are
 * currently "unlocked" in this browser session: `Array<{ user_id, exp }>` where
 * `exp` is an absolute expiry epoch in milliseconds.
 *
 * The signed envelope is `<base64url(json)>.<base64url(sig)>`. Tampered or
 * unsigned values are silently treated as absent (NFR-4). The cookie payload
 * is never logged.
 *
 * NEVER import `bcryptjs` or any Node-only crypto here — this module is
 * intentionally Edge-runtime safe so that future middleware-side reads stay
 * possible.
 */
import { cookies } from 'next/headers';
import { log } from '@/lib/log';

export const PIN_UNLOCKED_COOKIE = 'pin_unlocked';
export const PIN_UNLOCK_TTL_MS = 30 * 60 * 1000;

export interface UnlockEntry {
  user_id: string;
  /** Absolute expiry, epoch ms. */
  exp: number;
}

// --- pure helpers (no `next/headers`) ----------------------------------------

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function hmac(secret: string, payload: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return new Uint8Array(sig);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

function getCookieSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET must be set to sign the pin_unlocked cookie.');
  }
  return secret;
}

function isUnlockEntry(value: unknown): value is UnlockEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.user_id === 'string' && typeof v.exp === 'number';
}

/** Sign a payload of unlock entries. Pure — does not touch cookies. */
export async function signPayload(
  payload: readonly UnlockEntry[],
  secret: string,
): Promise<string> {
  const json = JSON.stringify(payload);
  const body = bytesToBase64Url(new TextEncoder().encode(json));
  const sig = await hmac(secret, body);
  return `${body}.${bytesToBase64Url(sig)}`;
}

export type VerifyOutcome =
  | { kind: 'absent' }
  | { kind: 'invalid_signature' }
  | { kind: 'valid'; entries: UnlockEntry[] };

/**
 * Verify a signed `pin_unlocked` envelope and project entries that are still
 * within their `exp` window at `now`. Returns a tagged union so callers can
 * log the outcome without inspecting the payload itself.
 */
export async function verifySignedPayload(
  raw: string | undefined,
  secret: string,
  now: number,
): Promise<VerifyOutcome> {
  if (!raw) return { kind: 'absent' };
  const dot = raw.lastIndexOf('.');
  if (dot <= 0 || dot === raw.length - 1) return { kind: 'invalid_signature' };
  const body = raw.slice(0, dot);
  const tag = raw.slice(dot + 1);

  let providedSig: Uint8Array;
  let bodyBytes: Uint8Array;
  try {
    providedSig = base64UrlToBytes(tag);
    bodyBytes = base64UrlToBytes(body);
  } catch {
    return { kind: 'invalid_signature' };
  }
  const expectedSig = await hmac(secret, body);
  if (!timingSafeEqual(providedSig, expectedSig)) {
    return { kind: 'invalid_signature' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bodyBytes));
  } catch {
    return { kind: 'invalid_signature' };
  }
  if (!Array.isArray(parsed)) return { kind: 'invalid_signature' };

  const entries: UnlockEntry[] = [];
  for (const item of parsed) {
    if (!isUnlockEntry(item)) {
      // A single malformed entry invalidates the whole envelope — fail closed.
      return { kind: 'invalid_signature' };
    }
    if (item.exp > now) entries.push(item);
  }
  return { kind: 'valid', entries };
}

// --- cookie-bound helpers (consume `next/headers`) ---------------------------

/**
 * Read the set of user-ids currently unlocked in this browser session. Tampered,
 * expired, or absent cookies all yield an empty set. Per NFR-4 a structured
 * `pin_cookie_verify` log line is emitted with the verification outcome — never
 * the payload itself.
 */
export async function readUnlockedUsers(now: number = Date.now()): Promise<Set<string>> {
  const store = await cookies();
  const raw = store.get(PIN_UNLOCKED_COOKIE)?.value;
  const outcome = await verifySignedPayload(raw, getCookieSecret(), now);

  switch (outcome.kind) {
    case 'absent':
      log.info({ operation: 'pin_cookie_verify', outcome: 'absent' });
      return new Set();
    case 'invalid_signature':
      log.warn({ operation: 'pin_cookie_verify', outcome: 'invalid_signature' });
      return new Set();
    case 'valid': {
      log.info({
        operation: 'pin_cookie_verify',
        outcome: outcome.entries.length > 0 ? 'valid' : 'expired',
      });
      return new Set(outcome.entries.map((e) => e.user_id));
    }
  }
}

/** Read the full entry list (used internally for sliding writes). */
async function readEntries(now: number = Date.now()): Promise<UnlockEntry[]> {
  const store = await cookies();
  const raw = store.get(PIN_UNLOCKED_COOKIE)?.value;
  const outcome = await verifySignedPayload(raw, getCookieSecret(), now);
  return outcome.kind === 'valid' ? outcome.entries : [];
}

function maxExp(entries: readonly UnlockEntry[]): number {
  let max = 0;
  for (const e of entries) if (e.exp > max) max = e.exp;
  return max;
}

/**
 * Add (or refresh) an unlock entry for `userId`, valid for `ttlMs` from now.
 * The cookie's `Max-Age` tracks the longest entry so the browser hands the
 * cookie back at least until the last unlock would have expired anyway.
 */
export async function addUnlock(userId: string, ttlMs: number): Promise<void> {
  const now = Date.now();
  const existing = (await readEntries(now)).filter((e) => e.user_id !== userId);
  existing.push({ user_id: userId, exp: now + ttlMs });

  const signed = await signPayload(existing, getCookieSecret());
  const maxAgeSeconds = Math.max(1, Math.ceil((maxExp(existing) - now) / 1000));
  const store = await cookies();
  store.set(PIN_UNLOCKED_COOKIE, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  });
}

/**
 * Remove a single user from the unlock set. If the resulting set is empty the
 * cookie is deleted outright.
 */
export async function removeUnlock(userId: string): Promise<void> {
  const now = Date.now();
  const remaining = (await readEntries(now)).filter((e) => e.user_id !== userId);

  const store = await cookies();
  if (remaining.length === 0) {
    store.delete(PIN_UNLOCKED_COOKIE);
    return;
  }
  const signed = await signPayload(remaining, getCookieSecret());
  const maxAgeSeconds = Math.max(1, Math.ceil((maxExp(remaining) - now) / 1000));
  store.set(PIN_UNLOCKED_COOKIE, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  });
}

/** Drop the cookie entirely. */
export async function clearAllUnlocks(): Promise<void> {
  const store = await cookies();
  store.delete(PIN_UNLOCKED_COOKIE);
}
