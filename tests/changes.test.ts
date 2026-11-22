import { describe, expect, it } from 'vitest';
import { checkVisible, generateChanges, type Change } from '../src/changes';
import { deltaE } from '../src/palette';
import { makeRng } from '../src/rng';
import { generateScene, validateScene, type Item, type Scene } from '../src/room';
import { renderItem, renderItems } from '../src/render';
import { CHANGE_TYPES, difficulty, type ChangeType } from '../src/scoring';

const byId = (s: Scene) => new Map(s.items.map((i) => [i.id, i]));

/** Everything not named by a change must be byte-for-byte identical. */
function expectOnlyChangedItemsDiffer(before: Scene, after: Scene, changes: Change[]) {
  const touched = new Set<number>();
  for (const c of changes) {
    if (c.before) touched.add(c.before.id);
    if (c.after) touched.add(c.after.id);
  }
  const b = byId(before), a = byId(after);
  for (const [id, it] of b) if (!touched.has(id)) expect(a.get(id)).toEqual(it);
  for (const [id, it] of a) if (!touched.has(id)) expect(b.get(id)).toEqual(it);
}

function expectShape(c: Change, before: Scene, after: Scene) {
  const b = byId(before), a = byId(after);
  const pre = c.before as Item | null, post = c.after as Item | null;
  switch (c.type) {
    case 'removed':
      expect(pre && b.has(pre.id) && !a.has(pre.id)).toBe(true);
      break;
    case 'added':
      expect(post && a.has(post.id) && !b.has(post.id)).toBe(true);
      break;
    case 'moved':
      expect(pre!.id).toBe(post!.id);
      expect(pre!.slot).not.toBe(post!.slot);
      expect({ ...pre, slot: '' }).toEqual({ ...post, slot: '' });
      break;
    case 'color':
      expect({ ...pre, color: '' }).toEqual({ ...post, color: '' });
      expect(pre!.color).not.toBe(post!.color);
      break;
    case 'pattern':
      expect({ ...pre, pattern: '' }).toEqual({ ...post, pattern: '' });
      break;
    case 'swapped':
      expect(pre!.slot).toBe(post!.slot);
      expect(pre!.kind).not.toBe(post!.kind);
      expect(b.has(pre!.id) && !a.has(pre!.id) && a.has(post!.id)).toBe(true);
      break;
    case 'rotated':
      expect({ ...pre, rot: 0, flip: false }).toEqual({ ...post, rot: 0, flip: false });
      break;
  }
  // The change must actually look different.
  if (pre && post && pre.id === post.id) expect(renderItem(post)).not.toBe(renderItem(pre));
}

describe('change generation', () => {
  it('every change type can be forced and is valid and visible at every difficulty', () => {
    for (const type of CHANGE_TYPES) {
      for (const round of [1, 4, 8, 15, 25]) {
        let made = 0;
        for (let seed = 1; seed <= 40; seed++) {
          const diff = { ...difficulty(round), changeCount: 1 };
          const before = generateScene(makeRng(seed * 7 + round), diff.itemCount, diff.closedSurfaces);
          const { after, changes } = generateChanges(before, makeRng(seed), diff, type);
          expect(changes.length).toBe(1);
          validateScene(after);
          expectOnlyChangedItemsDiffer(before, after, changes);
          for (const c of changes) {
            expectShape(c, before, after);
            const vis = checkVisible(c, diff);
            expect(vis.ok, `${c.type} r${round} s${seed}: ${vis.reason}`).toBe(true);
            expect(c.targets.length).toBeGreaterThan(0);
            expect(c.description.length).toBeGreaterThan(10);
          }
          if (changes[0].type === type) made++;
          expect(renderItems(after)).not.toBe(renderItems(before));
        }
        // A forced type should almost always be possible in rounds where it can occur.
        if (difficulty(round).weights[type] > 0) expect(made, `${type} at round ${round}`).toBeGreaterThanOrEqual(36);
      }
    }
  });

  it('later rounds ask for multiple independent changes', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const diff = difficulty(14);
      const before = generateScene(makeRng(seed), diff.itemCount, diff.closedSurfaces);
      const { after, changes } = generateChanges(before, makeRng(seed + 1000), diff);
      expect(changes.length).toBe(3);
      validateScene(after);
      expectOnlyChangedItemsDiffer(before, after, changes);
      const ids = changes.flatMap((c) => [...new Set([c.before?.id, c.after?.id].filter((x) => x !== undefined))]);
      expect(new Set(ids).size).toBe(ids.length);
      for (const c of changes) expect(checkVisible(c, diff).ok).toBe(true);
    }
  });

  it('mixes change types across a run', () => {
    const seen = new Map<ChangeType, number>();
    for (let seed = 1; seed <= 400; seed++) {
      const diff = difficulty(1 + (seed % 18));
      const before = generateScene(makeRng(seed), diff.itemCount, diff.closedSurfaces);
      for (const c of generateChanges(before, makeRng(seed * 3), diff).changes) seen.set(c.type, (seen.get(c.type) ?? 0) + 1);
    }
    for (const t of CHANGE_TYPES) expect(seen.get(t) ?? 0, t).toBeGreaterThan(15);
  });

  it('colour changes get subtler as rounds go on', () => {
    const avg = (round: number) => {
      const des: number[] = [];
      for (let seed = 1; seed <= 150; seed++) {
        const diff = { ...difficulty(round), changeCount: 1 };
        const c = generateChanges(generateScene(makeRng(seed), diff.itemCount, diff.closedSurfaces), makeRng(seed), diff, 'color').changes[0];
        if (c.type === 'color') des.push(deltaE(c.before!.color, c.after!.color));
      }
      return des.reduce((a, b) => a + b, 0) / des.length;
    };
    expect(avg(15)).toBeLessThan(avg(1) - 10);
  });
});
