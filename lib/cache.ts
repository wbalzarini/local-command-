/**
 * TTL cache with in-flight coalescing and a last-good fallback.
 *
 * Three jobs, all of which the dashboard needs at once:
 *
 *  - bound provider calls, because the Today page asks for six modules and a
 *    tab left open all day would otherwise walk straight into a rate limit;
 *  - collapse concurrent askers onto one upstream request, since Today and the
 *    Weather page want the same forecast at the same instant;
 *  - keep the last successful value so an outage degrades to "stale" with a
 *    timestamp rather than to an empty card.
 *
 * Process-local, so on serverless it lives as long as the warm instance. That
 * is enough: the HTTP cache headers on each route do the cross-instance work.
 */

type Entry<T> = { value: T; storedAt: number };

const fresh = new Map<string, Entry<unknown>>();
const lastGood = new Map<string, Entry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

export type Cached<T> = {
  value: T;
  /** When the value was actually produced by the provider. */
  storedAt: number;
  /** True when the TTL has passed and this is a fallback, not a fresh read. */
  stale: boolean;
};

/**
 * Runs `load` at most once per `ttlSeconds` per key.
 *
 * `load` returns null to mean "the provider failed". On failure the last good
 * value is served as stale; if there has never been one, null propagates and
 * the caller reports the module unavailable.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T | null>,
): Promise<Cached<T> | null> {
  const now = Date.now();
  const hit = fresh.get(key) as Entry<T> | undefined;
  if (hit && now - hit.storedAt < ttlSeconds * 1000) {
    return { value: hit.value, storedAt: hit.storedAt, stale: false };
  }

  const pending = inFlight.get(key) as Promise<T | null> | undefined;
  if (pending) {
    const value = await pending;
    if (value !== null) {
      const stored = fresh.get(key) as Entry<T> | undefined;
      return {
        value,
        storedAt: stored?.storedAt ?? Date.now(),
        stale: false,
      };
    }
    return staleFallback<T>(key);
  }

  const task = load()
    .then((value) => {
      if (value !== null) {
        const entry = { value, storedAt: Date.now() };
        fresh.set(key, entry);
        lastGood.set(key, entry);
      }
      return value;
    })
    .catch(() => null)
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, task);
  const value = await task;
  if (value === null) return staleFallback<T>(key);
  return { value, storedAt: Date.now(), stale: false };
}

function staleFallback<T>(key: string): Cached<T> | null {
  const previous = lastGood.get(key) as Entry<T> | undefined;
  if (!previous) return null;
  return { value: previous.value, storedAt: previous.storedAt, stale: true };
}

/** Last time this key was loaded successfully, for "last successful update". */
export function lastSuccessAt(key: string): number | undefined {
  return lastGood.get(key)?.storedAt;
}

/** Test and dev helper; never called from a request path. */
export function clearCache(): void {
  fresh.clear();
  lastGood.clear();
  inFlight.clear();
}
