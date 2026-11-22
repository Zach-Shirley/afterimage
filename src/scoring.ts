/** Difficulty curve and scoring. Pure functions, so tests can pin them down. */
import type { Surface } from './layout';

export type ChangeType = 'moved' | 'removed' | 'added' | 'color' | 'pattern' | 'swapped' | 'rotated';
export const CHANGE_TYPES: readonly ChangeType[] = ['moved', 'removed', 'added', 'color', 'pattern', 'swapped', 'rotated'];

export interface Difficulty {
  round: number;
  /** 0 at round 1, 1 at round 15 and beyond */
  d: number;
  /** objects in the room: 5 in round 1, about +1.5 a round, capped at 30 */
  itemCount: number;
  /** surfaces left empty (the floor stays bare for the first rounds) */
  closedSurfaces: Surface[];
  viewMs: number;
  findMs: number;
  changeCount: number;
  /** smallest item (w×h) allowed to carry a change */
  minArea: number;
  /** colour changes must differ by at least this CIE76 ΔE … */
  minDeltaE: number;
  /** … and at most this, so late colour changes get subtle */
  maxDeltaE: number;
  /** smallest distance a moved item travels, in SVG units */
  minMove: number;
  weights: Record<ChangeType, number>;
}

export const START_LIVES = 3;
export const MAX_LIVES = 3;
export const WRONG_TAP_PENALTY_MS = 3000;
export const LIFE_BACK_EVERY = 5;
export const FLOOR_OPENS_AT = 4;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function difficulty(round: number): Difficulty {
  const r = Math.max(1, Math.floor(round));
  const d = Math.min(1, (r - 1) / 14);
  const changeCount = r >= 13 ? 3 : r >= 7 ? 2 : 1;
  return {
    round: r,
    d,
    itemCount: Math.min(30, 5 + Math.round((r - 1) * 1.5)),
    closedSurfaces: r < FLOOR_OPENS_AT ? ['floor'] : [],
    viewMs: Math.round(lerp(6000, 3000, d)),
    findMs: Math.round(lerp(20000, 12000, d) + (changeCount - 1) * 7000),
    changeCount,
    minArea: Math.round(lerp(1500, 300, d)),
    minDeltaE: lerp(42, 20, d),
    maxDeltaE: lerp(200, 48, d),
    minMove: Math.round(lerp(150, 62, d)),
    weights: {
      removed: lerp(3, 1.4, d),
      added: lerp(3, 1.4, d),
      moved: lerp(2, 2, d),
      color: lerp(1.6, 2.6, d),
      pattern: lerp(1, 1.6, d),
      swapped: lerp(0.5, 2.2, d),
      rotated: r < 3 ? 0 : lerp(0.6, 1.6, d),
    },
  };
}

/** Points for each change found in a round. */
export function changePoints(round: number): number {
  return Math.round(100 * (1 + 0.15 * (Math.max(1, round) - 1)));
}

export interface RoundResult {
  base: number;
  timeBonus: number;
  multiplier: number;
  total: number;
}

/**
 * Score for a cleared round.
 * - base: changePoints × changes found
 * - timeBonus: 10 per whole second left
 * - multiplier: perfect-round streak (×1.1 per prior perfect round, capped ×2) halved per peek
 */
export function roundScore(opts: { round: number; found: number; remainingMs: number; peeks: number; streak: number }): RoundResult {
  const base = changePoints(opts.round) * opts.found;
  const timeBonus = Math.floor(Math.max(0, opts.remainingMs) / 1000) * 10;
  const streakMult = 1 + 0.1 * Math.min(Math.max(0, opts.streak), 10);
  const multiplier = streakMult * 0.5 ** Math.max(0, opts.peeks);
  return { base, timeBonus, multiplier, total: Math.round((base + timeBonus) * multiplier) };
}

export interface Best {
  score: number;
  round: number;
}

export function isNewBest(score: number, best: Best | null): boolean {
  return score > 0 && (!best || score > best.score);
}

export const BEST_KEY = 'afterimage.best';
export const MUTE_KEY = 'afterimage.muted';

export function loadBest(storage: Pick<Storage, 'getItem'> | null): Best | null {
  try {
    const raw = storage?.getItem(BEST_KEY);
    if (!raw) return null;
    const b = JSON.parse(raw);
    if (typeof b?.score === 'number' && typeof b?.round === 'number') return { score: b.score, round: b.round };
  } catch {
    /* corrupted or blocked storage: treat as no best */
  }
  return null;
}

export function saveBest(storage: Pick<Storage, 'setItem'> | null, best: Best): void {
  try {
    storage?.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    /* private mode etc. */
  }
}
