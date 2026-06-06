import Link from 'next/link';
import {
  HelpCircle,
  ListChecks,
  Medal,
  Shield,
  Trophy,
} from 'lucide-react';

import { SectionHeader } from '@/components/section-header';
import { Card, CardContent } from '@/components/ui/card';

const ADMIN_TILES: ReadonlyArray<{
  href: string;
  title: string;
  description: string;
  icon: typeof Trophy;
}> = [
  {
    href: '/admin/matches',
    title: 'Mängude tulemused',
    description:
      'Sisesta või paranda kodumeeskonna ja võõrsil meeskonna skoore. Knockoutmängudel märgi ka lõpetus.',
    icon: Trophy,
  },
  {
    href: '/admin/best-thirds',
    title: 'Best-thirds kinnitus',
    description:
      'Märgi ametlikud 8 paremat kolmandat (avaneb pärast alagrupiakna sulgumist).',
    icon: ListChecks,
  },
  {
    href: '/admin/finals',
    title: 'Finaali kinnitus',
    description:
      'Märgi ametlikud medalivõitjad: F1 (kuld), F2 (hõbe), F3 (pronks), F4 (neljas koht).',
    icon: Medal,
  },
  {
    href: '/admin/trivia',
    title: 'Trivia kinnitus',
    description:
      'Sisesta viie trivia küsimuse ametlikud vastused; Q5 skoorib ainult Q4 õigsuse korral.',
    icon: HelpCircle,
  },
];

export default function AdminHome() {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <SectionHeader as="h1" icon={Shield} title="Operaatori tööriistad" />
        <p className="text-sm text-text-muted">
          Sisesta või paranda mängude lõpptulemusi ja kinnita ametlikud
          väärtused. Iga toiming arvutab mõjutatud ennustused automaatselt
          ümber.
        </p>
      </header>

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border-default">
            {ADMIN_TILES.map((tile) => {
              const Icon = tile.icon;
              return (
                <li key={tile.href}>
                  <Link
                    href={tile.href}
                    className="flex items-start gap-3 p-4 transition-colors hover:bg-bg-app focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-state-upcoming-bg text-state-upcoming-text">
                      <Icon aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-semibold text-text-primary">
                        {tile.title}
                      </span>
                      <span className="mt-0.5 block text-sm text-text-muted">
                        {tile.description}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
