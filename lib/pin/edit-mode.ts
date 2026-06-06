/**
 * E03 UX-flip — resolve the page-level edit mode for a prediction-write surface.
 *
 * Called by each predict page's Server Component to decide what the form
 * Client Component should render:
 *
 *   - `'closed'` — stage is closed (or not yet open). Form renders read-only;
 *     "Suletud" badge in the action area. (Existing rendering, unchanged.)
 *   - `'pending-unlock'` — stage is open, user has a PIN configured, and is
 *     not currently unlocked. Form renders read-only; "Muuda" button in the
 *     action area opens the PIN modal.
 *   - `'edit'` — stage is open and the user either has no PIN configured or
 *     is currently unlocked. Form is editable; "Salvesta" button shown.
 *
 * Distinct from `assertEditAllowedForUser` in `lib/pin/guard.ts`: the guard
 * sits inside Server Actions and is binary (write allowed / not). This resolver
 * sits in Server Components and is ternary so the FE can render three
 * different action-area affordances.
 */
import { eq } from 'drizzle-orm';

import { db as defaultDb } from '@/lib/db';
import { users } from '@/db/schema';
import type { StageGateResult } from '@/lib/stages/is-stage-open';
import { readUnlockedUsers } from './cookie';

export type EditMode = 'edit' | 'pending-unlock' | 'closed';

export interface ResolveEditModeArgs {
  userId: string;
  stageGate: StageGateResult;
}

export interface ResolveEditModeDeps {
  findPinHash: (userId: string) => Promise<string | null | undefined>;
  readUnlocked: () => Promise<Set<string>>;
}

async function findPinHashDb(userId: string): Promise<string | null | undefined> {
  const rows = await defaultDb
    .select({ pin_hash: users.pin_hash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.pin_hash ?? null;
}

const defaultDeps: ResolveEditModeDeps = {
  findPinHash: findPinHashDb,
  readUnlocked: () => readUnlockedUsers(),
};

export async function resolveEditMode(
  args: ResolveEditModeArgs,
  deps: ResolveEditModeDeps = defaultDeps,
): Promise<EditMode> {
  const { userId, stageGate } = args;

  if (!stageGate.open) return 'closed';

  const pinHash = await deps.findPinHash(userId);
  if (!pinHash) return 'edit';

  const unlocked = await deps.readUnlocked();
  return unlocked.has(userId) ? 'edit' : 'pending-unlock';
}
