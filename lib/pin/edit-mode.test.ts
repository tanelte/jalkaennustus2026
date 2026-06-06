import { describe, expect, it, vi } from 'vitest';

import { resolveEditMode, type ResolveEditModeDeps } from './edit-mode';
import type { StageGateResult } from '@/lib/stages/is-stage-open';

function makeDeps(overrides: Partial<ResolveEditModeDeps>): ResolveEditModeDeps {
  return {
    findPinHash: vi.fn().mockResolvedValue(null),
    readUnlocked: vi.fn().mockResolvedValue(new Set<string>()),
    ...overrides,
  };
}

const closedGate: StageGateResult = { open: false, reason: 'closed' };
const notYetGate: StageGateResult = { open: false, reason: 'not_yet' };
const openGate: StageGateResult = { open: true };

describe('resolveEditMode', () => {
  it("returns 'closed' when the stage gate is closed", async () => {
    const deps = makeDeps({});
    const mode = await resolveEditMode({ userId: 'u1', stageGate: closedGate }, deps);
    expect(mode).toBe('closed');
    expect(deps.findPinHash).not.toHaveBeenCalled();
    expect(deps.readUnlocked).not.toHaveBeenCalled();
  });

  it("returns 'closed' when the stage has not yet opened", async () => {
    const deps = makeDeps({});
    const mode = await resolveEditMode({ userId: 'u1', stageGate: notYetGate }, deps);
    expect(mode).toBe('closed');
  });

  it("returns 'edit' when the stage is open and the user has no PIN", async () => {
    const deps = makeDeps({ findPinHash: vi.fn().mockResolvedValue(null) });
    const mode = await resolveEditMode({ userId: 'u1', stageGate: openGate }, deps);
    expect(mode).toBe('edit');
    expect(deps.readUnlocked).not.toHaveBeenCalled();
  });

  it("returns 'edit' when the stage is open and the user is unlocked", async () => {
    const deps = makeDeps({
      findPinHash: vi.fn().mockResolvedValue('$2b$12$something'),
      readUnlocked: vi.fn().mockResolvedValue(new Set(['u1'])),
    });
    const mode = await resolveEditMode({ userId: 'u1', stageGate: openGate }, deps);
    expect(mode).toBe('edit');
  });

  it("returns 'pending-unlock' when the stage is open, the user has a PIN, and is not unlocked", async () => {
    const deps = makeDeps({
      findPinHash: vi.fn().mockResolvedValue('$2b$12$something'),
      readUnlocked: vi.fn().mockResolvedValue(new Set<string>()),
    });
    const mode = await resolveEditMode({ userId: 'u1', stageGate: openGate }, deps);
    expect(mode).toBe('pending-unlock');
  });

  it("returns 'pending-unlock' when the cookie carries a different user", async () => {
    const deps = makeDeps({
      findPinHash: vi.fn().mockResolvedValue('$2b$12$something'),
      readUnlocked: vi.fn().mockResolvedValue(new Set(['other-user'])),
    });
    const mode = await resolveEditMode({ userId: 'u1', stageGate: openGate }, deps);
    expect(mode).toBe('pending-unlock');
  });
});
