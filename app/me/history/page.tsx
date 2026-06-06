import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { requireCurrentUserId } from '@/lib/current-user';
import { getPlayerHistory } from '@/lib/me/history/queries';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Sinu ajalugu' };

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user?.group_id) {
    redirect('/login');
  }

  const userId = await requireCurrentUserId();
  const rows = await getPlayerHistory(userId, session.user.group_id);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sinu ajalugu</h1>
        <Link href="/" className="text-sm text-gray-600 underline">
          Tagasi
        </Link>
      </header>
      <p className="mt-2 text-gray-600">Sinu turniiride punktid ja kohad</p>

      {rows.length === 0 ? (
        <p className="mt-6 rounded border p-4 text-gray-600">
          Esimene turniir — kogu ajalugu algab siit.
        </p>
      ) : (
        <table className="mt-6 w-full border-collapse text-left">
          <thead>
            <tr className="border-b">
              <th scope="col" className="py-2 pr-3 text-sm font-medium text-gray-600">
                Turniir
              </th>
              <th scope="col" className="py-2 pr-3 text-right text-sm font-medium text-gray-600">
                Punktid
              </th>
              <th scope="col" className="py-2 text-right text-sm font-medium text-gray-600">
                Koht
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.tournamentCode} className="border-b last:border-b-0">
                <td className="py-2 pr-3">
                  <strong>{row.tournamentCode}</strong> — {row.tournamentName}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{row.totalPoints}</td>
                <td className="py-2 text-right tabular-nums">{row.finishingPosition}.</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
