'use server';

import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { signIn } from '@/lib/auth';

export type LoginError = 'invalid';

export interface LoginState {
  ok?: true;
  error?: LoginError;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get('username') ?? '');
  const password = String(formData.get('password') ?? '');

  try {
    await signIn('credentials', { username, password, redirectTo: '/' });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: 'invalid' };
    }
    throw err;
  }
  // signIn() with redirectTo throws NEXT_REDIRECT on success; this is unreachable.
  redirect('/');
}
