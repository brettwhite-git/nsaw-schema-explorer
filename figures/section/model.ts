// The Entry section: the pure model. No DOM. The camera, the beats, the reveal windows, the closing of the risers, the
// level-of-detail rules, the travelling row marks and the accent are all pure functions of scroll progress p (0..1) and
// the stage size, so scrolling back reverses everything exactly and the tests can check every beat.
//
// WORLD (units; y grows DOWN, the ground is y = 0 and the section climbs into negative y):
//   four bands, bottom to top: 0 NetSuite, 1 Ingestion, 2 Warehouse, 3 Model. Each band is BW wide and BH tall.
//   Between two bands is a RISER (RISER units, more than half a band) where threads and rows travel. At the end the
//   risers CLOSE to a thin seam (SEAM) as the camera pulls back, so the five parts settle into one assembled section.
//   The two doors stand on the right edge, door one on the warehouse band and door two on the model band, and move
//   with their bands.

// ================================================================================================ TIMING (tune here)
// Everything about how the piece feels in the hand lives in this block. Progress runs 0..1 over the scroll track; the
// numbers below are RELATIVE lengths (they are normalised so they always sum to 1), so lengthening one shortens the
// others. Change a number, reload, scroll. `?debug=1` shows progress, beat and camera scale while you tune.
export const TIMING = {
  /** the scroll track is this many viewport heights tall (the longer, the slower every move) */
  trackViewports: 8,
  /** how long the camera rests on each stop (the band draws in while it rests) */
  dwell: { ground: 0.03, b0: 0.085, b1: 0.09, b2: 0.12, b3: 0.11, doors: 0.07, doorEach: 0.045, final: 0.05 },
  /** how long each camera move takes. The risers are the long ones: the order line is drawn while the camera crosses */
  pan: { toB0: 0.04, riser: 0.11, toDoors: 0.07, betweenDoors: 0.05, assemble: 0.11 },
  /** every move eases in and out; 'smoother' is the quintic (gentler start and stop), 'smooth' the cubic */
  ease: 'smoother' as 'smooth' | 'smoother',
  /** the part of a riser pan (from its start) after which the next band starts to draw */
  bandStartsAt: 0.4,
  /** the part of a dwell (from its start) by which a band has finished drawing */
  bandDoneAt: 0.55,
};

export function clamp01(t: number): number { return t < 0 ? 0 : t > 1 ? 1 : t; }

export const X0 = 260;
export const BW = 380;
export const X1 = X0 + BW;
export const BH = 200;
export const RISER = 120;
/** the seam between two bands once the section is assembled */
export const SEAM = 10;
export const STEP = BH + RISER;
export const BANDS = 4;

/** Riser height when the risers are `c` closed (0 = open, 1 = a thin seam). */
export const riserAt = (c: number): number => RISER + (SEAM - RISER) * clamp01(c);
export const bandBottom = (i: number, c = 0): number => -i * (BH + riserAt(c)) + 0;
export const bandTop = (i: number, c = 0): number => bandBottom(i, c) - BH;
export const bandMid = (i: number, c = 0): number => bandBottom(i, c) - BH / 2;
export const WORLD_TOP = bandTop(3) - 40;
/** Downward shift of band i (in open coordinates) when the risers are `c` closed. */
export const shiftAt = (i: number, c: number): number => i * (RISER - riserAt(c));

export interface Stage { w: number; h: number }
export const isNarrow = (st: Stage): boolean => st.w < 540;
export const isWide = (st: Stage): boolean => st.w >= 900;

/** Text is never smaller than this many pixels on screen, after the camera's scale. */
export const MIN_TEXT_PX = 10;
/** Every label inside the drawing is set at this world size. */
export const FONT_WORLD = 12.5;
export const TEXT_MIN_SCALE = MIN_TEXT_PX / FONT_WORLD;
/** Small quiet labels (the nine groups of the model band) are set at 10 world units and so need scale >= 1. */
export const FONT_SMALL = 10;
export const SMALL_MIN_SCALE = MIN_TEXT_PX / FONT_SMALL;
/** The band names drawn inside the assembled section (set large so they reach the minimum when pulled back). */
export const FONT_NAME = 22;
export const NAME_MIN_SCALE = MIN_TEXT_PX / FONT_NAME;

// ------------------------------------------------------------------------------------------------ camera

export interface Cam { cx: number; cy: number; s: number }
export type KeyName = 'g' | 'b0' | 'b1' | 'b2' | 'b3' | 'doors' | 'doorA' | 'doorB' | 'fit';

export function closeScale(st: Stage): number {
  if (isNarrow(st)) return Math.max(TEXT_MIN_SCALE + 0.01, Math.min((st.w * 0.92) / BW, (st.h * 0.6) / BH));
  return Math.min((st.w * 0.6) / BW, (st.h * 0.62) / BH);
}
/** The doors beat (wide stages) frames both doors and the two bands they open from. */
export const DOORS_BOX = { x0: 256, x1: 800, y0: -1176, y1: -640 };
export function doorsScale(st: Stage): number {
  return Math.min((st.w * 0.9) / (DOORS_BOX.x1 - DOORS_BOX.x0), (st.h * 0.88) / (DOORS_BOX.y1 - DOORS_BOX.y0));
}
/** Phones frame one door at a time so each door's label and the report number reach the minimum size. */
export const DOOR_BOX = {
  a: { x0: 604, x1: 806, y0: -724, y1: -632 },
  b: { x0: 604, x1: 806, y0: -1034, y1: -940 },
};
export const doorScale = (st: Stage): number => Math.min((st.w * 0.92) / (DOOR_BOX.a.x1 - DOOR_BOX.a.x0), (st.h * 0.7) / (DOOR_BOX.a.y1 - DOOR_BOX.a.y0));

/** The assembled section: ground to the top of the model band, risers closed. Width includes the doors. */
export const FIT_BOX = () => ({ x0: 200, x1: 800, y0: bandTop(3, 1) - 22, y1: 34 });
/** Room left on each side of the assembled section for the numbered entries (screen px). */
export const entryMargin = (st: Stage): number => (isNarrow(st) ? 34 : isWide(st) ? 330 : 214);
export function fitScale(st: Stage): number {
  const b = FIT_BOX();
  const bySize = Math.min((st.h * 0.96) / (b.y1 - b.y0), (st.w * 0.94) / (b.x1 - b.x0));
  const byMargins = (st.w - 2 * entryMargin(st)) / (800 - X0 + 40);   // strata + doors, plus a little air
  return Math.max(0.2, Math.min(bySize, byMargins));
}

export function camForKey(k: KeyName, st: Stage): Cam {
  const sc = closeScale(st);
  switch (k) {
    case 'g': return { cx: 450, cy: -30, s: sc };
    case 'b0': case 'b1': case 'b2': case 'b3': return { cx: 450, cy: bandMid(Number(k[1])), s: sc };
    case 'doors': return { cx: (DOORS_BOX.x0 + DOORS_BOX.x1) / 2, cy: (DOORS_BOX.y0 + DOORS_BOX.y1) / 2, s: doorsScale(st) };
    case 'doorA': case 'doorB': {
      const b = DOOR_BOX[k === 'doorA' ? 'a' : 'b'];
      return { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, s: doorScale(st) };
    }
    case 'fit': {
      const b = FIT_BOX();
      return { cx: (X0 + 800) / 2, cy: (b.y0 + b.y1) / 2, s: fitScale(st) };
    }
  }
}

export const smooth = (t: number): number => { const c = t < 0 ? 0 : t > 1 ? 1 : t; return c * c * (3 - 2 * c); };
export const smoother = (t: number): number => { const c = t < 0 ? 0 : t > 1 ? 1 : t; return c * c * c * (c * (6 * c - 15) + 10); };
const ease = (t: number): number => (TIMING.ease === 'smoother' ? smoother(t) : smooth(t));

// ------------------------------------------------------------------------------------------------ the timeline

export type Win = [number, number];
export interface WinSet {
  band0: Win; riser1: Win; band1: Win; riser2: Win; band2: Win; field2: Win; riser3: Win; band3: Win; field3: Win;
  doorA: Win; doorB: Win; exit: Win;
}
export interface Timeline {
  keyframes: [number, KeyName][];
  win: WinSet;
  /** progress at which each beat begins (the caption changes here) */
  beatStart: number[];
  /** the pan during which the risers close */
  assemble: Win;
  /** the section is at rest and interactive from here */
  restStart: number;
  /** ingestion pipes start moving rows here */
  marksStart: number;
}

/** Build the whole timeline from TIMING. Phones get two door framings (one door at a time); wider stages get one. */
function buildTimeline(narrow: boolean): Timeline {
  const D = TIMING.dwell, P = TIMING.pan;
  const stops: { key: KeyName; dwell: number }[] = [
    { key: 'g', dwell: D.ground }, { key: 'b0', dwell: D.b0 }, { key: 'b1', dwell: D.b1 }, { key: 'b2', dwell: D.b2 }, { key: 'b3', dwell: D.b3 },
    ...(narrow ? [{ key: 'doorA' as KeyName, dwell: D.doorEach }, { key: 'doorB' as KeyName, dwell: D.doorEach }] : [{ key: 'doors' as KeyName, dwell: D.doors }]),
    { key: 'fit', dwell: D.final },
  ];
  const panBetween = (a: KeyName, b: KeyName): number => {
    if (a === 'g') return P.toB0;
    if (b === 'doors' || b === 'doorA') return P.toDoors;
    if (b === 'doorB') return P.betweenDoors;
    if (b === 'fit') return P.assemble;
    return P.riser;
  };
  const raw: { key: KeyName; a: number; b: number; panA: number; panB: number }[] = [];
  let t = 0;
  stops.forEach((s, i) => {
    const pan = i === 0 ? 0 : panBetween(stops[i - 1].key, s.key);
    raw.push({ key: s.key, a: t + pan, b: t + pan + s.dwell, panA: t, panB: t + pan });
    t += pan + s.dwell;
  });
  const total = t;
  const n = (x: number): number => x / total;
  const stop = (k: KeyName) => raw.find((r) => r.key === k)!;
  const keyframes: [number, KeyName][] = [];
  for (const r of raw) { keyframes.push([n(r.a), r.key]); keyframes.push([n(r.b), r.key]); }
  keyframes[0] = [0, 'g'];
  keyframes[keyframes.length - 1] = [1, 'fit'];

  const bandWin = (k: KeyName): Win => { const r = stop(k); return [n(r.panA + (r.panB - r.panA) * TIMING.bandStartsAt), n(r.a + (r.b - r.a) * TIMING.bandDoneAt)]; };
  const fieldWin = (k: KeyName): Win => { const r = stop(k); return [n(r.a + (r.b - r.a) * 0.15), n(r.a + (r.b - r.a) * 0.6)]; };
  const panWin = (k: KeyName): Win => { const r = stop(k); return [n(r.panA + (r.panB - r.panA) * 0.04), n(r.panB - (r.panB - r.panA) * 0.04)]; };
  const b0 = stop('b0');
  const dA = stop(narrow ? 'doorA' : 'doors'), dB = stop(narrow ? 'doorB' : 'doors');
  const win: WinSet = {
    band0: [0, n(b0.a + (b0.b - b0.a) * TIMING.bandDoneAt)],
    riser1: panWin('b1'), band1: bandWin('b1'),
    riser2: panWin('b2'), band2: bandWin('b2'), field2: fieldWin('b2'),
    riser3: panWin('b3'), band3: bandWin('b3'), field3: fieldWin('b3'),
    doorA: narrow ? [n(dA.panA + (dA.panB - dA.panA) * 0.5), n(dA.a + (dA.b - dA.a) * 0.7)] : [n(dA.panA + (dA.panB - dA.panA) * 0.5), n(dA.a + (dA.b - dA.a) * 0.6)],
    doorB: narrow ? [n(dB.panA + (dB.panB - dB.panA) * 0.5), n(dB.a + (dB.b - dB.a) * 0.7)] : [n(dB.panA + (dB.panB - dB.panA) * 0.5), n(dB.a + (dB.b - dB.a) * 0.8)],
    exit: narrow ? [n(dB.a + (dB.b - dB.a) * 0.1), n(dB.a + (dB.b - dB.a) * 0.9)] : [n(dB.a + (dB.b - dB.a) * 0.3), n(dB.a + (dB.b - dB.a) * 0.95)],
  };
  const fit = stop('fit');
  const midPan = (k: KeyName): number => { const r = stop(k); return n((r.panA + r.panB) / 2); };
  const beatStart = [0, midPan('b0'), midPan('b1'), midPan('b2'), midPan('b3'), midPan(narrow ? 'doorA' : 'doors'), midPan('fit')];
  return { keyframes, win, beatStart, assemble: [n(fit.panA), n(fit.panB)], restStart: n(fit.panB), marksStart: n(stop('b1').a) };
}
const TL: { wide?: Timeline; narrow?: Timeline } = {};
export function timelineFor(st: Stage): Timeline {
  const nar = isNarrow(st);
  return nar ? (TL.narrow ??= buildTimeline(true)) : (TL.wide ??= buildTimeline(false));
}
/** Rebuild after TIMING changes (tests and the debug tuner). */
export function resetTimeline(): void { delete TL.wide; delete TL.narrow; }

/** The camera at progress p: a smooth ease between keyframes. Pure: the same p always gives the same camera. */
export function cameraAt(p: number, st: Stage): Cam {
  const q = clamp01(p);
  const kf = timelineFor(st).keyframes;
  let i = 0;
  while (i < kf.length - 2 && q > kf[i + 1][0]) i++;
  const [p0, k0] = kf[i], [p1, k1] = kf[i + 1];
  const a = camForKey(k0, st), b = camForKey(k1, st);
  const t = p1 === p0 ? 1 : ease((q - p0) / (p1 - p0));
  return { cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t, s: a.s + (b.s - a.s) * t };
}

/** How closed the risers are at progress p: 0 open .. 1 a thin seam. Pure, reversible. */
export function closeAt(p: number, st: Stage): number {
  const [a, b] = timelineFor(st).assemble;
  return ease((clamp01(p) - a) / (b - a));
}

/** World -> screen for a camera and stage. */
export const toScreen = (c: Cam, st: Stage, x: number, y: number): [number, number] => [st.w / 2 + (x - c.cx) * c.s, st.h / 2 + (y - c.cy) * c.s];
export const toWorld = (c: Cam, st: Stage, sx: number, sy: number): [number, number] => [(sx - st.w / 2) / c.s + c.cx, (sy - st.h / 2) / c.s + c.cy];

// ------------------------------------------------------------------------------------------------ beats

export const BEAT_NAMES = ['The ground', 'NetSuite', 'Ingestion', 'The warehouse', 'The semantic model', 'Two doors', 'The whole section'] as const;
export const BEAT_COUNT = 7;
/** Camera key a beat rests on (the doors beat rests on 'doors', or on 'doorA' then 'doorB' on phones). */
export const BEAT_KEY: KeyName[] = ['g', 'b0', 'b1', 'b2', 'b3', 'doors', 'fit'];

export function beatAt(p: number, st: Stage = { w: 1000, h: 625 }): number {
  const bs = timelineFor(st).beatStart;
  let b = 0;
  for (let i = 0; i < bs.length; i++) if (p >= bs[i]) b = i;
  return b;
}
/** A progress value in the middle of a beat's dwell (used by stills, tests and the debug parameter). */
export function beatCentre(b: number, st: Stage = { w: 1000, h: 625 }): number {
  const kf = timelineFor(st).keyframes;
  const key = BEAT_KEY[b] === 'doors' && isNarrow(st) ? 'doorA' : BEAT_KEY[b];
  const hit = kf.filter(([, k]) => k === key);
  return (hit[0][0] + hit[hit.length - 1][0]) / 2;
}
/** The dwell [start, end] of a beat's camera key. */
export function dwellOf(b: number, st: Stage): Win {
  const kf = timelineFor(st).keyframes;
  const keys: KeyName[] = BEAT_KEY[b] === 'doors' && isNarrow(st) ? ['doorA', 'doorB'] : [BEAT_KEY[b]];
  const hits = kf.filter(([, k]) => keys.includes(k));
  return [hits[0][0], hits[hits.length - 1][0]];
}

export const reveal = (w: Win, p: number): number => clamp01((p - w[0]) / (w[1] - w[0]));
/** The ground and desk are drawn on arrival by time, so the first paint already shows something: the reveal never falls below this. */
export const INTRO_FRACTION = 0.3;

// ------------------------------------------------------------------------------------------------ level of detail

export interface Lod {
  /** labels inside the drawing (>= 10 px after scale) */
  text: boolean;
  /** quiet group labels */
  textSmall: boolean;
  /** the large band names (assembled section) */
  names: boolean;
  /** lettered call-outs in the margins (close up); otherwise the numbered entries */
  callouts: boolean;
}
export function lodAt(cam: Cam, st: Stage): Lod {
  const mid = (doorsScale(st) + fitScale(st)) / 2;
  const text = cam.s >= TEXT_MIN_SCALE - 1e-9;
  return { text, textSmall: cam.s >= SMALL_MIN_SCALE - 1e-9, names: !text && cam.s >= NAME_MIN_SCALE - 1e-9, callouts: cam.s >= mid };
}
/** Effective on-screen size of a label of `fontWorld` at camera scale s. */
export const effectivePx = (fontWorld: number, s: number): number => fontWorld * s;

// ------------------------------------------------------------------------------------------------ travelling rows

export const PIPE_X = [336, 456, 576];
export const PIPE_W = 40;
export const PIPE_Y0 = bandBottom(1) - 65;      // pipe bottom
export const PIPE_Y1 = bandTop(1) + 20;         // pipe top
export const MARKS_PER_PIPE = 4;
const MARK_CYCLES = 7;
/** Row mark k in pipe j at progress p: a pure function of p (nothing moves when the reader stops). y, in world units. */
export function rowMarkY(j: number, k: number, p: number, st: Stage = { w: 1000, h: 625 }): number {
  const start = timelineFor(st).marksStart;
  const adv = clamp01((p - start) / (1 - start)) * MARK_CYCLES;
  const f = (((adv + k / MARKS_PER_PIPE + j * 0.17) % 1) + 1) % 1;
  return PIPE_Y0 + (PIPE_Y1 - PIPE_Y0) * f;
}

// ------------------------------------------------------------------------------------------------ accent

export interface Accent { focus: string; threadAccent: boolean; band: number | null }
/** One accent at any time: at rest the order line; under hover or focus the hovered band (the thread drops to ink). */
export function accentFor(hoverBand: number | null): Accent {
  return hoverBand === null ? { focus: 'order-line', threadAccent: true, band: null } : { focus: `band:${hoverBand}`, threadAccent: false, band: hoverBand };
}

// ------------------------------------------------------------------------------------------------ counts

export interface EntryCounts { records: number; tables: number; twins: number; subjectAreas: number; functionalAreas: number }
export const NAMED_TABLES = 4;
export const NAMED_RECORDS = 4;
export const moreRecords = (c: EntryCounts): number => c.records - NAMED_RECORDS;
export const moreTables = (c: EntryCounts): number => c.tables - NAMED_TABLES;
export const moreSubjectAreas = (c: EntryCounts): number => c.subjectAreas - 1;
