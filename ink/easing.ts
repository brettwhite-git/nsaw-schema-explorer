// Easing and draw-in maths. Pure functions, no DOM: unit-tested.
import tokens from '../tokens.json';

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** CSS cubic-bezier(x1,y1,x2,y2) as a function of progress 0..1. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x;
      if (Math.abs(err) < 1e-6) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 40; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

function parseBezier(s: string): [number, number, number, number] {
  const m = /cubic-bezier\(([^)]+)\)/.exec(s);
  if (!m) throw new Error(`not a cubic-bezier: ${s}`);
  const v = m[1].split(',').map(Number);
  return [v[0], v[1], v[2], v[3]];
}

/** Rulebook strokes: cubic-bezier(.42,.05,.4,1). Read from tokens.json, never retyped. */
export const easeDraw = cubicBezier(...parseBezier(tokens.motion.easing.draw));
/** Rulebook text fade: cubic-bezier(.23,1,.32,1). */
export const easeText = cubicBezier(...parseBezier(tokens.motion.easing.text));

/** Local progress of an item that starts at t0 and lasts dur, at time t. Always 0..1. */
export function localProgress(t: number, t0: number, dur: number): number {
  if (dur <= 0) return t >= t0 ? 1 : 0;
  return clamp01((t - t0) / dur);
}

/** stroke-dashoffset for a pathLength=1 stroke at eased progress p (1 = undrawn, 0 = drawn). */
export function dashOffset(p: number): number {
  return 1 - clamp01(p);
}

/** Whole stitches only: progress snapped down to k/n. A thread is sewn one stitch at a time. */
export function stitchSteps(p: number, n: number): number {
  if (p >= 1) return 1;
  return Math.floor(clamp01(p) * n) / n;
}

/** Number of stitches along a thread of this length (rulebook: length / 9.5 px, at least 4). */
export function stitchCount(len: number): number {
  return Math.max(4, Math.round(len / tokens.line.thread.stitchPx));
}

/** Right inset (%) of the clip that opens a label left to right. */
export function labelInset(p: number): number {
  return (1 - clamp01(p)) * 100;
}
