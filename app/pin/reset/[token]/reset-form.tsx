'use client';

import { useActionState } from 'react';
import Link from 'next/link';

import { SubmitButton } from '@/components/submit-button';
import {
  setNewPinFromTokenAction,
  type SetNewPinFromTokenError,
  type SetNewPinFromTokenState,
} from './actions';

const initialState: SetNewPinFromTokenState = {};

const ERROR_COPY: Record<SetNewPinFromTokenError, string> = {
  invalid_or_expired:
    'See link on aegunud või juba kasutatud. Palu uut taastuslinki.',
  pin_mismatch: 'Sisestatud PIN-id ei kattu.',
};

export interface ResetFormProps {
  token: string;
}

/**
 * E03 S05 — public reset surface form.
 *
 * Validation of the token happens server-side at submit time (not on page
 * load). This satisfies the no-info-leak principle: an attacker browsing the
 * `/pin/reset/<anything>` URL gets the same page render as the legitimate
 * recipient; only submission distinguishes valid from invalid.
 */
export function ResetForm({ token }: ResetFormProps) {
  const [state, formAction, pending] = useActionState(
    setNewPinFromTokenAction,
    initialState,
  );

  if (state.ok) {
    return (
      <div className="rounded-lg border border-border-default bg-surface-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-text-primary">
          PIN edukalt seadistatud
        </h1>
        <p className="mt-2 text-sm text-text-body">
          Logi nüüd grupina sisse ja vali oma mängija — uue PIN-i abil pääsed
          ennustustele tagasi ligi.
        </p>
        <div className="mt-4">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md bg-brand-green px-3 py-2 text-sm font-medium text-white hover:bg-brand-green-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2"
          >
            Logi sisse
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-lg border border-border-default bg-surface-card p-6 shadow-sm"
      noValidate
    >
      <input type="hidden" name="token" value={token} />

      <div>
        <h1 className="text-lg font-semibold text-text-primary">
          Sea uus PIN
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          See link kehtib 30 minutit alates saatmisest. Pärast PIN-i
          seadistamist pead grupina uuesti sisse logima.
        </p>
      </div>

      <div>
        <label
          htmlFor="reset-new-pin"
          className="block text-sm font-medium text-text-primary"
        >
          Uus PIN (4 numbrit)
        </label>
        <input
          id="reset-new-pin"
          name="new_pin"
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          pattern="[0-9]{4}"
          maxLength={4}
          required
          className="mt-2 w-full rounded-md border border-border-default bg-surface-card px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2"
        />
      </div>

      <div>
        <label
          htmlFor="reset-new-pin-confirm"
          className="block text-sm font-medium text-text-primary"
        >
          Korda PIN-i
        </label>
        <input
          id="reset-new-pin-confirm"
          name="new_pin_confirm"
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
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

      <div className="flex justify-end pt-2">
        <SubmitButton
          pendingOverride={pending}
          className="bg-brand-green hover:bg-brand-green-hover"
        >
          Salvesta PIN
        </SubmitButton>
      </div>
    </form>
  );
}
