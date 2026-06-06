import Link from 'next/link';
import { Shield, Sparkles } from 'lucide-react';

import { Card } from '@/components/ui/card';
import type { CurrentScore } from '@/lib/home';

export interface StandingCardProps {
  currentScore: CurrentScore;
  href?: string;
}

/**
 * UX spec §14.2 / §15.1 — dark "Sinu seis" card. Two stat columns (Hetke
 * punktid + Asetus liigas), shield+sparkles decoration on the right, optional
 * `Vaata tabelit →` link. Reused on `/leaderboard` (S06) summarizing the
 * current player.
 */
export function StandingCard({ currentScore, href = '/leaderboard' }: StandingCardProps) {
  return (
    <Card className="relative overflow-hidden bg-surface-card-dark p-6 text-text-on-dark shadow-card-dark border-transparent">
      {/* Decorative shield + sparkles */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-4 -top-4 hidden h-32 w-32 md:block"
      >
        <Shield
          className="absolute inset-0 h-full w-full text-text-on-dark opacity-10"
          strokeWidth={1.5}
        />
        <Sparkles
          className="absolute right-6 top-6 h-6 w-6 text-brand-green opacity-60"
          strokeWidth={1.5}
        />
      </div>

      <h2 className="text-xl font-semibold">Sinu seis</h2>

      <div className="mt-4 grid grid-cols-2 gap-6">
        <div>
          <p className="text-sm text-text-on-dark-muted">Hetke punktid</p>
          <p className="mt-1 text-5xl font-bold tabular-nums">
            {currentScore.totalPoints}
            <span className="ml-1 text-2xl font-semibold text-text-on-dark-muted">
              p
            </span>
          </p>
        </div>
        <div>
          <p className="text-sm text-text-on-dark-muted">Asetus liigas</p>
          <p className="mt-1 text-5xl font-bold tabular-nums">
            {currentScore.position ?? '—'}
          </p>
        </div>
      </div>

      {href && (
        <p className="mt-6 text-sm">
          <Link
            href={href}
            className="font-medium text-brand-green hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card-dark rounded-sm"
          >
            Vaata tabelit →
          </Link>
        </p>
      )}
    </Card>
  );
}
