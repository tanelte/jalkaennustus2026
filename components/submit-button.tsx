'use client';

import * as React from 'react';
import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from '@/components/ui/button';

export interface SubmitButtonProps extends Omit<ButtonProps, 'type'> {
  /**
   * Label rendered while the action is pending. Defaults to UX §16.2 copy
   * ("Salvestab…"). Idle label is the button's `children`.
   */
  pendingLabel?: string;
  /**
   * Optional override for the pending state. Some forms in this codebase use
   * `useActionState` + `startTransition` rather than passing the action via
   * `<form action={…}>`. In that path React 19's `useFormStatus` cannot see
   * the pending state, so the caller passes it explicitly via this prop. When
   * omitted, the component falls back to `useFormStatus().pending`.
   */
  pendingOverride?: boolean;
}

/**
 * Shared submit Button used by every prediction surface (UX §15.4, §16.2).
 * Wraps the shadcn `Button` and swaps its label to `Salvestab…` while the
 * enclosing form is submitting. Renders as `type="submit"` so it can sit
 * inside any `<form>`.
 */
export function SubmitButton({
  children,
  pendingLabel = 'Salvestab…',
  pendingOverride,
  disabled,
  ...rest
}: SubmitButtonProps) {
  const status = useFormStatus();
  const pending = pendingOverride ?? status.pending;
  return (
    <Button type="submit" disabled={disabled || pending} {...rest}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
