import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

export interface SectionHeaderProps {
  icon?: LucideIcon;
  title: string;
  id?: string;
  rightLink?: { href: string; label: string };
  /**
   * Heading level. Default `h2` per UX §18 (one h1 per page; h2 for section
   * headers). Pass `h1` on admin / form pages where this `SectionHeader` is the
   * sole page title (so the page is not h1-less).
   */
  as?: 'h1' | 'h2';
}

/**
 * UX spec §14.2 — `SectionHeader`. Muted lucide icon · heading · spacer ·
 * optional right-aligned `View all →` link.
 *
 * Defaults to `h2` to match the common section-header role. Admin pages without
 * a dedicated page-title heading pass `as="h1"` so §18's "one h1 per page" gate
 * holds without introducing a second visual heading.
 */
export function SectionHeader({
  icon: Icon,
  title,
  id,
  rightLink,
  as = 'h2',
}: SectionHeaderProps) {
  const Heading = as;
  const headingClass =
    as === 'h1'
      ? 'text-2xl font-semibold text-text-primary'
      : 'text-xl font-semibold text-text-primary';
  return (
    <div className="flex items-baseline gap-2">
      {Icon && (
        <Icon
          aria-hidden="true"
          className="h-5 w-5 self-center text-text-muted"
        />
      )}
      <Heading id={id} className={headingClass}>
        {title}
      </Heading>
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
