import type { Category } from './layout';

/**
 * Everything an item can be. Each kind draws itself in local coordinates with the
 * origin at its bottom-centre, spanning x ∈ [-w/2, w/2] and y ∈ [-h, 0].
 */
export interface DrawCtx {
  /** main fill: a colour or a url(#pattern) */
  F: string;
  /** main colour as hex */
  c: string;
  dk: string;
  lt: string;
  /** contrasting accent for details */
  acc: string;
  /** stable per-item variant number for small details */
  v: number;
  pattern: string;
}

export interface Kind {
  id: string;
  name: string;
  cats: Category[];
  w: number;
  h: number;
  /** swaps happen within a family (mug ↔ teacup) */
  family: string;
  recolor: boolean;
  /** fabric/ceramic patterns this kind may wear; for framed art, the artworks */
  patterns?: readonly string[];
  /** patterns are artworks painted by draw() rather than SVG fills */
  art?: boolean;
  /** visibly asymmetric, so a mirror flip is a fair "rotated" change */
  flip?: boolean;
  /** can tilt on its pivot as a "rotated" change */
  tilt?: boolean;
  draw(c: DrawCtx): string;
}

/** Items draw at their natural size × this. Sizes in `w`/`h` are natural; use kw/kh for room units. */
export const ITEM_SCALE = 1.3;
export const kw = (k: Pick<Kind, 'w'>) => k.w * ITEM_SCALE;
export const kh = (k: Pick<Kind, 'h'>) => k.h * ITEM_SCALE;

export const FABRIC = ['solid', 'stripes', 'dots', 'check', 'zigzag'] as const;
export const CERAMIC = ['solid', 'stripes', 'dots'] as const;
export const ARTWORKS = ['mountains', 'sunset', 'sea', 'shapes', 'botanical'] as const;

const SPINES = ['#7a3b2e', '#2d4263', '#3f6b4f', '#c8a03a', '#8c5a7a', '#c8643b', '#476e8a', '#e6d6b8', '#5a4a3a', '#9db389', '#b14a4a', '#3a3a48'];
const GREEN = '#5f8a4c';
const GREEN_DK = '#3f6b3a';
const WOOD = '#9a6a45';
const INK = '#4a3426';

/** deterministic 0..1 from a variant number and a salt */
export function vr(v: number, salt: number): number {
  let x = (v * 374761393 + salt * 668265263) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
const spine = (v: number, i: number) => SPINES[Math.floor(vr(v, i) * SPINES.length)];
const flame = (x: number, y: number, s = 1) =>
  `<path d="M${x} ${y} q${-4 * s} ${-6 * s} 0 ${-12 * s} q${4 * s} ${6 * s} 0 ${12 * s}z" fill="#f6c453" stroke="none"/><path d="M${x} ${y} q${-1.6 * s} ${-3 * s} 0 ${-6 * s} q${1.6 * s} ${3 * s} 0 ${6 * s}z" fill="#fff3c4" stroke="none"/>`;

function artwork(name: string, x: number, y: number, w: number, h: number, v: number): string {
  const r = (n: number) => n.toFixed(1);
  switch (name) {
    case 'mountains':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#cfe3ea" stroke="none"/>` +
        `<circle cx="${r(x + w * 0.75)}" cy="${r(y + h * 0.3)}" r="${r(Math.min(w, h) * 0.1)}" fill="#f4d27a" stroke="none"/>` +
        `<path d="M${x} ${y + h} L${r(x + w * 0.35)} ${r(y + h * 0.35)} L${r(x + w * 0.62)} ${y + h}z" fill="#6f8f7a" stroke="none"/>` +
        `<path d="M${r(x + w * 0.4)} ${y + h} L${r(x + w * 0.7)} ${r(y + h * 0.5)} L${x + w} ${y + h}z" fill="#4e6e62" stroke="none"/>`;
    case 'sunset':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f6d7a7" stroke="none"/>` +
        `<rect x="${x}" y="${r(y + h * 0.45)}" width="${w}" height="${r(h * 0.2)}" fill="#efa77a" stroke="none"/>` +
        `<rect x="${x}" y="${r(y + h * 0.65)}" width="${w}" height="${r(h * 0.35)}" fill="#c96b5a" stroke="none"/>` +
        `<circle cx="${r(x + w / 2)}" cy="${r(y + h * 0.48)}" r="${r(Math.min(w, h) * 0.18)}" fill="#fff0c9" stroke="none"/>`;
    case 'sea':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#dceef2" stroke="none"/>` +
        `<rect x="${x}" y="${r(y + h * 0.6)}" width="${w}" height="${r(h * 0.4)}" fill="#5f93ad" stroke="none"/>` +
        `<path d="M${r(x + w * 0.42)} ${r(y + h * 0.6)} l${r(w * 0.1)} ${r(-h * 0.35)} l0 ${r(h * 0.35)}z" fill="#fffaf0" stroke="none"/>` +
        `<path d="M${r(x + w * 0.3)} ${r(y + h * 0.6)} h${r(w * 0.36)} l${r(-w * 0.05)} ${r(h * 0.08)} h${r(-w * 0.26)}z" fill="#8a4b3a" stroke="none"/>`;
    case 'shapes': {
      const a = SPINES[Math.floor(vr(v, 11) * SPINES.length)];
      const b = SPINES[Math.floor(vr(v, 12) * SPINES.length)];
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f3ead8" stroke="none"/>` +
        `<circle cx="${r(x + w * 0.38)}" cy="${r(y + h * 0.42)}" r="${r(Math.min(w, h) * 0.24)}" fill="${a}" stroke="none"/>` +
        `<rect x="${r(x + w * 0.5)}" y="${r(y + h * 0.45)}" width="${r(w * 0.32)}" height="${r(h * 0.4)}" fill="${b}" stroke="none"/>` +
        `<path d="M${r(x + w * 0.12)} ${r(y + h * 0.88)} h${r(w * 0.5)}" stroke="${INK}" stroke-width="1.5"/>`;
    }
    default: // botanical
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f4efe2" stroke="none"/>` +
        `<path d="M${r(x + w / 2)} ${r(y + h * 0.9)} Q${r(x + w * 0.48)} ${r(y + h * 0.5)} ${r(x + w / 2)} ${r(y + h * 0.12)}" stroke="${GREEN_DK}" stroke-width="1.4" fill="none"/>` +
        [0.25, 0.42, 0.6].map((t, i) =>
          `<ellipse cx="${r(x + w / 2 + (i % 2 ? 1 : -1) * w * 0.14)}" cy="${r(y + h * t)}" rx="${r(w * 0.13)}" ry="${r(h * 0.06)}" fill="${GREEN}" stroke="none" transform="rotate(${i % 2 ? -30 : 30} ${r(x + w / 2 + (i % 2 ? 1 : -1) * w * 0.14)} ${r(y + h * t)})"/>`).join('');
  }
}

function frame(c: DrawCtx, w: number, h: number, mat: number): string {
  const art = artwork(c.pattern === 'solid' ? ARTWORKS[c.v % ARTWORKS.length] : c.pattern, -w / 2 + mat, -h + mat, w - 2 * mat, h - 2 * mat, c.v);
  return `<rect x="${-w / 2}" y="${-h}" width="${w}" height="${h}" rx="2" fill="${c.c}"/>` +
    `<rect x="${-w / 2 + mat * 0.55}" y="${-h + mat * 0.55}" width="${w - mat * 1.1}" height="${h - mat * 1.1}" fill="#faf6ee" stroke="none"/>` +
    art + `<rect x="${-w / 2 + mat}" y="${-h + mat}" width="${w - 2 * mat}" height="${h - 2 * mat}" fill="none" stroke-width="1"/>`;
}

const potPath = (w: number, h: number) => `M${-w / 2} ${-h} h${w} l${-w * 0.12} ${h} h${-w * 0.76}z`;

export const KINDS: Kind[] = [
  // ---------- drinkware ----------
  { id: 'mug', name: 'mug', cats: ['small'], w: 34, h: 34, family: 'drinkware', recolor: true, patterns: CERAMIC, flip: true,
    draw: (c) => `<path d="M7 -26 h5 a7 7 0 0 1 0 14 h-5" fill="none" stroke="${c.dk}" stroke-width="4"/><rect x="-17" y="-32" width="25" height="32" rx="4" fill="${c.F}"/><ellipse cx="-4.5" cy="-31" rx="11" ry="2.2" fill="${c.dk}" stroke="none"/>` },
  { id: 'teacup', name: 'teacup', cats: ['small'], w: 42, h: 28, family: 'drinkware', recolor: true, patterns: CERAMIC, flip: true,
    draw: (c) => `<ellipse cx="0" cy="-3.5" rx="20" ry="3.5" fill="${c.lt}"/><circle cx="12" cy="-18" r="5" fill="none" stroke="${c.dk}" stroke-width="2.6"/><path d="M-13 -26 h24 q0 19 -12 20 q-12 -1 -12 -20z" fill="${c.F}"/>` },
  // ---------- candles ----------
  { id: 'pillar-candle', name: 'pillar candle', cats: ['small'], w: 22, h: 46, family: 'candle', recolor: true,
    draw: (c) => `<rect x="-10" y="-34" width="20" height="34" rx="2" fill="${c.F}"/><path d="M0 -34 v-3" stroke="${INK}"/>${flame(0, -36, 0.85)}` },
  { id: 'jar-candle', name: 'jar candle', cats: ['small'], w: 32, h: 40, family: 'candle', recolor: true,
    draw: (c) => `<rect x="-15" y="-30" width="30" height="30" rx="5" fill="${c.lt}" fill-opacity="0.85"/><rect x="-12" y="-18" width="24" height="16" rx="3" fill="${c.F}" stroke="none"/><rect x="-15" y="-14" width="30" height="7" fill="#f8f1e2" stroke-width="1"/>${flame(0, -26, 0.7)}` },
  { id: 'lantern', name: 'lantern', cats: ['small'], w: 32, h: 56, family: 'candle', recolor: true,
    draw: (c) => `<path d="M-6 -50 a6 6 0 0 1 12 0" fill="none" stroke="${c.dk}" stroke-width="2.4"/><path d="M-14 -44 h28 l-4 -6 h-20z" fill="${c.F}"/><rect x="-12" y="-44" width="24" height="38" fill="#fbe9b8" fill-opacity="0.8"/><path d="M-12 -25 h24 M0 -44 v38" stroke="${c.dk}" stroke-width="1.6"/>${flame(0, -14, 0.6)}<rect x="-15" y="-7" width="30" height="7" rx="1.5" fill="${c.F}"/>` },
  // ---------- vessels ----------
  { id: 'round-vase', name: 'round vase', cats: ['small'], w: 40, h: 52, family: 'vase', recolor: true, patterns: CERAMIC,
    draw: (c) => `<path d="M-7 -52 h14 v8 q13 6 13 24 q0 20 -20 20 q-20 0 -20 -20 q0 -18 13 -24z" fill="${c.F}"/><ellipse cx="0" cy="-52" rx="7" ry="1.6" fill="${c.dk}" stroke="none"/>` },
  { id: 'tall-vase', name: 'tall vase', cats: ['small'], w: 26, h: 68, family: 'vase', recolor: true, patterns: CERAMIC,
    draw: (c) => `<path d="M-9 -68 h18 l-3 8 q7 10 7 30 l-2 30 h-22 l-2 -30 q0 -20 7 -30z" fill="${c.F}"/>` },
  { id: 'bud-vase', name: 'bud vase with a flower', cats: ['small'], w: 26, h: 62, family: 'vase', recolor: true, flip: true,
    draw: (c) => `<path d="M0 -24 q4 -18 8 -30" stroke="${GREEN_DK}" stroke-width="1.6" fill="none"/><ellipse cx="4" cy="-38" rx="5" ry="2.4" fill="${GREEN}" stroke="none" transform="rotate(-35 4 -38)"/>` +
      `<circle cx="8" cy="-55" r="6" fill="${['#e8806a', '#f1d68c', '#c9667e', '#aa9dc6'][c.v % 4]}"/><circle cx="8" cy="-55" r="2" fill="#f7e6a6" stroke="none"/><path d="M-4 -26 h8 v4 q8 6 8 14 q0 8 -12 8 q-12 0 -12 -8 q0 -8 8 -14z" fill="${c.F}"/>` },
  { id: 'pencil-cup', name: 'pencil cup', cats: ['small'], w: 28, h: 46, family: 'vase', recolor: true, patterns: CERAMIC,
    draw: (c) => `<path d="M-6 -30 l-4 -14 M0 -30 v-16 M6 -30 l5 -12" stroke-width="3.4" stroke="${INK}"/><path d="M-6 -30 l-4 -14 M0 -30 v-16 M6 -30 l5 -12" stroke-width="2" stroke="#e8b84a"/><rect x="-12" y="-30" width="24" height="30" rx="3" fill="${c.F}"/>` },
  // ---------- potted plants ----------
  { id: 'succulent', name: 'succulent', cats: ['plant', 'small'], w: 36, h: 36, family: 'pottedplant', recolor: true, patterns: CERAMIC,
    draw: (c) => `<g fill="${GREEN}" stroke="${GREEN_DK}"><ellipse cx="-9" cy="-24" rx="9" ry="5" transform="rotate(-25 -9 -24)"/><ellipse cx="9" cy="-24" rx="9" ry="5" transform="rotate(25 9 -24)"/><ellipse cx="0" cy="-28" rx="5" ry="9"/></g><path d="${potPath(30, 20)}" fill="${c.F}"/>` },
  { id: 'cactus', name: 'cactus', cats: ['plant', 'small'], w: 30, h: 56, family: 'pottedplant', recolor: true, flip: true,
    draw: (c) => `<path d="M-6 -18 v-30 a6 6 0 0 1 12 0 v30z" fill="${GREEN}" stroke="${GREEN_DK}"/><path d="M6 -30 h4 v-10 a4 4 0 0 1 8 0 v10 a6 6 0 0 1 -6 6 h-6z" fill="${GREEN}" stroke="${GREEN_DK}"/><path d="${potPath(28, 18)}" fill="${c.F}"/>` },
  { id: 'fern', name: 'fern', cats: ['plant'], w: 54, h: 56, family: 'pottedplant', recolor: true, patterns: CERAMIC,
    draw: (c) => `<g fill="none" stroke="${GREEN}" stroke-width="5" stroke-linecap="round"><path d="M0 -20 q-18 -10 -24 -30"/><path d="M0 -20 q18 -10 24 -30"/><path d="M0 -20 q-4 -22 0 -36"/><path d="M0 -20 q-22 -2 -26 -14"/><path d="M0 -20 q22 -2 26 -14"/></g><path d="${potPath(30, 22)}" fill="${c.F}"/>` },
  { id: 'bonsai', name: 'bonsai', cats: ['plant', 'small'], w: 54, h: 48, family: 'pottedplant', recolor: true, flip: true,
    draw: (c) => `<path d="M-2 -10 q-2 -14 8 -22 M4 -26 q-8 -4 -14 -6" stroke="#6b4a34" stroke-width="3.5" fill="none"/><ellipse cx="10" cy="-36" rx="13" ry="8" fill="${GREEN}" stroke="${GREEN_DK}"/><ellipse cx="-14" cy="-32" rx="10" ry="6" fill="${GREEN}" stroke="${GREEN_DK}"/><rect x="-24" y="-11" width="48" height="11" rx="2" fill="${c.F}"/>` },
  { id: 'tulips', name: 'jar of tulips', cats: ['plant', 'small'], w: 36, h: 62, family: 'pottedplant', recolor: true,
    draw: (c) => `<g stroke="${GREEN_DK}" stroke-width="1.6" fill="none"><path d="M0 -24 q-2 -18 -9 -26"/><path d="M0 -24 v-30"/><path d="M0 -24 q2 -18 9 -24"/></g>` +
      [[-9, -50], [0, -55], [9, -48]].map(([x, y]) => `<path d="M${x - 5} ${y} q0 -9 5 -9 q5 0 5 9 q-5 4 -10 0z" fill="${c.F}"/>`).join('') +
      `<rect x="-11" y="-26" width="22" height="26" rx="4" fill="#dbe9ee" fill-opacity="0.85"/>` },
  // ---------- books ----------
  { id: 'book-stack', name: 'stack of books', cats: ['book', 'small'], w: 58, h: 30, family: 'books', recolor: true,
    draw: (c) => `<rect x="-27" y="-10" width="54" height="10" rx="1.5" fill="${spine(c.v, 1)}"/><rect x="-24" y="-20" width="48" height="10" rx="1.5" fill="${spine(c.v, 2)}"/><rect x="-26" y="-30" width="50" height="10" rx="1.5" fill="${c.F}"/><path d="M18 -27 v4 M-20 -17 h10" stroke="#f3e7cc" stroke-width="1.2"/>` },
  { id: 'standing-books', name: 'row of books', cats: ['book'], w: 50, h: 62, family: 'books', recolor: true,
    draw: (c) => `<rect x="-24" y="-56" width="11" height="56" fill="${spine(c.v, 3)}"/><rect x="-13" y="-62" width="13" height="62" fill="${c.F}"/><rect x="0" y="-52" width="10" height="52" fill="${spine(c.v, 4)}"/><rect x="10" y="-58" width="12" height="58" fill="${spine(c.v, 5)}"/><path d="M-11 -50 h9 M-11 -14 h9" stroke="#f3e7cc" stroke-width="1.4"/>` },
  { id: 'book-row', name: 'shelf of books', cats: ['book'], w: 60, h: 72, family: 'books', recolor: true,
    draw: (c) => `<rect x="-29" y="-64" width="10" height="64" fill="${spine(c.v, 6)}"/><rect x="-19" y="-72" width="12" height="72" fill="${spine(c.v, 7)}"/><rect x="-7" y="-60" width="10" height="60" fill="${c.F}"/><rect x="3" y="-70" width="11" height="70" fill="${spine(c.v, 8)}"/><path d="M14 0 l14 -64 l9 2 l-14 62z" fill="${spine(c.v, 9)}"/><path d="M-5 -52 h6" stroke="#f3e7cc" stroke-width="1.4"/>` },
  // ---------- flat things ----------
  { id: 'magazine', name: 'magazine', cats: ['flat'], w: 58, h: 12, family: 'flatthing', recolor: true,
    draw: (c) => `<path d="M-25 -12 h50 l4 10 h-58z" fill="${c.F}"/><path d="M-29 -2 h58 v2 h-58z" fill="#efe6d4"/><path d="M-16 -9 h18" stroke="#fff8ea" stroke-width="2"/>` },
  { id: 'remote', name: 'TV remote', cats: ['flat'], w: 48, h: 10, family: 'flatthing', recolor: false, flip: true,
    draw: () => `<rect x="-24" y="-9" width="48" height="9" rx="4" fill="#3a3a40"/><circle cx="-15" cy="-5" r="2.4" fill="#d9534f" stroke="none"/><path d="M-6 -5 h3 M2 -5 h3 M10 -5 h3" stroke="#bcbcc4" stroke-width="2"/>` },
  { id: 'glasses', name: 'pair of glasses', cats: ['flat'], w: 42, h: 14, family: 'flatthing', recolor: true,
    draw: (c) => `<g fill="#e8f2f5" fill-opacity="0.6" stroke="${c.c}" stroke-width="3"><ellipse cx="-10" cy="-7" rx="9" ry="6"/><ellipse cx="10" cy="-7" rx="9" ry="6"/></g><path d="M-2 -8 q2 -2 4 0" stroke="${c.c}" stroke-width="2.4" fill="none"/>` },
  { id: 'phone', name: 'phone', cats: ['flat'], w: 34, h: 8, family: 'flatthing', recolor: true,
    draw: (c) => `<path d="M-15 -8 h30 l2 6 h-34z" fill="${c.F}"/><rect x="-17" y="-2.5" width="34" height="2.5" fill="${c.dk}"/>` },
  // ---------- dishes & boxes ----------
  { id: 'bowl', name: 'bowl', cats: ['small'], w: 52, h: 24, family: 'dish', recolor: true, patterns: CERAMIC,
    draw: (c) => `<path d="M-26 -22 h52 q-2 20 -26 22 q-24 -2 -26 -22z" fill="${c.F}"/><ellipse cx="0" cy="-22" rx="26" ry="3" fill="${c.dk}"/>` },
  { id: 'fruit-bowl', name: 'fruit bowl', cats: ['small'], w: 58, h: 40, family: 'dish', recolor: true,
    draw: (c) => `<circle cx="-10" cy="-26" r="9" fill="#e48a2e"/><circle cx="8" cy="-27" r="9" fill="#c0392b"/><path d="M8 -36 v-4" stroke="#6b4a34" stroke-width="1.6"/><path d="M-22 -24 q16 -18 40 -4 q-18 -6 -40 4z" fill="#f2cf4a"/><path d="M-28 -22 h56 q-2 20 -28 22 q-26 -2 -28 -22z" fill="${c.F}"/>` },
  { id: 'keepsake-box', name: 'keepsake box', cats: ['small'], w: 46, h: 30, family: 'dish', recolor: true, patterns: FABRIC,
    draw: (c) => `<rect x="-21" y="-24" width="42" height="24" rx="2" fill="${c.F}"/><rect x="-23" y="-30" width="46" height="8" rx="2" fill="${c.dk}"/><rect x="-3" y="-24" width="6" height="5" fill="#e6c26a"/>` },
  // ---------- figurines ----------
  { id: 'cat-figurine', name: 'cat figurine', cats: ['small'], w: 32, h: 44, family: 'figurine', recolor: true, flip: true,
    draw: (c) => `<path d="M8 -4 q16 0 10 -18" stroke="${c.c}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M-12 0 q-4 -20 4 -28 l-3 -12 l8 7 h6 l8 -7 l-3 12 q8 8 4 28z" fill="${c.F}"/><circle cx="-3" cy="-30" r="1.3" fill="${INK}" stroke="none"/><circle cx="4" cy="-30" r="1.3" fill="${INK}" stroke="none"/>` },
  { id: 'bird-figurine', name: 'bird figurine', cats: ['small'], w: 38, h: 30, family: 'figurine', recolor: true, flip: true,
    draw: (c) => `<path d="M-18 -16 l-2 -6 l8 3z" fill="${c.dk}"/><path d="M-14 -18 q2 -12 14 -10 q8 -6 14 2 l6 2 l-6 2 q2 18 -14 20 q-14 0 -14 -16z" fill="${c.F}"/><circle cx="9" cy="-22" r="1.4" fill="${INK}" stroke="none"/><path d="M-6 0 v-4 M2 0 v-4" stroke="${INK}"/>` },
  { id: 'duck', name: 'ceramic duck', cats: ['small'], w: 38, h: 32, family: 'figurine', recolor: true, flip: true,
    draw: (c) => `<path d="M-18 -12 q0 12 18 12 h6 q12 0 12 -12 q-8 2 -14 -2 q6 -4 6 -10 a8 8 0 0 0 -16 0 q0 6 4 10 q-8 -2 -16 2z" fill="${c.F}"/><path d="M-10 -24 l-7 2 l7 2z" fill="#e8a33a"/><circle cx="-4" cy="-26" r="1.4" fill="${INK}" stroke="none"/>` },
  // ---------- timepieces ----------
  { id: 'alarm-clock', name: 'alarm clock', cats: ['small'], w: 36, h: 40, family: 'timepiece', recolor: true,
    draw: (c) => { const a = vr(c.v, 2) * 6.28, b = vr(c.v, 3) * 6.28; return `<circle cx="-11" cy="-31" r="5" fill="${c.dk}"/><circle cx="11" cy="-31" r="5" fill="${c.dk}"/><path d="M-12 0 l4 -6 M12 0 l-4 -6" stroke="${INK}" stroke-width="2"/><circle cx="0" cy="-18" r="15" fill="${c.F}"/><circle cx="0" cy="-18" r="11" fill="#fbf6ea"/><path d="M0 -18 l${(Math.sin(a) * 6).toFixed(1)} ${(-Math.cos(a) * 6).toFixed(1)} M0 -18 l${(Math.sin(b) * 9).toFixed(1)} ${(-Math.cos(b) * 9).toFixed(1)}" stroke="${INK}" stroke-width="1.4"/>`; } },
  { id: 'hourglass', name: 'hourglass', cats: ['small'], w: 24, h: 44, family: 'timepiece', recolor: true,
    draw: (c) => `<rect x="-12" y="-44" width="24" height="4" rx="1" fill="${WOOD}"/><rect x="-12" y="-4" width="24" height="4" rx="1" fill="${WOOD}"/><path d="M-8 -40 h16 q0 12 -7 18 q7 6 7 18 h-16 q0 -12 7 -18 q-7 -6 -7 -18z" fill="#eaf3f5" fill-opacity="0.8"/><path d="M-6 -4 q0 -8 6 -10 q6 2 6 10z M-4 -36 h8 q-1 6 -4 10 q-3 -4 -4 -10z" fill="${c.c}" stroke="none"/>` },
  // ---------- kettles & gadgets ----------
  { id: 'teapot', name: 'teapot', cats: ['small'], w: 58, h: 42, family: 'kettle', recolor: true, patterns: CERAMIC, flip: true,
    draw: (c) => `<path d="M-14 -20 q-10 -2 -14 -14 q8 2 12 8" fill="${c.F}"/><path d="M15 -28 a9 9 0 0 1 0 18" fill="none" stroke="${c.dk}" stroke-width="3.6"/><path d="M-17 -18 q0 -16 17 -16 q17 0 17 16 q0 18 -17 18 q-17 0 -17 -18z" fill="${c.F}"/><path d="M-9 -34 q9 -6 18 0z" fill="${c.dk}"/><circle cx="0" cy="-39" r="3" fill="${c.dk}"/>` },
  { id: 'watering-can', name: 'watering can', cats: ['small'], w: 54, h: 40, family: 'kettle', recolor: true, flip: true,
    draw: (c) => `<path d="M-10 -20 l-16 -16 l-2 3 l14 16z" fill="${c.F}"/><ellipse cx="-27" cy="-35" rx="3" ry="5" fill="${c.dk}" transform="rotate(-45 -27 -35)"/><path d="M-4 -30 a12 10 0 0 1 24 0" fill="none" stroke="${c.dk}" stroke-width="3.4"/><path d="M-12 0 v-28 h30 v28z" fill="${c.F}"/>` },
  { id: 'radio', name: 'retro radio', cats: ['small'], w: 58, h: 40, family: 'kettle', recolor: true, flip: true,
    draw: (c) => `<path d="M14 -34 l10 -6" stroke="${INK}" stroke-width="1.6"/><rect x="-28" y="-34" width="56" height="34" rx="6" fill="${c.F}"/><circle cx="-11" cy="-17" r="10" fill="#efe3c8"/><path d="M-18 -20 h14 M-18 -14 h14" stroke="${c.dk}" stroke-width="1.4"/><circle cx="14" cy="-22" r="4" fill="${c.dk}"/><circle cx="14" cy="-10" r="3" fill="${c.dk}"/>` },
  { id: 'camera', name: 'film camera', cats: ['small'], w: 46, h: 32, family: 'kettle', recolor: true, flip: true,
    draw: (c) => `<rect x="-14" y="-32" width="10" height="5" fill="#3a3a40"/><rect x="-22" y="-27" width="44" height="27" rx="4" fill="${c.F}"/><rect x="-22" y="-20" width="44" height="12" fill="#3a3a40"/><circle cx="4" cy="-14" r="10" fill="#2f2f36"/><circle cx="4" cy="-14" r="5" fill="#6f8fa8"/><circle cx="-15" cy="-23" r="2" fill="#f2efe6" stroke="none"/>` },
  // ---------- curios ----------
  { id: 'photo-frame', name: 'standing photo frame', cats: ['small'], w: 38, h: 46, family: 'curio', recolor: true, tilt: true, patterns: ARTWORKS, art: true,
    draw: (c) => frame(c, 36, 46, 5) },
  { id: 'globe', name: 'globe', cats: ['small'], w: 40, h: 54, family: 'curio', recolor: false,
    draw: () => `<path d="M-12 0 h24 l-4 -4 h-16z" fill="${WOOD}"/><path d="M0 -4 v-6" stroke="${WOOD}" stroke-width="3"/><path d="M-16 -46 a18 18 0 0 0 20 34" fill="none" stroke="${WOOD}" stroke-width="2.4"/><circle cx="0" cy="-30" r="16" fill="#7fb2cf"/><path d="M-10 -40 q6 -2 8 4 q-4 6 -10 2z M2 -30 q8 -4 10 4 q-2 8 -8 8 q-4 -6 -2 -12z" fill="#8fb069" stroke="none"/>` },
  { id: 'yarn', name: 'ball of yarn', cats: ['small', 'floor'], w: 32, h: 26, family: 'craft', recolor: true,
    draw: (c) => `<path d="M-4 -26 l14 24 M6 -26 l-14 24" stroke="${WOOD}" stroke-width="2.4"/><circle cx="0" cy="-12" r="12" fill="${c.F}"/><path d="M-10 -18 q10 6 20 0 M-12 -11 q12 6 24 0 M-9 -4 q9 4 18 0 M-4 -23 q-4 10 0 22" stroke="${c.dk}" stroke-width="1.3" fill="none"/>` },
  // ---------- lamps ----------
  { id: 'table-lamp', name: 'table lamp', cats: ['lamp'], w: 54, h: 100, family: 'lamp', recolor: true, patterns: FABRIC,
    draw: (c) => `<path d="M0 -60 v-6" stroke="${INK}" stroke-width="2"/><path d="M-9 0 h18 l-2 -5 q9 -14 4 -30 q-4 -10 -2 -21 h-18 q2 11 -2 21 q-5 16 4 30z" fill="#efe3cd"/><path d="M-17 -100 h34 l10 34 h-54z" fill="${c.F}"/>` },
  // ---------- pillows ----------
  { id: 'square-pillow', name: 'square pillow', cats: ['pillow'], w: 66, h: 58, family: 'pillow', recolor: true, patterns: FABRIC,
    draw: (c) => `<path d="M-31 -55 q31 5 62 0 q-4 27 0 53 q-31 -5 -62 0 q4 -26 0 -53z" fill="${c.F}"/>` },
  { id: 'round-pillow', name: 'round pillow', cats: ['pillow'], w: 58, h: 58, family: 'pillow', recolor: true, patterns: FABRIC,
    draw: (c) => `<circle cx="0" cy="-29" r="28" fill="${c.F}"/><circle cx="0" cy="-29" r="4" fill="${c.dk}"/><path d="M0 -33 v-21 M0 -25 v21 M-4 -29 h-21 M4 -29 h21" stroke="${c.dk}" stroke-width="1" stroke-opacity="0.6"/>` },
  { id: 'tassel-pillow', name: 'tasselled pillow', cats: ['pillow'], w: 70, h: 58, family: 'pillow', recolor: true, patterns: FABRIC,
    draw: (c) => `<path d="M-29 -53 l-5 -4 M29 -53 l5 -4 M-29 -4 l-5 3 M29 -4 l5 3" stroke="${c.dk}" stroke-width="3"/><path d="M-29 -53 q29 5 58 0 q-4 24 0 49 q-29 -5 -58 0 q4 -24 0 -49z" fill="${c.F}"/>` },
  { id: 'lumbar-pillow', name: 'long pillow', cats: ['pillow'], w: 70, h: 40, family: 'pillow', recolor: true, patterns: FABRIC,
    draw: (c) => `<path d="M-35 -37 q35 5 70 0 q-4 17 0 35 q-35 -5 -70 0 q4 -17 0 -35z" fill="${c.F}"/>` },
  // ---------- wall ----------
  { id: 'landscape-frame', name: 'landscape picture', cats: ['wall'], w: 76, h: 58, family: 'wallart', recolor: true, tilt: true, patterns: ARTWORKS, art: true,
    draw: (c) => frame(c, 76, 58, 7) },
  { id: 'portrait-frame', name: 'portrait picture', cats: ['wall'], w: 60, h: 82, family: 'wallart', recolor: true, tilt: true, patterns: ARTWORKS, art: true,
    draw: (c) => frame(c, 60, 82, 8) },
  { id: 'small-frame', name: 'small picture', cats: ['wall'], w: 50, h: 60, family: 'wallart', recolor: true, tilt: true, patterns: ARTWORKS, art: true,
    draw: (c) => frame(c, 50, 60, 7) },
  { id: 'mirror', name: 'round mirror', cats: ['wall'], w: 68, h: 68, family: 'wallart', recolor: true,
    draw: (c) => `<circle cx="0" cy="-34" r="33" fill="${c.F}"/><circle cx="0" cy="-34" r="26" fill="#dfeef2"/><path d="M-14 -44 l10 -10 M-16 -34 l18 -18" stroke="#ffffff" stroke-width="3" stroke-opacity="0.8"/>` },
  { id: 'wall-clock', name: 'wall clock', cats: ['wall'], w: 60, h: 60, family: 'wallart', recolor: true,
    draw: (c) => { const a = vr(c.v, 4) * 6.28, b = vr(c.v, 5) * 6.28; return `<circle cx="0" cy="-30" r="29" fill="${c.F}"/><circle cx="0" cy="-30" r="23" fill="#fbf6ea"/>${[0, 1, 2, 3].map((i) => `<circle cx="${(Math.sin(i * 1.5708) * 18).toFixed(1)}" cy="${(-30 - Math.cos(i * 1.5708) * 18).toFixed(1)}" r="1.6" fill="${INK}" stroke="none"/>`).join('')}<path d="M0 -30 l${(Math.sin(a) * 11).toFixed(1)} ${(-Math.cos(a) * 11).toFixed(1)} M0 -30 l${(Math.sin(b) * 17).toFixed(1)} ${(-Math.cos(b) * 17).toFixed(1)}" stroke="${INK}" stroke-width="1.8"/>`; } },
  { id: 'wall-hanging', name: 'woven hanging', cats: ['wall'], w: 56, h: 84, family: 'wallart', recolor: true,
    draw: (c) => `<path d="M-26 -84 h52" stroke="${WOOD}" stroke-width="4"/><path d="M-22 -82 h44 v40 l-22 18 l-22 -18z" fill="${c.F}"/><path d="M-22 -70 h44 M-22 -60 h44" stroke="${c.lt}" stroke-width="3"/>${[-16, -8, 0, 8, 16].map((x) => `<path d="M${x} ${-40 + Math.abs(x) * 0.8} v${22 - Math.abs(x) * 0.5}" stroke="${c.dk}" stroke-width="2"/>`).join('')}` },
  { id: 'wall-plate', name: 'decorative plate', cats: ['wall'], w: 50, h: 50, family: 'wallart', recolor: true, patterns: CERAMIC,
    draw: (c) => `<circle cx="0" cy="-25" r="24" fill="#f6efe2"/><circle cx="0" cy="-25" r="17" fill="${c.F}"/><circle cx="0" cy="-25" r="7" fill="#f6efe2" stroke="none"/>` },
  // ---------- floor ----------
  { id: 'floor-plant', name: 'tall plant', cats: ['tallfloor'], w: 74, h: 140, family: 'tall', recolor: true, patterns: CERAMIC, flip: true,
    draw: (c) => `<g fill="${GREEN}" stroke="${GREEN_DK}"><path d="M0 -36 q-28 -26 -34 -70 q22 18 34 70z"/><path d="M2 -36 q10 -52 28 -86 q6 44 -28 86z"/><path d="M0 -36 q-8 -60 4 -104 q14 52 -4 104z"/><path d="M0 -36 q22 -18 36 -44 q-4 30 -36 44z"/></g><path d="${potPath(42, 36)}" fill="${c.F}"/>` },
  { id: 'guitar', name: 'guitar', cats: ['tallfloor'], w: 50, h: 146, family: 'tall', recolor: true, flip: true,
    draw: (c) => `<g transform="scale(0.91)"><g transform="rotate(8 0 0)"><rect x="-4" y="-156" width="8" height="90" fill="#6b4a34"/><rect x="-6" y="-160" width="12" height="16" rx="2" fill="#3a2a20"/><path d="M0 -76 q-22 0 -20 20 q2 10 -4 20 q-4 30 24 36 q28 -6 24 -36 q-6 -10 -4 -20 q2 -20 -20 -20z" fill="${c.F}"/><circle cx="0" cy="-42" r="7" fill="#2f2018"/><path d="M-8 -18 h16" stroke="#2f2018" stroke-width="3"/></g></g>` },
  { id: 'branch-vase', name: 'vase of branches', cats: ['tallfloor'], w: 56, h: 140, family: 'tall', recolor: true, patterns: CERAMIC,
    draw: (c) => `<g transform="scale(0.93)"><g stroke="#6b4a34" stroke-width="2" fill="none"><path d="M0 -50 q-6 -50 -24 -96 M-12 -100 l-12 -10"/><path d="M0 -50 q6 -60 22 -98 M14 -110 l12 -6"/><path d="M0 -50 v-92"/></g>${[[-24, -146], [22, -148], [0, -142], [-22, -110], [26, -116]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#f1c6c0" stroke="none"/>`).join('')}<path d="M-8 -54 h16 v6 q14 10 12 30 l-4 18 h-32 l-4 -18 q-2 -20 12 -30z" fill="${c.F}"/></g>` },
  { id: 'floor-lamp', name: 'floor lamp', cats: ['tallfloor'], w: 60, h: 146, family: 'tall', recolor: true, patterns: FABRIC,
    draw: (c) => `<g transform="scale(0.89)"><path d="M0 -120 v116" stroke="#3a3a40" stroke-width="4"/><ellipse cx="0" cy="-3" rx="20" ry="4" fill="#3a3a40"/><path d="M-18 -164 h36 l12 44 h-60z" fill="${c.F}"/></g>` },
  { id: 'basket', name: 'woven basket', cats: ['floor'], w: 68, h: 52, family: 'floorsoft', recolor: true, patterns: ['solid', 'stripes'],
    draw: (c) => `<path d="M-14 -44 a14 10 0 0 1 28 0" fill="none" stroke="${c.dk}" stroke-width="3"/><path d="M-32 -40 h64 l-6 40 h-52z" fill="${c.F}"/><path d="M-30 -28 h60 M-28 -16 h56" stroke="${c.dk}" stroke-width="1.2" stroke-opacity="0.6"/>` },
  { id: 'pouf', name: 'pouf', cats: ['floor'], w: 72, h: 46, family: 'floorsoft', recolor: true, patterns: FABRIC,
    draw: (c) => `<g transform="scale(0.947 1)"><path d="M-36 -36 q36 -16 72 0 v30 q-36 12 -72 0z" fill="${c.F}"/><ellipse cx="0" cy="-37" rx="36" ry="9" fill="${c.lt}"/></g>` },
  { id: 'floor-books', name: 'pile of books', cats: ['floor'], w: 58, h: 54, family: 'floorsoft', recolor: true,
    draw: (c) => [0, 1, 2, 3, 4].map((i) => `<rect x="${-27 + (i % 2) * 3 - (i === 3 ? 2 : 0)}" y="${-11 * (i + 1)}" width="${52 - i * 2}" height="10" rx="1.5" fill="${i === 2 ? c.F : spine(c.v, 20 + i)}"/>`).join('') },
  { id: 'slippers', name: 'pair of slippers', cats: ['floor'], w: 62, h: 18, family: 'floorsmall', recolor: true, flip: true,
    draw: (c) => `<path d="M-30 -2 q0 -12 14 -12 h12 q4 0 4 6 v6 q0 2 -4 2h-24 q-2 0 -2 -2z" fill="${c.F}"/><path d="M2 -2 q0 -14 14 -14 h12 q4 0 4 7 v7 q0 2 -4 2 h-24 q-2 0 -2 -2z" fill="${c.F}"/><path d="M-26 -8 h14 M6 -9 h14" stroke="${c.lt}" stroke-width="3"/>` },
];

export const KIND_BY_ID: ReadonlyMap<string, Kind> = new Map(KINDS.map((k) => [k.id, k]));

export function kindById(id: string): Kind {
  const k = KIND_BY_ID.get(id);
  if (!k) throw new Error(`unknown kind ${id}`);
  return k;
}

export function patternsOf(k: Kind): readonly string[] {
  return k.patterns ?? ['solid'];
}
