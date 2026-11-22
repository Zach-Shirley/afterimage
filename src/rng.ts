/** Small seeded PRNG (mulberry32) so rooms and changes are reproducible in tests. */
export interface Rng {
  next(): number;
  int(min: number, maxInclusive: number): number;
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: T[]): T[];
  chance(p: number): boolean;
  weighted<T>(entries: readonly (readonly [T, number])[]): T;
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => {
      if (arr.length === 0) throw new Error('pick from empty array');
      return arr[Math.floor(next() * arr.length)];
    },
    shuffle: (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    chance: (p) => next() < p,
    weighted: (entries) => {
      const total = entries.reduce((s, [, w]) => s + Math.max(0, w), 0);
      if (total <= 0) throw new Error('weighted pick with no weight');
      let r = next() * total;
      for (const [v, w] of entries) {
        r -= Math.max(0, w);
        if (r < 0) return v;
      }
      return entries[entries.length - 1][0];
    },
  };
  return rng;
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
