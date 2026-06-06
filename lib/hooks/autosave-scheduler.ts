/**
 * Pure (no React) per-key debounced save scheduler. Latest-wins semantics:
 * a fresh `schedule` for the same key cancels any pending debounce and
 * supersedes whatever was about to fire. While a save is in-flight for a key,
 * the next call is queued; older queued runs are dropped. Each save is
 * expected to be an idempotent upsert.
 *
 * The React-facing hook (`use-autosave.ts`) is a thin wrapper around this.
 */

export type AutoSaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface AutoSaveResult {
  ok?: boolean;
  error?: string;
}

export interface AutoSaveSnapshot {
  status: AutoSaveStatus;
  lastSavedAt: Date | null;
  errorCode: string | null;
}

export interface AutoSaveScheduler {
  schedule: (
    key: string,
    run: () => Promise<AutoSaveResult>,
    opts?: { debounceMs?: number },
  ) => void;
  flushPending: () => void;
  dispose: () => void;
  getSnapshot: () => AutoSaveSnapshot;
  subscribe: (listener: () => void) => () => void;
}

interface KeyEntry {
  timer: ReturnType<typeof setTimeout> | null;
  debouncedRun: (() => Promise<AutoSaveResult>) | null;
  queuedRun: (() => Promise<AutoSaveResult>) | null;
  inflight: boolean;
}

export interface SchedulerOptions {
  /** Override `setTimeout` (useful for fake timers in tests). */
  setTimeout?: typeof setTimeout;
  /** Override `clearTimeout` (useful for fake timers in tests). */
  clearTimeout?: typeof clearTimeout;
  /** Override `Date` factory (useful for deterministic `lastSavedAt` in tests). */
  now?: () => Date;
}

export function createAutoSaveScheduler(
  opts: SchedulerOptions = {},
): AutoSaveScheduler {
  const setTimeoutFn = opts.setTimeout ?? setTimeout;
  const clearTimeoutFn = opts.clearTimeout ?? clearTimeout;
  const nowFn = opts.now ?? (() => new Date());

  const keys = new Map<string, KeyEntry>();
  const listeners = new Set<() => void>();

  let lastSavedAt: Date | null = null;
  let errorCode: string | null = null;
  let snapshot: AutoSaveSnapshot = {
    status: 'idle',
    lastSavedAt: null,
    errorCode: null,
  };

  function computeStatus(): AutoSaveStatus {
    let inflightAny = false;
    let dirtyAny = false;
    for (const entry of keys.values()) {
      if (entry.inflight) inflightAny = true;
      if (entry.timer !== null || entry.queuedRun !== null) dirtyAny = true;
    }
    if (inflightAny) return 'saving';
    if (dirtyAny) return 'dirty';
    if (errorCode) return 'error';
    if (lastSavedAt) return 'saved';
    return 'idle';
  }

  function publish() {
    const status = computeStatus();
    if (
      snapshot.status === status &&
      snapshot.lastSavedAt === lastSavedAt &&
      snapshot.errorCode === errorCode
    ) {
      return;
    }
    snapshot = { status, lastSavedAt, errorCode };
    for (const listener of listeners) listener();
  }

  function getOrCreate(key: string): KeyEntry {
    let entry = keys.get(key);
    if (!entry) {
      entry = { timer: null, debouncedRun: null, queuedRun: null, inflight: false };
      keys.set(key, entry);
    }
    return entry;
  }

  async function runOnce(
    key: string,
    run: () => Promise<AutoSaveResult>,
  ): Promise<void> {
    const entry = getOrCreate(key);
    entry.inflight = true;
    publish();
    let result: AutoSaveResult;
    try {
      result = await run();
    } catch {
      result = { error: 'network_error' };
    }
    entry.inflight = false;
    if (result.ok) {
      lastSavedAt = nowFn();
      errorCode = null;
    } else {
      errorCode = result.error ?? 'unknown_error';
    }
    if (entry.queuedRun) {
      const next = entry.queuedRun;
      entry.queuedRun = null;
      // Recurse for the queued one — keeps per-key serialization without
      // unbounded growth (only one queued slot per key).
      void runOnce(key, next);
      return;
    }
    publish();
  }

  function fire(key: string, run: () => Promise<AutoSaveResult>) {
    const entry = getOrCreate(key);
    if (entry.timer !== null) {
      clearTimeoutFn(entry.timer);
      entry.timer = null;
    }
    entry.debouncedRun = null;
    if (entry.inflight) {
      // Drop any older queued run; latest wins.
      entry.queuedRun = run;
      publish();
      return;
    }
    void runOnce(key, run);
  }

  function schedule(
    key: string,
    run: () => Promise<AutoSaveResult>,
    options?: { debounceMs?: number },
  ) {
    const debounceMs = options?.debounceMs ?? 0;
    const entry = getOrCreate(key);
    if (entry.timer !== null) {
      clearTimeoutFn(entry.timer);
      entry.timer = null;
    }
    entry.debouncedRun = null;
    if (debounceMs > 0) {
      entry.debouncedRun = run;
      entry.timer = setTimeoutFn(() => {
        entry.timer = null;
        entry.debouncedRun = null;
        fire(key, run);
      }, debounceMs);
      publish();
    } else {
      fire(key, run);
    }
  }

  function flushPending() {
    for (const [key, entry] of keys.entries()) {
      if (entry.timer !== null && entry.debouncedRun !== null) {
        const run = entry.debouncedRun;
        clearTimeoutFn(entry.timer);
        entry.timer = null;
        entry.debouncedRun = null;
        fire(key, run);
      }
    }
  }

  function dispose() {
    for (const entry of keys.values()) {
      if (entry.timer !== null) clearTimeoutFn(entry.timer);
      entry.timer = null;
      entry.debouncedRun = null;
      entry.queuedRun = null;
    }
    listeners.clear();
  }

  function getSnapshot(): AutoSaveSnapshot {
    return snapshot;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    schedule,
    flushPending,
    dispose,
    getSnapshot,
    subscribe,
  };
}
