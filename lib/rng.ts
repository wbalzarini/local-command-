/**
 * Deterministic pseudo-randomness for the sample data generators.
 *
 * Sample data has to be stable: the dashboard must look the same on every
 * reload of the same day, so a screenshot is reproducible and a chart does not
 * reshuffle itself while you are reading it. Everything is therefore derived
 * from a seed built out of the calendar date, plus a channel name so the
 * weather generator and the routing generator don't produce correlated
 * streams.
 */

/** FNV-1a — cheap, well-mixed, and stable across runs. */
export function seedFrom(...parts: (string | number)[]): number {
  let hash = 0x811c9dc5;
  for (const part of parts) {
    const text = String(part);
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    hash ^= 0x5f; // separator, so ("AB","C") and ("A","BC") differ
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export type Rng = {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [min, max). */
  range(min: number, max: number): number;
  /** Integer in [min, max]. */
  int(min: number, max: number): number;
  /** Roughly standard-normal, via the mean of four uniforms. */
  normal(): number;
  pick<T>(items: readonly T[]): T;
  /** True with the given probability. */
  chance(probability: number): boolean;
};

/** mulberry32 — small, fast, and good enough for sample data. */
export function rng(seed: number): Rng {
  let state = seed >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const range = (min: number, max: number) => min + next() * (max - min);

  return {
    next,
    range,
    int: (min, max) => Math.floor(range(min, max + 1)),
    normal: () => (next() + next() + next() + next() - 2) * 1.1,
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (probability) => next() < probability,
  };
}

export function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
