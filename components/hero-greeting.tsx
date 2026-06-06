import { CircleDot, Sparkles } from 'lucide-react';

export interface HeroGreetingProps {
  greeting: string;
  groupName: string;
}

/**
 * UX spec §14.2 / §15.1 — Avaleht hero. Display-size greeting + league line,
 * decorative stadium accent on the right at md+. Mobile hides the accent.
 */
export function HeroGreeting({ greeting, groupName }: HeroGreetingProps) {
  return (
    <section aria-labelledby="tervitus" className="flex items-center gap-6 py-2">
      <div className="min-w-0 flex-1">
        <h1
          id="tervitus"
          className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl"
        >
          Tere, {greeting}.
        </h1>
        <p className="mt-2 text-xl text-text-body">
          Liiga: <strong className="text-brand-green">{groupName}</strong>.
        </p>
      </div>

      {/* Decorative stadium accent — md+ only */}
      <div
        aria-hidden="true"
        className="relative hidden h-24 w-24 shrink-0 md:block"
      >
        <CircleDot
          className="absolute inset-0 h-full w-full text-brand-green-soft"
          strokeWidth={1.5}
        />
        <Sparkles
          className="absolute right-0 top-0 h-8 w-8 text-brand-green opacity-60"
          strokeWidth={1.5}
        />
      </div>
    </section>
  );
}
