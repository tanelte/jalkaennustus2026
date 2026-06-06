import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';

export interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  secondary?: string;
}

/**
 * UX spec §14.2 — Avaleht stat card. Icon medallion on the left, label (muted)
 * above the value (large, tabular-nums) on the right.
 */
export function StatCard({ icon: Icon, label, value, secondary }: StatCardProps) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <span
        aria-hidden="true"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-green-soft text-brand-green"
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text-muted">{label}</p>
        <p className="text-3xl font-bold tabular-nums text-text-primary">
          {value}
        </p>
        {secondary && (
          <p className="text-xs text-text-muted">{secondary}</p>
        )}
      </div>
    </Card>
  );
}
