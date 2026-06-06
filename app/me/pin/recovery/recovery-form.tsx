'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { SubmitButton } from '@/components/submit-button';
import {
  requestPinResetAction,
  type RequestPinResetError,
  type RequestPinResetState,
} from './request-action';

const initialState: RequestPinResetState = {};

const ERROR_COPY: Record<RequestPinResetError, string> = {
  no_session: 'Logi sisse uuesti.',
  no_user: 'Vali kõigepealt mängija.',
  no_pin_set: 'PIN-i pole seadistatud.',
  no_recovery_email:
    'Sul pole salvestatud taastusmeili. Lülita PIN välja ja seadista see uuesti koos taastusmeiliga.',
  email_send_failed:
    'Meili saatmine ebaõnnestus. Proovi mõne minuti pärast uuesti.',
};

export function RecoveryForm({ maskedEmail }: { maskedEmail: string }) {
  const [state, formAction, pending] = useActionState(
    requestPinResetAction,
    initialState,
  );

  if (state.ok) {
    return (
      <div className="space-y-3 text-sm">
        <p className="font-medium text-text-primary">
          Saatsime taastuslingi su meilile{' '}
          <span className="font-semibold">
            ({state.maskedEmail ?? maskedEmail})
          </span>
          .
        </p>
        <p className="text-text-muted">
          Kontrolli ka rämpsposti — esimesel korral võib see sinna sattuda. Link
          kehtib 30 minutit.
        </p>
        <Link
          href="/me"
          className="inline-block rounded border px-4 py-2 text-sm font-medium"
        >
          Tagasi
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4 text-sm">
      <p>
        Saadame taastuslingi su salvestatud aadressile{' '}
        <span className="font-semibold">{maskedEmail}</span>.
      </p>

      {state.error && (
        <p role="alert" className="text-state-closed-text">
          {ERROR_COPY[state.error]}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <SubmitButton
          pendingOverride={pending}
          className="bg-brand-green hover:bg-brand-green-hover"
        >
          Saada taastuslink
        </SubmitButton>
        <Link
          href="/me"
          className="inline-block rounded border px-4 py-2 text-sm font-medium"
        >
          Tühista
        </Link>
      </div>
    </form>
  );
}
