import { KINDS, kindById, patternsOf, type Kind } from './catalog';
import { COLOR_NAMES, deltaE, type ColorName } from './palette';
import { slotById, slotPlace, type Slot } from './layout';
import { cloneScene, fits, freeSlots, itemBox, kindCounts, makeItem, MAX_PER_KIND, type Box, type Item, type Scene } from './room';
import type { Rng } from './rng';
import { CHANGE_TYPES, type ChangeType, type Difficulty } from './scoring';

export interface Change {
  type: ChangeType;
  /** item before the change (null when one was added) */
  before: Item | null;
  /** item after the change (null when one was removed) */
  after: Item | null;
  /** where a tap counts: old and/or new position */
  targets: Box[];
  description: string;
}

/**
 * Share of an item's box that its main colour covers. A colour change on a picture
 * only repaints the frame; on a pillow it repaints everything.
 */
export const COLOR_SHARE: Record<string, number> = {
  hourglass: 0.3, glasses: 0.3, tulips: 0.4, 'bud-vase': 0.45, 'pencil-cup': 0.7,
  'photo-frame': 0.4, 'landscape-frame': 0.35, 'portrait-frame': 0.35, 'small-frame': 0.38,
  'standing-books': 0.3, 'book-row': 0.2, 'book-stack': 0.35, 'floor-books': 0.2,
  'fruit-bowl': 0.55, lantern: 0.45, 'jar-candle': 0.45, cactus: 0.35, succulent: 0.5, fern: 0.35,
  bonsai: 0.3, 'floor-plant': 0.22, 'branch-vase': 0.3, guitar: 0.5, 'table-lamp': 0.45,
  'floor-lamp': 0.3, mirror: 0.45, 'wall-clock': 0.5, 'wall-plate': 0.5, 'alarm-clock': 0.7,
  'keepsake-box': 0.9, camera: 0.6, teacup: 0.7, mug: 0.8,
};
/** Share of the box a pattern or artwork covers. */
const PATTERN_SHARE: Record<string, number> = {
  'photo-frame': 0.6, 'landscape-frame': 0.7, 'portrait-frame': 0.7, 'small-frame': 0.65,
  fern: 0.35, succulent: 0.5, 'floor-plant': 0.22, 'branch-vase': 0.3, 'table-lamp': 0.45, 'floor-lamp': 0.3,
  'wall-plate': 0.5, teacup: 0.7, mug: 0.8, 'pencil-cup': 0.7,
};

/** Patterns read less clearly than colour or shape, so they need bigger items. */
export const PATTERN_AREA_FACTOR = 1.6;

export const area = (k: Kind) => k.w * k.h;
export const colorArea = (k: Kind) => area(k) * (COLOR_SHARE[k.id] ?? 1);
export const patternArea = (k: Kind) => area(k) * (PATTERN_SHARE[k.id] ?? 1);

export function tiltDegrees(d: number): number {
  return Math.round(14 - 5 * d);
}

export function anchorDistance(a: Slot, b: Slot): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const patternWord = (p: string) => (p === 'solid' ? 'plain' : p);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function unionBox(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

interface Ctx {
  scene: Scene;
  rng: Rng;
  diff: Difficulty;
  touchedItems: Set<number>;
  touchedSlots: Set<string>;
}

function candidates(ctx: Ctx, pred: (it: Item, k: Kind) => boolean): Item[] {
  return ctx.scene.items.filter((it) => {
    if (ctx.touchedItems.has(it.id) || ctx.touchedSlots.has(it.slot)) return false;
    return pred(it, kindById(it.kind));
  });
}

function replaceItem(scene: Scene, id: number, next: Item | null) {
  const i = scene.items.findIndex((x) => x.id === id);
  if (next) scene.items[i] = next;
  else scene.items.splice(i, 1);
}

type Maker = (ctx: Ctx) => Change | null;

const makers: Record<ChangeType, Maker> = {
  moved(ctx) {
    const { rng, diff, scene } = ctx;
    const free = freeSlots(scene).filter((s) => !ctx.touchedSlots.has(s.id));
    const opts = candidates(ctx, (it, k) => area(k) >= ctx.diff.minArea && free.some((s) => fits(k, s) && anchorDistance(s, slotById(it.slot)) >= diff.minMove));
    if (!opts.length) return null;
    const it = rng.pick(opts);
    const k = kindById(it.kind);
    const from = slotById(it.slot);
    const to = rng.pick(free.filter((s) => fits(k, s) && anchorDistance(s, from) >= diff.minMove));
    const moved: Item = { ...it, slot: to.id };
    replaceItem(scene, it.id, moved);
    ctx.touchedSlots.add(from.id).add(to.id);
    ctx.touchedItems.add(it.id);
    const where = slotPlace(from) === slotPlace(to) ? `to a different spot ${slotPlace(from)}` : `from ${slotPlace(from).replace(/^(on|under) the /, 'the ')} to ${slotPlace(to).replace(/^(on|under) the /, 'the ')}`;
    return { type: 'moved', before: it, after: moved, targets: [itemBox(it), itemBox(moved)], description: `The ${k.name} moved ${where}.` };
  },

  removed(ctx) {
    const opts = candidates(ctx, (_it, k) => area(k) >= ctx.diff.minArea);
    if (!opts.length) return null;
    const it = ctx.rng.pick(opts);
    replaceItem(ctx.scene, it.id, null);
    ctx.touchedItems.add(it.id);
    ctx.touchedSlots.add(it.slot);
    const k = kindById(it.kind);
    return { type: 'removed', before: it, after: null, targets: [itemBox(it)], description: `The ${k.name} ${slotPlace(slotById(it.slot))} disappeared.` };
  },

  added(ctx) {
    const { scene, rng } = ctx;
    const counts = kindCounts(scene);
    const free = freeSlots(scene).filter((s) => !ctx.touchedSlots.has(s.id));
    const pairs: [Slot, Kind][] = [];
    for (const s of free) for (const k of KINDS) if (fits(k, s) && area(k) >= ctx.diff.minArea && (counts.get(k.id) ?? 0) < MAX_PER_KIND) pairs.push([s, k]);
    if (!pairs.length) return null;
    const [slot, kind] = rng.pick(pairs);
    const it = makeItem(rng, scene.nextId++, kind, slot);
    scene.items.push(it);
    ctx.touchedItems.add(it.id);
    ctx.touchedSlots.add(slot.id);
    return { type: 'added', before: null, after: it, targets: [itemBox(it)], description: `A ${kind.name} appeared ${slotPlace(slot)}.` };
  },

  color(ctx) {
    const { diff, rng } = ctx;
    const inRange = (a: ColorName) => COLOR_NAMES.filter((c) => c !== a && deltaE(a, c) >= diff.minDeltaE && deltaE(a, c) <= diff.maxDeltaE);
    const opts = candidates(ctx, (_it, k) => k.recolor && colorArea(k) >= diff.minArea);
    if (!opts.length) return null;
    const it = rng.pick(opts);
    let choices = inRange(it.color);
    if (!choices.length) choices = COLOR_NAMES.filter((c) => deltaE(it.color, c) >= diff.minDeltaE);
    if (!choices.length) return null;
    const next: Item = { ...it, color: rng.pick(choices) };
    replaceItem(ctx.scene, it.id, next);
    ctx.touchedItems.add(it.id);
    ctx.touchedSlots.add(it.slot);
    const k = kindById(it.kind);
    const what = k.art ? `frame of the ${k.name}` : k.name;
    return { type: 'color', before: it, after: next, targets: [itemBox(it)], description: `${cap(`the ${what}`)} changed from ${it.color} to ${next.color}.` };
  },

  pattern(ctx) {
    const opts = candidates(ctx, (_it, k) => patternsOf(k).length > 1 && patternArea(k) >= ctx.diff.minArea * PATTERN_AREA_FACTOR);
    if (!opts.length) return null;
    const it = ctx.rng.pick(opts);
    const k = kindById(it.kind);
    const next: Item = { ...it, pattern: ctx.rng.pick(patternsOf(k).filter((p) => p !== it.pattern)) };
    replaceItem(ctx.scene, it.id, next);
    ctx.touchedItems.add(it.id);
    ctx.touchedSlots.add(it.slot);
    const description = k.art
      ? `The ${k.name} now shows ${next.pattern === 'shapes' ? 'shapes' : `a ${next.pattern}`} instead of ${it.pattern === 'shapes' ? 'shapes' : `a ${it.pattern}`}.`
      : `The ${k.name} went from ${patternWord(it.pattern)} to ${patternWord(next.pattern)}.`;
    return { type: 'pattern', before: it, after: next, targets: [itemBox(it)], description };
  },

  swapped(ctx) {
    const { scene, rng, diff } = ctx;
    const counts = kindCounts(scene);
    const similar = (it: Item, k: Kind) => {
      const s = slotById(it.slot);
      return KINDS.filter((o) => o.family === k.family && o.id !== k.id && fits(o, s) && (counts.get(o.id) ?? 0) < MAX_PER_KIND &&
        o.w / k.w >= 0.6 && o.w / k.w <= 1.67 && o.h / k.h >= 0.6 && o.h / k.h <= 1.67 && area(o) >= diff.minArea);
    };
    const opts = candidates(ctx, (it, k) => area(k) >= diff.minArea && similar(it, k).length > 0);
    if (!opts.length) return null;
    const it = rng.pick(opts);
    const k = kindById(it.kind);
    const nk = rng.pick(similar(it, k));
    const fresh = makeItem(rng, scene.nextId++, nk, slotById(it.slot));
    // Keep the colour where possible: a same-colour swap is the subtle version.
    const next: Item = { ...fresh, color: nk.recolor && k.recolor ? it.color : fresh.color };
    replaceItem(scene, it.id, next);
    ctx.touchedItems.add(it.id).add(next.id);
    ctx.touchedSlots.add(it.slot);
    return { type: 'swapped', before: it, after: next, targets: [unionBox(itemBox(it), itemBox(next))], description: `The ${k.name} became a ${nk.name}.` };
  },

  rotated(ctx) {
    const { diff, rng } = ctx;
    const opts = candidates(ctx, (_it, k) => (k.flip || k.tilt === true) && area(k) >= diff.minArea);
    if (!opts.length) return null;
    const it = rng.pick(opts);
    const k = kindById(it.kind);
    let next: Item;
    let description: string;
    if (k.tilt) {
      const deg = tiltDegrees(diff.d);
      next = { ...it, rot: it.rot === 0 ? (rng.chance(0.5) ? deg : -deg) : 0 };
      description = next.rot === 0 ? `The ${k.name} was straightened.` : `The ${k.name} is now hanging crooked.`;
      if (!slotById(it.slot).hanging && next.rot !== 0) description = `The ${k.name} is now tilted.`;
    } else {
      next = { ...it, flip: !it.flip };
      description = `The ${k.name} turned to face the other way.`;
    }
    replaceItem(ctx.scene, it.id, next);
    ctx.touchedItems.add(it.id);
    ctx.touchedSlots.add(it.slot);
    return { type: 'rotated', before: it, after: next, targets: [itemBox(it)], description };
  },
};

/**
 * Apply `diff.changeCount` changes to a copy of the scene. Changes never touch the
 * same item or slot twice, so each one stays independently findable.
 * `forced` pins the type of the first change (debug and tests).
 */
export function generateChanges(scene: Scene, rng: Rng, diff: Difficulty, forced?: ChangeType): { after: Scene; changes: Change[] } {
  const ctx: Ctx = { scene: cloneScene(scene), rng, diff, touchedItems: new Set(), touchedSlots: new Set() };
  const changes: Change[] = [];
  for (let n = 0; n < diff.changeCount; n++) {
    let made: Change | null = null;
    if (n === 0 && forced) made = makers[forced](ctx);
    for (let attempt = 0; !made && attempt < 40; attempt++) {
      const type = rng.weighted(CHANGE_TYPES.map((t) => [t, diff.weights[t]] as const));
      made = makers[type](ctx);
    }
    if (made) changes.push(made);
  }
  return { after: ctx.scene, changes };
}

export interface Visibility {
  ok: boolean;
  reason?: string;
}

/** The fairness rules a change must meet at a given difficulty. */
export function checkVisible(c: Change, diff: Difficulty): Visibility {
  const fail = (reason: string) => ({ ok: false, reason });
  const k = kindById((c.before ?? c.after)!.kind);
  switch (c.type) {
    case 'moved': {
      if (!c.before || !c.after) return fail('moved needs both');
      const dist = anchorDistance(slotById(c.before.slot), slotById(c.after.slot));
      if (dist < diff.minMove) return fail(`moved only ${dist}`);
      if (area(k) < diff.minArea) return fail('too small');
      return { ok: true };
    }
    case 'removed':
    case 'added':
      return area(k) >= diff.minArea ? { ok: true } : fail('too small');
    case 'color': {
      if (!c.before || !c.after) return fail('color needs both');
      const de = deltaE(c.before.color, c.after.color);
      if (de < diff.minDeltaE) return fail(`ΔE ${de.toFixed(1)} too low`);
      if (colorArea(k) < diff.minArea) return fail('colour area too small');
      return { ok: true };
    }
    case 'pattern':
      if (!c.before || !c.after || c.before.pattern === c.after.pattern) return fail('pattern unchanged');
      return patternArea(k) >= diff.minArea * PATTERN_AREA_FACTOR ? { ok: true } : fail('pattern area too small');
    case 'swapped': {
      if (!c.before || !c.after || c.before.kind === c.after.kind) return fail('kind unchanged');
      return area(kindById(c.after.kind)) >= diff.minArea && area(k) >= diff.minArea ? { ok: true } : fail('too small');
    }
    case 'rotated': {
      if (!c.before || !c.after) return fail('rotated needs both');
      const flipped = c.before.flip !== c.after.flip;
      const tilted = Math.abs(c.before.rot - c.after.rot) >= 8;
      if (!flipped && !tilted) return fail('no visible rotation');
      return area(k) >= diff.minArea ? { ok: true } : fail('too small');
    }
  }
}
