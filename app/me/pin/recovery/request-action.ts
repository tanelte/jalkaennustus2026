'use server';

import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';

import { auth } from '@/lib/auth';
import { getCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { sendRecoveryEmail } from '@/lib/email/send';
import { log } from '@/lib/log';
import { maskEmail } from '@/lib/pin/mask-email';
import {
  invalidateIssuedTokenByHash,
  issueResetToken,
} from '@/lib/pin/recovery';
import { users } from '@/db/schema';

export type RequestPinResetError =
  | 'no_session'
  | 'no_user'
  | 'no_pin_set'
  | 'no_recovery_email'
  | 'email_send_failed';

export interface RequestPinResetState {
  ok?: boolean;
  error?: RequestPinResetError;
  /** Masked recovery email returned on success so the modal can confirm where
   * the link was sent without ever exposing the full address. */
  maskedEmail?: string;
}

/**
 * Resolve the absolute origin for the reset link. Prefers the live request
 * host (Next can serve under multiple hostnames in dev/preview), then the
 * NEXT_PUBLIC_BASE_URL fallback, then an empty string (relative path).
 */
async function resolveOrigin(): Promise<string> {
  try {
    const h = await headers();
    const fromOrigin = h.get('origin');
    if (fromOrigin) return fromOrigin;
    const host = h.get('host');
    const proto = h.get('x-forwarded-proto') ?? 'https';
    if (host) return `${proto}://${host}`;
  } catch {
    // No request scope (test/edge) — fall through.
  }
  return process.env.NEXT_PUBLIC_BASE_URL ?? '';
}

/**
 * E03 S05 — Request a PIN-reset email.
 *
 * Issues a fresh single-use token (invalidating any prior unconsumed ones for
 * this user atomically), builds the absolute reset link, then sends the email
 * via Brevo with a 3-second budget (NFR-2). On send failure the just-issued
 * row is rolled back (consumed) so no live token is left orphaned in the DB.
 *
 * Logs `pin_reset_request` per NFR-2 / NFR-5 / NFR-6. The recovery email is
 * never logged in unmasked form; the raw token is never logged at all.
 */
export async function requestPinResetAction(
  _prev: RequestPinResetState,
  _formData: FormData,
): Promise<RequestPinResetState> {
  const session = await auth();
  if (!session?.user?.group_id) {
    log.warn({
      operation: 'pin_reset_request',
      outcome: 'rejected',
      reason: 'no_session',
    });
    return { error: 'no_session' };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    log.warn({
      operation: 'pin_reset_request',
      outcome: 'rejected',
      reason: 'no_user',
      group_id: session.user.group_id,
    });
    return { error: 'no_user' };
  }

  const rows = await db
    .select({ pin_hash: users.pin_hash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    log.warn({
      operation: 'pin_reset_request',
      outcome: 'rejected',
      reason: 'no_user',
      user_id: userId,
      group_id: session.user.group_id,
    });
    return { error: 'no_user' };
  }
  if (row.pin_hash === null) {
    log.warn({
      operation: 'pin_reset_request',
      outcome: 'rejected',
      reason: 'no_pin_set',
      user_id: userId,
      group_id: session.user.group_id,
    });
    return { error: 'no_pin_set' };
  }

  const issued = await issueResetToken(userId);
  if (!issued.ok) {
    return { error: 'no_recovery_email' };
  }

  const origin = await resolveOrigin();
  const link = `${origin}/pin/reset/${issued.rawToken}`;

  const subject = 'Lähtesta oma Jalkaennustus PIN';
  const body = [
    'Tere!',
    '',
    'Sa palusid oma Jalkaennustuse PIN-koodi lähtestamist.',
    '',
    'Klõpsa allolevat linki, et seada uus PIN:',
    link,
    '',
    'Link kehtib 30 minutit alates saatmisest ja seda saab kasutada vaid ühe korra.',
    '',
    'Kui see e-kiri sinu sissetulevate hulka ei jõudnud, kontrolli ka rämpsposti — esimesel korral võib see sinna sattuda.',
    '',
    'Kui sa seda ei soovinud, ignoreeri seda kirja.',
    '',
    '— Jalkaennustus',
  ].join('\n');

  const sendResult = await sendRecoveryEmail({
    to: issued.recoveryEmail,
    subject,
    body,
  });

  if (!sendResult.ok) {
    // Roll back: mark the just-issued reset row consumed so the leaked-in-
    // -transit token (if any) cannot be redeemed. This is a small extra
    // write, but keeps the architectural invariant "no orphan live tokens"
    // even when the provider fails or times out.
    try {
      await invalidateIssuedTokenByHash(issued.tokenHash);
    } catch (err) {
      log.error({
        operation: 'pin_reset_request',
        outcome: 'rollback_failed',
        user_id: userId,
        group_id: session.user.group_id,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    log.warn({
      operation: 'pin_reset_request',
      outcome: 'email_send_failed',
      reason: sendResult.reason,
      user_id: userId,
      group_id: session.user.group_id,
    });
    return { error: 'email_send_failed' };
  }

  log.info({
    operation: 'pin_reset_request',
    outcome: 'ok',
    user_id: userId,
    group_id: session.user.group_id,
    recovery_email_masked: maskEmail(issued.recoveryEmail),
  });

  return { ok: true, maskedEmail: maskEmail(issued.recoveryEmail) };
}
