import { ITEM_SCALE, kh, kindById, kw, type DrawCtx } from './catalog';
import { hex, luminance, shade } from './palette';
import { slotById } from './layout';
import type { Item, Scene } from './room';

const INK = '#4a3426';

function patternDef(id: string, pattern: string, base: string, acc: string): string {
  const open = (w: number, h: number, extra = '') => `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="${h}"${extra}><rect width="${w}" height="${h}" fill="${base}"/>`;
  switch (pattern) {
    case 'stripes':
      return `${open(10, 10)}<rect width="4" height="10" fill="${acc}"/></pattern>`;
    case 'dots':
      return `${open(10, 10)}<circle cx="5" cy="5" r="2" fill="${acc}"/></pattern>`;
    case 'check':
      return `${open(14, 14)}<rect width="7" height="14" fill="${acc}" fill-opacity="0.55"/><rect width="14" height="7" fill="${acc}" fill-opacity="0.55"/></pattern>`;
    case 'zigzag':
      return `${open(12, 10)}<path d="M0 7 l3 -4 l3 4 l3 -4 l3 4" fill="none" stroke="${acc}" stroke-width="2"/></pattern>`;
    default:
      return '';
  }
}

export function drawCtx(item: Item): { ctx: DrawCtx; defs: string } {
  const k = kindById(item.kind);
  const c = hex(item.color);
  const light = luminance(c) > 0.62;
  const acc = light ? shade(c, -0.35) : shade(c, 0.62);
  const usesFill = !k.art && item.pattern !== 'solid';
  const pid = `pat-${item.id}`;
  const defs = usesFill ? patternDef(pid, item.pattern, c, acc) : '';
  return {
    ctx: { F: usesFill ? `url(#${pid})` : c, c, dk: shade(c, -0.28), lt: shade(c, 0.35), acc, v: item.v, pattern: item.pattern },
    defs,
  };
}

/** One item as an SVG group, positioned at its slot. */
export function renderItem(item: Item): string {
  const k = kindById(item.kind);
  const s = slotById(item.slot);
  const { ctx, defs } = drawCtx(item);
  const h = kh(k);
  const pivotY = s.hanging ? -h : 0;
  const rot = item.rot ? ` rotate(${item.rot} 0 ${pivotY})` : '';
  const flip = item.flip ? ' scale(-1 1)' : '';
  const nail = s.hanging ? `<path d="M-10 ${-h} l10 -10 l10 10" fill="none" stroke="#8a7560" stroke-width="1"/><circle cx="0" cy="${-h - 10}" r="1.8" fill="#6a5a4a" stroke="none"/>` : '';
  const shadow = s.hanging ? '' : `<ellipse cx="0" cy="0" rx="${(kw(k) * 0.45).toFixed(1)}" ry="3" fill="#2a1a10" fill-opacity="0.16" stroke="none"/>`;
  return `<g class="it" data-id="${item.id}" transform="translate(${s.x} ${s.y})" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${defs ? `<defs>${defs}</defs>` : ''}${shadow}<g${rot ? ` transform="${rot.trim()}"` : ''}>${nail}<g transform="scale(${ITEM_SCALE})${flip}">${k.draw(ctx)}</g></g></g>`;
}

export function renderItems(scene: Scene): string {
  // Wall first, then back-to-front by baseline so nothing in front is overdrawn.
  return [...scene.items]
    .sort((a, b) => slotById(a.slot).y - slotById(b.slot).y)
    .map(renderItem)
    .join('');
}

export interface Ambience {
  sky: [string, string];
  /** 0 = daylight, 1 = deep night */
  dark: number;
}

/** The window light cycles day → golden hour → dusk → night → morning as rounds go by. */
export function ambienceFor(round: number): Ambience {
  const phases: Ambience[] = [
    { sky: ['#a9d6ee', '#e3f1f7'], dark: 0 },
    { sky: ['#9fc9e6', '#f6e3c0'], dark: 0.05 },
    { sky: ['#f2b179', '#f9dcae'], dark: 0.12 },
    { sky: ['#8a6fa8', '#efa58a'], dark: 0.25 },
    { sky: ['#2f3a64', '#6a5b8e'], dark: 0.42 },
    { sky: ['#1b2343', '#2f3a64'], dark: 0.5 },
    { sky: ['#5a6fa0', '#f2c7a6'], dark: 0.2 },
  ];
  return phases[Math.floor((Math.max(1, round) - 1) / 3) % phases.length];
}

/** Furniture, walls and floor. Static within a round. */
export function renderRoom(amb: Ambience): string {
  const stars = amb.dark > 0.35
    ? [[470, 100], [520, 130], [610, 95], [660, 150], [560, 180], [490, 220]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3" fill="#fff8dc"/>`).join('') + `<circle cx="640" cy="120" r="12" fill="#fbf1cf"/><circle cx="646" cy="116" r="11" fill="${amb.sky[0]}"/>`
    : `<g fill="#ffffff" fill-opacity="0.75"><ellipse cx="500" cy="140" rx="34" ry="10"/><ellipse cx="520" cy="132" rx="20" ry="10"/><ellipse cx="640" cy="200" rx="26" ry="8"/></g>`;
  const planks = Array.from({ length: 7 }, (_, i) => `<path d="M0 ${590 + i * 34} H1000" stroke="#94643f" stroke-width="1.4" opacity="0.5"/>`).join('') +
    Array.from({ length: 16 }, (_, i) => { const row = i % 7; const x = (i * 197) % 1000; return `<path d="M${x} ${572 + row * 34} v34" stroke="#94643f" stroke-width="1.2" opacity="0.5"/>`; }).join('');
  const wallStripes = Array.from({ length: 25 }, (_, i) => `<rect x="${i * 40 + 18}" y="0" width="4" height="548" fill="#e9d6b8" opacity="0.55"/>`).join('');
  const shelfBoards = [180, 290, 400, 510].map((y) => `<rect x="36" y="${y}" width="252" height="10" fill="#9a6a45" stroke="${INK}" stroke-width="1.5"/>`).join('');
  return `
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${amb.sky[0]}"/><stop offset="1" stop-color="${amb.sky[1]}"/></linearGradient>
  <radialGradient id="lampglow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffd98a" stop-opacity="0.55"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
  <pattern id="rugpat" patternUnits="userSpaceOnUse" width="40" height="20"><rect width="40" height="20" fill="#c9785a"/><path d="M0 10 l10 -7 l10 7 l10 -7 l10 7" fill="none" stroke="#f0d9b5" stroke-width="2"/></pattern>
</defs>
<rect width="1000" height="560" fill="#f2e2c8"/>
${wallStripes}
<rect y="546" width="1000" height="16" fill="#e2c9a4" stroke="${INK}" stroke-width="1.2"/>
<rect y="562" width="1000" height="238" fill="#b98457"/>
${planks}
<!-- window -->
<rect x="428" y="68" width="276" height="264" rx="4" fill="#f5eee0" stroke="${INK}" stroke-width="2"/>
<rect x="442" y="82" width="248" height="236" fill="url(#sky)"/>
${stars}
<path d="M566 82 v236 M442 200 h248" stroke="#f5eee0" stroke-width="8"/>
<rect x="442" y="82" width="248" height="236" fill="none" stroke="${INK}" stroke-width="1.5"/>
<path d="M404 56 h324" stroke="#7a5236" stroke-width="5" stroke-linecap="round"/>
<path d="M408 58 q20 140 4 300 h34 q-8 -150 4 -300z" fill="#c55f45" stroke="${INK}" stroke-width="1.5"/>
<path d="M724 58 q-20 140 -4 300 h-34 q8 -150 -4 -300z" fill="#c55f45" stroke="${INK}" stroke-width="1.5"/>
<rect x="418" y="331" width="296" height="14" rx="3" fill="#efe5d2" stroke="${INK}" stroke-width="1.5"/>
<!-- floating shelf -->
<rect x="306" y="350" width="110" height="8" rx="2" fill="#9a6a45" stroke="${INK}" stroke-width="1.5"/>
<!-- bookcase -->
<rect x="22" y="62" width="280" height="510" rx="4" fill="#8a5a3c" stroke="${INK}" stroke-width="2"/>
<rect x="36" y="76" width="252" height="444" fill="#6a432d"/>
${shelfBoards}
<rect x="28" y="524" width="268" height="44" rx="2" fill="#7a4e34" stroke="${INK}" stroke-width="1.5"/>
<path d="M126 546 h72" stroke="#d7b98a" stroke-width="4" stroke-linecap="round"/>
<!-- rug -->
<ellipse cx="512" cy="712" rx="390" ry="74" fill="url(#rugpat)" stroke="${INK}" stroke-width="1.5"/>
<ellipse cx="512" cy="712" rx="350" ry="58" fill="none" stroke="#f0d9b5" stroke-width="3"/>
<!-- couch -->
<rect x="342" y="392" width="436" height="116" rx="28" fill="#5d7f78" stroke="${INK}" stroke-width="2"/>
<rect x="356" y="488" width="408" height="60" rx="14" fill="#6b8f87" stroke="${INK}" stroke-width="2"/>
<path d="M560 492 v54" stroke="${INK}" stroke-width="1.5" opacity="0.6"/>
<rect x="316" y="440" width="58" height="140" rx="22" fill="#5d7f78" stroke="${INK}" stroke-width="2"/>
<rect x="746" y="440" width="58" height="140" rx="22" fill="#5d7f78" stroke="${INK}" stroke-width="2"/>
<rect x="340" y="546" width="440" height="34" rx="8" fill="#55746d" stroke="${INK}" stroke-width="2"/>
<path d="M350 580 l-4 16 M770 580 l4 16" stroke="#5a3a26" stroke-width="6" stroke-linecap="round"/>
<!-- side table -->
<rect x="826" y="466" width="128" height="13" rx="3" fill="#a87650" stroke="${INK}" stroke-width="1.6"/>
<path d="M838 479 v110 M942 479 v110" stroke="#8a5a3c" stroke-width="7" stroke-linecap="round"/>
<rect x="836" y="546" width="108" height="9" rx="2" fill="#a87650" stroke="${INK}" stroke-width="1.4"/>
<!-- coffee table -->
<path d="M318 628 l-6 72 M706 628 l6 72 M360 628 l-2 58 M664 628 l2 58" stroke="#7a4e34" stroke-width="8" stroke-linecap="round"/>
<rect x="296" y="610" width="432" height="20" rx="8" fill="#b07a50" stroke="${INK}" stroke-width="2"/>
<path d="M312 616 h400" stroke="#c99a6e" stroke-width="2" opacity="0.8"/>
`;
}

/** Overlay that dims the room for evening rounds; lamps get a halo. */
export function renderLighting(amb: Ambience, scene: Scene): string {
  if (amb.dark <= 0.02) return '';
  const halos = scene.items
    .filter((i) => i.kind === 'table-lamp' || i.kind === 'floor-lamp' || i.kind === 'lantern' || i.kind.includes('candle'))
    .map((i) => {
      const s = slotById(i.slot);
      const k = kindById(i.kind);
      const r = i.kind.includes('lamp') ? 150 : 50;
      return `<circle cx="${s.x}" cy="${s.y - kh(k) * 0.75}" r="${r}" fill="url(#lampglow)"/>`;
    })
    .join('');
  return `<rect width="1000" height="800" fill="#1a1030" opacity="${amb.dark}" pointer-events="none"/>${halos}`;
}
