// The WORLD model (pure, no DOM): a scene is a table of POSES, one per beat. Each beat names where every object is when
// the beat has finished (position, scale, tilt, how much is drawn, how strongly it is shown, small named props); the
// state at any moment is the previous beat's pose moving to this beat's pose. An object missing from a beat's table is
// not on stage; one that was missing before is drawn in where it stands; one that goes missing is faded out.
// Everything is in DESIGN units (the 1200 x 780 stage); the view scales it to the stage.
import { easeDraw } from '../../../ink/easing';
import { KINDS, type Kind, type Spec } from '../objects';
import { BUILD_KINDS } from '../building';
import { LOOKS, POSES, lerpPose, solveFigure, toUnits, type Pose as FigPose, type Solved } from '../figures';
import type { Beat } from '../shared/beats';

export type Pt = [number, number];
export type AnchorRef = string | Pt;
export type Strength = 'full' | 'back';
export interface Rect { x: number; y: number; w: number; h: number }

export type BuildKind = keyof typeof BUILD_KINDS;
export type AnyKind = Kind | BuildKind | 'string' | 'figure';
export interface Camera { cx: number; cy: number; s: number }
export interface EntityDef { id: string; kind: AnyKind; spec: Spec; z: number; parent?: string; space?: 'world' | 'screen' }
export interface Pose {
  x?: number; y?: number; s?: number; rot?: number; draw?: number; op?: number; sep?: number;
  props?: Record<string, number>; strength?: Strength; amber?: boolean;
  /** ms after the beat starts, and how long this object's move/draw takes */
  delay?: number; dur?: number;
  /** strings: the two ends (an anchor "id.name" or a point), the sag, the style */
  a?: AnchorRef; b?: AnchorRef; sag?: number; style?: 'string' | 'light' | 'plumb';
  /** figures: a named pose, where they stand (x, y = feet), size, facing, and world targets for the hands */
  fig?: string; H?: number; flip?: boolean; handsW?: [Pt | null, Pt | null];
  /** follows a figure's hand */
  attach?: { to: string; hand: 0 | 1; dx?: number; dy?: number; rot?: number };
}
export type Poses = Record<string, Pose>;
export interface TextDef { id: string; kind: 'serif' | 'hand'; lines: string[]; x: number; y: number; size: number; anchor?: 'start' | 'middle' | 'end'; weight?: number; italic?: boolean; tone?: 'ink' | 'ink2'; seed?: number }
export interface TextPose { draw?: number; op?: number; delay?: number; dur?: number }
export interface CamPose extends Camera { delay?: number; dur?: number }
export interface BeatWorld { poses: Poses; texts: Record<string, TextPose>; camera?: CamPose; stages?: Stage[] }
/** a later moment inside one click: its poses are reached `at` ms into the beat */
export interface Stage { at: number; poses: Poses; texts?: Record<string, TextPose>; camera?: CamPose }
export interface WorldDef { entities: EntityDef[]; texts: TextDef[]; beats: BeatWorld[]; entry: BeatWorld & { camera?: Camera } }

export interface EState {
  id: string; kind: EntityDef['kind']; spec: Spec; parent?: string;
  x: number; y: number; s: number; rot: number; draw: number; op: number; sep: number;
  props: Record<string, number>; strength: Strength | 'hidden'; amber: boolean;
  w: number; h: number; rect: Rect;
  a?: Pt; b?: Pt; sag?: number; style?: 'string' | 'light' | 'plumb';
  space: 'world' | 'screen';
  fig?: FigPose; solved?: Solved; flip?: boolean; H?: number; handsW?: [Pt | null, Pt | null];
}
export interface TState { id: string; draw: number; op: number }
export interface WorldState { entities: EState[]; texts: TState[]; beat: number; camera: Camera }

const ZETA = 0.86, OMEGA = 7.2;
const spring0 = (u: number): number => { const wd = OMEGA * Math.sqrt(1 - ZETA * ZETA); return 1 - Math.exp(-ZETA * OMEGA * u) * (Math.cos(wd * u) + ((ZETA * OMEGA) / wd) * Math.sin(wd * u)); };
const END = spring0(1);
/** damped spring 0..1; exactly 1 at u = 1; overshoot well under 1% */
export const spring = (u: number): number => (u <= 0 ? 0 : u >= 1 ? 1 : spring0(u) / END);
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const DEFAULT_MS = 800;

const kindDef = (k: AnyKind): { size(s: Spec): { w: number; h: number }; anchors(s: Spec): Record<string, Pt>; draw: (p: import('../objects').Pen, g: SVGGElement, s: Spec) => void } | null => (k === 'string' || k === 'figure' ? null : k in KINDS ? KINDS[k as Kind] : BUILD_KINDS[k as BuildKind]);
export function sizeOf(e: EntityDef): { w: number; h: number } { const d = kindDef(e.kind); return d ? d.size(e.spec) : { w: 0, h: 0 }; }
export { kindDef };

/** a point of an object's local box, in stage coordinates */
export function worldPoint(e: { x: number; y: number; s: number; rot: number; w: number; h: number }, lx: number, ly: number): Pt {
  const cx = e.w / 2, cy = e.h / 2, a = (e.rot * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
  const dx = (lx - cx) * e.s, dy = (ly - cy) * e.s;
  return [e.x + cx * e.s + dx * c - dy * sn, e.y + cy * e.s + dx * sn + dy * c];
}
export function rectOf(e: { x: number; y: number; s: number; rot: number; w: number; h: number }): Rect {
  const pts = [worldPoint(e, 0, 0), worldPoint(e, e.w, 0), worldPoint(e, e.w, e.h), worldPoint(e, 0, e.h)];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

interface Full { x: number; y: number; s: number; rot: number; draw: number; op: number; sep: number; props: Record<string, number>; strength: Strength; amber: boolean }
const full = (p: Pose): Full => ({ x: p.x ?? 0, y: p.y ?? 0, s: p.s ?? 1, rot: p.rot ?? 0, draw: p.draw ?? 1, op: p.op ?? 1, sep: p.sep ?? 1, props: p.props ?? {}, strength: p.strength ?? 'full', amber: p.amber ?? false });

function blend(prev: Pose | undefined, cur: Pose | undefined, lt: number): { f: Full; present: boolean; pose: Pose } | null {
  if (!prev && !cur) return null;
  if (cur) {
    const c = full(cur), dly = cur.delay ?? 0, dur = cur.dur ?? DEFAULT_MS;
    const u = clamp01((lt - dly) / dur);
    if (!prev) return { f: { ...c, draw: c.draw * easeDraw(u) }, present: u > 0 || lt >= dly, pose: cur };
    const p = full(prev);
    if (u >= 1) return { f: c, present: true, pose: cur };
    const e = spring(u), d = easeDraw(u);
    const props: Record<string, number> = {};
    for (const k of new Set([...Object.keys(p.props), ...Object.keys(c.props)])) props[k] = lerp(p.props[k] ?? 0, c.props[k] ?? 0, d);
    return {
      f: {
        x: lerp(p.x, c.x, e), y: lerp(p.y, c.y, e), s: lerp(p.s, c.s, e), rot: lerp(p.rot, c.rot, e),
        draw: lerp(p.draw, c.draw, d), op: lerp(p.op, c.op, d), sep: lerp(p.sep, c.sep, d), props,
        strength: u > 0.5 ? c.strength : p.strength, amber: u > 0.5 ? c.amber : p.amber,
      },
      present: true, pose: cur,
    };
  }
  const p = full(prev!), k = clamp01(lt / 300);
  return k >= 1 ? null : { f: { ...p, op: p.op * (1 - k) }, present: true, pose: prev! };
}

/** the world at time `t` ms into the scene. Beat k runs from beats[k].startMs for beats[k].ms. */
export const CAM_MS = 1200;
function camAt(prev: Camera, cur: CamPose | undefined, lt: number): Camera {
  if (!cur) return prev;
  const u = easeDraw(clamp01((lt - (cur.delay ?? 0)) / (cur.dur ?? CAM_MS)));
  const ls = Math.log(prev.s) + (Math.log(cur.s) - Math.log(prev.s)) * u;
  return { cx: lerp(prev.cx, cur.cx, u), cy: lerp(prev.cy, cur.cy, u), s: Math.exp(ls) };
}
interface Flat { k: number; at: number; poses: Poses; texts: Record<string, TextPose>; camera?: CamPose }
const flatCache = new WeakMap<WorldDef, Flat[]>();
function flatten(def: WorldDef): Flat[] {
  let f = flatCache.get(def);
  if (!f) {
    f = [];
    def.beats.forEach((b, k) => { f!.push({ k, at: 0, poses: b.poses, texts: b.texts, camera: b.camera }); for (const st of b.stages ?? []) f!.push({ k, at: st.at, poses: st.poses, texts: st.texts ?? b.texts, camera: st.camera }); });
    flatCache.set(def, f);
  }
  return f;
}
/** the camera at the end of beat k (k = -1: the entry camera) */
export function cameraEnd(def: WorldDef, k: number): Camera {
  let c: Camera = def.entry.camera ?? { cx: 600, cy: 390, s: 1 };
  for (const fl of flatten(def)) if (fl.k <= k && fl.camera) c = { cx: fl.camera.cx, cy: fl.camera.cy, s: fl.camera.s };
  return c;
}
/** the poses at the end of beat k (its last stage) */
export function endPoses(def: WorldDef, k: number): Poses { const fl = flatten(def).filter((x) => x.k === k); return fl[fl.length - 1].poses; }
export const project = (c: Camera, x: number, y: number): Pt => [(x - c.cx) * c.s + 600, (y - c.cy) * c.s + 390];
export function screenRect(r: Rect, c: Camera): Rect { const a = project(c, r.x, r.y); return { x: a[0], y: a[1], w: r.w * c.s, h: r.h * c.s }; }

/** the world at time `t` ms into the scene. Beat k runs from beats[k].startMs for beats[k].ms. */
export function evalWorld(def: WorldDef, beats: Beat[], t: number): WorldState {
  let k = 0;
  for (let i = beats.length - 1; i >= 0; i--) if (t >= beats[i].startMs) { k = i; break; }
  const lt0 = Math.min(t - beats[k].startMs, beats[k].ms);
  const flat = flatten(def);
  let fi = 0;
  flat.forEach((fl, i) => { if (fl.k === k && fl.at <= lt0) fi = i; });
  const cur = flat[fi], lt = lt0 - cur.at;
  const prevB: { poses: Poses; texts: Record<string, TextPose> } = fi > 0 ? flat[fi - 1] : def.entry;
  const curB = { poses: cur.poses, texts: cur.texts };
  let camPrev: Camera = def.entry.camera ?? { cx: 600, cy: 390, s: 1 };
  for (let i = 0; i < fi; i++) if (flat[i].camera) camPrev = { cx: flat[i].camera!.cx, cy: flat[i].camera!.cy, s: flat[i].camera!.s };
  const camera = camAt(camPrev, cur.camera, lt);
  const out: EState[] = [];
  const done = new Map<string, EState>();
  const sorted = [...def.entities].sort((a, b) => a.z - b.z);
  const anchorOf = (e: EState, name: string): Pt => {
    const d = kindDef(e.kind);
    const loc = d ? (d.anchors(e.spec)[name] ?? [e.w / 2, e.h / 2]) : [0, 0] as Pt;
    return worldPoint(e, loc[0], loc[1]);
  };
  const resolve = (ref: AnchorRef): Pt => {
    if (typeof ref !== 'string') return ref;
    const [id, name] = ref.split('.');
    const e = done.get(id);
    return e ? anchorOf(e, name) : [0, 0];
  };
  const make = (d: EntityDef, r: { f: Full; pose: Pose }): EState => {
    const sz = sizeOf(d), f = r.f;
    return { id: d.id, kind: d.kind, spec: d.spec, parent: d.parent, ...f, w: sz.w, h: sz.h, rect: { x: f.x, y: f.y, w: sz.w * f.s, h: sz.h * f.s }, space: d.space ?? 'world' };
  };
  // pass 0: objects and figures; pass 1: things attached to a hand; pass 2: strings
  for (const pass of [0, 1, 2]) {
    for (const d of sorted) {
      const isStr = d.kind === 'string';
      const pa = prevB.poses[d.id], pc = curB.poses[d.id];
      const attached = !!(pc?.attach ?? pa?.attach);
      if ((pass === 2) !== isStr || (!isStr && (pass === 1) !== attached)) continue;
      const r = blend(pa, pc, lt);
      if (!r || r.f.op <= 0.001) continue;
      const base = make(d, r);
      if (d.kind === 'figure') {
        const look = LOOKS[String(d.spec.role)];
        const f = r.f, cp = r.pose;
        const dly = cp.delay ?? 0, dur = cp.dur ?? DEFAULT_MS, u = clamp01((lt - dly) / dur);
        const place = { x: f.x, y: f.y, H: cp.H ?? 76, flip: cp.flip ?? pa?.flip ?? false };
        const pCur: FigPose = POSES[cp.fig ?? 'stand'], pPrev: FigPose = POSES[(pa && pa.fig) ?? cp.fig ?? 'stand'];
        const fix = (p0: FigPose, hw: Pose['handsW']): FigPose => ({ ...p0, hands: [hw?.[0] ? toUnits(hw[0], place, look) : p0.hands[0], hw?.[1] ? toUnits(hw[1], place, look) : p0.hands[1]] });
        const fig = lerpPose(fix(pPrev, pa?.handsW), fix(pCur, cp.handsW), pa ? u : 1);
        const solved = solveFigure(look, fig, place);
        Object.assign(base, { fig, solved, flip: place.flip, H: place.H, handsW: cp.handsW, rect: { x: place.x - 0.18 * place.H, y: place.y - 1.08 * place.H * look.h, w: 0.5 * place.H, h: 1.1 * place.H * look.h } });
      }
      if (pass === 1 && (pc?.attach ?? pa?.attach)) {
        const at = (pc?.attach ?? pa?.attach)!;
        const host = done.get(at.to);
        if (host?.solved) {
          const hp = host.solved.J.hands[at.hand];
          base.x = hp[0] + (at.dx ?? 0) * (host.flip ? -1 : 1); base.y = hp[1] + (at.dy ?? 0); base.rot = at.rot ?? base.rot;
          base.rect = rectOf(base);
        }
      }
      if (isStr) {
        const pp = r.pose;
        const a0 = resolve(pp.a ?? [0, 0]), b0 = resolve(pp.b ?? [0, 0]);
        base.a = a0; base.b = b0; base.sag = pp.sag ?? 24; base.style = pp.style ?? 'string';
        base.rect = { x: Math.min(a0[0], b0[0]), y: Math.min(a0[1], b0[1]), w: Math.abs(a0[0] - b0[0]), h: Math.abs(a0[1] - b0[1]) };
      } else if (d.kind !== 'figure' && !(pass === 1)) base.rect = rectOf(base);
      done.set(d.id, base); out.push(base);
    }
  }
  const texts: TState[] = [];
  for (const td of def.texts) {
    const pp = prevB.texts[td.id], cp = curB.texts[td.id];
    if (!pp && !cp) continue;
    const dly = cp?.delay ?? 0, dur = cp?.dur ?? 900;
    const u = clamp01((lt - dly) / dur);
    let draw = 0, op = 1;
    if (cp) { draw = (pp ? (pp.draw ?? 1) : 0) + ((cp.draw ?? 1) - (pp ? (pp.draw ?? 1) : 0)) * easeDraw(u); op = cp.op ?? 1; }
    else { draw = pp!.draw ?? 1; op = (pp!.op ?? 1) * (1 - clamp01(lt / 300)); }
    if (op > 0.001 && draw > 0) texts.push({ id: td.id, draw, op });
  }
  return { entities: out, texts, beat: k, camera };
}
