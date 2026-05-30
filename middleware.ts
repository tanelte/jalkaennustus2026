/**
 * Edge middleware: protects routes via an explicit unauthenticated-redirect to
 * /login, redirects authenticated requests without a selected user to
 * /select-user, and applies an in-memory rate-limit stub on the credentials
 * callback.
 *
 * The rate-limit stub is local-dev-grade only — production uses Upstash (S16).
 */
import NextAuth from 'next-auth';
import { NextResponse, type NextRequest } from 'next/server';
import { authConfig } from '@/lib/auth/config';
import { log } from '@/lib/log';
import { increment, peek } from '@/lib/ratelimit';
import {
  CURRENT_USER_COOKIE,
  getCurrentUserSecret,
  verifyUserId,
} from '@/lib/sign-user-id';

const { auth } = NextAuth(authConfig);

const CREDENTIALS_CALLBACK_PATH = '/api/auth/callback/credentials';
const PUBLIC_PATH_PREFIXES = ['/login', '/api/auth'];
const SELECT_USER_PATH = '/select-user';

function extractIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

function isPublic(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  if (req.method === 'POST' && pathname === CREDENTIALS_CALLBACK_PATH) {
    const ip = extractIp(req);
    if (peek(ip)) {
      log.warn({ operation: 'auth', outcome: 'auth_failure_rate_limited', ip });
      return new NextResponse(null, { status: 429 });
    }
    increment(ip);
    return undefined;
  }

  if (!req.auth && !isPublic(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Authenticated request: require a selected user before any non-/select-user page.
  if (req.auth && pathname !== SELECT_USER_PATH && !isPublic(pathname)) {
    const cookieValue = req.cookies.get(CURRENT_USER_COOKIE)?.value;
    const userId = await verifyUserId(cookieValue, getCurrentUserSecret());
    if (!userId) {
      const url = req.nextUrl.clone();
      url.pathname = SELECT_USER_PATH;
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return undefined;
});

export const config = {
  matcher: [
    // Protected pages: everything except Next internals, /api, and static assets.
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
    // Rate-limited credential submissions.
    '/api/auth/callback/credentials',
  ],
};
