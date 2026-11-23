// Drawing kit for the entry-piece concept sketches (lab only). Static drawings in the house style:
// paper-filled faces, hairline hatching, rough.js outlines with fixed seeds, pencil for what the lineage file
// does not contain, ONE amber thread. Isometric helpers use the real engine, ink/iso.ts.
import { applyX, applyY, basisOf, faceFrame, faceQuad, planeAffine, project, visibleFaces, depthOf, type Affine, type Basis, type Box, type V3 } from '../../ink/iso';
import { hatchSegments } from '../../ink/hatch';
import { PENCIL, roughPath } from '../../ink/rough';
import { el } from '../../ink/svg';

export type Pt = [number, number];
export interface Callout { n: string; ax: number; ay: number; side: 'l' | 'r'; lines: string[]; sub?: string; pencil?: boolean; by?: number; accent?: boolean }

/** roughness is off while a drawing is being tweened between states (cost), on at rest */
export const flags = { rough: true };

export class Sketch {
  readonly g: SVGGElement;
  readonly paths: SVGPathElement[] = [];
  readonly callouts: Callout[] = [];
  bs: Basis;
  rough = flags.rough;
  private seed = 1;
  private bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
  cur: SVGElement;

  constructor(parent: SVGElement, bs: Basis | null = null) {
    this.g = el('g', { class: 'sk' }, parent);
    this.cur = this.g;
    this.bs = bs ?? basisOf({ yaw: 0, scale: 1, cx: 0, cy: 0 });
  }

  /** run `f` with new elements going into a group */
  group(cls: string, f: () => void): SVGGElement {
    const g = el('g', { class: cls }, this.cur);
    const prev = this.cur; this.cur = g; f(); this.cur = prev;
    return g;
  }

  track(x: number, y: number): void {
    const b = this.bb;
    if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
  }
  get bounds() { return this.bb; }

  private fm = (v: number): string => String(Math.round(v * 2) / 2);
  private dOf(pts: Pt[], close: boolean): string {
    return pts.map(([x, y], i) => (i ? 'L' : 'M') + this.fm(x) + ' ' + this.fm(y)).join('') + (close ? 'Z' : '');
  }

  /** a stroked path; `pencil` = documented-not-in-the-data */
  stroke(d: string, o: { w?: number; pencil?: boolean; cls?: string; amber?: boolean; rough?: boolean } = {}): SVGPathElement {
    const rd = this.rough && o.rough !== false ? roughPath(d, this.seed++, o.pencil ? PENCIL : undefined) : d;
    const cls = `ink${o.pencil ? ' pencil' : ''}${o.amber ? ' amber' : ''}${o.cls ? ' ' + o.cls : ''}`;
    const p = el('path', { class: cls, d: rd, 'stroke-width': o.w ?? (o.pencil ? 1.1 : 1.1), pathLength: 1 }, this.cur);
    this.paths.push(p);
    return p;
  }
  fill(d: string): SVGPathElement { return el('path', { class: 'pf', d }, this.cur); }

  poly(pts: Pt[], o: { fill?: boolean; w?: number; pencil?: boolean; close?: boolean; cls?: string; rough?: boolean } = {}): void {
    for (const [x, y] of pts) this.track(x, y);
    const close = o.close !== false;
    const d = this.dOf(pts, close);
    if (o.fill !== false && close) this.fill(d);
    this.stroke(d, { w: o.w, pencil: o.pencil, cls: o.cls, rough: o.rough });
  }
  line(pts: Pt[], o: { w?: number; pencil?: boolean; cls?: string; rough?: boolean; amber?: boolean } = {}): SVGPathElement {
    for (const [x, y] of pts) this.track(x, y);
    return this.stroke(this.dOf(pts, false), o);
  }
  /** hairline set of segments (hatching) as one path */
  hatch(d: string, pencil = false): void {
    if (!d) return;
    this.stroke(d, { w: 0.6, pencil, rough: false, cls: 'hairline' });
  }

  /** a dashed assembly line (not part of the draw-in) */
  dashed(pts: Pt[]): void {
    for (const [x, y] of pts) this.track(x, y);
    el('path', { class: 'axis', d: this.dOf(pts, false) }, this.cur);
  }

  text(x: number, y: number, s: string, cls = 'tx', anchor: 'start' | 'middle' | 'end' = 'start'): SVGTextElement {
    const t = el('text', { class: cls, x: this.fm(x), y: this.fm(y), 'text-anchor': anchor }, this.cur);
    t.textContent = s;
    return t;
  }

  // ------------------------------------------------------------------------------------------------ isometric

  setBasis(bs: Basis): void { this.bs = bs; }
  P(x: number, y: number, z: number): Pt { const s = project(this.bs, [x, y, z]); return [s[0], s[1]]; }
  depth(x: number, y: number, z: number): number { return depthOf(this.bs, x, y, z); }

  /** a box with paper-filled visible faces, hatched sides */
  box(b: { x: number; y: number; z: number; w: number; h: number; d: number }, o: { hatch?: number | false; pencil?: boolean; w?: number; top?: boolean; cls?: string } = {}): void {
    const box: Box = { x0: b.x, x1: b.x + b.w, y0: b.y, y1: b.y + b.h, z0: b.z, z1: b.z + b.d };
    for (const id of visibleFaces(this.bs)) {
      const q = faceQuad(this.bs, box, id) as Pt[];
      if (id === 'top' && o.top === false) continue;
      this.poly(q, { w: o.w, pencil: o.pencil, cls: o.cls });
      if (id !== 'top' && o.hatch !== false) {
        const ff = faceFrame(box, id);
        const m = planeAffine(this.bs, ff.o, ff.u, ff.v);
        const gap = typeof o.hatch === 'number' ? o.hatch : 1.9;
        this.hatch(this.segs(hatchSegments({ x0: 0, y0: 0, x1: ff.lu, y1: ff.lv }, 45, gap), m), o.pencil);
      }
    }
  }
  /** hatch segments (local coordinates) through an affine map, as one path string */
  segs(ss: number[][], m: Affine): string {
    let d = '';
    for (const s of ss) d += 'M' + this.fm(applyX(m, s[0], s[1])) + ' ' + this.fm(applyY(m, s[0], s[1])) + 'L' + this.fm(applyX(m, s[2], s[3])) + ' ' + this.fm(applyY(m, s[2], s[3]));
    return d;
  }

  /** polygon from world points */
  quad3(pts: V3[], o: { fill?: boolean; pencil?: boolean; w?: number; close?: boolean; cls?: string; rough?: boolean } = {}): void {
    this.poly(pts.map(([x, y, z]) => this.P(x, y, z)), o);
  }
  line3(pts: V3[], o: { pencil?: boolean; w?: number; cls?: string; rough?: boolean } = {}): SVGPathElement {
    return this.line(pts.map(([x, y, z]) => this.P(x, y, z)), o);
  }
  /** affine for a plane: local (u, v) -> screen */
  plane(o: V3, u: V3, v: V3): Affine { return planeAffine(this.bs, o, u, v); }
  /** local polygon through an affine map */
  localPoly(m: Affine, pts: Pt[], o: { fill?: boolean; pencil?: boolean; w?: number; close?: boolean; cls?: string } = {}): void {
    this.poly(pts.map(([u, v]) => [applyX(m, u, v), applyY(m, u, v)] as Pt), o);
  }
  localLine(m: Affine, pts: Pt[], o: { pencil?: boolean; w?: number; cls?: string } = {}): void {
    this.line(pts.map(([u, v]) => [applyX(m, u, v), applyY(m, u, v)] as Pt), o);
  }
  localHatch(m: Affine, rect: { x0: number; y0: number; x1: number; y1: number }, deg: number, gap: number, pencil = false): void {
    this.hatch(this.segs(hatchSegments(rect, deg, gap), m), pencil);
  }
  at(m: Affine, u: number, v: number): Pt { return [applyX(m, u, v), applyY(m, u, v)]; }

  dot(p: Pt, r = 2.3, cls = 'knot'): void {
    this.track(p[0], p[1]);
    el('circle', { class: cls, cx: this.fm(p[0]), cy: this.fm(p[1]), r }, this.cur);
  }

  // ------------------------------------------------------------------------------------------------ callouts

  callout(c: Callout): void { this.callouts.push(c); }
}

/** Sort drawables by depth (far first) and run them. Items are drawn after each other; nearer ones cover farther ones. */
export function paintFarToNear(items: { d: number; draw: () => void }[]): void {
  items.sort((a, b) => a.d - b.d).forEach((i) => i.draw());
}

/** Lay the callouts out left and right of the drawing: balloons in two columns, spread so nothing collides. */
export function layoutCallouts(sk: Sketch, svg: SVGElement, W: number, H: number, opts: { minGap?: number } = {}): { x0: number; x1: number } {
  const b = sk.bounds;
  const gap = opts.minGap ?? 50;
  const g = el('g', { class: 'callouts' }, svg);
  const colL = b.x0 - 30, colR = b.x1 + 30;
  for (const side of ['l', 'r'] as const) {
    const cs = sk.callouts.filter((c) => c.side === side).map((c) => ({ c, y: c.by ?? c.ay }));
    cs.sort((a, bb) => a.y - bb.y);
    let prev = 28 - gap;
    for (const it of cs) { it.y = Math.max(it.y, prev + gap); prev = it.y; }
    const over = prev - (H - 34);
    if (over > 0) { let shift = over; for (let k = cs.length - 1; k >= 0; k--) { cs[k].y -= shift; if (k > 0) shift = Math.max(0, cs[k - 1].y + gap - cs[k].y); } }
    for (const { c, y } of cs) {
      const bx = side === 'l' ? colL : colR;
      const line = el('path', { class: `ink leader${c.pencil ? ' pencil' : ''}${c.accent ? ' amber' : ''}`, d: `M${Math.round(c.ax)} ${Math.round(c.ay)}L${bx + (side === 'l' ? 12 : -12)} ${Math.round(y)}`, 'stroke-width': 0.6, pathLength: 1 }, g);
      sk.paths.push(line);
      el('circle', { class: c.accent ? 'knot amber-k' : 'knot', cx: Math.round(c.ax), cy: Math.round(c.ay), r: 2 }, g);
      const bg = el('g', { class: 'balloon' }, g);
      if (c.n) {
        el('circle', { cx: bx, cy: Math.round(y), r: 13, class: 'bl-c' }, bg);
        const nt = el('text', { class: 'bl-n', x: bx, y: Math.round(y) + 4, 'text-anchor': 'middle' }, bg);
        nt.textContent = c.n;
      }
      const tg = el('g', { class: c.accent ? 'bl-text amber-t' : 'bl-text' }, g);
      const tx = side === 'l' ? bx - 20 : bx + 20, anchor = side === 'l' ? 'end' : 'start';
      c.lines.forEach((ln, i) => {
        const t = el('text', { class: 'bl-l', x: tx, y: Math.round(y) - 2 + i * 15, 'text-anchor': anchor }, tg);
        t.textContent = ln;
      });
      if (c.sub) {
        const t = el('text', { class: 'bl-s', x: tx, y: Math.round(y) - 2 + c.lines.length * 15 + 1, 'text-anchor': anchor }, tg);
        t.textContent = c.sub;
      }
    }
  }
  return { x0: colL - 12, x1: colR + 12 };
}
