/** Named colours items can take. Names appear in reveal captions ("mustard → sage"). */
export const COLORS = {
  terracotta: '#c8643b',
  rust: '#9e452a',
  coral: '#ec8a6f',
  blush: '#ebbcae',
  rose: '#c9667e',
  mustard: '#d9a331',
  butter: '#f1d68c',
  sage: '#9db389',
  olive: '#6f7d45',
  forest: '#3f6b4f',
  teal: '#2f8080',
  'dusty blue': '#7d9cb8',
  navy: '#2d4263',
  lavender: '#aa9dc6',
  plum: '#7a4b6d',
  cream: '#f2e7d2',
  sand: '#d3b48c',
  cocoa: '#7b5640',
  charcoal: '#47454a',
  mint: '#b5d8c4',
} as const;

export type ColorName = keyof typeof COLORS;
export const COLOR_NAMES = Object.keys(COLORS) as ColorName[];

export function hex(name: ColorName): string {
  return COLORS[name];
}

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** amt in -1..1: negative darkens toward black, positive lightens toward white. */
export function shade(h: string, amt: number): string {
  const [r, g, b] = hexToRgb(h);
  if (amt < 0) return rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
  return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
}

export function luminance(h: string): number {
  const [r, g, b] = hexToRgb(h);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function toLab(h: string): [number, number, number] {
  const lin = (c: number) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(h).map(lin);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 colour difference. ~2.3 is a just-noticeable difference; 20+ is clearly different. */
export function deltaE(a: ColorName, b: ColorName): number {
  const [l1, a1, b1] = toLab(COLORS[a]);
  const [l2, a2, b2] = toLab(COLORS[b]);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}
