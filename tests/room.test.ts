import { describe, expect, it } from 'vitest';
import { KINDS, patternsOf } from '../src/catalog';
import { SLOTS } from '../src/layout';
import { makeRng } from '../src/rng';
import { fits, generateScene, itemBox, kindsForSlot, validateScene } from '../src/room';
import { difficulty } from '../src/scoring';
import { renderItem } from '../src/render';

describe('catalog and layout', () => {
  it('has a large catalog with unique ids', () => {
    expect(KINDS.length).toBeGreaterThanOrEqual(50);
    expect(new Set(KINDS.map((k) => k.id)).size).toBe(KINDS.length);
  });

  it('every slot can hold several kinds, and every kind fits somewhere', () => {
    for (const s of SLOTS) expect(kindsForSlot(s).length, s.id).toBeGreaterThanOrEqual(s.surface === 'couch' ? 4 : 2);
    for (const k of KINDS) expect(SLOTS.some((s) => fits(k, s)), k.id).toBe(true);
  });

  it('slot footprints never overlap', () => {
    const box = (s: (typeof SLOTS)[number]) => ({ x: s.x - s.maxW / 2, y: s.y - s.maxH, w: s.maxW, h: s.maxH });
    for (let i = 0; i < SLOTS.length; i++)
      for (let j = i + 1; j < SLOTS.length; j++) {
        const a = box(SLOTS[i]), b = box(SLOTS[j]);
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${SLOTS[i].id} vs ${SLOTS[j].id}`).toBe(false);
      }
  });

  it('every kind renders differently in every colour and pattern it allows', () => {
    const slot = (k: (typeof KINDS)[number]) => SLOTS.find((s) => fits(k, s))!.id;
    for (const k of KINDS) {
      const base = { id: 1, kind: k.id, slot: slot(k), color: 'mustard' as const, pattern: patternsOf(k)[0], rot: 0, flip: false, v: 7 };
      if (k.recolor) expect(renderItem({ ...base, color: 'navy' }), k.id).not.toBe(renderItem(base));
      for (const p of patternsOf(k).slice(1)) expect(renderItem({ ...base, pattern: p }), `${k.id} ${p}`).not.toBe(renderItem(base));
      if (k.flip) expect(renderItem({ ...base, flip: true })).not.toBe(renderItem(base));
    }
  });
});

describe('room generation', () => {
  it('produces valid rooms across many seeds and difficulties', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const diff = difficulty(1 + (seed % 20));
      const scene = generateScene(makeRng(seed), diff.itemCount, diff.closedSurfaces);
      validateScene(scene);
      expect(scene.items.length).toBe(diff.itemCount);
      if (diff.closedSurfaces.includes('floor')) expect(scene.items.some((i) => i.slot.startsWith('floor'))).toBe(false);
      for (const it of scene.items) {
        const b = itemBox(it);
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w).toBeLessThanOrEqual(1000);
        expect(b.y).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('is deterministic for a seed and varied across seeds', () => {
    const a = generateScene(makeRng(42), 20);
    const b = generateScene(makeRng(42), 20);
    expect(a).toEqual(b);
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) generateScene(makeRng(seed), 20).items.forEach((i) => kinds.add(i.kind));
    expect(kinds.size).toBeGreaterThanOrEqual(KINDS.length - 3);
  });

  it('always leaves free slots for moves and additions', () => {
    const scene = generateScene(makeRng(5), 999);
    expect(SLOTS.length - scene.items.length).toBeGreaterThanOrEqual(4);
  });
});
