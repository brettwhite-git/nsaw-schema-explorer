// Shared pieces for the three sketches.
import { basisOf, project, type Basis, type V3 } from '../../ink/iso';
import type { Sketch, Pt } from './kit';
import { applyX, applyY, type Affine } from '../../ink/iso';

export interface Counts { records: number; tables: number; subjectAreas: number; twins: number; shownTables: number }

/** A camera whose scale fits the fully apart state and whose centre sits on the current state's bounding box. */
export function fitBasis(yaw: number, full: V3[], now: V3[], box: { w: number; h: number; cx: number; cy: number }): Basis {
  const probe = basisOf({ yaw, scale: 1, cx: 0, cy: 0 });
  const ext = (pts: V3[]) => {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of pts) { const s = project(probe, p); x0 = Math.min(x0, s[0]); x1 = Math.max(x1, s[0]); y0 = Math.min(y0, s[1]); y1 = Math.max(y1, s[1]); }
    return { x0, x1, y0, y1 };
  };
  const f = ext(full), n = ext(now);
  const scale = Math.min(box.w / (f.x1 - f.x0), box.h / (f.y1 - f.y0));
  const cx = box.cx - ((n.x0 + n.x1) / 2) * scale;
  const cy = box.cy - ((n.y0 + n.y1) / 2) * scale;
  return basisOf({ yaw, scale, cx, cy });
}

/** A seated-or-standing person as a plain outline in a plane (u across, v up). Pencil: it is an illustration. */
export function person(sk: Sketch, m: Affine, u: number, v: number, s = 1): void {
  const P = (a: number, b: number): Pt => [applyX(m, u + a * s, v + b * s), applyY(m, u + a * s, v + b * s)];
  const head: Pt[] = [];
  for (let i = 0; i < 10; i++) { const t = (i / 10) * Math.PI * 2; head.push(P(2.4 * Math.cos(t), 15.5 + 2.4 * Math.sin(t))); }
  sk.poly(head, { pencil: true, w: 1.1 });
  sk.line([P(0, 13), P(0, 5)], { pencil: true });
  sk.line([P(-3.5, 11), P(0, 12), P(3.5, 11)], { pencil: true });
  sk.line([P(0, 5), P(-2.5, 0)], { pencil: true });
  sk.line([P(0, 5), P(2.5, 0)], { pencil: true });
}

/** A keyed gate: two posts, a bar and a keyhole. Security, documented by Oracle (pencil). */
export function gate(sk: Sketch, m: Affine, u: number, v: number, w: number, h: number): void {
  const P = (a: number, b: number): Pt => [applyX(m, u + a, v + b), applyY(m, u + a, v + b)];
  sk.line([P(0, 0), P(0, h)], { pencil: true, w: 1.3 });
  sk.line([P(w, 0), P(w, h)], { pencil: true, w: 1.3 });
  sk.line([P(0, h * 0.62), P(w, h * 0.62)], { pencil: true, w: 1.3 });
  const c: Pt[] = [];
  for (let i = 0; i < 10; i++) { const t = (i / 10) * Math.PI * 2; c.push(P(w / 2 + 1.7 * Math.cos(t), h * 0.62 + 1.7 * Math.sin(t))); }
  sk.poly(c, { pencil: true, w: 1 });
  sk.line([P(w / 2, h * 0.62 - 1.7), P(w / 2, h * 0.62 - 4)], { pencil: true, w: 1 });
}

/** An amber thread of segments. Solid where the lineage states it, pencil where the deck or Oracle documents it. */
export interface ThreadSeg { pts: Pt[]; pencil: boolean; arrow?: boolean }
export function drawThread(sk: Sketch, segs: ThreadSeg[]): void {
  sk.group('thread', () => {
    for (const s of segs) {
      sk.line(s.pts, { amber: true, pencil: s.pencil, w: s.pencil ? 1.5 : 1.7, rough: false });
      if (s.arrow) {
        const a = s.pts[s.pts.length - 2], b = s.pts[s.pts.length - 1];
        const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
        sk.line([[b[0] - ux * 9 + uy * 5, b[1] - uy * 9 - ux * 5], b, [b[0] - ux * 9 - uy * 5, b[1] - uy * 9 + ux * 5]], { amber: true, w: 1.7, rough: false });
      }
    }
    const first = segs[0].pts[0];
    sk.dot(first, 3.2, 'knot amber-k');
  });
}
