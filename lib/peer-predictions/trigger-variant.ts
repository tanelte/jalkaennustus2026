/**
 * Pure helper that classifies the (n, m) state of a peer-view trigger and
 * returns the class strings the component should apply. Extracted so it can
 * be unit-tested without spinning up React DOM (the repo doesn't ship
 * `@testing-library/react`).
 *
 * UX spec §2.2 state-variant table.
 */
export type TriggerState = 'complete' | 'partial' | 'empty' | 'singleton';

export interface TriggerVariantInput {
  n: number;
  m: number;
}

export interface TriggerVariantOutput {
  state: TriggerState;
  /** True when the trigger should render nothing at all. */
  hidden: boolean;
  /** Tailwind class string applied to the button surface. */
  surfaceClass: string;
  /** Tailwind class string applied to the count text span. */
  countClass: string;
}

export function classifyTriggerVariant(input: TriggerVariantInput): TriggerVariantOutput {
  const { n, m } = input;

  if (m <= 0) {
    return {
      state: 'singleton',
      hidden: true,
      surfaceClass: '',
      countClass: '',
    };
  }

  if (n === m) {
    return {
      state: 'complete',
      hidden: false,
      surfaceClass:
        'border border-brand-green/40 bg-brand-green-soft text-brand-green hover:bg-brand-green-soft',
      countClass: 'font-semibold tabular-nums',
    };
  }

  if (n === 0) {
    return {
      state: 'empty',
      hidden: false,
      surfaceClass:
        'border border-border-default bg-surface-card text-text-body hover:bg-bg-app',
      countClass: 'text-text-muted tabular-nums',
    };
  }

  // 0 < n < m
  return {
    state: 'partial',
    hidden: false,
    surfaceClass:
      'border border-border-default bg-surface-card text-text-body hover:bg-bg-app',
    countClass: 'tabular-nums',
  };
}
