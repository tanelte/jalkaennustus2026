import { describe, expect, it, vi } from 'vitest';
import { evaluateStageWindow, isStageOpen, type StageWindow } from './is-stage-open';

const WINDOW: StageWindow = {
  opens_at: new Date('2026-06-10T00:00:00Z'),
  closes_at: new Date('2026-06-25T00:00:00Z'),
};

describe('evaluateStageWindow', () => {
  it('reports not_found when window is null', () => {
    expect(evaluateStageWindow(null, new Date('2026-06-15T00:00:00Z'))).toEqual({
      open: false,
      reason: 'not_found',
    });
  });

  it('reports not_yet when now is before opens_at', () => {
    expect(evaluateStageWindow(WINDOW, new Date('2026-06-09T23:59:59Z'))).toMatchObject({
      open: false,
      reason: 'not_yet',
    });
  });

  it('reports closed when now is after closes_at', () => {
    expect(evaluateStageWindow(WINDOW, new Date('2026-06-25T00:00:01Z'))).toMatchObject({
      open: false,
      reason: 'closed',
    });
  });

  it('reports open when now is exactly opens_at', () => {
    expect(evaluateStageWindow(WINDOW, WINDOW.opens_at)).toMatchObject({ open: true });
  });

  it('reports open when now is exactly closes_at', () => {
    expect(evaluateStageWindow(WINDOW, WINDOW.closes_at)).toMatchObject({ open: true });
  });

  it('reports open when now is mid-window', () => {
    expect(evaluateStageWindow(WINDOW, new Date('2026-06-15T00:00:00Z'))).toMatchObject({
      open: true,
    });
  });
});

describe('isStageOpen', () => {
  it('delegates to findStageWindow with the correct args', async () => {
    const finder = vi.fn(async () => WINDOW);
    await isStageOpen('best_thirds', 't-1', {
      findStageWindow: finder,
      now: () => new Date('2026-06-15T00:00:00Z'),
    });
    expect(finder).toHaveBeenCalledWith('best_thirds', 't-1');
  });

  it('returns open=true when now is in window', async () => {
    const result = await isStageOpen('best_thirds', 't-1', {
      findStageWindow: async () => WINDOW,
      now: () => new Date('2026-06-15T00:00:00Z'),
    });
    expect(result.open).toBe(true);
  });

  it('returns closed when stage window has passed', async () => {
    const result = await isStageOpen('best_thirds', 't-1', {
      findStageWindow: async () => WINDOW,
      now: () => new Date('2027-01-01T00:00:00Z'),
    });
    expect(result).toMatchObject({ open: false, reason: 'closed' });
  });

  it('returns not_found when no stage row exists', async () => {
    const result = await isStageOpen('nonexistent', 't-1', {
      findStageWindow: async () => null,
      now: () => new Date('2026-06-15T00:00:00Z'),
    });
    expect(result).toEqual({ open: false, reason: 'not_found' });
  });
});
