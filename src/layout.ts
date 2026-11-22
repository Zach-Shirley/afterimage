/**
 * The one persistent room. Coordinates are SVG units in a 1000×800 viewBox.
 * Every slot is an anchor (bottom-centre of the item) plus a size budget and the
 * item categories that make sense there. Slots never overlap, so items never overlap.
 */
export type Category =
  | 'small' // tabletop odds and ends
  | 'book'
  | 'plant'
  | 'flat' // lies flat on a table (magazine, remote)
  | 'pillow'
  | 'wall'
  | 'lamp'
  | 'floor'
  | 'tallfloor';

export type Surface =
  | 'bookcase'
  | 'floating shelf'
  | 'window sill'
  | 'couch'
  | 'wall'
  | 'side table'
  | 'coffee table'
  | 'floor';

export interface Slot {
  id: string;
  surface: Surface;
  x: number;
  y: number;
  maxW: number;
  maxH: number;
  accepts: Category[];
  /** wall items hang from the top, so tilt pivots there */
  hanging?: boolean;
}

export const VIEW_W = 1000;
export const VIEW_H = 800;

const slots: Slot[] = [];
const add = (s: Slot) => slots.push(s);

// Bookcase: four shelves × three compartments.
[180, 290, 400, 510].forEach((y, shelf) => {
  [79, 162, 245].forEach((x, i) => {
    add({ id: `shelf${shelf + 1}-${i + 1}`, surface: 'bookcase', x, y, maxW: 80, maxH: 98, accepts: ['small', 'book', 'plant'] });
  });
});

// Wall between bookcase and window: one picture, and a floating shelf under it.
add({ id: 'wall-left', surface: 'wall', x: 361, y: 240, maxW: 100, maxH: 112, accepts: ['wall'], hanging: true });
add({ id: 'float-1', surface: 'floating shelf', x: 334, y: 350, maxW: 53, maxH: 72, accepts: ['small', 'plant'] });
add({ id: 'float-2', surface: 'floating shelf', x: 389, y: 350, maxW: 53, maxH: 72, accepts: ['small', 'plant'] });

// Window sill.
[467, 533, 599, 665].forEach((x, i) => {
  add({ id: `sill-${i + 1}`, surface: 'window sill', x, y: 331, maxW: 65, maxH: 86, accepts: ['small', 'plant'] });
});

// Couch cushions.
[418, 512, 606, 700].forEach((x, i) => {
  add({ id: `couch-${i + 1}`, surface: 'couch', x, y: 500, maxW: 93, maxH: 80, accepts: ['pillow'] });
});

// Wall right of the window.
add({ id: 'wall-r1', surface: 'wall', x: 798, y: 200, maxW: 104, maxH: 124, accepts: ['wall'], hanging: true });
add({ id: 'wall-r2', surface: 'wall', x: 920, y: 200, maxW: 104, maxH: 124, accepts: ['wall'], hanging: true });
add({ id: 'wall-r3', surface: 'wall', x: 858, y: 328, maxW: 80, maxH: 84, accepts: ['wall'], hanging: true });

// Side table: top (lamp-capable), top (small), lower shelf.
add({ id: 'side-1', surface: 'side table', x: 862, y: 466, maxW: 72, maxH: 134, accepts: ['lamp', 'small', 'plant', 'book'] });
add({ id: 'side-2', surface: 'side table', x: 925, y: 466, maxW: 52, maxH: 72, accepts: ['small'] });
add({ id: 'side-low', surface: 'side table', x: 890, y: 546, maxW: 100, maxH: 66, accepts: ['book', 'small', 'flat'] });

// Coffee table.
[352, 432, 512, 592, 672].forEach((x, i) => {
  add({ id: `table-${i + 1}`, surface: 'coffee table', x, y: 612, maxW: 79, maxH: 96, accepts: ['small', 'book', 'plant', 'flat'] });
});

// Floor.
add({ id: 'floor-tall-l', surface: 'floor', x: 108, y: 702, maxW: 100, maxH: 191, accepts: ['tallfloor', 'floor'] });
add({ id: 'floor-l', surface: 'floor', x: 246, y: 772, maxW: 98, maxH: 80, accepts: ['floor'] });
add({ id: 'floor-rug', surface: 'floor', x: 522, y: 786, maxW: 84, maxH: 36, accepts: ['floor'] });
add({ id: 'floor-r', surface: 'floor', x: 800, y: 782, maxW: 98, maxH: 80, accepts: ['floor'] });
add({ id: 'floor-tall-r', surface: 'floor', x: 950, y: 742, maxW: 98, maxH: 191, accepts: ['tallfloor', 'floor'] });

export const SLOTS: readonly Slot[] = slots;
export const SLOT_BY_ID: ReadonlyMap<string, Slot> = new Map(slots.map((s) => [s.id, s]));

export function slotById(id: string): Slot {
  const s = SLOT_BY_ID.get(id);
  if (!s) throw new Error(`unknown slot ${id}`);
  return s;
}

/** Human phrase for where a slot is, used in reveal captions. */
export function slotPlace(s: Slot): string {
  switch (s.surface) {
    case 'bookcase': return 'on the bookcase';
    case 'floating shelf': return 'on the little wall shelf';
    case 'window sill': return 'on the window sill';
    case 'couch': return 'on the couch';
    case 'wall': return 'on the wall';
    case 'side table': return s.id === 'side-low' ? 'under the side table' : 'on the side table';
    case 'coffee table': return 'on the coffee table';
    case 'floor': return 'on the floor';
  }
}
