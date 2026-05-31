import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { requireCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { isFinalEnded, loadAllPredictions } from '@/lib/roast/queries';
import { buildRoast, type RoastPick } from '@/lib/scoring/roast';
import { getCurrentTournamentId } from '@/lib/tournaments/current';
import { users } from '@/db/schema';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Roast — Jalkaennustus' };

async function loadUsername(userId: string): Promise<string> {
  const rows = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.username ?? 'tundmatu mängija';
}

export default async function RoastPage() {
  const session = await auth();
  if (!session?.user?.group_id) redirect('/login');
  const focusUserId = await requireCurrentUserId();

  const tournamentId = await getCurrentTournamentId();
  const finalEnded = await isFinalEnded(tournamentId);

  if (!finalEnded) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <header>
          <Link href="/" className="text-sm text-gray-500 hover:underline">
            ← Tagasi
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Roast</h1>
        </header>
        <section
          className="mt-6 rounded border bg-gray-50 p-6 text-gray-700"
          role="status"
        >
          <p className="font-medium">Roast avaneb pärast finaali.</p>
          <p className="mt-2 text-sm">
            Kui finaali tulemus on sees, koondame siin sinu turniiri parima
            ennustuse, mängud kus ainult sina pakkusid valesti, mängud mille
            kogu grupp valesti pakkus, ning ennustused kus sina olid grupis
            ainus, kes õigesti pakkus.
          </p>
        </section>
      </main>
    );
  }

  const [focusUsername, predictions] = await Promise.all([
    loadUsername(focusUserId),
    loadAllPredictions(session.user.group_id, tournamentId),
  ]);
  const roast = buildRoast({ focusUserId, predictions });

  const plainTextLines = renderPlainText({
    focusUsername,
    groupName: session.user.username,
    roast,
  });

  return (
    <main className="mx-auto max-w-2xl p-8">
      <header>
        <Link href="/" className="text-sm text-gray-500 hover:underline">
          ← Tagasi
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Roast — {focusUsername}</h1>
        <p className="mt-1 text-sm text-gray-600">
          Liiga <strong>{session.user.username}</strong> — WC2026 kokkuvõte. Kopeeri
          tekst all ja kleebi WhatsAppi.
        </p>
      </header>

      <section className="mt-6 space-y-4">
        <RoastBlock heading="🏆 Parim ennustus" pick={roast.bestPick} emptyLabel="—" />
        <RoastListBlock
          heading="🤦 Ainult sina pakkusid valesti"
          items={roast.soloWrong}
          emptyLabel="Mitte ühtegi sellist hetke — alati oli vähemalt veel keegi, kes mööda pani."
        />
        <RoastListBlock
          heading="🙈 Kogu grupp pakkus valesti"
          items={roast.groupWrong}
          emptyLabel="Ei leidnud — vähemalt keegi sai punkti igas ennustuses."
        />
        <RoastListBlock
          heading="✨ Ainult sina pakkusid õigesti"
          items={roast.soloCorrect}
          emptyLabel="Mitte ühtegi sellist hetke."
        />
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Kopeeritav tekst</h2>
        <pre
          className="mt-2 whitespace-pre-wrap rounded border bg-gray-50 p-4 text-sm"
          aria-label="WhatsApp-i jaoks valmis tekst"
        >
          {plainTextLines.join('\n')}
        </pre>
      </section>
    </main>
  );
}

function RoastBlock({
  heading,
  pick,
  emptyLabel,
}: {
  heading: string;
  pick: RoastPick | null;
  emptyLabel: string;
}) {
  return (
    <article className="rounded border p-4">
      <h2 className="text-base font-medium">{heading}</h2>
      {pick ? (
        <p className="mt-1">
          {pick.label} — <strong>{pick.points} p</strong>
        </p>
      ) : (
        <p className="mt-1 text-gray-500">{emptyLabel}</p>
      )}
    </article>
  );
}

function RoastListBlock({
  heading,
  items,
  emptyLabel,
}: {
  heading: string;
  items: RoastPick[];
  emptyLabel: string;
}) {
  return (
    <article className="rounded border p-4">
      <h2 className="text-base font-medium">{heading}</h2>
      {items.length === 0 ? (
        <p className="mt-1 text-gray-500">{emptyLabel}</p>
      ) : (
        <ul className="mt-1 list-disc pl-6">
          {items.map((item) => (
            <li key={`${item.predictionKind}:${item.predictionId}`}>
              {item.label}
              {item.points > 0 ? <> — <strong>{item.points} p</strong></> : null}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function renderPlainText(input: {
  focusUsername: string;
  groupName: string;
  roast: ReturnType<typeof buildRoast>;
}): string[] {
  const { focusUsername, groupName, roast } = input;
  const lines = [
    `Jalkaennustus WC2026 — ${focusUsername} (${groupName})`,
    '',
    `Parim ennustus: ${formatPick(roast.bestPick)}`,
  ];
  if (roast.soloWrong.length > 0) {
    lines.push('', 'Ainult mina pakkusin valesti (kõik teised said punkti):');
    for (const item of roast.soloWrong) lines.push(`- ${item.label}`);
  }
  if (roast.groupWrong.length > 0) {
    lines.push('', 'Kogu grupp pakkus valesti:');
    for (const item of roast.groupWrong) lines.push(`- ${item.label}`);
  }
  if (roast.soloCorrect.length > 0) {
    lines.push('', 'Ainult mina pakkusin õigesti:');
    for (const item of roast.soloCorrect) lines.push(`- ${item.label} (${item.points} p)`);
  }
  return lines;
}

function formatPick(pick: RoastPick | null): string {
  if (!pick) return '—';
  return `${pick.label} (${pick.points} p)`;
}
