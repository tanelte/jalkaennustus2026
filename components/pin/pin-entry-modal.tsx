'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

import { SubmitButton } from '@/components/submit-button';
import {
  verifyPinAction,
  type VerifyPinState,
  type VerifyPinError,
} from '@/app/me/pin/verify-action';

const initialState: VerifyPinState = {};

const ERROR_COPY: Record<VerifyPinError, string> = {
  no_session: 'Logi sisse uuesti.',
  no_user: 'Vali kõigepealt mängija.',
  wrong_pin: 'Vale PIN. Proovi uuesti.',
  no_pin_set: 'PIN-i pole seadistatud.',
  pin_rate_limited:
    'Liiga palju katseid. Proovi mõne minuti pärast (või kasuta "Unustasid PIN-i?").',
};

export interface PinEntryModalProps {
  open: boolean;
  onClose?: () => void;
  /**
   * Forward-compat hook for S05 — the forgot-PIN attachment needs the
   * user id to look up the masked recovery email. Not used in S02.
   */
  userId: string;
}

/**
 * E03 S02 — PIN-entry modal.
 *
 * Reused everywhere a prediction-write surface needs to prompt for PIN. Mounts
 * only when `open` is true so escape-key handlers / focus traps don't leak.
 * Accessibility: `role="dialog"` + `aria-modal` + initial focus + Tab cycle
 * trap (NFR-8 / FE constitution §V).
 *
 * Submits to `verifyPinAction`; on `{ ok: true }` the modal closes and the
 * router refreshes so the calling form can be re-submitted with the unlock
 * cookie now present.
 */
export function PinEntryModal({ open, onClose, userId: _userId }: PinEntryModalProps) {
  const [state, formAction, pending] = useActionState(verifyPinAction, initialState);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the PIN input as soon as the dialog mounts.
  useEffect(() => {
    if (!open) return;
    // Defer to next tick so React has committed the DOM.
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  // Trap Tab inside the dialog. Esc closes.
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

  // On success, refresh the page so the unlock cookie is observed, then close.
  useEffect(() => {
    if (state.ok) {
      onClose?.();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  if (!open) return null;

  return (
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

        <form action={formAction} className="mt-4 space-y-4" noValidate>
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

          {state.error && (
            <p role="alert" className="text-sm text-state-closed-text">
              {ERROR_COPY[state.error]}
            </p>
          )}

          {/* TODO(S05): "Unustasid PIN-i?" link */}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onClose?.()}
              className="rounded border border-border-default px-3 py-2 text-sm text-text-primary"
            >
              Tühista
            </button>
            <SubmitButton
              pendingOverride={pending}
              className="bg-brand-green hover:bg-brand-green-hover"
            >
              Kinnita
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
