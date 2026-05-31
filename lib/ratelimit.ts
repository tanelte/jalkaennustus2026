/**
 * In-memory sliding-window rate-limit for the credentials callback.
 *
 * Per-IP bucket of timestamps; window prunes lazily on access. LRU eviction
 * caps total tracked IPs so a botnet cannot grow memory unbounded. State is
 * per-Edge-instance — acceptable for a hobby private-league deployment; swap
 * to Upstash here without changing the call sites if abuse appears in prod.
 */

export const LIMIT = 5;
export const WINDOW_MS = 15 * 60 * 1000;
export const MAX_TRACKED_IPS = 10_000;

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

function touch(store: Store, ip: string, value: number[]): void {
  // Map preserves insertion order; delete + set moves the entry to the tail,
  // making the head the least-recently-touched IP.
  store.buckets.delete(ip);
  store.buckets.set(ip, value);
  while (store.buckets.size > MAX_TRACKED_IPS) {
    const oldest = store.buckets.keys().next().value;
    if (oldest === undefined) break;
    store.buckets.delete(oldest);
  }
}

export function peek(ip: string, now: number = Date.now()): boolean {
  const store = getStore();
  const existing = store.buckets.get(ip);
  if (!existing) return false;
  const fresh = prune(existing, now);
  if (fresh.length === 0) {
    store.buckets.delete(ip);
    return false;
  }
  if (fresh.length !== existing.length) {
    touch(store, ip, fresh);
  }
  return fresh.length >= LIMIT;
}

export function increment(ip: string, now: number = Date.now()): void {
  const store = getStore();
  const existing = store.buckets.get(ip) ?? [];
  const fresh = prune(existing, now);
  fresh.push(now);
  touch(store, ip, fresh);
}

export function reset(ip: string): void {
  getStore().buckets.delete(ip);
}

export function _clearForTests(): void {
  getStore().buckets.clear();
}
