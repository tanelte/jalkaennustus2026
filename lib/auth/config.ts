/**
 * Edge-safe NextAuth configuration. Imported by middleware (Edge runtime) and
 * re-exported by lib/auth/index.ts where the Node-only Credentials provider is
 * attached. Do not import Node-only modules (db, bcryptjs) from this file.
 */
import type { NextAuthConfig } from 'next-auth';

const PUBLIC_PATH_PREFIXES = ['/login', '/api/auth'];

export const authConfig = {
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublic = PUBLIC_PATH_PREFIXES.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`),
      );
      if (isPublic) return true;
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user) {
        token.group_id = user.id;
        token.username = user.name;
      }
      return token;
    },
    session({ session, token }) {
      session.user.group_id = token.group_id as string;
      session.user.username = token.username as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
