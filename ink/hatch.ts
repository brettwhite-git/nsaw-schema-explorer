// Hatching: parallel hairlines clipped to a rectangle, never a fill. Pure geometry.
import { mulberry32 } from './svg';

export interface Rect { x0: number; y0: number; x1: number; y1: number }
export type Segment = [number, number, number, number];

/** angle: degrees counter-clockwise from horizontal (45 = "/", 135 = "\"). Liang-Barsky clip per line. */
export function hatchSegments(r: Rect, angle: number, gap: number): Segment[] {
  const th = (angle * Math.PI) / 180;
  const dx = Math.cos(th), dy = -Math.sin(th), nx = -dy, ny = dx;
  const corners: [number, number][] = [[r.x0, r.y0], [r.x1, r.y0], [r.x0, r.y1], [r.x1, r.y1]];
  let lo = Infinity, hi = -Infinity;
  for (const [x, y] of corners) {
    const p = x * nx + y * ny;
    lo = Math.min(lo, p);
    hi = Math.max(hi, p);
  }
  const out: Segment[] = [];
  for (let c = lo + gap / 2; c < hi; c += gap) {
    const px = nx * c, py = ny * c;
    let t0 = -1e9, t1 = 1e9, ok = true;
    const tests: [number, number][] = [[-dx, px - r.x0], [dx, r.x1 - px], [-dy, py - r.y0], [dy, r.y1 - py]];
    for (const [p, q] of tests) {
      if (Math.abs(p) < 1e-9) { if (q < 0) ok = false; continue; }
      const t = q / p;
      if (p < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
    }
    if (ok && t1 - t0 > 0.5) out.push([px + dx * t0, py + dy * t0, px + dx * t1, py + dy * t1]);
  }
  return out;
}

/** Stipple dots on an offset grid with jitter from a fixed seed. */
export function stipplePoints(r: Rect, gap: number, seed: number): [number, number][] {
  const rnd = mulberry32(seed);
  const pts: [number, number][] = [];
  for (let y = r.y0 + gap / 2; y < r.y1; y += gap) {
    const odd = Math.round((y - r.y0) / gap) % 2 ? gap / 2 : 0;
    for (let x = r.x0 + gap / 2 + odd; x < r.x1; x += gap) {
      pts.push([x + (rnd() - 0.5) * 1.4, y + (rnd() - 0.5) * 1.4]);
    }
  }
  return pts;
}
