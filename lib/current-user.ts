import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  CURRENT_USER_COOKIE,
  getCurrentUserSecret,
  signUserId,
  verifyUserId,
} from './sign-user-id';

export { CURRENT_USER_COOKIE } from './sign-user-id';

/** Server-side getter for Server Components / Server Actions. */
export async function getCurrentUserId(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(CURRENT_USER_COOKIE)?.value;
  return verifyUserId(raw, getCurrentUserSecret());
}

/** Server-side getter that redirects to /select-user when no user is chosen. */
export async function requireCurrentUserId(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) redirect('/select-user');
  return userId;
}

/** Set the signed cookie (Server Actions only). */
export async function setCurrentUserCookie(userId: string): Promise<void> {
  const signed = await signUserId(userId, getCurrentUserSecret());
  const store = await cookies();
  store.set(CURRENT_USER_COOKIE, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

/** Clear the signed cookie (Server Actions only). */
export async function clearCurrentUserCookie(): Promise<void> {
  const store = await cookies();
  store.delete(CURRENT_USER_COOKIE);
}
