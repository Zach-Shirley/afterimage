import type { Change } from './changes';
import { itemBox, type Box, type Scene } from './room';

export interface Point {
  x: number;
  y: number;
}

/** Distance from a point to a box (0 when inside). */
export function distToBox(p: Point, b: Box): number {
  const dx = Math.max(b.x - p.x, 0, p.x - (b.x + b.w));
  const dy = Math.max(b.y - p.y, 0, p.y - (b.y + b.h));
  return Math.hypot(dx, dy);
}

export function inBox(p: Point, b: Box, pad = 0): boolean {
  return p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad;
}

/** A change's own items, so tapping the changed item never counts as "some other item". */
function changeItemIds(c: Change): Set<number> {
  const s = new Set<number>();
  if (c.before) s.add(c.before.id);
  if (c.after) s.add(c.after.id);
  return s;
}

/**
 * Decide which pending change (if any) a tap finds.
 *
 * - A tap inside a target box (plus a small pad) always counts.
 * - A near miss within `tolerance` counts too, unless the tap landed squarely on a
 *   different, unchanged item — then the player clearly meant that item.
 * - When several targets qualify, the closest wins.
 *
 * `tolerance` is in SVG units; the UI converts ~22 screen pixels so phones get a
 * bigger allowance than desktops.
 */
export function resolveTap(p: Point, pending: readonly Change[], scene: Scene, tolerance: number, pad = 6): Change | null {
  let best: Change | null = null;
  let bestD = Infinity;
  for (const c of pending) {
    const d = Math.min(...c.targets.map((b) => distToBox(p, b)));
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  if (!best || bestD > Math.max(tolerance, pad)) return null;
  if (bestD <= pad) return best;
  const mine = changeItemIds(best);
  const onOther = scene.items.some((it) => !mine.has(it.id) && inBox(p, itemBox(it)));
  return onOther ? null : best;
}
