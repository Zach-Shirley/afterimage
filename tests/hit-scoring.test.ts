import { describe, expect, it } from 'vitest';
import { generateChanges, type Change } from '../src/changes';
import { distToBox, resolveTap } from '../src/hit';
import { makeRng } from '../src/rng';
import { generateScene, itemBox, type Scene } from '../src/room';
import { changePoints, difficulty, isNewBest, loadBest, roundScore, saveBest, BEST_KEY } from '../src/scoring';

function setup(seed: number, round = 8) {
  const diff = difficulty(round);
  const before = generateScene(makeRng(seed), diff.itemCount, diff.closedSurfaces);
  return { before, ...generateChanges(before, makeRng(seed + 99), diff) };
}

const center = (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

describe('hit testing', () => {
  it('distance to box is 0 inside and euclidean outside', () => {
    const b = { x: 10, y: 10, w: 10, h: 10 };
    expect(distToBox({ x: 15, y: 15 }, b)).toBe(0);
    expect(distToBox({ x: 23, y: 14 }, b)).toBe(3);
    expect(distToBox({ x: 23, y: 24 }, b)).toBe(5);
  });

  it('a tap at the centre of every target finds that change', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const { after, changes } = setup(seed);
      for (const c of changes) for (const t of c.targets) expect(resolveTap(center(t), changes, after, 20)).toBe(c);
    }
  });

  it('a moved item counts at both its old and new spot', () => {
    let checked = 0;
    for (let seed = 1; seed <= 200 && checked < 10; seed++) {
      const { after, changes } = setup(seed, 3);
      const m = changes.find((c) => c.type === 'moved');
      if (!m) continue;
      expect(m.targets.length).toBe(2);
      expect(resolveTap(center(m.targets[0]), [m], after, 0)).toBe(m);
      expect(resolveTap(center(m.targets[1]), [m], after, 0)).toBe(m);
      checked++;
    }
    expect(checked).toBe(10);
  });

  it('taps on unchanged items or empty space far away miss', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const { after, changes } = setup(seed);
      const changedIds = new Set(changes.flatMap((c) => [c.before?.id, c.after?.id]));
      for (const it of after.items) {
        if (changedIds.has(it.id)) continue;
        const p = center(itemBox(it));
        const near = changes.some((c) => c.targets.some((t) => distToBox(p, t) <= 6));
        if (!near) expect(resolveTap(p, changes, after, 24)).toBeNull();
      }
      expect(resolveTap({ x: -500, y: -500 }, changes, after, 24)).toBeNull();
    }
  });

  it('near misses within tolerance count when they are not on another item', () => {
    const t = { x: 100, y: 100, w: 40, h: 40 };
    const change = { type: 'removed', before: null, after: null, targets: [t], description: '' } as unknown as Change;
    const empty: Scene = { items: [], nextId: 1 };
    expect(resolveTap({ x: 155, y: 120 }, [change], empty, 20)).toBe(change);
    expect(resolveTap({ x: 165, y: 120 }, [change], empty, 20)).toBeNull();
  });

  it('picks the closest of several pending changes', () => {
    const a = { type: 'removed', before: null, after: null, targets: [{ x: 0, y: 0, w: 10, h: 10 }], description: '' } as unknown as Change;
    const b = { type: 'removed', before: null, after: null, targets: [{ x: 30, y: 0, w: 10, h: 10 }], description: '' } as unknown as Change;
    const empty: Scene = { items: [], nextId: 1 };
    expect(resolveTap({ x: 24, y: 5 }, [a, b], empty, 30)).toBe(b);
    expect(resolveTap({ x: 16, y: 5 }, [a, b], empty, 30)).toBe(a);
  });
});

describe('difficulty and scoring', () => {
  it('difficulty ramps monotonically and then holds', () => {
    let prev = difficulty(1);
    for (let r = 2; r <= 30; r++) {
      const d = difficulty(r);
      expect(d.itemCount).toBeGreaterThanOrEqual(prev.itemCount);
      expect(d.viewMs).toBeLessThanOrEqual(prev.viewMs);
      expect(d.changeCount).toBeGreaterThanOrEqual(prev.changeCount);
      expect(d.minArea).toBeLessThanOrEqual(prev.minArea);
      expect(d.minDeltaE).toBeLessThanOrEqual(prev.minDeltaE);
      expect(d.minMove).toBeLessThanOrEqual(prev.minMove);
      prev = d;
    }
    expect(difficulty(1)).toMatchObject({ itemCount: 5, viewMs: 6000, changeCount: 1, closedSurfaces: ['floor'] });
    expect(difficulty(4).closedSurfaces).toEqual([]);
    expect(difficulty(5).itemCount).toBe(11);
    expect(difficulty(7).changeCount).toBe(2);
    expect(difficulty(13).changeCount).toBe(3);
    expect(difficulty(40)).toMatchObject({ itemCount: 30, viewMs: 3000 });
    expect(difficulty(1).weights.rotated).toBe(0);
  });

  it('scores rounds with time bonus, streak and peek penalty', () => {
    expect(changePoints(1)).toBe(100);
    expect(changePoints(11)).toBe(250);
    expect(roundScore({ round: 1, found: 1, remainingMs: 12_900, peeks: 0, streak: 0 })).toEqual({ base: 100, timeBonus: 120, multiplier: 1, total: 220 });
    expect(roundScore({ round: 1, found: 1, remainingMs: 0, peeks: 0, streak: 5 }).total).toBe(150);
    expect(roundScore({ round: 1, found: 1, remainingMs: 0, peeks: 1, streak: 0 }).total).toBe(50);
    expect(roundScore({ round: 1, found: 1, remainingMs: 0, peeks: 0, streak: 50 }).multiplier).toBe(2);
  });

  it('saves and loads the high score, tolerating bad storage', () => {
    const store = new Map<string, string>();
    const s = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(loadBest(s)).toBeNull();
    saveBest(s, { score: 1234, round: 9 });
    expect(loadBest(s)).toEqual({ score: 1234, round: 9 });
    store.set(BEST_KEY, '{broken');
    expect(loadBest(s)).toBeNull();
    expect(loadBest({ getItem: () => { throw new Error('blocked'); } })).toBeNull();
    expect(isNewBest(10, null)).toBe(true);
    expect(isNewBest(0, null)).toBe(false);
    expect(isNewBest(10, { score: 10, round: 1 })).toBe(false);
  });
});
