import { ResetForm } from './reset-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sea uus PIN — Jalkaennustus' };

/**
 * E03 S05 — Public PIN-reset surface.
 *
 * Sits outside the middleware-protected set (see middleware.ts public-paths
 * allowlist `'/pin/reset'`) so an email-delivered link can be opened without
 * an active Group session. The route is best-effort optimistic: token
 * validity is checked at submit time, not on page load, so a malformed or
 * already-consumed token doesn't change the render — only submission
 * distinguishes valid from invalid. This satisfies the architecture I4 /
 * S05 AC "no info leak between expired and consumed".
 */
export default async function PinResetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <ResetForm token={token} />
    </main>
  );
}
