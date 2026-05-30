import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { getGroupLeaderboard, getTournamentIdByCode } from '@/lib/leaderboard/queries';

export const dynamic = 'force-dynamic';

const WC2026_CODE = 'WC2026';

export const metadata = { title: 'Edetabel' };

export default async function LeaderboardPage() {
  const session = await auth();
  if (!session?.user?.group_id) {
    redirect('/login');
  }

  const tournamentId = await getTournamentIdByCode(WC2026_CODE);
  if (!tournamentId) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-2xl font-semibold">Edetabel</h1>
        <p className="mt-4 text-red-700">Turniiri WC2026 ei leitud andmebaasist.</p>
      </main>
    );
  }

  const rows = await getGroupLeaderboard(session.user.group_id, tournamentId);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Edetabel</h1>
        <Link href="/" className="text-sm text-gray-600 underline">
          Tagasi
        </Link>
      </header>
      <p className="mt-2 text-gray-600">WC2026 – grupi seis</p>

      {rows.length === 0 ? (
        <p className="mt-6 rounded border p-4 text-gray-600">
          Selles grupis pole veel mängijaid.
        </p>
      ) : (
        <table className="mt-6 w-full border-collapse text-left">
          <thead>
            <tr className="border-b">
              <th scope="col" className="py-2 pr-3 text-sm font-medium text-gray-600">
                Koht
              </th>
              <th scope="col" className="py-2 pr-3 text-sm font-medium text-gray-600">
                Mängija
              </th>
              <th scope="col" className="py-2 text-right text-sm font-medium text-gray-600">
                Punktid
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.user_id} className="border-b last:border-b-0">
                <td className="py-2 pr-3">{row.position}</td>
                <td className="py-2 pr-3">{row.username}</td>
                <td className="py-2 text-right tabular-nums">{row.total_points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
