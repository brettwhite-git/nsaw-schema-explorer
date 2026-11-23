// The figure system: a tiny skeleton (pelvis, spine lean, head, two feet, two hands) solved with two-bone IK, drawn as
// ONE solid silhouette (no outline, no joints). Everything is in height units (1.0 tall, y down, ground y = 0, facing +x)
// and scaled to H. A pose is a set of numbers, so poses interpolate (`lerpPose`) with a small arc on the hands and a
// small weight shift. `solveFigure` is pure (no DOM) so scenes can read hand positions; `paintFigure` draws it.
import { el } from '../../../ink/svg';

export type Pt = [number, number];
export type Elbow = 'down' | 'up' | 'back';
export interface Pose { pelvis: Pt; lean: number; head?: number; feet: [Pt, Pt]; hands: [Pt, Pt]; elbows?: [Elbow, Elbow] }
export type Hair = 'short' | 'bun' | 'slick' | 'long' | 'cap' | 'fedora';
export type Mark = 'eyeshade' | 'satchel' | 'apron' | 'spectacles' | 'bowtie' | 'overcoat';
export type Coat = 'coat' | 'apron' | 'jacket' | 'overcoat' | 'cardigan';
export interface Look { id: string; name: string; h: number; build: number; hair: Hair; mark: Mark; coat: Coat }

export const LOOKS: Record<string, Look> = {
  clerk: { id: 'clerk', name: 'clerk', h: 1.0, build: 1.0, hair: 'short', mark: 'eyeshade', coat: 'jacket' },
  courier: { id: 'courier', name: 'courier', h: 1.05, build: 0.84, hair: 'cap', mark: 'satchel', coat: 'jacket' },
  stock: { id: 'stock', name: 'stock-keeper', h: 0.96, build: 1.22, hair: 'bun', mark: 'apron', coat: 'apron' },
  cataloguer: { id: 'cataloguer', name: 'cataloguer', h: 0.92, build: 0.92, hair: 'long', mark: 'spectacles', coat: 'cardigan' },
  counter: { id: 'counter', name: 'counter clerk', h: 1.02, build: 1.0, hair: 'slick', mark: 'bowtie', coat: 'jacket' },
  customer: { id: 'customer', name: 'customer', h: 1.04, build: 1.14, hair: 'fedora', mark: 'overcoat', coat: 'overcoat' },
};

const L = { spine: 0.3, thigh: 0.26, shin: 0.25, upper: 0.165, fore: 0.155 };
const dir = (deg: number): Pt => [Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180)];
const add = (a: Pt, b: Pt, k = 1): Pt => [a[0] + b[0] * k, a[1] + b[1] * k];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const len = (a: Pt): number => Math.hypot(a[0], a[1]);
const norm = (a: Pt): Pt => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const perp = (a: Pt): Pt => [-a[1], a[0]];
const rot = (a: Pt, deg: number): Pt => { const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r); return [a[0] * c - a[1] * s, a[0] * s + a[1] * c]; };
const f1 = (n: number): string => n.toFixed(2);
const ptsD = (p: Pt[]): string => `M${p.map((q) => `${f1(q[0])} ${f1(q[1])}`).join('L')}Z`;

function ik(a: Pt, t: Pt, l1: number, l2: number, score: (m: Pt) => number): { mid: Pt; end: Pt; reach: number } {
  const d = sub(t, a), want = len(d);
  const max = (l1 + l2) * 0.995, min = Math.abs(l1 - l2) + 0.01;
  const dl = Math.min(max, Math.max(min, want));
  const u = norm(d);
  const cosA = (l1 * l1 + dl * dl - l2 * l2) / (2 * l1 * dl);
  const ang = (Math.acos(Math.max(-1, Math.min(1, cosA))) * 180) / Math.PI;
  const m1 = add(a, rot(u, ang), l1), m2 = add(a, rot(u, -ang), l1);
  return { mid: score(m1) >= score(m2) ? m1 : m2, end: add(a, u, dl), reach: want - dl };
}
function chaikin(pts: Pt[], n = 1): Pt[] {
  let p = pts;
  for (let k = 0; k < n; k++) {
    const q: Pt[] = [];
    for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
    p = q;
  }
  return p;
}
function capsule(a: Pt, b: Pt, r1: number, r2: number): Pt[] {
  const n = perp(norm(sub(b, a))), out: Pt[] = [add(a, n, r1), add(b, n, r2)];
  const base = Math.atan2(n[1], n[0]);
  for (let i = 1; i < 4; i++) { const t = base - (Math.PI * i) / 4; out.push([b[0] + Math.cos(t) * r2, b[1] + Math.sin(t) * r2]); }
  out.push(add(b, n, -r2), add(a, n, -r1));
  for (let i = 1; i < 4; i++) { const t = base + Math.PI - (Math.PI * i) / 4; out.push([a[0] + Math.cos(t) * r1, a[1] + Math.sin(t) * r1]); }
  return out;
}

export interface Joints { head: Pt; shoulder: Pt; pelvis: Pt; hands: [Pt, Pt]; elbows: [Pt, Pt]; knees: [Pt, Pt]; feet: [Pt, Pt]; px: (u: Pt) => Pt; H: number; sx: number }
export interface Part { d: string; ring?: boolean; cut?: boolean; group: 'far' | 'mid' | 'legN' | 'head' | 'armN' | 'cut' }
export interface Solved { parts: Part[]; J: Joints; miss: [number, number] }
export interface Place { x: number; y: number; H: number; flip?: boolean }

/** hand targets in page coordinates -> height units for a placement */
export const toUnits = (w: Pt, o: Place, look: Look): Pt => [((w[0] - o.x) * (o.flip ? -1 : 1)) / (o.H * look.h), (w[1] - o.y) / (o.H * look.h)];

export function solveFigure(look: Look, pose: Pose, o: Place): Solved {
  const H = o.H * look.h, sx = o.flip ? -1 : 1;
  const px = (u: Pt): Pt => [o.x + sx * u[0] * H, o.y + u[1] * H];
  const B = look.build, BL = Math.sqrt(B);
  const grounded = Math.min(pose.feet[0][1], pose.feet[1][1]) >= -0.05 && pose.pelvis[1] < -0.4;
  const P: Pt = grounded ? [pose.pelvis[0], pose.pelvis[1] - 0.025] : pose.pelvis, sp = dir(pose.lean);
  const S = add(P, sp, L.spine * 1.04);
  const headA = (pose.head ?? 0) + pose.lean * 0.5;
  const N = add(S, dir(pose.lean * 0.7 + (pose.head ?? 0) * 0.4), 0.05);
  const C = add(N, dir(headA), 0.072);
  const side = perp(sp);
  const sh: [Pt, Pt] = [add(S, side, -0.012), add(S, side, 0.014)];
  const hip: [Pt, Pt] = [add(P, side, -0.01), add(P, side, 0.014)];
  const legs = [0, 1].map((i) => ik(hip[i], pose.feet[i], L.thigh, L.shin, (m) => m[0]));
  const el2 = pose.elbows ?? ['down', 'down'];
  const arms = [0, 1].map((i) => ik(sh[i], pose.hands[i], L.upper, L.fore, (m) => (el2[i] === 'up' ? -m[1] : el2[i] === 'back' ? -m[0] * 1.4 : m[1] - m[0] * 0.25)));
  const J: Joints = { head: px(C), shoulder: px(S), pelvis: px(P), hands: [px(arms[0].end), px(arms[1].end)], elbows: [px(arms[0].mid), px(arms[1].mid)], knees: [px(legs[0].mid), px(legs[1].mid)], feet: [px(legs[0].end), px(legs[1].end)], px, H, sx };
  const P2 = (u: Pt): Pt => px(u);
  const cap = (a: Pt, b: Pt, r1: number, r2: number): string => ptsD(capsule(P2(a), P2(b), Math.max(0.5, r1 * H), Math.max(0.4, r2 * H)));
  const ell = (c: Pt, rx: number, ry: number, ang = 0): string => ptsD(Array.from({ length: 20 }, (_, k): Pt => { const t = (k / 20) * Math.PI * 2; return P2(add(c, rot([Math.cos(t) * rx, Math.sin(t) * ry], ang))); }));
  const poly = (pts: Pt[], it = 0): string => ptsD((it ? chaikin(pts, it) : pts).map(P2));
  const parts: Part[] = [];
  const push = (group: Part['group'], d: string, extra: Partial<Part> = {}): void => { parts.push({ d, group, ...extra }); };
  const foot = (a: Pt): string => { const gy = a[1] + 0.03; return poly([[a[0] - 0.03, a[1] - 0.012], [a[0] + 0.012, a[1] - 0.03], [a[0] + 0.045, a[1] - 0.012], [a[0] + 0.085, gy - 0.006], [a[0] + 0.082, gy], [a[0] - 0.035, gy]], 1); };
  const leg = (i: number, g: Part['group']): void => { const kn = legs[i].mid, an = legs[i].end; push(g, cap(hip[i], kn, 0.04 * BL, 0.03 * BL)); push(g, cap(kn, an, 0.03 * BL, 0.017 * BL)); push(g, foot(an)); };
  const arm = (i: number, g: Part['group']): void => { const e = arms[i].mid, w = arms[i].end; push(g, cap(sh[i], e, 0.024 * BL, 0.019 * BL)); push(g, cap(e, w, 0.019 * BL, 0.012 * BL)); push(g, ell(add(w, norm(sub(w, e)), 0.01), 0.017, 0.014, Math.atan2(w[1] - e[1], w[0] - e[0]) * 57.3)); };
  leg(0, 'far'); arm(0, 'far');
  const sn = side;
  const avgLeg = norm(add(sub(legs[0].mid, hip[0]), sub(legs[1].mid, hip[1])));
  const skirt = look.coat === 'overcoat' ? 0.4 : look.coat === 'apron' ? 0.2 : look.coat === 'cardigan' ? 0.17 : look.coat === 'coat' ? 0.25 : 0.14;
  const at = (t: number, f: number, b: number): [Pt, Pt] => { const c = add(P, sp, L.spine * t); return [add(c, sn, f * B), add(c, sn, -b * B)]; };
  // shoulder line, a slight waist, then the hip and the coat hem
  const sPts = [at(1.06, 0.034, 0.04), at(0.96, 0.066, 0.062), at(0.8, 0.07, 0.06), at(0.5, 0.052, 0.046), at(0.16, 0.062, 0.068)];
  const flare = look.coat === 'overcoat' ? 0.1 : look.coat === 'apron' ? 0.085 : 0.07;
  const hemC = add(P, norm(add(avgLeg, [0, 1], 0.7)), skirt);
  const hemF = add(hemC, sn, flare * B), hemB = add(hemC, sn, -flare * B * 0.9);
  push('mid', poly([...sPts.map((s) => s[0]), hemF, hemB, ...sPts.map((s) => s[1]).reverse()], 2));
  push('mid', cap(add(S, sp, -0.03), N, 0.024 * BL, 0.019 * BL));
  const cut = (d: string, ring = false): void => push('cut', d, { cut: true, ring });
  if (look.mark === 'apron') { const a0 = at(0.8, 0.07, 0)[0]; cut(poly([a0, add(hemF, sn, 0.004)])); cut(poly([at(1.0, 0.03, 0)[0], a0])); }
  if (look.mark === 'overcoat') { const b = at(0.3, 0.07, 0.07); cut(poly([b[1], b[0]])); cut(poly([at(1.0, 0.012, 0)[0], at(0.55, 0.05, 0)[0]])); }
  if (look.mark === 'bowtie') {
    const c = add(N, sn, 0.036);
    cut(poly([add(c, [-0.022, -0.012]), c, add(c, [-0.022, 0.012])])); cut(poly([add(c, [0.022, -0.012]), c, add(c, [0.022, 0.012])]));
    cut(poly([at(0.98, 0.04, 0)[0], at(0.62, 0.012, 0)[0], at(0.3, 0.064, 0)[0]]));
  }
  if (look.mark === 'satchel') {
    cut(poly([at(0.96, -0.04, 0)[0], at(0.08, 0.06, 0)[0]]));
    const bc = add(add(P, sp, 0.02), sn, 0.085 * B);
    push('mid', poly([add(bc, [-0.036, 0]), add(bc, [0.036, 0]), add(bc, [0.036, 0.075]), add(bc, [-0.036, 0.075])], 1));
  }
  leg(1, 'legN');
  const hp = (ux: number, uy: number): Pt => add(C, rot([ux, uy], headA));
  const arcPts = (a0: number, a1: number, rx: number, ry: number, n = 12): Pt[] => Array.from({ length: n + 1 }, (_, k): Pt => { const t = ((a0 + (a1 - a0) * (k / n)) * Math.PI) / 180; return hp(Math.cos(t) * rx, Math.sin(t) * ry); });
  push('head', ell(C, 0.054, 0.069, headA));
  const hairShape = (pts: Pt[]): void => push('head', poly(pts, 1), { ring: true });
  const crescent = (a0: number, a1: number, o1: [number, number], i1: [number, number]): Pt[] => [...arcPts(a0, a1, o1[0], o1[1]), ...arcPts(a1 + 8, a0 - 25, i1[0], i1[1], 8)];
  switch (look.hair) {
    case 'short': hairShape(crescent(-22, -208, [0.063, 0.078], [0.04, 0.05])); break;
    case 'bun': hairShape(crescent(-22, -212, [0.063, 0.078], [0.04, 0.05])); push('head', ell(hp(-0.066, -0.06), 0.034, 0.032)); break;
    case 'slick': hairShape(crescent(-12, -218, [0.063, 0.08], [0.05, 0.06])); break;
    case 'long': hairShape([...arcPts(-22, -212, 0.065, 0.08), hp(-0.078, 0.1), hp(-0.085, 0.2), hp(-0.045, 0.2), hp(-0.03, 0.1), hp(-0.04, 0)]); break;
    case 'cap': push('head', poly([...arcPts(-4, -188, 0.066, 0.078, 14)], 1), { ring: true }); push('head', poly([hp(0.02, -0.05), hp(0.112, -0.024), hp(0.112, -0.006), hp(0.03, -0.014)], 1)); break;
    case 'fedora': push('head', poly([hp(-0.105, -0.036), hp(-0.04, -0.05), hp(0.06, -0.05), hp(0.118, -0.036), hp(0.06, -0.02), hp(-0.04, -0.02)], 1), { ring: true }); push('head', poly([hp(-0.05, -0.04), hp(-0.044, -0.108), hp(-0.01, -0.13), hp(0.03, -0.12), hp(0.054, -0.04)], 1), { ring: true }); break;
  }
  if (look.mark === 'eyeshade') push('head', poly([hp(-0.058, -0.032), hp(0.03, -0.048), hp(0.105, -0.028), hp(0.1, -0.012), hp(0.03, -0.026), hp(-0.058, -0.014)], 1), { ring: true });
  if (look.mark === 'spectacles') { cut(ell(hp(0.034, -0.004), 0.019, 0.019, 0), true); cut(poly([hp(0.016, -0.004), hp(-0.05, -0.008)])); cut(poly([hp(-0.03, -0.04), hp(-0.058, -0.1)])); }
  arm(1, 'armN');
  return { parts, J, miss: [arms[0].reach, arms[1].reach] };
}

const PAPER = 'var(--paper-2)';
/** paint into g (the solid silhouette). Near limbs: one cut ring around the whole limb, then the fill, so there are no seams. */
export function paintFigure(g: Element, s: Solved, H: number, fill = 'var(--ink)'): void {
  const path = (d: string, a: Record<string, string | number>): void => { el('path', { d, ...a }, g); };
  const ringW = Math.min(1.8, Math.max(0.5, H * 0.009));
  const run = (grp: Part['group'], ring: boolean): void => {
    const ps = s.parts.filter((q) => q.group === grp);
    if (ring) for (const q of ps) path(q.d, { fill: 'none', stroke: PAPER, 'stroke-width': ringW * 2, 'stroke-linejoin': 'round' });
    for (const q of ps) path(q.d, { fill, stroke: q.ring ? PAPER : 'none', 'stroke-width': q.ring ? Math.min(1.2, Math.max(0.35, H * 0.004)) : 0, 'stroke-linejoin': 'round' });
  };
  run('far', false); run('mid', false); run('legN', true); run('head', false); run('armN', true);
  for (const c of s.parts.filter((q) => q.group === 'cut')) path(c.d, c.ring ? { fill: 'none', stroke: PAPER, 'stroke-width': Math.min(1.2, Math.max(0.4, H * 0.005)) } : { fill: 'none', stroke: PAPER, 'stroke-width': Math.min(1.6, Math.max(0.5, H * 0.006)), 'stroke-linecap': 'round' });
}

/** poses: numbers only */
const STAND: Pose['feet'] = [[-0.06, -0.03], [0.07, -0.03]];
export const POSES: Record<string, Pose> = {
  stand: { pelvis: [0, -0.5], lean: 0, feet: STAND, hands: [[-0.03, -0.46], [0.03, -0.45]] },
  step1: { pelvis: [0, -0.5], lean: 3, feet: [[-0.14, -0.03], [0.12, -0.03]], hands: [[0.07, -0.5], [-0.08, -0.46]] },
  step2: { pelvis: [0, -0.5], lean: 3, feet: [[0.12, -0.03], [-0.14, -0.03]], hands: [[-0.08, -0.46], [0.07, -0.5]] },
  receive: { pelvis: [0, -0.5], lean: 2, head: -4, feet: STAND, hands: [[0.08, -0.5], [0.2, -0.62]] },
  tear: { pelvis: [-0.02, -0.5], lean: 8, feet: [[-0.1, -0.03], [0.06, -0.03]], hands: [[0.17, -0.66], [0.31, -0.7]] },
  file: { pelvis: [-0.03, -0.5], lean: 7, feet: [[-0.1, -0.03], [0.06, -0.03]], hands: [[0.2, -0.64], [0.31, -0.69]] },
  carry: { pelvis: [0, -0.5], lean: 3, feet: [[-0.14, -0.03], [0.12, -0.03]], hands: [[-0.08, -0.47], [0.2, -0.6]] },
  bend: { pelvis: [-0.04, -0.46], lean: 20, feet: [[-0.12, -0.03], [0.05, -0.03]], hands: [[0.2, -0.5], [0.3, -0.45]] },
  crouch: { pelvis: [-0.06, -0.22], lean: 48, head: -10, feet: [[-0.18, -0.03], [0.04, -0.03]], hands: [[0.2, -0.3], [0.3, -0.25]] },
  write: { pelvis: [-0.04, -0.5], lean: 20, head: 12, feet: [[-0.12, -0.03], [0.04, -0.03]], hands: [[0.22, -0.52], [0.3, -0.54]] },
  hold: { pelvis: [0, -0.5], lean: 0, feet: STAND, hands: [[0.17, -0.7], [0.24, -0.66]] },
  listen: { pelvis: [-0.04, -0.5], lean: 22, head: 10, feet: [[-0.15, -0.03], [-0.02, -0.03]], hands: [[-0.04, -0.46], [0.26, -0.61]], elbows: ['back', 'down'] },
  hand: { pelvis: [-0.02, -0.5], lean: 9, feet: [[-0.08, -0.03], [0.04, -0.03]], hands: [[0.12, -0.58], [0.34, -0.64]] },
  pin: { pelvis: [0, -0.51], lean: 3, feet: [[-0.04, -0.03], [0.06, -0.03]], hands: [[-0.02, -0.46], [0.27, -0.98]], elbows: ['down', 'up'] },
  offer: { pelvis: [0.01, -0.5], lean: 8, head: -6, feet: [[-0.07, -0.03], [0.09, -0.03]], hands: [[0.24, -0.62], [0.3, -0.58]] },
  wait: { pelvis: [0, -0.5], lean: 2, head: -3, feet: STAND, hands: [[-0.01, -0.45], [0.06, -0.5]] },
  push: { pelvis: [-0.05, -0.49], lean: 15, feet: [[-0.24, -0.03], [0.04, -0.03]], hands: [[0.26, -0.62], [0.3, -0.64]] },
  climb: { pelvis: [0.08, -0.62], lean: 8, feet: [[0.1, -0.3], [0.14, -0.1]], hands: [[0.24, -0.86], [0.27, -0.97]] },
  sit: { pelvis: [-0.05, -0.3], lean: 14, head: 14, feet: [[0.14, -0.03], [0.22, -0.03]], hands: [[0.26, -0.5], [0.33, -0.5]] },
};

const ease = (t: number): number => t * t * (3 - 2 * t);
/** pose between two poses: eased, with a small arc on the hands and a small weight shift */
export function lerpPose(a: Pose, b: Pose, t: number, arc = 0.04): Pose {
  const e = ease(Math.min(1, Math.max(0, t))), bump = Math.sin(Math.PI * e);
  const l = (x: number, y: number): number => x + (y - x) * e;
  const lp = (p: Pt, q: Pt, up = 0): Pt => [l(p[0], q[0]), l(p[1], q[1]) - up * bump];
  return {
    pelvis: [l(a.pelvis[0], b.pelvis[0]), l(a.pelvis[1], b.pelvis[1]) + 0.012 * bump],
    lean: l(a.lean, b.lean), head: l(a.head ?? 0, b.head ?? 0),
    feet: [lp(a.feet[0], b.feet[0]), lp(a.feet[1], b.feet[1])],
    hands: [lp(a.hands[0], b.hands[0], arc), lp(a.hands[1], b.hands[1], arc)],
    elbows: e < 0.5 ? a.elbows : b.elbows,
  };
}
