'use client';

import { useActionState } from 'react';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginAction, type LoginError, type LoginState } from './actions';

const initialState: LoginState = {};

const ERROR_COPY: Record<LoginError, string> = {
  invalid: 'Vale kasutajanimi või parool.',
};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md bg-state-closed-bg px-3 py-2 text-sm text-state-closed-text"
        >
          <XCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{ERROR_COPY[state.error]}</p>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="username">Liiga kasutajanimi</Label>
        <Input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Parool</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Salvestab…' : 'Logi sisse'}
      </Button>
      <p className="text-center text-sm text-text-muted">
        Sa pead teadma oma liiga jagatud parooli.
      </p>
    </form>
  );
}
