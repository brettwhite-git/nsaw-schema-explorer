// Shared scene kit: a scene is an ordered list of flat polygons and polylines. Every renderer paints the same list.
import { Rng, mix } from './rng';

export type Mat = 'sky' | 'mist' | 'far' | 'rock' | 'snow' | 'pine' | 'wall' | 'roof' | 'glass' | 'trim' | 'glaze'
  | 'gold' | 'plum' | 'glow' | 'wood' | 'skin' | 'cloth' | 'metal' | 'box' | 'ribbon' | 'stone' | 'plant';
export interface Poly { k: 'poly'; pts: number[]; fill: string; mat: Mat; lay: number; ink?: number; knock?: number; load?: number; alpha?: number; grad?: [string, string]; lift?: number; fine?: number; layers?: number; lit?: boolean; }
export interface Line { k: 'line'; pts: number[]; col: string; w: number; a: number; lay: number; }
export type Item = Poly | Line;
export interface Scene { w: number; h: number; seed: number; items: Item[]; skyStops: [number, string][]; }

export const PAL = {
  wall: '#EEA8B7', wallSh: '#CC8A9E', wallHi: '#F5C9CF', cream: '#F6E6CD', creamSh: '#D9BFAE', roof: '#7B8BA8', roofSh: '#58668A', roofHi: '#9AA8C0',
  glass: '#4A4565', glassLit: '#FFCF78', gold: '#D6A03C', plum: '#5A2D4B', rasp: '#EE3A5E', snow: '#F6F1F4', snowSh: '#B3B1D2',
  rock: '#8E8499', rockSh: '#5E5672', pine: '#3F5C59', pineSh: '#2A4247', ink: '#3A2A3C', stone: '#C9B4B8', sky: '#7DB5DD', pink: '#F3C6CE',
};

export type Pt = [number, number];
export const flat = (p: Pt[]): number[] => p.flatMap((q) => q);
export function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 16): Pt[] {
  const o: Pt[] = [];
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return o;
}
/** Catmull-Rom spline through points, for organic shapes (figures, drapery). */
export function smooth(p: Pt[], closed = true, n = 6): Pt[] {
  const o: Pt[] = [], L = p.length;
  const g = (i: number): Pt => (closed ? p[(i + L) % L] : p[Math.max(0, Math.min(L - 1, i))]);
  const segs = closed ? L : L - 1;
  for (let i = 0; i < segs; i++) {
    const a = g(i - 1), b = g(i), c = g(i + 1), d = g(i + 2);
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      o.push([0.5 * (2 * b[0] + (-a[0] + c[0]) * t + (2 * a[0] - 5 * b[0] + 4 * c[0] - d[0]) * t2 + (-a[0] + 3 * b[0] - 3 * c[0] + d[0]) * t3),
        0.5 * (2 * b[1] + (-a[1] + c[1]) * t + (2 * a[1] - 5 * b[1] + 4 * c[1] - d[1]) * t2 + (-a[1] + 3 * b[1] - 3 * c[1] + d[1]) * t3)]);
    }
  }
  if (!closed) o.push(p[L - 1]);
  return o;
}
export function archPts(cx: number, yb: number, w: number, h: number, n = 10): Pt[] {
  const r = w / 2, ys = yb - h + r;
  return [[cx - r, yb], [cx - r, ys], ...arc(cx, ys, r, r, Math.PI, 2 * Math.PI, n).slice(1, -1), [cx + r, ys], [cx + r, yb]];
}
export function bays(x0: number, x1: number, n: number): number[] {
  const sp = (x1 - x0) / n; return Array.from({ length: n }, (_, i) => x0 + (i + 0.5) * sp);
}
export const shade = (c: string, t: number): string => mix(c, '#4C3A68', t);
export const lighten = (c: string, t: number): string => mix(c, '#FFF3DC', t);

export class Kit {
  items: Item[] = [];
  lay = 0;
  constructor(public rng: Rng) {}
  next(): number { return ++this.lay; }
  poly(p: Pt[] | number[], fill: string, mat: Mat, o: Partial<Poly> = {}): void {
    const pts = typeof p[0] === 'number' ? (p as number[]) : flat(p as Pt[]);
    this.items.push({ k: 'poly', pts, fill, mat, lay: this.lay, ...o });
  }
  rect(x: number, y: number, w: number, h: number, fill: string, mat: Mat, o: Partial<Poly> = {}): void {
    this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill, mat, o);
  }
  line(p: Pt[], col: string, w = 1, a = 0.6): void { this.items.push({ k: 'line', pts: flat(p), col, w, a, lay: this.lay }); }
  glaze(p: Pt[], col = PAL.snowSh, a = 0.35): void { this.poly(p, col, 'glaze', { alpha: a, knock: 0 }); }
}
