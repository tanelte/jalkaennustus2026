import Link from 'next/link';

export default function AdminHome() {
  return (
    <article className="space-y-4 text-sm text-gray-800">
      <p>
        Operaatori tööriistad: sisesta või paranda mängude lõpptulemusi ja
        kinnita ametlik 8 paremat kolmandat. Iga toiming uuendab mõjutatud
        ennustused automaatselt.
      </p>
      <ul className="space-y-2">
        <li>
          <Link href="/admin/matches" className="text-blue-700 underline">
            Mängude tulemused
          </Link>
          <span className="text-gray-600"> — sisesta / korrigeeri kodumeeskonna ja võõrsil meeskonna skoore.</span>
        </li>
        <li>
          <Link href="/admin/best-thirds" className="text-blue-700 underline">
            Best-thirds kinnitus
          </Link>
          <span className="text-gray-600"> — märgi ametlikud 8 paremat kolmandat (avaneb pärast alagrupiakna sulgumist).</span>
        </li>
      </ul>
    </article>
  );
}
