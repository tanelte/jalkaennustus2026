'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

import { SubmitButton } from '@/components/submit-button';
import {
  verifyPinAction,
  type VerifyPinState,
  type VerifyPinError,
} from '@/app/me/pin/verify-action';
import {
  requestPinResetAction,
  type RequestPinResetError,
  type RequestPinResetState,
} from '@/app/me/pin/recovery/request-action';

const initialVerifyState: VerifyPinState = {};
const initialResetState: RequestPinResetState = {};

const ERROR_COPY: Record<VerifyPinError, string> = {
  no_session: 'Logi sisse uuesti.',
  no_user: 'Vali kõigepealt mängija.',
  wrong_pin: 'Vale PIN. Proovi uuesti.',
  no_pin_set: 'PIN-i pole seadistatud.',
  pin_rate_limited:
    'Liiga palju katseid. Proovi mõne minuti pärast (või kasuta "Unustasid PIN-i?").',
};

const RESET_ERROR_COPY: Record<RequestPinResetError, string> = {
  no_session: 'Logi sisse uuesti.',
  no_user: 'Vali kõigepealt mängija.',
  no_pin_set: 'Sul pole PIN-i seadistatud, taastamist pole vaja.',
  no_recovery_email:
    'Sul pole taastamise e-posti aadressi salvestatud — ei saa taastuslinki saata.',
  email_send_failed:
    'Kirja saatmine ebaõnnestus. Proovi mõne hetke pärast uuesti.',
};

export interface PinEntryModalProps {
  open: boolean;
  onClose?: () => void;
  userId: string;
  /**
   * Server-side masked recovery email for the currently selected user. If
   * provided, the modal exposes the "Unustasid PIN-i?" recovery branch.
   * Undefined / null hides the link (user hasn't enrolled in recovery).
   */
  maskedRecoveryEmail?: string | null;
}

/**
 * E03 S02 + S05 — PIN-entry modal.
 *
 * Mounts only when `open` is true so escape-key handlers / focus traps don't
 * leak. Accessibility: `role="dialog"` + `aria-modal` + initial focus + Tab
 * cycle trap (NFR-8 / FE constitution §V).
 *
 * S05 attachment: the "Unustasid PIN-i?" link toggles a sub-panel that shows
 * the masked recovery email + a button bound to `requestPinResetAction`. On
 * success the panel renders the R-1 "check spam" nudge in Estonian.
 */
export function PinEntryModal({
  open,
  onClose,
  userId: _userId,
  maskedRecoveryEmail,
}: PinEntryModalProps) {
  const [verifyState, verifyFormAction, verifyPending] = useActionState(
    verifyPinAction,
    initialVerifyState,
  );
  const [resetState, resetFormAction, resetPending] = useActionState(
    requestPinResetAction,
    initialResetState,
  );
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Portal target is only available after hydration on the client.
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = containerRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // On verify success, refresh so the unlock cookie is observed, then close.
  useEffect(() => {
    if (verifyState.ok) {
      onClose?.();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyState.ok]);

  // Reset recovery state when the modal opens again so a previous "couldn't
  // send" toast doesn't leak into a fresh attempt.
  useEffect(() => {
    if (!open) setRecoveryOpen(false);
  }, [open]);

  if (!open || !mounted) return null;

  const canRecover = !!maskedRecoveryEmail;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
    >
      <div
        ref={containerRef}
        className="w-full max-w-sm rounded-lg border border-border-default bg-surface-card p-6 shadow-lg"
      >
        <h2
          id="pin-modal-title"
          className="text-lg font-semibold text-text-primary"
        >
          Sisesta oma PIN
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Sinu ennustused on PIN-iga kaitstud. Sisesta PIN, et muudatusi
          salvestada.
        </p>

        <form
          action={verifyFormAction}
          onSubmit={(e) => e.stopPropagation()}
          className="mt-4 space-y-4"
          noValidate
        >
          <div>
            <label
              htmlFor="pin-modal-input"
              className="block text-sm font-medium text-text-primary"
            >
              PIN (4 numbrit)
            </label>
            <input
              ref={inputRef}
              id="pin-modal-input"
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]{4}"
              maxLength={4}
              required
              className="mt-2 w-full rounded-md border border-border-default bg-surface-card px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2"
            />
          </div>

          {verifyState.error && (
            <p role="alert" className="text-sm text-state-closed-text">
              {ERROR_COPY[verifyState.error]}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onClose?.()}
              className="rounded border border-border-default px-3 py-2 text-sm text-text-primary"
            >
              Tühista
            </button>
            <SubmitButton
              pendingOverride={verifyPending}
              className="bg-brand-green hover:bg-brand-green-hover"
            >
              Kinnita
            </SubmitButton>
          </div>
        </form>

        {canRecover && !recoveryOpen && (
          <div className="mt-4 flex justify-center border-t border-border-default pt-4">
            <button
              type="button"
              onClick={() => setRecoveryOpen(true)}
              className="text-sm font-medium text-brand-green underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2"
            >
              Unustasid PIN-i? Saada taastuslink meilile
            </button>
          </div>
        )}

        {canRecover && recoveryOpen && (
          <div className="mt-5 border-t border-border-default pt-4">
            {resetState.ok ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-text-primary">
                  Saatsime taastuslingi su meilile{' '}
                  <span className="font-semibold">
                    ({resetState.maskedEmail ?? maskedRecoveryEmail})
                  </span>
                  .
                </p>
                <p className="text-sm text-text-muted">
                  Kontrolli ka rämpsposti — esimesel korral võib see sinna
                  sattuda. Link kehtib 30 minutit.
                </p>
              </div>
            ) : (
              <form
                action={resetFormAction}
                onSubmit={(e) => e.stopPropagation()}
                className="space-y-3"
              >
                <p className="text-sm text-text-body">
                  Saadame taastuslingi su salvestatud aadressile{' '}
                  <span className="font-semibold">{maskedRecoveryEmail}</span>.
                </p>
                {resetState.error && (
                  <p
                    role="alert"
                    className="text-sm text-state-closed-text"
                  >
                    {RESET_ERROR_COPY[resetState.error]}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRecoveryOpen(false)}
                    className="rounded border border-border-default px-3 py-2 text-sm text-text-primary"
                  >
                    Tagasi
                  </button>
                  <SubmitButton
                    pendingOverride={resetPending}
                    className="bg-brand-green hover:bg-brand-green-hover"
                  >
                    Saada taastuslink
                  </SubmitButton>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
