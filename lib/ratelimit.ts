/**
 * In-memory sliding-window rate-limit stub for the credentials callback.
 *
 * Production replacement (Upstash-backed) lands in S16. This stub lives in
 * Edge middleware memory; in dev a single process makes it effective.
 */

export const LIMIT = 5;
export const WINDOW_MS = 15 * 60 * 1000;

interface Store {
  buckets: Map<string, number[]>;
}

declare global {
  // eslint-disable-next-line no-var
  var __rateLimitStore: Store | undefined;
}

function getStore(): Store {
  if (!globalThis.__rateLimitStore) {
    globalThis.__rateLimitStore = { buckets: new Map() };
  }
  return globalThis.__rateLimitStore;
}

function prune(timestamps: number[], now: number): number[] {
  const cutoff = now - WINDOW_MS;
  let i = 0;
  while (i < timestamps.length && timestamps[i]! <= cutoff) i += 1;
  return i === 0 ? timestamps : timestamps.slice(i);
}

export function peek(ip: string, now: number = Date.now()): boolean {
  const store = getStore();
  const existing = store.buckets.get(ip);
  if (!existing) return false;
  const fresh = prune(existing, now);
  if (fresh.length !== existing.length) {
    if (fresh.length === 0) store.buckets.delete(ip);
    else store.buckets.set(ip, fresh);
  }
  return fresh.length >= LIMIT;
}

export function increment(ip: string, now: number = Date.now()): void {
  const store = getStore();
  const existing = store.buckets.get(ip) ?? [];
  const fresh = prune(existing, now);
  fresh.push(now);
  store.buckets.set(ip, fresh);
}

export function reset(ip: string): void {
  getStore().buckets.delete(ip);
}

export function _clearForTests(): void {
  getStore().buckets.clear();
}
