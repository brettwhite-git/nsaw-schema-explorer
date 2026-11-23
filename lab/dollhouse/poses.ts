// Poses for the six characters, three each, with the little set and props each one needs to make sense.
// All numbers are height units (see figure.ts). Props are drawn from the solved joints, so hands meet them.
import { Pen, fmt, ptsD, rectPts, type Pt } from '../../figures/scenes/objects';
import { drawFigure, LOOKS, type Joints, type Pose } from './figure';
import { drawSolid, FIG } from './silhouette';

export interface Ctx { p: Pen; g: SVGGElement; x: number; y: number; H: number; flip: boolean }
export interface PoseDef { name: string; pose: Pose; set?: (c: Ctx) => void; props?: (c: Ctx, j: Joints) => void }

const pt = (c: Ctx, u: Pt): Pt => [c.x + (c.flip ? -1 : 1) * u[0] * c.H, c.y + u[1] * c.H];
const line = (c: Ctx, pts: Pt[], w = 1.1, op = 1): void => { const q = pts.map((u) => pt(c, u)); c.p.hair(c.g, `M${q.map((a) => `${fmt(a[0])} ${fmt(a[1])}`).join('L')}`, { w, op }); };
const solid = (c: Ctx, pts: Pt[], tone: 'ink' | 'accent' = 'ink', w?: number): void => { const q = pts.map((u) => pt(c, u)); const d = ptsD(q); c.p.fill(c.g, d); c.p.stroke(c.g, d, 'support', tone, { rough: 0.12, w }); };
const hatchBox = (c: Ctx, pts: Pt[]): void => { const q = pts.map((u) => pt(c, u)); c.p.hatch(c.g, ptsD(q), { x0: Math.min(...q.map((a) => a[0])), y0: Math.min(...q.map((a) => a[1])), x1: Math.max(...q.map((a) => a[0])), y1: Math.max(...q.map((a) => a[1])) }, 45, Math.max(2, c.H / 40), 0.55); };
const standF: [Pt, Pt] = [[-0.06, -0.03], [0.07, -0.03]];
const hang: [Pt, Pt] = [[-0.03, -0.46], [0.03, -0.45]];
/** a card in a hand: small, tilted, optionally amber */
const card = (c: Ctx, at: Pt, w = 0.15, h = 0.085, amber = true, tilt = 0): void => {
  const t = (tilt * Math.PI) / 180, co = Math.cos(t), si = Math.sin(t);
  const q = ([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]] as Pt[]).map(([a, b]): Pt => [at[0] + a * co - b * si, at[1] + a * si + b * co]);
  solid(c, q, amber ? 'accent' : 'ink', amber ? 1.8 : 1.1);
  line(c, [[at[0] - w * 0.36, at[1] - h * 0.12], [at[0] + w * 0.36, at[1] - h * 0.12]], 0.8, 0.7);
};
const parcel = (c: Ctx, at: Pt, w = 0.17, h = 0.13): void => {
  solid(c, [[at[0] - w / 2, at[1] - h / 2], [at[0] + w / 2, at[1] - h / 2], [at[0] + w / 2, at[1] + h / 2], [at[0] - w / 2, at[1] + h / 2]]);
  line(c, [[at[0], at[1] - h / 2], [at[0], at[1] + h / 2]], 0.9, 0.8);
};
const desk = (c: Ctx, x0: number, x1: number, top: number): void => {
  solid(c, [[x0, top], [x1, top], [x1, top + 0.03], [x0, top + 0.03]]);
  line(c, [[x0 + 0.03, top + 0.03], [x0 + 0.03, 0]]); line(c, [[x1 - 0.03, top + 0.03], [x1 - 0.03, 0]]);
};

export const POSES: Record<string, PoseDef[]> = {
  clerk: [
    { name: 'filing', pose: { pelvis: [-0.03, -0.5], lean: 7, feet: [[-0.1, -0.03], [0.06, -0.03]], hands: [[0.2, -0.64], [0.31, -0.69]] },
      set: (c) => { solid(c, [[0.42, -0.98], [0.64, -0.98], [0.64, 0], [0.42, 0]]); [-0.86, -0.7, -0.54, -0.38].forEach((y) => line(c, [[0.42, y], [0.64, y]], 0.9, 0.8)); solid(c, [[0.36, -0.74], [0.42, -0.74], [0.42, -0.66], [0.36, -0.66]]); },
      props: (c, j) => card(c, [0.3, -0.69], 0.13, 0.07, true, 0) },
    { name: 'carrying', pose: { pelvis: [0, -0.5], lean: 3, feet: [[-0.14, -0.03], [0.12, -0.03]], hands: [[-0.08, -0.47], [0.2, -0.6]] },
      props: (c) => card(c, [0.27, -0.6], 0.15, 0.085, true, -6) },
    { name: 'writing', pose: { pelvis: [-0.04, -0.5], lean: 20, head: 12, feet: [[-0.12, -0.03], [0.04, -0.03]], hands: [[0.22, -0.5], [0.3, -0.52]] },
      set: (c) => desk(c, 0.18, 0.74, -0.53), props: (c) => { solid(c, [[0.4, -0.545], [0.62, -0.545], [0.62, -0.53], [0.4, -0.53]]); } },
  ],
  courier: [
    { name: 'carrying', pose: { pelvis: [0, -0.5], lean: 4, feet: [[-0.12, -0.03], [0.1, -0.03]], hands: [[0.16, -0.58], [0.3, -0.56]] }, props: (c) => parcel(c, [0.23, -0.6]) },
    { name: 'pushing', pose: { pelvis: [-0.05, -0.49], lean: 15, feet: [[-0.24, -0.03], [0.04, -0.03]], hands: [[0.26, -0.62], [0.3, -0.64]] },
      set: (c) => { line(c, [[0.3, -0.68], [0.32, -0.16]], 1.2); solid(c, [[0.3, -0.16], [0.8, -0.16], [0.8, -0.12], [0.3, -0.12]]); [[0.4, -0.05], [0.7, -0.05]].forEach(([x, y]) => line(c, Array.from({ length: 13 }, (_, k): Pt => [x + Math.cos((k / 12) * 6.283) * 0.05, y + Math.sin((k / 12) * 6.283) * 0.05]), 1.1)); parcel(c, [0.5, -0.23], 0.17, 0.13); parcel(c, [0.68, -0.21], 0.14, 0.09); } },
    { name: 'reaching', pose: { pelvis: [0, -0.51], lean: 3, feet: [[-0.04, -0.03], [0.06, -0.03]], hands: [[-0.02, -0.46], [0.27, -0.98]], elbows: ['down', 'up'] },
      set: (c) => { solid(c, [[0.34, -1.04], [0.6, -1.04], [0.6, -0.86], [0.34, -0.86]]); line(c, [[0.34, -0.95], [0.6, -0.95]], 0.8, 0.6); } },
  ],
  stock: [
    { name: 'climbing', pose: { pelvis: [0.08, -0.62], lean: 8, feet: [[0.1, -0.3], [0.14, -0.1]], hands: [[0.24, -0.86], [0.27, -0.97]] },
      set: (c) => { line(c, [[0.17, 0], [0.31, -1.06]], 1.4); line(c, [[0.26, 0], [0.4, -1.06]], 1.4); [0.1, 0.3, 0.5, 0.7, 0.9].forEach((t) => line(c, [[0.17 + 0.14 * t, -1.06 * t], [0.26 + 0.14 * t, -1.06 * t]], 1.1)); } },
    { name: 'reaching', pose: { pelvis: [0, -0.49], lean: 5, feet: [[-0.06, -0.03], [0.07, -0.03]], hands: [[0.18, -1.0], [0.25, -1.03]], elbows: ['up', 'up'] },
      set: (c) => { solid(c, [[0.1, -1.1], [0.62, -1.1], [0.62, -1.08], [0.1, -1.08]]); [0.14, 0.2, 0.26, 0.32, 0.38].forEach((x, i) => solid(c, [[x, -1.08 - 0.07 - (i % 2) * 0.012], [x + 0.045, -1.08 - 0.07 - (i % 2) * 0.012], [x + 0.045, -1.08], [x, -1.08]])); } },
    { name: 'ledger', pose: { pelvis: [0, -0.5], lean: -2, feet: [[-0.08, -0.03], [0.07, -0.03]], hands: [[0.15, -0.64], [0.23, -0.6]] },
      props: (c) => { solid(c, [[0.14, -0.7], [0.26, -0.7], [0.26, -0.55], [0.14, -0.55]]); line(c, [[0.17, -0.66], [0.23, -0.66]], 0.8, 0.7); } },
  ],
  cataloguer: [
    { name: 'writing', pose: { pelvis: [-0.05, -0.3], lean: 14, head: 14, feet: [[0.14, -0.03], [0.22, -0.03]], hands: [[0.26, -0.5], [0.33, -0.5]] },
      set: (c) => { line(c, [[-0.14, -0.28], [0.04, -0.28]], 1.4); line(c, [[-0.14, -0.28], [-0.14, -0.62]], 1.4); line(c, [[-0.12, -0.28], [-0.12, 0]], 1.1); line(c, [[0.02, -0.28], [0.02, 0]], 1.1); desk(c, 0.18, 0.7, -0.53); },
      props: (c) => solid(c, [[0.36, -0.55], [0.56, -0.55], [0.56, -0.53], [0.36, -0.53]]) },
    { name: 'pointing', pose: { pelvis: [0, -0.49], lean: 0, feet: [[-0.06, -0.03], [0.06, -0.03]], hands: [[0.05, -0.52], [0.37, -0.78]], elbows: ['back', 'up'] } },
    { name: 'holding plate', pose: { pelvis: [0, -0.49], lean: 0, feet: [[-0.06, -0.03], [0.06, -0.03]], hands: [[0.17, -0.72], [0.24, -0.68]] },
      props: (c) => { solid(c, [[0.14, -0.78], [0.3, -0.78], [0.3, -0.63], [0.14, -0.63]]); line(c, [[0.17, -0.73], [0.27, -0.73]], 0.9, 0.8); line(c, [[0.17, -0.69], [0.25, -0.69]], 0.9, 0.8); } },
  ],
  counter: [
    { name: 'handing across', pose: { pelvis: [-0.02, -0.5], lean: 9, feet: [[-0.08, -0.03], [0.04, -0.03]], hands: [[0.12, -0.58], [0.34, -0.64]] },
      props: (c) => { solid(c, [[0.28, -0.68], [0.42, -0.68], [0.42, -0.6], [0.28, -0.6]]); solid(c, [[0.12, -0.6], [0.7, -0.6], [0.7, 0], [0.12, 0]]); line(c, [[0.14, -0.57], [0.68, -0.57]], 0.8, 0.5); } },
    { name: 'listening', pose: { pelvis: [-0.05, -0.5], lean: 24, head: 10, feet: [[-0.15, -0.03], [-0.02, -0.03]], hands: [[-0.04, -0.46], [0.26, -0.61]], elbows: ['back', 'down'] },
      props: (c) => { solid(c, [[0.1, -0.6], [0.68, -0.6], [0.68, 0], [0.1, 0]]); } },
    { name: 'writing', pose: { pelvis: [0, -0.5], lean: 16, head: 14, feet: [[-0.1, -0.03], [0.03, -0.03]], hands: [[0.22, -0.6], [0.27, -0.61]] },
      props: (c) => { solid(c, [[0.1, -0.6], [0.68, -0.6], [0.68, 0], [0.1, 0]]); } },
  ],
  customer: [
    { name: 'asking', pose: { pelvis: [0.01, -0.5], lean: 9, head: -12, feet: [[-0.07, -0.03], [0.09, -0.03]], hands: [[0.17, -0.6], [0.24, -0.93]], elbows: ['down', 'up'] },
      props: (c) => { solid(c, [[0.14, -0.66], [0.25, -0.66], [0.25, -0.56], [0.14, -0.56]]); line(c, [[0.16, -0.62], [0.23, -0.62]], 0.8, 0.6); } },
    { name: 'walking', pose: { pelvis: [0, -0.5], lean: 3, feet: [[-0.15, -0.03], [0.14, -0.03]], hands: [[0.07, -0.5], [-0.08, -0.46]] } },
    { name: 'receiving', pose: { pelvis: [0, -0.5], lean: 6, feet: [[-0.06, -0.03], [0.07, -0.03]], hands: [[0.24, -0.64], [0.3, -0.6]] },
      props: (c) => solid(c, [[0.26, -0.66], [0.38, -0.66], [0.38, -0.58], [0.26, -0.58]]) },
  ],
};

export interface Extra { noSet?: boolean; noProps?: boolean; handsW?: [Pt | null, Pt | null]; pelvisDy?: number; lean?: number; head?: number }
export function drawPose(p: Pen, parent: Element, role: string, def: PoseDef, x: number, y: number, H: number, flip = false, ex: Extra = {}): Joints {
  const g = p.g(parent);
  const look = LOOKS[role];
  const c: Ctx = { p, g, x, y, H: H * look.h, flip };
  if (!ex.noSet) def.set?.(c);
  const pose = { ...def.pose, hands: [...def.pose.hands] as [Pt, Pt], pelvis: [def.pose.pelvis[0], def.pose.pelvis[1] + (ex.pelvisDy ?? 0)] as Pt, lean: ex.lean ?? def.pose.lean, head: ex.head ?? def.pose.head };
  ex.handsW?.forEach((w, i) => { if (w) pose.hands[i] = [((w[0] - x) * (flip ? -1 : 1)) / (H * look.h), (w[1] - y) / (H * look.h)]; });
  const j = FIG.mode === 'jointed' ? drawFigure(p, g, look, pose, { x, y, H, flip }) : drawSolid(p, g, look, pose, { x, y, H, flip }, FIG.mode);
  if (!ex.noProps) def.props?.(c, j);
  void rectPts; void hatchBox; void standF; void hang;
  return j;
}
