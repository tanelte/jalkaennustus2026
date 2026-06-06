import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { buildCrossTournamentMatrix } from '@/lib/cross-tournament/build-matrix';
import {
  getGroupCrossTournamentCells,
  getGroupCrossTournamentTotals,
  getGroupTournaments,
} from '@/lib/cross-tournament/queries';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Läbi aegade' };

export default async function CrossTournamentPage() {
  const session = await auth();
  if (!session?.user?.group_id) {
    redirect('/login');
  }

  const groupId = session.user.group_id;
  const [tournaments, cells, totals] = await Promise.all([
    getGroupTournaments(groupId),
    getGroupCrossTournamentCells(groupId),
    getGroupCrossTournamentTotals(groupId),
  ]);

  const matrix = buildCrossTournamentMatrix(tournaments, cells, totals);

  return (
    <main className="mx-auto max-w-5xl p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Läbi aegade</h1>
        <Link href="/" className="text-sm text-gray-600 underline">
          Tagasi
        </Link>
      </header>
      <p className="mt-2 text-gray-600">Grupi koondtabel turniiride kaupa</p>

      {matrix.tournaments.length === 0 ? (
        <p className="mt-6 rounded border p-4 text-gray-600">
          Liiga ajalugu pole veel — kogume andmeid esimese turniiri jooksul.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b">
                <th
                  scope="col"
                  className="py-2 pr-3 text-sm font-medium text-gray-600"
                >
                  Mängija
                </th>
                {matrix.tournaments.map((t) => (
                  <th
                    key={t.id}
                    scope="col"
                    title={t.name}
                    className="py-2 px-2 text-right text-sm font-medium text-gray-600 tabular-nums"
                  >
                    {t.code}
                  </th>
                ))}
                <th
                  scope="col"
                  className="py-2 pl-3 text-right text-sm font-medium text-gray-600"
                >
                  Kokku
                </th>
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row) => (
                <tr key={row.user_id} className="border-b last:border-b-0">
                  <td className="py-2 pr-3">{row.username}</td>
                  {row.cells.map((cell, idx) => {
                    const isWinner = cell?.position === 1;
                    return (
                      <td
                        key={matrix.tournaments[idx].id}
                        className={`py-2 px-2 text-right tabular-nums ${
                          isWinner ? 'bg-amber-50' : ''
                        }`}
                      >
                        {cell == null ? (
                          ''
                        ) : (
                          <>
                            <span>{cell.points}</span>
                            {cell.position != null && (
                              <sup className="ml-1 text-xs text-gray-500">
                                {cell.position}
                              </sup>
                            )}
                          </>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-2 pl-3 text-right font-semibold tabular-nums">
                    {row.total_points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
