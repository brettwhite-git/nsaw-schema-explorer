// The stage every scene shares: size, scale, and the RESERVED ZONES of the shared furniture.
// Pure geometry, no DOM.
//
// Landscape design box 1200 x 780 (16:10-ish), scaled by k = min(w/1200, h/780) and centred:
//   12-column grid, outer margin 40. Scene area: x 24..928, y 24..730 (the scene's own drawing, headline, call-outs).
//   Right column (x 944..1160, columns 11-12): the furniture.
//     pins      944,  24, 216 x 152   the three pinned questions (handwritten, small, quiet)
//     locator   944, 188, 216 x  62   "where we are": the five-layer section, current layer marked
//     ledger    944, 262, 216 x 380   one ruled line per finished scene
//     legend     36, 738, 1128 x 28   the three line styles, and the one illustration note
//   A scene may use the whole of x 24..928 (y 24..730); nothing of a scene may enter a furniture zone.
//   The forward pose of a question (it comes to the stage when a scene asks it) is the strip x 480..920, y 24..100.
// Portrait design box 343 x 920: pins and locator in a top strip, the ledger and legend in a bottom band, the scene between.
export interface Rect { x: number; y: number; w: number; h: number }
export interface Stage { w: number; h: number }
export type Kind = 'landscape' | 'portrait';

/** below this width the tall composition is used (phones, tablets held upright) */
export const PORTRAIT_BELOW = 0;   // style C: one composition at every width (portrait is not redrawn; see DESIGN.md 8.9)
export const PORTRAIT_MAX_W = 440;
export const LANDSCAPE_DESIGN = { w: 1200, h: 780 };
export const PORTRAIT_DESIGN = { w: 343, h: 920 };

export const kindOf = (s: Stage): Kind => (s.w < PORTRAIT_BELOW ? 'portrait' : 'landscape');

export function stageFor(width: number): Stage {
  const w = Math.max(280, Math.floor(width));
  if (w < PORTRAIT_BELOW) { const pw = Math.min(w, PORTRAIT_MAX_W); return { w: pw, h: Math.round((pw * PORTRAIT_DESIGN.h) / PORTRAIT_DESIGN.w) }; }
  const lw = Math.min(1200, w);
  return { w: lw, h: Math.round((lw * LANDSCAPE_DESIGN.h) / LANDSCAPE_DESIGN.w) };
}

export interface Metrics {
  kind: Kind; stage: Stage; k: number; ox: number; oy: number; margin: number;
  X(v: number): number; Y(v: number): number; S(v: number): number; R(x: number, y: number, w: number, h: number): Rect;
  /** a font size from a design size: scaled, never under the floor */
  F(v: number, floor?: number): number;
}

export function metrics(stage: Stage): Metrics {
  const kind = kindOf(stage);
  const d = kind === 'portrait' ? PORTRAIT_DESIGN : LANDSCAPE_DESIGN;
  const k = Math.min(stage.w / d.w, stage.h / d.h);
  const ox = (stage.w - d.w * k) / 2, oy = (stage.h - d.h * k) / 2;
  return {
    kind, stage, k, ox, oy, margin: (kind === 'portrait' ? 6 : 24) * k,
    X: (v) => ox + v * k, Y: (v) => oy + v * k, S: (v) => v * k,
    R: (x, y, w, h) => ({ x: ox + x * k, y: oy + y * k, w: w * k, h: h * k }),
    F: (v, floor = 10) => Math.max(floor, Math.round(v * k * 2) / 2),
  };
}

export interface Zones {
  pins: Rect; locator: Rect; ledger: Rect; legend: Rect;
  /** the strip a question occupies when it is brought forward */
  forward: Rect;
  /** where the scene's headline goes */
  headline: Rect;
}

export function zonesFor(m: Metrics): Zones {
  const R = m.R;
  return {
    pins: R(536, 18, 616, 44), locator: R(1118, 330, 42, 54), ledger: R(820, 610, 340, 124), legend: R(36, 738, 900, 28),
    forward: R(60, 40, 620, 100), headline: R(60, 64, 880, 100),
  };
}

export const overlaps = (a: Rect, b: Rect, gap = 0): boolean => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
export const inside = (r: Rect, w: number, h: number, mg: number): boolean => r.x >= mg - 0.01 && r.y >= mg - 0.01 && r.x + r.w <= w - mg + 0.01 && r.y + r.h <= h - mg + 0.01;
export const aabb = (pts: [number, number][]): Rect => {
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** a labelled box: what the tests look at */
export interface Box { id: string; kind: string; rect: Rect }

export const MONO_ADV = 0.6;
export const monoWidth = (text: string, size: number, track = 0): number => text.length * size * (MONO_ADV + track);
export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
/** progress of a window [t0, dur] at time t */
export const win = (t: number, w: readonly [number, number]): number => (w[1] <= 0 ? (t >= w[0] ? 1 : 0) : clamp01((t - w[0]) / w[1]));
