/**
 * E03 S05 — Brevo transactional-email adapter (ADR-E03-01).
 *
 * The ONLY place in the codebase that imports `@getbrevo/brevo`. If the provider
 * is swapped (Resend, nodemailer, etc.), the swap lives behind this same
 * `sendRecoveryEmail` boundary and no caller code needs to change.
 *
 * Contract:
 *  - Returns `{ ok: true }` on a 2xx response.
 *  - Returns `{ ok: false, reason: 'failed' }` on any SDK error, config error,
 *    or non-2xx response.
 *  - Returns `{ ok: false, reason: 'timeout' }` if the provider hangs past the
 *    3-second NFR-2 budget.
 *
 * Logging is structured per NFR-2 / NFR-5 / NFR-6:
 *  - operation: 'recovery_email_send'
 *  - outcome:   'sent' | 'failed' | 'timeout' | 'config_missing'
 *  - duration_ms: integer
 *  - provider:  'brevo'
 *  - The raw recipient email is NEVER logged. If a hint is desired, it is
 *    masked with `maskEmail` before emission.
 */
import { BrevoClient } from '@getbrevo/brevo';

import { maskEmail } from '@/lib/pin/mask-email';
import { log } from '@/lib/log';

export interface SendRecoveryEmailArgs {
  to: string;
  subject: string;
  /** Plain text or simple HTML. */
  body: string;
}

export type SendRecoveryEmailResult =
  | { ok: true }
  | { ok: false; reason: 'failed' | 'timeout' };

/** Hard timeout per NFR-2. The Server Action must not wait longer than 3s. */
const SEND_TIMEOUT_MS = 3_000;

/**
 * Verified-sender identity. `BREVO_SENDER_EMAIL` must point at a mailbox that
 * has completed Brevo's verified-sender click-through; otherwise the API
 * accepts the payload but the message is silently rejected at delivery.
 * Resolved at call time (not module-load) so tests / preview environments can
 * inject the value after import.
 */
function resolveBrevoSender(): { email: string; name: string } {
  return {
    email: process.env.BREVO_SENDER_EMAIL ?? 'no-reply@jalkaennustus.invalid',
    name: 'Jalkaennustus',
  };
}

export async function sendRecoveryEmail(
  args: SendRecoveryEmailArgs,
): Promise<SendRecoveryEmailResult> {
  const start = Date.now();
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    // Config error: surface as `failed` to the caller (the UX-facing copy is
    // already "couldn't send — try again") but make the cause obvious in the
    // structured log so operators can fix it.
    log.warn({
      operation: 'recovery_email_send',
      outcome: 'config_missing',
      duration_ms: 0,
      provider: 'brevo',
      to_masked: maskEmail(args.to),
    });
    return { ok: false, reason: 'failed' };
  }

  const client = new BrevoClient({ apiKey });
  const sender = resolveBrevoSender();

  // Race the SDK call against a 3s timeout. Whoever resolves first wins.
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<{ kind: 'timeout' }>((resolve) => {
    timeoutHandle = setTimeout(
      () => resolve({ kind: 'timeout' }),
      SEND_TIMEOUT_MS,
    );
  });

  const sendPromise: Promise<{ kind: 'sent' } | { kind: 'failed'; err: unknown }> =
    client.transactionalEmails
      .sendTransacEmail({
        subject: args.subject,
        textContent: args.body,
        sender,
        to: [{ email: args.to }],
      })
      .then(() => ({ kind: 'sent' as const }))
      .catch((err: unknown) => ({ kind: 'failed' as const, err }));

  const outcome = await Promise.race([sendPromise, timeoutPromise]);
  if (timeoutHandle) clearTimeout(timeoutHandle);

  const duration_ms = Date.now() - start;

  if (outcome.kind === 'sent') {
    log.info({
      operation: 'recovery_email_send',
      outcome: 'sent',
      duration_ms,
      provider: 'brevo',
      to_masked: maskEmail(args.to),
    });
    return { ok: true };
  }

  if (outcome.kind === 'timeout') {
    log.warn({
      operation: 'recovery_email_send',
      outcome: 'timeout',
      duration_ms,
      provider: 'brevo',
      to_masked: maskEmail(args.to),
    });
    return { ok: false, reason: 'timeout' };
  }

  log.error({
    operation: 'recovery_email_send',
    outcome: 'failed',
    duration_ms,
    provider: 'brevo',
    to_masked: maskEmail(args.to),
    err: outcome.err instanceof Error ? outcome.err.message : String(outcome.err),
  });
  return { ok: false, reason: 'failed' };
}
