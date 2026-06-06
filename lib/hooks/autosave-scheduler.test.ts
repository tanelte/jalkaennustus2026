import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createAutoSaveScheduler,
  type AutoSaveResult,
} from './autosave-scheduler';

function defer<T = AutoSaveResult>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('createAutoSaveScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts idle and reports no last-save', () => {
    const s = createAutoSaveScheduler();
    expect(s.getSnapshot().status).toBe('idle');
    expect(s.getSnapshot().lastSavedAt).toBeNull();
    expect(s.getSnapshot().errorCode).toBeNull();
  });

  it('fires an immediate save and transitions saving → saved', async () => {
    const s = createAutoSaveScheduler();
    const d = defer();
    const run = vi.fn(() => d.promise);
    s.schedule('k1', run);
    expect(run).toHaveBeenCalledTimes(1);
    expect(s.getSnapshot().status).toBe('saving');
    d.resolve({ ok: true });
    await vi.waitFor(() => expect(s.getSnapshot().status).toBe('saved'));
    expect(s.getSnapshot().lastSavedAt).toBeInstanceOf(Date);
    expect(s.getSnapshot().errorCode).toBeNull();
  });

  it('debounces typed input: only the latest value fires once after the delay', async () => {
    const s = createAutoSaveScheduler();
    const run1 = vi.fn(() => Promise.resolve({ ok: true }));
    const run2 = vi.fn(() => Promise.resolve({ ok: true }));
    const run3 = vi.fn(() => Promise.resolve({ ok: true }));
    s.schedule('k', run1, { debounceMs: 800 });
    vi.advanceTimersByTime(200);
    s.schedule('k', run2, { debounceMs: 800 });
    vi.advanceTimersByTime(200);
    s.schedule('k', run3, { debounceMs: 800 });
    expect(s.getSnapshot().status).toBe('dirty');
    expect(run1).not.toHaveBeenCalled();
    expect(run2).not.toHaveBeenCalled();
    expect(run3).not.toHaveBeenCalled();
    vi.advanceTimersByTime(800);
    expect(run1).not.toHaveBeenCalled();
    expect(run2).not.toHaveBeenCalled();
    expect(run3).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(s.getSnapshot().status).toBe('saved'));
  });

  it('queues at most one run while a save is in-flight (latest wins)', async () => {
    const s = createAutoSaveScheduler();
    const d1 = defer();
    const run1 = vi.fn(() => d1.promise);
    const run2 = vi.fn(() => Promise.resolve({ ok: true }));
    const run3 = vi.fn(() => Promise.resolve({ ok: true }));
    s.schedule('k', run1);
    expect(run1).toHaveBeenCalledTimes(1);
    s.schedule('k', run2);
    s.schedule('k', run3);
    expect(run2).not.toHaveBeenCalled();
    expect(run3).not.toHaveBeenCalled();
    d1.resolve({ ok: true });
    await vi.waitFor(() => expect(run3).toHaveBeenCalledTimes(1));
    expect(run2).not.toHaveBeenCalled();
  });

  it('records errorCode on a failed action result', async () => {
    const s = createAutoSaveScheduler();
    s.schedule('k', () => Promise.resolve({ error: 'stage_closed' }));
    await vi.waitFor(() => expect(s.getSnapshot().status).toBe('error'));
    expect(s.getSnapshot().errorCode).toBe('stage_closed');
  });

  it('maps a thrown error into a generic network_error code', async () => {
    const s = createAutoSaveScheduler();
    s.schedule('k', () => Promise.reject(new Error('boom')));
    await vi.waitFor(() => expect(s.getSnapshot().status).toBe('error'));
    expect(s.getSnapshot().errorCode).toBe('network_error');
  });

  it('clears errorCode after the next successful save', async () => {
    const s = createAutoSaveScheduler();
    s.schedule('k', () => Promise.resolve({ error: 'stage_closed' }));
    await vi.waitFor(() => expect(s.getSnapshot().errorCode).toBe('stage_closed'));
    s.schedule('k', () => Promise.resolve({ ok: true }));
    await vi.waitFor(() => expect(s.getSnapshot().status).toBe('saved'));
    expect(s.getSnapshot().errorCode).toBeNull();
  });

  it('flushPending fires a pending debounce immediately', () => {
    const s = createAutoSaveScheduler();
    const run = vi.fn(() => Promise.resolve({ ok: true }));
    s.schedule('k', run, { debounceMs: 800 });
    expect(run).not.toHaveBeenCalled();
    s.flushPending();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers when the snapshot changes', async () => {
    const s = createAutoSaveScheduler();
    const listener = vi.fn();
    const unsubscribe = s.subscribe(listener);
    s.schedule('k', () => Promise.resolve({ ok: true }));
    await vi.waitFor(() => expect(s.getSnapshot().status).toBe('saved'));
    expect(listener.mock.calls.length).toBeGreaterThanOrEqual(2);
    unsubscribe();
  });

  it('dispose clears all timers without firing them', () => {
    const s = createAutoSaveScheduler();
    const run = vi.fn(() => Promise.resolve({ ok: true }));
    s.schedule('k', run, { debounceMs: 800 });
    s.dispose();
    vi.advanceTimersByTime(2000);
    expect(run).not.toHaveBeenCalled();
  });

  it('keeps separate debounce timers per key', () => {
    const s = createAutoSaveScheduler();
    const runA = vi.fn(() => Promise.resolve({ ok: true }));
    const runB = vi.fn(() => Promise.resolve({ ok: true }));
    s.schedule('a', runA, { debounceMs: 500 });
    s.schedule('b', runB, { debounceMs: 800 });
    vi.advanceTimersByTime(500);
    expect(runA).toHaveBeenCalledTimes(1);
    expect(runB).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(runB).toHaveBeenCalledTimes(1);
  });
});
