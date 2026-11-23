// Figures as ONE solid silhouette (like an architect's scale figure), and the same silhouette as a single contour.
// Same skeleton, IK and poses as figure.ts. Parts are painted in one fill with no stroke, so they merge into one shape;
// near limbs get a hairline cut in the paper colour so a crossing arm stays readable. Role marks are part of the
// silhouette (visor, cap brim, hat, satchel, apron flare) or small cut-outs in the paper colour.
import { Pen, fmt, ptsD, type Pt } from '../../figures/scenes/objects';
import { L, add, capsule, chaikin, dir, ik, norm, perp, rot, sub, type Joints, type Look, type Pose } from './figure';
import { el } from '../../ink/svg';

export type FigMode = 'jointed' | 'solid' | 'contour';
export const FIG: { mode: FigMode } = { mode: 'solid' };
const PAPER = 'var(--paper-2)';

interface Part { d: string; cut?: boolean; ring?: boolean }

export function drawSolid(p: Pen, parent: Element, look: Look, pose: Pose, o: { x: number; y: number; H: number; flip?: boolean; tone?: string }, mode: 'solid' | 'contour'): Joints {
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
  const sh: [Pt, Pt] = [add(S, side, -0.01), add(S, side, 0.012)];
  const hip: [Pt, Pt] = [add(P, side, -0.01), add(P, side, 0.014)];
  const legs = [0, 1].map((i) => ik(hip[i], pose.feet[i], L.thigh, L.shin, (m) => m[0])) as { mid: Pt; end: Pt }[];
  const el2 = pose.elbows ?? ['down', 'down'];
  const arms = [0, 1].map((i) => ik(sh[i], pose.hands[i], L.upper, L.fore, (m) => (el2[i] === 'up' ? -m[1] : el2[i] === 'back' ? -m[0] * 1.4 : m[1] - m[0] * 0.25))) as { mid: Pt; end: Pt }[];
  const J: Joints = { head: px(C), shoulder: px(S), pelvis: px(P), hands: [px(arms[0].end), px(arms[1].end)], elbows: [px(arms[0].mid), px(arms[1].mid)], knees: [px(legs[0].mid), px(legs[1].mid)], feet: [px(legs[0].end), px(legs[1].end)], px, H, sx };
  const g = p.g(parent);
  const P2 = (u: Pt): Pt => px(u);
  const u = (v: number): number => v * H;
  const cap = (a: Pt, b: Pt, r1: number, r2: number): string => ptsD(capsule(P2(a), P2(b), Math.max(0.9, u(r1)), Math.max(0.7, u(r2))));
  const ell = (c: Pt, rx: number, ry: number, ang = 0): string => ptsD(Array.from({ length: 20 }, (_, k): Pt => { const t = (k / 20) * Math.PI * 2; return P2(add(c, rot([Math.cos(t) * rx, Math.sin(t) * ry], ang))); }));
  const poly = (pts: Pt[], iters = 0): string => ptsD((iters ? chaikin(pts, iters) : pts).map(P2));
  const far: Part[] = [], mid: Part[] = [], nearLeg: Part[] = [], head: Part[] = [], nearArm: Part[] = [], cuts: Part[] = [];
  const foot = (a: Pt): string => { const gy = a[1] + 0.03; return poly([[a[0] - 0.03, a[1] - 0.012], [a[0] + 0.012, a[1] - 0.03], [a[0] + 0.045, a[1] - 0.012], [a[0] + 0.085, gy - 0.006], [a[0] + 0.082, gy], [a[0] - 0.035, gy]], 1); };
  const leg = (i: number, into: Part[]): void => {
    const kn = legs[i].mid, an = legs[i].end;
    into.push({ d: cap(hip[i], kn, 0.04 * BL, 0.03 * BL) }, { d: cap(kn, an, 0.03 * BL, 0.017 * BL) }, { d: foot(an) });
  };
  const arm = (i: number, into: Part[]): void => {
    const e = arms[i].mid, w = arms[i].end;
    into.push({ d: cap(sh[i], e, 0.024 * BL, 0.019 * BL) }, { d: cap(e, w, 0.019 * BL, 0.012 * BL) }, { d: ell(add(w, norm(sub(w, e)), 0.01), 0.017, 0.014, Math.atan2(w[1] - e[1], w[0] - e[0]) * 57.3) });
  };
  leg(0, far); arm(0, far);
  // torso with its coat
  const sn = side;
  const avgLeg = norm(add(sub(legs[0].mid, hip[0]), sub(legs[1].mid, hip[1])));
  const skirt = look.coat === 'overcoat' ? 0.4 : look.coat === 'apron' ? 0.2 : look.coat === 'cardigan' ? 0.17 : look.coat === 'coat' ? 0.25 : 0.14;
  const at = (t: number, f: number, b: number): [Pt, Pt] => { const c = add(P, sp, L.spine * t); return [add(c, sn, f * B), add(c, sn, -b * B)]; };
  const sPts = [at(1.04, 0.05, 0.05), at(0.86, 0.066, 0.058), at(0.52, 0.056, 0.05), at(0.14, 0.064, 0.07)];
  const flare = look.coat === 'overcoat' ? 0.1 : look.coat === 'apron' ? 0.085 : 0.07;
  const hemC = add(P, norm(add(avgLeg, [0, 1], 0.7)), skirt);
  const hemF = add(hemC, sn, flare * B), hemB = add(hemC, sn, -flare * B * 0.9);
  mid.push({ d: poly([...sPts.map((s) => s[0]), hemF, hemB, ...sPts.map((s) => s[1]).reverse()], 2) });
  mid.push({ d: cap(add(S, sp, -0.02), N, 0.024 * BL, 0.019 * BL) });
  if (look.mark === 'apron') {
    const a0 = at(0.8, 0.07, 0)[0];
    cuts.push({ d: poly([a0, add(hemF, sn, 0.004)]), cut: true });
    cuts.push({ d: poly([at(1.0, 0.03, 0)[0], a0]), cut: true });
  }
  if (look.mark === 'overcoat') { const b = at(0.3, 0.07, 0.07); cuts.push({ d: poly([b[1], b[0]]), cut: true }); cuts.push({ d: poly([at(1.0, 0.012, 0)[0], at(0.55, 0.05, 0)[0]]), cut: true }); }
  if (look.mark === 'bowtie') {
    const c = add(N, sn, 0.036);
    cuts.push({ d: poly([add(c, [-0.022, -0.012]), c, add(c, [-0.022, 0.012])]), cut: true });
    cuts.push({ d: poly([add(c, [0.022, -0.012]), c, add(c, [0.022, 0.012])]), cut: true });
    cuts.push({ d: poly([at(0.98, 0.04, 0)[0], at(0.62, 0.012, 0)[0], at(0.3, 0.064, 0)[0]]), cut: true });
  }
  if (look.mark === 'satchel') {
    cuts.push({ d: poly([at(0.96, -0.04, 0)[0], at(0.08, 0.06, 0)[0]]), cut: true });
    const bc = add(add(P, sp, 0.02), sn, 0.085 * B);
    mid.push({ d: poly([add(bc, [-0.036, 0]), add(bc, [0.036, 0]), add(bc, [0.036, 0.075]), add(bc, [-0.036, 0.075])], 1) });
  }
  leg(1, nearLeg);
  // head, hair and marks
  const hp = (ux: number, uy: number): Pt => add(C, rot([ux, uy], headA));
  const arcPts = (a0: number, a1: number, rx: number, ry: number, n = 12): Pt[] => Array.from({ length: n + 1 }, (_, k): Pt => { const t = ((a0 + (a1 - a0) * (k / n)) * Math.PI) / 180; return hp(Math.cos(t) * rx, Math.sin(t) * ry); });
  head.push({ d: ell(C, 0.054, 0.069, headA) });
  const hairShape = (pts: Pt[]): void => { head.push({ d: poly(pts, 1), ring: true }); };
  const crescent = (a0: number, a1: number, o1: [number, number], i1: [number, number]): Pt[] => [...arcPts(a0, a1, o1[0], o1[1]), ...arcPts(a1 + 8, a0 - 25, i1[0], i1[1], 8)];
  switch (look.hair) {
    case 'tight': case 'short': hairShape(crescent(-22, -208, [0.063, 0.078], [0.04, 0.05])); break;
    case 'bun': hairShape(crescent(-22, -212, [0.063, 0.078], [0.04, 0.05])); head.push({ d: ell(hp(-0.066, -0.06), 0.034, 0.032) }); break;
    case 'slick': hairShape(crescent(-12, -218, [0.063, 0.08], [0.05, 0.06])); break;
    case 'long': hairShape([...arcPts(-22, -212, 0.065, 0.08), hp(-0.078, 0.1), hp(-0.085, 0.2), hp(-0.045, 0.2), hp(-0.03, 0.1), hp(-0.04, 0)]); break;
    case 'cap': head.push({ d: poly([...arcPts(-4, -188, 0.066, 0.078, 14)], 1), ring: true }); head.push({ d: poly([hp(0.02, -0.05), hp(0.112, -0.024), hp(0.112, -0.006), hp(0.03, -0.014)], 1) }); break;
    case 'fedora': head.push({ d: poly([hp(-0.105, -0.036), hp(-0.04, -0.05), hp(0.06, -0.05), hp(0.118, -0.036), hp(0.06, -0.02), hp(-0.04, -0.02)], 1), ring: true }); head.push({ d: poly([hp(-0.05, -0.04), hp(-0.044, -0.108), hp(-0.01, -0.13), hp(0.03, -0.12), hp(0.054, -0.04)], 1), ring: true }); break;
    default: break;
  }
  if (look.mark === 'eyeshade') head.push({ d: poly([hp(-0.058, -0.032), hp(0.03, -0.048), hp(0.105, -0.028), hp(0.1, -0.012), hp(0.03, -0.026), hp(-0.058, -0.014)], 1), ring: true });
  if (look.mark === 'spectacles') {
    cuts.push({ d: ell(hp(0.034, -0.004), 0.019, 0.019), cut: true, ring: true });
    cuts.push({ d: poly([hp(0.016, -0.004), hp(-0.05, -0.008)]), cut: true });
    cuts.push({ d: poly([hp(-0.03, -0.04), hp(-0.058, -0.1)]), cut: true });
  }
  arm(1, nearArm);
  // ---- paint
  const fill = o.tone ?? 'var(--ink)';
  const path = (d: string, a: Record<string, string | number>): void => { el('path', { d, ...a }, g); };
  const all = [...far, ...mid, ...nearLeg, ...head, ...nearArm];
  if (mode === 'contour') {
    const w = o.H < 70 ? 1.2 : 1.6;
    for (const q of all) path(q.d, { fill: 'none', stroke: fill, 'stroke-width': w * 2, 'stroke-linejoin': 'round' });
    for (const q of all) path(q.d, { fill: PAPER, stroke: 'none' });
    for (const q of [...far, ...mid, ...nearLeg].filter((x) => !x.cut)) void q;
    return J;
  }
  const solid = (arr: Part[], cut: boolean): void => {
    for (const q of arr) {
      if (cut) path(q.d, { fill: 'none', stroke: PAPER, 'stroke-width': Math.min(2.6, Math.max(1.2, u(0.009))), 'stroke-linejoin': 'round' });
      path(q.d, { fill, stroke: q.ring ? PAPER : 'none', 'stroke-width': q.ring ? Math.min(1.6, Math.max(0.7, u(0.004))) : 0, 'stroke-linejoin': 'round' });
    }
  };
  solid(far, false); solid(mid, false); solid(nearLeg, true); solid(head, false); solid(nearArm, true);
  for (const c of cuts) path(c.d, c.ring ? { fill: 'none', stroke: PAPER, 'stroke-width': Math.min(1.8, Math.max(0.8, u(0.006))) } : { fill: 'none', stroke: PAPER, 'stroke-width': Math.min(2.2, Math.max(0.9, u(0.007))), 'stroke-linecap': 'round' });
  void fmt; void p;
  return J;
}
