/**
 * Node-side NextAuth instance with the Credentials provider attached.
 * Imports the Node-only `pg` driver via `lib/db.ts`. Middleware imports
 * the edge-safe `authConfig` from `./config` directly, not from this file.
 */
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcryptjs from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { groups } from '@/db/schema';
import { log } from '@/lib/log';
import { reset as resetRateLimit } from '@/lib/ratelimit';
import { authConfig } from './config';
import { verifyGroupCredentials } from './credentials';

function extractIp(req: Request | undefined): string {
  if (!req) return 'unknown';
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

async function findGroupByUsername(username: string) {
  const rows = await db.select().from(groups).where(eq(groups.username, username)).limit(1);
  return rows[0] ?? null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Kasutajanimi', type: 'text' },
        password: { label: 'Parool', type: 'password' },
      },
      async authorize(credentials, request) {
        const ip = extractIp(request as Request | undefined);
        return verifyGroupCredentials(
          credentials as { username?: unknown; password?: unknown },
          ip,
          {
            findGroupByUsername,
            comparePassword: (pw, hash) => bcryptjs.compare(pw, hash),
            log,
            resetRateLimit,
          },
        );
      },
    }),
  ],
});
