/**
 * Pure Web-Crypto HMAC signing for the `current_user_id` cookie value.
 * Lives in its own file (no `next/headers` import) so middleware (Edge runtime)
 * can import it directly.
 */

export const CURRENT_USER_COOKIE = 'current_user_id';

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

export function getCurrentUserSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET must be set to sign the current_user_id cookie.');
  }
  return secret;
}

export async function signUserId(userId: string, secret: string): Promise<string> {
  const sig = await hmac(secret, userId);
  return `${userId}.${bytesToBase64Url(sig)}`;
}

export async function verifyUserId(
  signed: string | undefined,
  secret: string,
): Promise<string | null> {
  if (!signed) return null;
  const dot = signed.lastIndexOf('.');
  if (dot <= 0 || dot === signed.length - 1) return null;
  const userId = signed.slice(0, dot);
  const tag = signed.slice(dot + 1);

  let provided: Uint8Array;
  try {
    provided = base64UrlToBytes(tag);
  } catch {
    return null;
  }
  const expected = await hmac(secret, userId);
  return timingSafeEqual(provided, expected) ? userId : null;
}
