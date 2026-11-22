import { KINDS, kh, kindById, kw, patternsOf, type Kind } from './catalog';
import { COLOR_NAMES, type ColorName } from './palette';
import { SLOTS, slotById, type Slot, type Surface } from './layout';
import type { Rng } from './rng';

export interface Item {
  id: number;
  kind: string;
  slot: string;
  color: ColorName;
  pattern: string;
  /** degrees; 0 = upright */
  rot: number;
  flip: boolean;
  /** stable variant number for small details */
  v: number;
}

export interface Scene {
  items: Item[];
  nextId: number;
  /** surfaces kept empty this round (early rounds leave the floor bare) */
  closed?: Surface[];
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Max copies of one kind in a room, so it never looks like a warehouse. */
export const MAX_PER_KIND = 2;

export function fits(kind: Kind, slot: Slot): boolean {
  return kw(kind) <= slot.maxW && kh(kind) <= slot.maxH && kind.cats.some((c) => slot.accepts.includes(c));
}

export function kindsForSlot(slot: Slot): Kind[] {
  return KINDS.filter((k) => fits(k, slot));
}

export function itemBox(item: Pick<Item, 'kind' | 'slot'>): Box {
  const k = kindById(item.kind);
  const s = slotById(item.slot);
  return { x: s.x - kw(k) / 2, y: s.y - kh(k), w: kw(k), h: kh(k) };
}

export function makeItem(rng: Rng, id: number, kind: Kind, slot: Slot): Item {
  const pats = patternsOf(kind);
  // Mostly solid fabrics/ceramics so patterned ones stand out; artworks always pick one.
  const pattern = kind.art ? rng.pick(pats) : pats.length > 1 && rng.chance(0.4) ? rng.pick(pats.slice(1)) : 'solid';
  return {
    id,
    kind: kind.id,
    slot: slot.id,
    color: rng.pick(COLOR_NAMES),
    pattern,
    rot: 0,
    flip: kind.flip ? rng.chance(0.5) : false,
    v: rng.int(1, 1_000_000),
  };
}

/** Kinds already at their cap in this scene. */
export function kindCounts(scene: Scene): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of scene.items) m.set(it.kind, (m.get(it.kind) ?? 0) + 1);
  return m;
}

export function openSlots(closed: readonly Surface[] = []): Slot[] {
  return SLOTS.filter((s) => !closed.includes(s.surface));
}

export function freeSlots(scene: Scene): Slot[] {
  const used = new Set(scene.items.map((i) => i.slot));
  return openSlots(scene.closed).filter((s) => !used.has(s.id));
}

/**
 * Fill `count` slots with random items. Pillows and the wall get filled first-ish so
 * the room always looks lived-in; the rest is shuffled.
 */
export function generateScene(rng: Rng, count: number, closed: readonly Surface[] = []): Scene {
  const open = openSlots(closed);
  const n = Math.max(1, Math.min(count, open.length - 4));
  const scene: Scene = { items: [], nextId: 1, ...(closed.length ? { closed: [...closed] } : {}) };
  // Bias: a couple of pillows, a wall piece, a lamp spot and a tall floor spot come first.
  // With only a handful of items early on, this keeps them in the obvious places.
  const order = open.map((s) => ({ s, p: priority(s, rng) }))
    .sort((a, b) => b.p - a.p)
    .map((o) => o.s);
  const counts = new Map<string, number>();
  for (const slot of order) {
    if (scene.items.length >= n) break;
    const options = kindsForSlot(slot).filter((k) => (counts.get(k.id) ?? 0) < MAX_PER_KIND);
    if (options.length === 0) continue;
    const kind = rng.pick(options);
    counts.set(kind.id, (counts.get(kind.id) ?? 0) + 1);
    scene.items.push(makeItem(rng, scene.nextId++, kind, slot));
  }
  return scene;
}

function priority(s: Slot, rng: Rng): number {
  if (s.id === 'couch-2' || s.id === 'couch-3' || s.id === 'wall-r1') return 2;
  if (s.id === 'side-1' || s.id === 'floor-tall-l') return 1.5;
  return rng.next();
}

/** Throws if the scene breaks a room rule. Used by tests and as a dev assertion. */
export function validateScene(scene: Scene): void {
  const slotsSeen = new Set<string>();
  const ids = new Set<number>();
  const counts = new Map<string, number>();
  for (const it of scene.items) {
    const k = kindById(it.kind);
    const s = slotById(it.slot);
    if (slotsSeen.has(s.id)) throw new Error(`slot ${s.id} used twice`);
    slotsSeen.add(s.id);
    if (ids.has(it.id)) throw new Error(`duplicate id ${it.id}`);
    ids.add(it.id);
    if (it.id >= scene.nextId) throw new Error(`id ${it.id} >= nextId`);
    if (!fits(k, s)) throw new Error(`${k.id} does not fit ${s.id}`);
    if (scene.closed?.includes(s.surface)) throw new Error(`${s.id} is closed this round`);
    if (!patternsOf(k).includes(it.pattern)) throw new Error(`${k.id} cannot wear ${it.pattern}`);
    if (it.flip && !k.flip) throw new Error(`${k.id} cannot flip`);
    if (it.rot !== 0 && !k.tilt) throw new Error(`${k.id} cannot tilt`);
    counts.set(k.id, (counts.get(k.id) ?? 0) + 1);
  }
  for (const [id, n] of counts) if (n > MAX_PER_KIND) throw new Error(`${id} appears ${n} times`);
}

export function cloneScene(s: Scene): Scene {
  return { ...s, items: s.items.map((i) => ({ ...i })), ...(s.closed ? { closed: [...s.closed] } : {}) };
}
