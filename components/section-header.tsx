import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

export interface SectionHeaderProps {
  icon?: LucideIcon;
  title: string;
  id?: string;
  rightLink?: { href: string; label: string };
}

/**
 * UX spec §14.2 — `SectionHeader`. Muted lucide icon · `h2` title · spacer ·
 * optional right-aligned `View all →` link.
 */
export function SectionHeader({ icon: Icon, title, id, rightLink }: SectionHeaderProps) {
  return (
    <div className="flex items-baseline gap-2">
      {Icon && (
        <Icon
          aria-hidden="true"
          className="h-5 w-5 self-center text-text-muted"
        />
      )}
      <h2 id={id} className="text-xl font-semibold text-text-primary">
        {title}
      </h2>
      {rightLink && (
        <Link
          href={rightLink.href}
          className="ml-auto text-sm font-medium text-brand-green hover:text-brand-green-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 rounded-sm"
        >
          {rightLink.label}
        </Link>
      )}
    </div>
  );
}
