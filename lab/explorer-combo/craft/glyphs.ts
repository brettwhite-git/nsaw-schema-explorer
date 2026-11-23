// Pen-and-ink glyphs for the explorer's object kinds. Drawn on a 48-unit grid, run through rough.js with a fixed seed
// per kind (the same drawing every render, nothing boils), one ink colour, hatching only where a glyph needs a shadow.
import rough from 'roughjs';

export type GlyphKind = 'fact' | 'dimension' | 'header' | 'lines' | 'hierarchy' | 'derived' | 'netsuite' | 'report' | 'subjectArea';
export const GLYPH_KINDS: GlyphKind[] = ['fact', 'dimension', 'header', 'lines', 'hierarchy', 'derived', 'netsuite', 'report', 'subjectArea'];

const NS = 'http://www.w3.org/2000/svg';
const G = 48;
const gen = rough.generator();

type Op =
  | { t: 'path'; d: string }
  | { t: 'ellipse'; cx: number; cy: number; w: number; h: number }
  | { t: 'hatchRect'; x0: number; y0: number; x1: number; y1: number; gap?: number }
  | { t: 'hatchCircle'; cx: number; cy: number; r: number; gap?: number };

const rect = (x: number, y: number, w: number, h: number): string => `M${x} ${y} H${x + w} V${y + h} H${x} Z`;
const circle = (cx: number, cy: number, r: number): string => {
  let d = '';
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI * 2 - 0.4; d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)} `; }
  return d + 'Z';
};
const DOC = 'M13 6 H30 L37 13 V42 H13 Z M30 6 V13 H37';

function cog(): string {
  const cx = 24, cy = 24, n = 8, ro = 18, ri = 13.6, pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, w = Math.PI / n;
    const at = (ang: number, r: number): string => `${(cx + Math.cos(ang) * r).toFixed(2)} ${(cy + Math.sin(ang) * r).toFixed(2)}`;
    pts.push(at(a - w * 0.62, ri), at(a - w * 0.42, ro), at(a + w * 0.42, ro), at(a + w * 0.62, ri));
  }
  return 'M' + pts.join(' L') + ' Z';
}

const SHAPES: Record<GlyphKind, Op[]> = {
  // a stack of three ledgers, spine marks on the left; the middle one shaded
  fact: [
    { t: 'path', d: rect(7, 11, 32, 9) + ' M13 11 V20' },
    { t: 'path', d: rect(11, 20, 31, 10) + ' M17 20 V30' },
    { t: 'path', d: rect(6, 30, 34, 10) + ' M12 30 V40' },
    { t: 'hatchRect', x0: 11, y0: 20, x1: 17, y1: 30, gap: 2.6 },
  ],
  // an index card: a top rule, a key hole, two lines of writing
  dimension: [
    { t: 'path', d: rect(5, 11, 38, 26) },
    { t: 'path', d: 'M5 18 H43' },
    { t: 'path', d: circle(13, 27, 3.4) },
    { t: 'path', d: 'M20 25 H37 M20 31 H31' },
  ],
  // a sheet with a shaded header band and two short lines under it
  header: [
    { t: 'path', d: DOC },
    { t: 'path', d: rect(17, 15, 16, 7) },
    { t: 'hatchRect', x0: 17, y0: 15, x1: 33, y1: 22, gap: 2.8 },
    { t: 'path', d: 'M17 29 H33 M17 35 H28' },
  ],
  // a sheet ruled with lines all the way down
  lines: [
    { t: 'path', d: DOC },
    { t: 'path', d: 'M17 17 H26 M17 23 H33 M17 29 H33 M17 35 H30' },
  ],
  // a small tree: a shaded root, two children, two grandchildren
  hierarchy: [
    { t: 'path', d: circle(24, 8, 4) },
    { t: 'hatchCircle', cx: 24, cy: 8, r: 4, gap: 2.4 },
    { t: 'path', d: 'M24 12 V17 M12 17 H36 M12 17 V21 M36 17 V21' },
    { t: 'path', d: circle(12, 25, 4) },
    { t: 'path', d: circle(36, 25, 4) },
    { t: 'path', d: 'M12 29 V33 M6 33 H18 M6 33 V36 M18 33 V36' },
    { t: 'path', d: circle(6, 40, 3.6) },
    { t: 'path', d: circle(18, 40, 3.6) },
  ],
  // a cog: made by the warehouse, not brought in
  derived: [
    { t: 'path', d: cog() },
    { t: 'path', d: circle(24, 24, 5.6) },
  ],
  // a database drum: the source system
  netsuite: [
    { t: 'ellipse', cx: 24, cy: 11, w: 26, h: 8 },
    { t: 'path', d: 'M11 11 V36 M37 11 V36' },
    { t: 'path', d: 'M11 36 C11 41.5 37 41.5 37 36' },
    { t: 'path', d: 'M11 23.5 C11 29 37 29 37 23.5' },
    { t: 'hatchRect', x0: 30, y0: 16, x1: 36, y1: 37, gap: 2.8 },
  ],
  // a bar chart on its axis, the tall bar shaded
  report: [
    { t: 'path', d: 'M7 7 V41 H42' },
    { t: 'path', d: rect(12, 25, 7, 16) },
    { t: 'path', d: rect(22, 13, 7, 28) },
    { t: 'hatchRect', x0: 22, y0: 13, x1: 29, y1: 41, gap: 2.8 },
    { t: 'path', d: rect(32, 30, 7, 11) },
  ],
  // a folder with its tab and pocket line
  subjectArea: [
    { t: 'path', d: 'M6 13 H19 L23 17 H42 V40 H6 Z' },
    { t: 'path', d: 'M6 22 H42' },
  ],
};

function seedOf(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) % 100000 + 1; }
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const ro = (seed: number) => ({ roughness: 0.55, bowing: 0.5, seed, disableMultiStroke: true, maxRandomnessOffset: 0.9, preserveVertices: false });

/** hatch hairlines at 45 deg ("/"), clipped to a rect or a circle, with a little hand jitter */
function hatch(op: Extract<Op, { t: 'hatchRect' | 'hatchCircle' }>, rnd: () => number): string {
  const gap = op.gap ?? 2.8, out: string[] = [];
  const [x0, y0, x1, y1] = op.t === 'hatchRect' ? [op.x0, op.y0, op.x1, op.y1] : [op.cx - op.r, op.cy - op.r, op.cx + op.r, op.cy + op.r];
  // lines x + y = c
  for (let c = x0 + y0 + gap * 0.6; c < x1 + y1; c += gap) {
    let ax: number, ay: number, bx: number, by: number;
    if (op.t === 'hatchRect') {
      ax = Math.max(x0, c - y1); ay = c - ax; bx = Math.min(x1, c - y0); by = c - bx;
      if (bx - ax < 0.8) continue;
    } else {
      // chord of x + y = c through the circle
      const k = (c - op.cx - op.cy) / Math.SQRT2, rr = op.r * 0.82;
      if (Math.abs(k) >= rr) continue;
      const h = Math.sqrt(rr * rr - k * k), mx = op.cx + k / Math.SQRT2, my = op.cy + k / Math.SQRT2;
      ax = mx - h / Math.SQRT2; ay = my + h / Math.SQRT2; bx = mx + h / Math.SQRT2; by = my - h / Math.SQRT2;
    }
    const j = (): number => (rnd() - 0.5) * 0.7, ins = 0.6;
    out.push(`M${(ax + ins + j()).toFixed(2)} ${(ay - ins + j()).toFixed(2)} L${(bx - ins + j()).toFixed(2)} ${(by + ins + j()).toFixed(2)}`);
  }
  return out.join(' ');
}

interface Drawn { ink: string; hatch: string }
const cache = new Map<GlyphKind, Drawn>();
function draw(kind: GlyphKind): Drawn {
  const hit = cache.get(kind); if (hit) return hit;
  const seed = seedOf(kind), rnd = mulberry(seed);
  const ink: string[] = [], hs: string[] = [];
  SHAPES[kind].forEach((op, i) => {
    const s = seed + i * 7;
    if (op.t === 'path') ink.push(gen.toPaths(gen.path(op.d, ro(s))).map((p) => p.d).join(' '));
    else if (op.t === 'ellipse') ink.push(gen.toPaths(gen.ellipse(op.cx, op.cy, op.w, op.h, { ...ro(s), curveStepCount: 14 })).map((p) => p.d).join(' '));
    else hs.push(hatch(op, rnd));
  });
  const r: Drawn = { ink: ink.join(' ').replace(/(\.\d\d)\d+/g, '$1'), hatch: hs.join(' ') };
  cache.set(kind, r); return r;
}

/** line weight in screen px: a hair heavier as the glyph grows, so the family keeps one weight */
const weightPx = (size: number): number => (size <= 18 ? 1.25 : size <= 26 ? 1.4 : 1.65);

export function glyph(kind: GlyphKind, size = 20, color = 'currentColor'): SVGSVGElement {
  const d = draw(SHAPES[kind] ? kind : 'fact');
  const unit = G / size, sw = weightPx(size) * unit;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${G} ${G}`);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('class', `glyph glyph-${kind}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', color);
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.dataset.kind = kind;
  const main = document.createElementNS(NS, 'path');
  main.setAttribute('d', d.ink); main.setAttribute('stroke-width', sw.toFixed(2)); main.setAttribute('stroke-opacity', '0.9');
  svg.appendChild(main);
  if (d.hatch) {
    const h = document.createElementNS(NS, 'path');
    h.setAttribute('d', d.hatch); h.setAttribute('stroke-width', (Math.max(0.65, weightPx(size) * 0.55) * unit).toFixed(2)); h.setAttribute('stroke-opacity', '0.62');
    svg.appendChild(h);
  }
  return svg;
}
