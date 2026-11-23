// The figure system (lab only). A worker is a tiny skeleton: pelvis, a spine lean, a head, and four limb ends
// (two feet, two hands). Legs and arms are two-bone limbs solved from their end points, so a hand really meets the
// object it holds. Everything is in HEIGHT UNITS (the figure is 1.0 tall, y down, ground at y = 0, facing +x) and is
// scaled to H pixels, so the same pose draws at 48 px or 300 px. No faces: an oval head, a tapered coat, slim limbs,
// small hands, short feet, and ONE mark per role (eyeshade, cap, apron, spectacles, bow tie, hat).
import { hatchSegments } from '../../ink/hatch';
import { Pen, bbox, fmt, ptsD, type Pt, type Tone } from '../../figures/scenes/objects';
import { uid } from '../../ink/svg';

export type Hair = 'short' | 'bun' | 'slick' | 'long' | 'cap' | 'fedora' | 'bald' | 'tight';
export type Mark = 'eyeshade' | 'satchel' | 'apron' | 'spectacles' | 'bowtie' | 'overcoat';
export type Coat = 'coat' | 'apron' | 'jacket' | 'overcoat' | 'cardigan';
export interface Look { id: string; name: string; h: number; build: number; hair: Hair; mark: Mark; coat: Coat; sleeve?: number }
export interface Pose { pelvis: Pt; lean: number; head?: number; feet: [Pt, Pt]; hands: [Pt, Pt]; elbows?: [Elbow, Elbow]; chin?: boolean }
export type Elbow = 'down' | 'up' | 'back';

export const LOOKS: Record<string, Look> = {
  clerk: { id: 'clerk', name: 'clerk', h: 1.0, build: 1.0, hair: 'tight', mark: 'eyeshade', coat: 'jacket' },
  courier: { id: 'courier', name: 'courier', h: 1.05, build: 0.84, hair: 'cap', mark: 'satchel', coat: 'jacket' },
  stock: { id: 'stock', name: 'stock-keeper', h: 0.96, build: 1.22, hair: 'bun', mark: 'apron', coat: 'apron' },
  cataloguer: { id: 'cataloguer', name: 'cataloguer', h: 0.92, build: 0.92, hair: 'long', mark: 'spectacles', coat: 'cardigan' },
  counter: { id: 'counter', name: 'counter clerk', h: 1.02, build: 1.0, hair: 'slick', mark: 'bowtie', coat: 'jacket' },
  customer: { id: 'customer', name: 'customer', h: 1.04, build: 1.14, hair: 'fedora', mark: 'overcoat', coat: 'overcoat' },
};

export const L = { spine: 0.3, thigh: 0.26, shin: 0.25, upper: 0.165, fore: 0.155 };
export const dir = (deg: number): Pt => [Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180)];
export const add = (a: Pt, b: Pt, k = 1): Pt => [a[0] + b[0] * k, a[1] + b[1] * k];
export const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
export const len = (a: Pt): number => Math.hypot(a[0], a[1]);
export const norm = (a: Pt): Pt => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
export const perp = (a: Pt): Pt => [-a[1], a[0]];
export const rot = (a: Pt, deg: number): Pt => { const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r); return [a[0] * c - a[1] * s, a[0] * s + a[1] * c]; };

/** two-bone limb from a to target t: the middle joint, preferring the side the score likes */
export function ik(a: Pt, t: Pt, l1: number, l2: number, score: (m: Pt) => number): { mid: Pt; end: Pt } {
  let d = sub(t, a), dl = len(d);
  const max = (l1 + l2) * 0.995, min = Math.abs(l1 - l2) + 0.01;
  dl = Math.min(max, Math.max(min, dl));
  const u = norm(d);
  const cosA = (l1 * l1 + dl * dl - l2 * l2) / (2 * l1 * dl);
  const ang = (Math.acos(Math.max(-1, Math.min(1, cosA))) * 180) / Math.PI;
  const m1 = add(a, rot(u, ang), l1), m2 = add(a, rot(u, -ang), l1);
  const mid = score(m1) >= score(m2) ? m1 : m2;
  return { mid, end: add(a, u, dl) };
}

export interface Joints { head: Pt; shoulder: Pt; pelvis: Pt; hands: [Pt, Pt]; elbows: [Pt, Pt]; knees: [Pt, Pt]; feet: [Pt, Pt]; px: (u: Pt) => Pt; H: number; sx: number }

export function chaikin(pts: Pt[], n = 1): Pt[] {
  let p = pts;
  for (let k = 0; k < n; k++) {
    const q: Pt[] = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    p = q;
  }
  return p;
}

export function capsule(a: Pt, b: Pt, r1: number, r2: number): Pt[] {
  const n = perp(norm(sub(b, a)));
  const out: Pt[] = [];
  out.push(add(a, n, r1), add(b, n, r2));
  const base = Math.atan2(n[1], n[0]);
  for (let i = 1; i < 4; i++) { const t = base - (Math.PI * i) / 4; out.push([b[0] + Math.cos(t) * r2, b[1] + Math.sin(t) * r2]); }
  out.push(add(b, n, -r2), add(a, n, -r1));
  for (let i = 1; i < 4; i++) { const t = base + Math.PI - (Math.PI * i) / 4; out.push([a[0] + Math.cos(t) * r1, a[1] + Math.sin(t) * r1]); }
  return out;
}

export interface DrawOpts { x: number; y: number; H: number; flip?: boolean; tone?: Tone; weight?: 'support' | 'subject' | 'ghost' }

/** draw a figure; returns the joints in page coordinates so props can be put in its hands */
export function drawFigure(p: Pen, parent: Element, look: Look, pose: Pose, o: DrawOpts): Joints {
  const H = o.H * look.h, sx = o.flip ? -1 : 1, tier = o.weight ?? 'support', tone = o.tone ?? 'ink';
  const px = (u: Pt): Pt => [o.x + sx * u[0] * H, o.y + u[1] * H];
  const rough = o.H < 70 ? 0.1 : 0.18;
  const B = look.build;
  const g = p.g(parent);
  const shape = (pts: Pt[], fill = true, w?: number, tr: 'support' | 'subject' | 'ghost' = tier): void => {
    const d = ptsD(pts);
    if (fill) p.fill(g, d);
    p.stroke(g, d, tr, tone, { rough, w });
  };
  // ---- skeleton
  const grounded = Math.min(pose.feet[0][1], pose.feet[1][1]) >= -0.05 && pose.pelvis[1] < -0.4;
  const P: Pt = grounded ? [pose.pelvis[0], pose.pelvis[1] - 0.025] : pose.pelvis, sp = dir(pose.lean);
  const S = add(P, sp, L.spine);
  const headA = (pose.head ?? 0) + pose.lean * 0.5;
  const N = add(S, dir(pose.lean * 0.7 + (pose.head ?? 0) * 0.4), 0.045);
  const C = add(N, dir(headA), 0.07);
  const side = perp(sp); // points toward the front (+x) for an upright spine
  const sh: [Pt, Pt] = [add(S, side, -0.012), add(S, side, 0.012)];
  const hip: [Pt, Pt] = [add(P, side, -0.01), add(P, side, 0.014)];
  const legs = [0, 1].map((i) => ik(hip[i], pose.feet[i], L.thigh, L.shin, (m) => m[0] * 1.0 - Math.abs(m[1] - (hip[i][1] + pose.feet[i][1]) / 2) * 0)) as { mid: Pt; end: Pt }[];
  const el = pose.elbows ?? ['down', 'down'];
  const arms = [0, 1].map((i) => ik(sh[i], pose.hands[i], L.upper, L.fore, (m) => (el[i] === 'up' ? -m[1] : el[i] === 'back' ? -m[0] * 1.4 : m[1] - m[0] * 0.25))) as { mid: Pt; end: Pt }[];
  const J: Joints = {
    head: px(C), shoulder: px(S), pelvis: px(P), hands: [px(arms[0].end), px(arms[1].end)], elbows: [px(arms[0].mid), px(arms[1].mid)],
    knees: [px(legs[0].mid), px(legs[1].mid)], feet: [px(legs[0].end), px(legs[1].end)], px, H, sx,
  };
  const P2 = (u: Pt): Pt => px(u);
  const BL = Math.sqrt(B), rl = Math.max(1.1, 0.027 * H), rl2 = Math.max(0.9, 0.018 * H), ra = Math.max(1, 0.022 * H), ra2 = Math.max(0.8, 0.016 * H);
  const leg = (i: number): void => {
    const kn = legs[i].mid, an = legs[i].end;
    shape(capsule(P2(hip[i]), P2(kn), rl * BL, rl * 0.85 * BL));
    shape(capsule(P2(kn), P2(an), rl * 0.85 * BL, rl2 * BL));
    // a short foot
    const toe: Pt = [an[0] + 0.065, Math.min(0, an[1] + 0.028)];
    shape(capsule(P2(an), P2(toe), Math.max(1, 0.02 * H), Math.max(0.9, 0.014 * H)));
  };
  const sleeveCol = look.coat === 'cardigan' || look.coat === 'jacket' || look.coat === 'overcoat';
  const arm = (i: number): void => {
    const e = arms[i].mid, w = arms[i].end;
    shape(capsule(P2(sh[i]), P2(e), ra * 1.15 * B, ra * 1.05 * B));
    shape(capsule(P2(e), P2(w), ra * 1.0 * B, ra2));
    const hr = Math.max(1.4, 0.021 * H);
    const hd = ptsD(Array.from({ length: 10 }, (_, k): Pt => { const t = (k / 10) * Math.PI * 2; const q = P2(w); return [q[0] + Math.cos(t) * hr, q[1] + Math.sin(t) * hr]; }));
    p.fill(g, hd); p.stroke(g, hd, tier, tone, { rough: 0.05 });
  };
  void sleeveCol; void sleeveCol;
  // ---- far limbs first
  leg(0); arm(0);
  // ---- torso and coat
  const sn = side; // forward
  const down: Pt = [0, 1];
  const avgLeg = norm(add(sub(legs[0].mid, hip[0]), sub(legs[1].mid, hip[1])));
  const skirt = look.coat === 'overcoat' ? 0.36 : look.coat === 'coat' ? 0.24 : look.coat === 'apron' ? 0.12 : look.coat === 'cardigan' ? 0.16 : 0.13;
  const at = (t: number, f: number, b: number): [Pt, Pt] => { const c = add(P, sp, L.spine * t); return [add(c, sn, f * B), add(c, sn, -b * B)]; };
  const sPts = [at(1.02, 0.052, 0.05), at(0.82, 0.062, 0.056), at(0.5, 0.05, 0.048), at(0.12, 0.058, 0.064)];
  const front = sPts.map((s) => s[0]), back = sPts.map((s) => s[1]);
  const flare = look.coat === 'overcoat' ? 0.085 : look.coat === 'apron' ? 0.07 : 0.066;
  const hemC = add(P, norm(add(avgLeg, down, 0.6)), skirt);
  const hemF = add(hemC, sn, flare * B), hemB = add(hemC, sn, -flare * B * 0.95);
  const torso: Pt[] = chaikin([...front, hemF, hemB, ...back.slice().reverse()], 1);
  shape(torso.map(P2));
  // neck
  shape(capsule(P2(add(S, sp, 0.0)), P2(N), Math.max(1.4, 0.024 * H), Math.max(1.3, 0.02 * H)), true, undefined, 'ghost');
  // ---- role marks on the body
  const mark = look.mark;
  if (mark === 'apron') {
    const a1 = add(P, sp, L.spine * 0.74), a1f = add(a1, sn, 0.062 * B);
    const ap: Pt[] = [a1f, add(a1f, sn, 0.008), add(hemF, sn, 0.012), add(hemF, [0, 0], 0), add(hemC, sn, 0.0), add(add(P, sp, L.spine * 0.12), sn, 0.045 * B)];
    shape(chaikin(ap, 1).map(P2), true, 0.9);
    const strap = add(S, sn, 0.03 * B);
    p.hair(g, `M${fmt(P2(strap)[0])} ${fmt(P2(strap)[1])}L${fmt(P2(a1f)[0])} ${fmt(P2(a1f)[1])}`, { w: 1, op: 0.9 });
  }
  if (mark === 'bowtie') {
    const c = P2(add(N, sn, 0.04));
    const r = Math.max(1.6, 0.026 * H);
    shape([[c[0] - r * 1.6 * sx, c[1] - r * 0.7], [c[0], c[1]], [c[0] - r * 1.6 * sx, c[1] + r * 0.7]], true, 1);
    shape([[c[0] + r * 1.6 * sx, c[1] - r * 0.7], [c[0], c[1]], [c[0] + r * 1.6 * sx, c[1] + r * 0.7]], true, 1);
    // waistcoat: a V and two buttons
    const v0 = add(S, sn, 0.04 * B), v1 = add(add(P, sp, L.spine * 0.3), sn, 0.056 * B);
    p.hair(g, `M${fmt(P2(v0)[0])} ${fmt(P2(v0)[1])}L${fmt(P2(add(add(P, sp, L.spine * 0.55), sn, 0.02))[0])} ${fmt(P2(add(add(P, sp, L.spine * 0.55), sn, 0.02))[1])}L${fmt(P2(v1)[0])} ${fmt(P2(v1)[1])}`, { w: 0.9, op: 0.9 });
  }
  if (mark === 'overcoat') {
    // a collar and a belt line
    const b0 = add(P, sp, L.spine * 0.28);
    const a = P2(add(b0, sn, -0.062 * B)), b = P2(add(b0, sn, 0.07 * B));
    p.hair(g, `M${fmt(a[0])} ${fmt(a[1])}L${fmt(b[0])} ${fmt(b[1])}`, { w: 1, op: 0.9 });
    const c0 = P2(add(S, sn, 0.01)), c1 = P2(add(add(P, sp, L.spine * 0.7), sn, 0.045 * B));
    p.hair(g, `M${fmt(c0[0])} ${fmt(c0[1])}L${fmt(c1[0])} ${fmt(c1[1])}`, { w: 1, op: 0.8 });
  }
  if (mark === 'satchel') {
    const s0 = P2(add(S, sn, -0.045 * B)), s1 = P2(add(add(P, sp, 0.03), sn, 0.06));
    p.hair(g, `M${fmt(s0[0])} ${fmt(s0[1])}L${fmt(s1[0])} ${fmt(s1[1])}`, { w: 1, op: 0.95 });
    const bc = add(add(P, sp, 0.02), sn, 0.075 * B);
    const w = 0.07, h = 0.055;
    shape([P2(add(bc, [-w * 0.5, 0])), P2(add(bc, [w * 0.5, 0])), P2(add(bc, [w * 0.5, h])), P2(add(bc, [-w * 0.5, h]))], true, 1);
  }
  // ---- near leg, head, near arm
  leg(1);
  // head: an oval, no face
  const ha = headA, hc = C;
  const hp = (ux: number, uy: number): Pt => P2(add(hc, rot([ux, uy], ha)));
  const oval: Pt[] = Array.from({ length: 24 }, (_, k): Pt => { const t = (k / 24) * Math.PI * 2; return hp(Math.cos(t) * 0.054, Math.sin(t) * 0.068); });
  const hairFill = (pts: Pt[], gap = 2.2, op = 0.85): void => {
    const d = ptsD(pts);
    p.fill(g, d);
    const id = uid('hh');
    const cp = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath'); cp.setAttribute('id', id);
    const cpath = document.createElementNS('http://www.w3.org/2000/svg', 'path'); cpath.setAttribute('d', d); cp.appendChild(cpath); p.defs.appendChild(cp);
    const gg = p.g(g, { 'clip-path': `url(#${id})` });
    const bb = bbox(pts);
    const dd = hatchSegments(bb, 45, Math.max(1.6, gap * (o.H / 140))).map((s) => `M${fmt(s[0])} ${fmt(s[1])}L${fmt(s[2])} ${fmt(s[3])}`).join('');
    p.hair(gg, dd, { op, w: 0.7 });
    p.stroke(g, d, tier, tone, { rough: 0.08 });
  };
  shape(oval);
  const arcPts = (a0: number, a1: number, rx: number, ry: number, n = 10): Pt[] => Array.from({ length: n + 1 }, (_, k): Pt => { const t = ((a0 + (a1 - a0) * (k / n)) * Math.PI) / 180; return hp(Math.cos(t) * rx, Math.sin(t) * ry); });
  const hair = look.hair;
  const crescent = (a0: number, a1: number, o: [number, number], inn: [number, number]): Pt[] => [...arcPts(a0, a1, o[0], o[1], 12), ...arcPts(a1 + 8, a0 - 25, inn[0], inn[1], 8)];
  if (hair === 'short' || hair === 'tight') hairFill(crescent(-25, -205, [0.062, 0.076], [0.04, 0.05]), 2.4);
  if (hair === 'bun') { hairFill(crescent(-25, -210, [0.062, 0.076], [0.04, 0.05]), 2.4); hairFill(Array.from({ length: 12 }, (_, k): Pt => { const t = (k / 12) * Math.PI * 2; return hp(-0.062 + Math.cos(t) * 0.03, -0.055 + Math.sin(t) * 0.03); }), 1.8); }
  if (hair === 'slick') hairFill(crescent(-15, -215, [0.062, 0.078], [0.05, 0.06]), 1.6, 0.95);
  if (hair === 'long') hairFill([...arcPts(-25, -210, 0.064, 0.078, 12), hp(-0.075, 0.09), hp(-0.08, 0.17), hp(-0.05, 0.17), hp(-0.03, 0.09), hp(-0.04, 0.0)], 2.2);
  if (hair === 'cap') {
    hairFill([...arcPts(-4, -186, 0.063, 0.074, 14)], 2.8, 0.5);
    shape([hp(0.03, -0.044), hp(0.105, -0.02), hp(0.105, -0.004), hp(0.04, -0.012)], true, 1.1);
  }
  if (hair === 'fedora') {
    shape([hp(-0.1, -0.034), hp(-0.04, -0.045), hp(0.06, -0.045), hp(0.11, -0.034), hp(0.06, -0.02), hp(-0.04, -0.02)], true, 1.1);
    hairFill([hp(-0.05, -0.04), hp(-0.042, -0.1), hp(-0.01, -0.12), hp(0.03, -0.11), hp(0.052, -0.04)], 2.4, 0.55);
  }
  if (mark === 'eyeshade') {
    shape([hp(-0.056, -0.03), hp(0.03, -0.044), hp(0.095, -0.026), hp(0.093, -0.012), hp(0.03, -0.026), hp(-0.056, -0.014)], true, 1.1);
  }
  if (mark === 'spectacles') {
    const c1 = hp(0.036, -0.004), r = Math.max(1.6, 0.017 * H);
    p.stroke(g, `M${fmt(c1[0] - r)} ${fmt(c1[1])}a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(r * 2)} 0a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(-r * 2)} 0`, tier, tone, { rough: 0.05, w: 1 });
    const e = hp(-0.04, -0.004);
    p.hair(g, `M${fmt(c1[0] - sx * r)} ${fmt(c1[1])}L${fmt(e[0])} ${fmt(e[1])}`, { w: 0.9, op: 0.95 });
    // a pencil behind the ear
    const q0 = hp(-0.03, -0.03), q1 = hp(-0.062, -0.09);
    p.hair(g, `M${fmt(q0[0])} ${fmt(q0[1])}L${fmt(q1[0])} ${fmt(q1[1])}`, { w: 1.2, op: 1 });
  }
  arm(1);
  return J;
}
