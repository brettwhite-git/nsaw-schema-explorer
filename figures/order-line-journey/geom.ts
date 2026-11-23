// Pure geometry: path strings, bridges where lines cross, text-width estimates. No DOM.
import type { Pt } from './model';

export const r1 = (n: number): number => Math.round(n * 10) / 10;
const p = (pt: Pt): string => `${r1(pt[0])} ${r1(pt[1])}`;

/** Mono advance is 0.6 em; tracking is in em. */
export const monoW = (s: string, px: number, tracking = 0): number => s.length * px * (0.6 + tracking);
/** Georgia-ish average advance. Estimates only: layouts leave slack. */
export const serifW = (s: string, px: number): number => s.length * px * 0.52;

export function lineTo(...pts: Pt[]): string {
  return `M${p(pts[0])}` + pts.slice(1).map((q) => `L${p(q)}`).join('');
}

/** Horizontal-tangent S-curve from a to b; xm is the x of the vertical middle (default halfway). */
export function sCurve(a: Pt, b: Pt, xm = (a[0] + b[0]) / 2): string {
  return `M${p(a)}C${r1(xm)} ${r1(a[1])} ${r1(xm)} ${r1(b[1])} ${p(b)}`;
}

/** Polyline with rounded corners (radius r), as one path. */
export function rounded(pts: Pt[], r = 4): string {
  let d = `M${p(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const k = Math.min(r, l1 / 2, l2 / 2);
    const p1: Pt = [b[0] + ((a[0] - b[0]) / l1) * k, b[1] + ((a[1] - b[1]) / l1) * k];
    const p2: Pt = [b[0] + ((c[0] - b[0]) / l2) * k, b[1] + ((c[1] - b[1]) / l2) * k];
    d += `L${p(p1)}Q${p(b)} ${p(p2)}`;
  }
  return d + `L${p(pts[pts.length - 1])}`;
}

export interface Seg { a: Pt; b: Pt }
export const segsOf = (pts: Pt[]): Seg[] => pts.slice(1).map((q, i) => ({ a: pts[i], b: q }));

/**
 * An axis-aligned polyline that hops over other lines: wherever it crosses a segment in `others`
 * it leaves a gap of `gap` px (the bridge). Returns a multi-subpath string.
 */
export function bridged(pts: Pt[], others: Seg[], gap = 6): string {
  const out: string[] = [];
  let pen = false;
  const emit = (pt: Pt, move: boolean) => { out.push(`${move || !pen ? 'M' : 'L'}${p(pt)}`); pen = true; };
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const horiz = Math.abs(a[1] - b[1]) < 0.01;
    const cuts: number[] = [];   // positions along the axis where another line crosses
    for (const o of others) {
      const oh = Math.abs(o.a[1] - o.b[1]) < 0.01;
      if (oh === horiz) continue;
      if (horiz) {
        const x = o.a[0];
        const lo = Math.min(a[0], b[0]), hi = Math.max(a[0], b[0]);
        const y0 = Math.min(o.a[1], o.b[1]), y1 = Math.max(o.a[1], o.b[1]);
        if (x > lo + gap / 2 + 0.5 && x < hi - gap / 2 - 0.5 && a[1] > y0 && a[1] < y1) cuts.push(x);
      } else {
        const y = o.a[1];
        const lo = Math.min(a[1], b[1]), hi = Math.max(a[1], b[1]);
        const x0 = Math.min(o.a[0], o.b[0]), x1 = Math.max(o.a[0], o.b[0]);
        if (y > lo + gap / 2 + 0.5 && y < hi - gap / 2 - 0.5 && a[0] > x0 && a[0] < x1) cuts.push(y);
      }
    }
    const dir = horiz ? Math.sign(b[0] - a[0]) : Math.sign(b[1] - a[1]);
    cuts.sort((m, n) => (m - n) * dir);
    emit(a, i === 1);
    for (const c of cuts) {
      const before: Pt = horiz ? [c - dir * gap / 2, a[1]] : [a[0], c - dir * gap / 2];
      const after: Pt = horiz ? [c + dir * gap / 2, a[1]] : [a[0], c + dir * gap / 2];
      out.push(`L${p(before)}`);
      out.push(`M${p(after)}`);
    }
    out.push(`L${p(b)}`);
  }
  return out.join('');
}

/** Wrap by estimated width into at most `max` lines (greedy). */
export function wrap(text: string, width: number, est: (s: string) => number, max = 3): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of text.split(' ')) {
    const t = cur ? `${cur} ${w}` : w;
    if (cur && est(t) > width) { out.push(cur); cur = w; } else cur = t;
  }
  if (cur) out.push(cur);
  if (out.length > max) { const keep = out.slice(0, max - 1); keep.push(out.slice(max - 1).join(' ')); return keep; }
  return out;
}

export const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/**
 * A rounded polyline whose straight runs hop over other lines: where a run crosses a segment in `others`
 * it leaves a gap (the bridge). The hopping line is the dashed one, so the gap reads as part of the stitching.
 */
export function roundedBridged(pts: Pt[], r: number, others: Seg[], gap = 6): string {
  const n = pts.length;
  const runs: { s: Pt; e: Pt }[] = [];
  const corners: { c: Pt; to: Pt }[] = [];
  let start: Pt = pts[0];
  for (let i = 1; i < n - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const k = Math.min(r, l1 / 2, l2 / 2);
    const p1: Pt = [b[0] + ((a[0] - b[0]) / l1) * k, b[1] + ((a[1] - b[1]) / l1) * k];
    const p2: Pt = [b[0] + ((c[0] - b[0]) / l2) * k, b[1] + ((c[1] - b[1]) / l2) * k];
    runs.push({ s: start, e: p1 });
    corners.push({ c: b, to: p2 });
    start = p2;
  }
  runs.push({ s: start, e: pts[n - 1] });
  let d = '';
  runs.forEach((run, i) => {
    if (i === 0) d += `M${p(run.s)}`;
    const horiz = Math.abs(run.s[1] - run.e[1]) < 0.01;
    const dir = horiz ? Math.sign(run.e[0] - run.s[0]) : Math.sign(run.e[1] - run.s[1]);
    const cuts: number[] = [];
    if (!horiz) {
      const lo = Math.min(run.s[1], run.e[1]), hi = Math.max(run.s[1], run.e[1]);
      for (const o of others) {
        if (Math.abs(o.a[1] - o.b[1]) > 0.01) continue;
        const y = o.a[1], x0 = Math.min(o.a[0], o.b[0]), x1 = Math.max(o.a[0], o.b[0]);
        if (run.s[0] > x0 - 0.5 && run.s[0] < x1 + 0.5 && y > lo + gap / 2 + 0.5 && y < hi - gap / 2 - 0.5) cuts.push(y);
      }
    }
    cuts.sort((m, q) => (m - q) * dir);
    for (const c of cuts) d += `L${p([run.s[0], c - (dir * gap) / 2])}M${p([run.s[0], c + (dir * gap) / 2])}`;
    d += `L${p(run.e)}`;
    if (corners[i]) d += `Q${p(corners[i].c)} ${p(corners[i].to)}`;
  });
  return d;
}
