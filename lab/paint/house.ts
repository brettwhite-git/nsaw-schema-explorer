// The house of Aldous & Fig, in elevation: nineteen bays, six storeys and a roof storey, strictly symmetrical.
// Built in design coordinates (ground line y = 468, axis x = 600); the exterior uses them as-is and the cutaway scales them.
import { Rng, hash } from './rng';
import { Item, Kit, Mat, PAL, Poly, Pt, arc, archPts, smooth } from './kit';

export const AX = 600, BASE = 468;
const FINE = 0.3;
export let NIGHT = false;
export function setNight(n: boolean): void { NIGHT = n; }

// ---- palette for the house (dusty, warm; pink walls, deeper pink base, cream dressings, grey-blue slate)
export const HP = {
  wall: '#EFA9B8', wallP: '#F3B6C2', wallLow: '#E08C9E', wallSh: '#B87A95', trim: '#F5E5CB', trimSh: '#CDB2A6',
  slate: '#7E8DAA', slateSh: '#56648A', slateHi: '#A3B0C6', iron: '#2E2433', glass: '#6F6A8E', glassLit: '#FFD486',
  brick: '#B46F6E', gold: '#D6A03C', rasp: '#E23D5F', rose: '#E79AAE', curtain: '#D35C78', shutter: '#8A9DB0', stone: '#A08C9A',
};

// ---- small helpers: everything on the house is drawn fine (tight edges, steadier line)
type K = Kit;
const P = (k: K, p: Pt[], c: string, mat: Mat, ink = 1, o: Partial<Poly> = {}): void => k.poly(p, c, mat, { ink, knock: 1, fine: FINE, ...o });
const Rr = (k: K, x: number, y: number, w: number, h: number, c: string, mat: Mat, ink = 1, o: Partial<Poly> = {}): void => k.rect(x, y, w, h, c, mat, { ink, knock: 1, fine: FINE, ...o });
const G = (k: K, p: Pt[], c: string, a: number): void => k.poly(p, c, 'glaze', { alpha: a, knock: 0, fine: FINE });
const GR = (k: K, x: number, y: number, w: number, h: number, c: string, a: number): void => G(k, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], c, a);
const Ln = (k: K, p: Pt[], c = PAL.ink, w = 0.5, a = 0.5): void => k.line(p, c, w, a);
const circ = (x: number, y: number, r: number, n = 10): Pt[] => arc(x, y, r, r, 0, 2 * Math.PI, n);
const mir = (x: number): number => 2 * AX - x;

// ---- the plan: sections left to right; depth = how far the mass projects (for shading)
export interface Sec { x0: number; x1: number; bays: number[]; depth: number; kind: 'T' | 'P' | 'W' | 'F' | 'C'; }
const HALF: Sec[] = [
  { x0: 274, x1: 318, bays: [296], depth: 3, kind: 'T' },
  { x0: 318, x1: 388, bays: [339.5, 366.5], depth: 2, kind: 'P' },
  { x0: 388, x1: 484, bays: [404, 436, 468], depth: 0, kind: 'W' },
  { x0: 484, x1: 548, bays: [500, 532], depth: 1, kind: 'F' },
];
const CEN: Sec = { x0: 548, x1: 652, bays: [572, 600, 628], depth: 3, kind: 'C' };
export const SECS: Sec[] = [...HALF, CEN, ...HALF.slice().reverse().map((s) => ({ ...s, x0: mir(s.x1), x1: mir(s.x0), bays: s.bays.map(mir).reverse() }))];
export const BAYS: number[] = SECS.flatMap((s) => s.bays);
const secOf = (b: number): Sec => SECS.find((s) => s.bays.includes(BAYS[b]))!;

// floors: [bottom, top]; F0 ground (rusticated) .. F5 attic
export const FL: [number, number][] = [[468, 424], [424, 384], [384, 348], [348, 314], [314, 282], [282, 258]];
export const CORNICE = 258, ROOF_TOP = 222, PAV_TOP = 202, TOWER_DRUM = 232;

// ---- windows and the lives behind them
export type Kind = 'dark' | 'lit' | 'curtains' | 'lace' | 'blind' | 'shut' | 'lamp' | 'desk' | 'couple' | 'cat' | 'plant' | 'rug' | 'cage'
  | 'scope' | 'peek' | 'vitrine' | 'chef' | 'chandelier' | 'boxes' | 'door';
type Top = 'arch' | 'pedi' | 'seg' | 'hood' | 'ear' | 'sq';
interface Win { x: number; yb: number; w: number; h: number; top: Top; kind: Kind; shutters?: boolean; rust?: boolean; }

const STORIES: Record<string, Kind> = {
  '0:6': 'vitrine', '0:7': 'vitrine', '0:11': 'vitrine', '0:12': 'vitrine', '0:8': 'chef', '0:10': 'boxes', '0:9': 'door',
  '1:4': 'rug', '1:14': 'couple', '1:9': 'chandelier',
  '2:3': 'desk', '2:15': 'cage', '3:12': 'cat', '3:6': 'plant', '3:9': 'lamp', '4:16': 'peek', '4:2': 'lamp', '5:1': 'scope', '5:17': 'blind',
};
const LIT_P = [0.75, 0.62, 0.48, 0.38, 0.32, 0.3];
export function kindAt(floor: number, bay: number, seed: number): Kind {
  const s = STORIES[`${floor}:${bay}`]; if (s) return s;
  const m = Math.min(bay, 18 - bay); // lit pattern mirrors across the axis, so the facade reads composed
  const lit = NIGHT ? hash(floor, m, seed + 5) < 0.9 : hash(floor, m, seed + 5) < LIT_P[floor];
  const v = hash(floor * 31 + 7, bay, seed + 9);
  if (lit) return v < 0.3 ? 'curtains' : v < 0.5 ? 'lit' : v < 0.62 ? 'lamp' : v < 0.74 ? 'blind' : v < 0.86 ? 'lace' : 'curtains';
  return v < 0.14 ? 'shut' : v < 0.3 ? 'lace' : v < 0.4 ? 'blind' : 'dark';
}
const isLit = (k: Kind): boolean => !['dark', 'shut', 'lace', 'cat', 'scope'].includes(k) || (NIGHT && k !== 'shut');

function figure(k: K, x: number, yb: number, s: number, col = '#3A2A3C', hat = false): void {
  P(k, circ(x, yb - s * 0.78, s * 0.13, 8), col, 'glass', 0);
  P(k, [[x - s * 0.24, yb], [x - s * 0.2, yb - s * 0.52], [x, yb - s * 0.6], [x + s * 0.2, yb - s * 0.52], [x + s * 0.24, yb]], col, 'glass', 0);
  if (hat) P(k, [[x - s * 0.1, yb - s * 0.88], [x - s * 0.13, yb - s * 1.12], [x + s * 0.13, yb - s * 1.12], [x + s * 0.1, yb - s * 0.88]], '#F6EEE2', 'cloth', 1);
}

function interior(k: K, w: Win, rng: Rng): void {
  const { x, yb, w: ww, h, kind } = w, x0 = x - ww / 2, x1 = x + ww / 2, yt = yb - h, lit = isLit(kind);
  if (lit) { GR(k, x0, yb - h * 0.28, ww, h * 0.28, '#D9925E', 0.35); }
  else G(k, [[x0, yt + h * 0.15], [x0 + ww * 0.7, yt], [x1, yt], [x1, yt + h * 0.12], [x0, yb - h * 0.25]], '#E6D6EA', 0.4); // sky caught in the glass
  const drape = (c: string): void => { for (const s of [-1, 1]) { const e = x + (s * ww) / 2; P(k, [[e, yt + 1], [e - s * ww * 0.3, yt + 1], [e - s * ww * 0.12, yb - h * 0.45], [e - s * ww * 0.2, yb], [e, yb]], c, 'cloth', 0, { alpha: 0.95 }); } };
  switch (kind) {
    case 'curtains': drape(rng.chance(0.5) ? HP.curtain : HP.rose); break;
    case 'lace': P(k, [[x0, yb], [x0, yb - h * 0.5], [x, yb - h * 0.44], [x1, yb - h * 0.5], [x1, yb]], '#F4EAD8', 'cloth', 0, { alpha: 0.75 }); break;
    case 'blind': { const d = h * (0.35 + rng.next() * 0.3); Rr(k, x0, yt, ww, d, '#F2E3C8', 'trim', 0); Ln(k, [[x0, yt + d], [x1, yt + d]], '#9B7F72', 0.6, 0.6); break; }
    case 'peek': { const d = h * 0.66; Rr(k, x0, yt, ww, d, '#F2E3C8', 'trim', 0); P(k, circ(x + ww * 0.12, yt + d + 3, 2.6, 8), '#E9B59A', 'skin', 0); Ln(k, [[x0, yt + d], [x1, yt + d]], '#9B7F72', 0.6, 0.6); break; }
    case 'lamp': Ln(k, [[x - ww * 0.18, yb - 1], [x - ww * 0.18, yb - h * 0.3]], '#6E4A3A', 0.6, 0.8); P(k, [[x - ww * 0.18 - 3.4, yb - h * 0.3], [x - ww * 0.18 + 3.4, yb - h * 0.3], [x - ww * 0.18 + 2, yb - h * 0.45], [x - ww * 0.18 - 2, yb - h * 0.45]], '#F08AA2', 'cloth', 1); drape(HP.rose); break;
    case 'desk': Rr(k, x0, yb - h * 0.3, ww, 2, '#6E4A3A', 'wood', 0); figure(k, x - ww * 0.15, yb - h * 0.3 + 1, h * 0.55); P(k, [[x + ww * 0.18, yb - h * 0.3], [x + ww * 0.32, yb - h * 0.3], [x + ww * 0.28, yb - h * 0.42], [x + ww * 0.22, yb - h * 0.42]], '#4F8A68', 'cloth', 1); break;
    case 'couple': figure(k, x - ww * 0.2, yb, h * 0.7); figure(k, x + ww * 0.2, yb, h * 0.66); break;
    case 'chef': figure(k, x, yb, h * 0.6, '#3A2A3C', true); break;
    case 'chandelier': { const cy = yt + h * 0.42; Ln(k, [[x, yt + 4], [x, cy]], '#8A5A1C', 0.5, 0.8); P(k, [[x - 5, cy], [x + 5, cy], [x + 3, cy + 3], [x - 3, cy + 3]], HP.gold, 'gold', 1); drape(HP.curtain); break; }
    case 'cage': { const cy = yt + h * 0.55; P(k, [...arc(x, cy, 3.6, 4.5, Math.PI, 2 * Math.PI, 6), [x + 3.6, cy + 4], [x - 3.6, cy + 4]], '#F8E6B0', 'glow', 1); Ln(k, [[x, yt + 2], [x, cy - 4.5]], '#8A5A1C', 0.5, 0.8); P(k, circ(x, cy + 1, 1.2, 6), '#E7B92E', 'gold', 0); drape(HP.rose); break; }
    case 'boxes': for (const [dx, dy, bw, bh, c] of [[-0.25, 0, 0.4, 0.22, HP.rasp], [0.18, 0, 0.36, 0.26, '#8FA8C8'], [-0.05, -0.22, 0.34, 0.18, '#B7A2CC']] as [number, number, number, number, string][]) { const bx = x + dx * ww, by = yb + dy * h; Rr(k, bx - (bw * ww) / 2, by - bh * h, bw * ww, bh * h, '#F5E7CF', 'box', 1); Rr(k, bx - 0.7, by - bh * h, 1.4, bh * h, c, 'ribbon', 0); } break;
    case 'vitrine': {
      // a tiered cake on a stand, flanked by ribboned boxes: the shop
      Rr(k, x - 1, yb - h * 0.32, 2, h * 0.32, HP.gold, 'gold', 0);
      [[0.5, 0.16], [0.36, 0.14], [0.22, 0.12]].reduce((y, [tw, th]) => { Rr(k, x - (tw * ww) / 2, y - th * h, tw * ww, th * h, '#FBF0E4', 'box', 1); Ln(k, [[x - (tw * ww) / 2, y - th * h + 1.2], [x + (tw * ww) / 2, y - th * h + 1.2]], '#E9708C', 0.9, 0.8); return y - th * h; }, yb - h * 0.32);
      P(k, circ(x, yb - h * 0.32 - h * 0.42 - 1.6, 1.6, 6), HP.rasp, 'cloth', 0);
      for (const s of [-1, 1]) { const bx = x + s * ww * 0.34; Rr(k, bx - 3, yb - 7, 6, 7, '#F5E7CF', 'box', 1); Rr(k, bx - 0.6, yb - 7, 1.2, 7, s < 0 ? HP.rasp : '#8FA8C8', 'ribbon', 0); }
      break;
    }
    case 'scope': { Ln(k, [[x - 2, yb - 2], [x + ww * 0.6, yt + h * 0.25]], '#C08A3A', 1.6, 0.95); Ln(k, [[x - 2, yb], [x - 4, yb - 6]], PAL.ink, 0.5, 0.7); break; }
    case 'rug': figure(k, x + ww * 0.08, yb, h * 0.62); break;
    case 'door': break;
    default: break;
  }
}

function winHead(k: K, w: Win): void {
  const { x, yb, w: ww, h, top } = w, x0 = x - ww / 2, x1 = x + ww / 2, yt = yb - h, sw = 2.2;
  if (top === 'arch') {
    P(k, [[x - 1.8, yt - sw - 0.6], [x + 1.8, yt - sw - 0.6], [x + 1.3, yt + 3], [x - 1.3, yt + 3]], HP.trim, 'trim', 1); // keystone
  } else if (top === 'pedi') {
    P(k, [[x0 - 4, yt - 3], [x1 + 4, yt - 3], [x, yt - 10]], HP.trim, 'trim', 1);
    G(k, [[x0 - 3, yt - 3], [x1 + 3, yt - 3], [x1 + 3, yt - 1], [x0 - 3, yt - 1]], HP.wallSh, 0.55);
    G(k, [[x, yt - 10], [x1 + 4, yt - 3], [x + 3, yt - 3]], HP.trimSh, 0.5);
  } else if (top === 'seg') {
    P(k, [...arc(x, yt + 4, ww / 2 + 4, 7, Math.PI, 2 * Math.PI, 8)], HP.trim, 'trim', 1);
  } else if (top === 'hood' || top === 'ear') {
    Rr(k, x0 - 4, yt - 5, ww + 8, 2.6, HP.trim, 'trim', 1);
    GR(k, x0 - 3, yt - 2.4, ww + 7, 2.2, HP.wallSh, 0.55);
    for (let i = 0; i < 4; i++) Rr(k, x0 - 1 + (i * (ww + 2)) / 3 - 0.6, yt - 2.6, 1.2, 2, HP.trimSh, 'trim', 0);
    if (top === 'ear') for (const s of [-1, 1]) Rr(k, x + s * (ww / 2 + 2) - 1.2, yt - 2, 2.4, 3, HP.trim, 'trim', 1);
  }
}

function window_(k: K, w: Win, rng: Rng, railing = false): void {
  const { x, yb, w: ww, h, top, kind } = w, x0 = x - ww / 2, x1 = x + ww / 2, yt = yb - h, sw = 2.2;
  const arched = top === 'arch' || top === 'seg' && false;
  const shape = (pad: number): Pt[] => (arched ? archPts(x, yb, ww + pad * 2, h + pad, 8) : [[x0 - pad, yb], [x0 - pad, yt - pad], [x1 + pad, yt - pad], [x1 + pad, yb]]);
  if (w.rust && arched) for (let i = 0; i <= 8; i++) { const a = Math.PI + (i * Math.PI) / 8, r0 = ww / 2 + sw, r1 = r0 + 4.5; Ln(k, [[x + Math.cos(a) * r0, yt + ww / 2 + Math.sin(a) * r0], [x + Math.cos(a) * r1, yt + ww / 2 + Math.sin(a) * r1]], '#8E5A6A', 0.6, 0.55); }
  if (w.shutters && kind !== 'shut') for (const s of [-1, 1]) { const sx = s < 0 ? x0 - sw - ww * 0.48 : x1 + sw; Rr(k, sx, yt, ww * 0.48, h, HP.shutter, 'wood', 1); for (let y = yt + 2.5; y < yb - 1; y += 2.4) Ln(k, [[sx + 0.8, y], [sx + ww * 0.48 - 0.8, y]], '#4E5E70', 0.35, 0.45); }
  P(k, shape(sw), HP.trim, 'trim', 1);
  const lit = isLit(kind);
  P(k, shape(0), lit ? HP.glassLit : HP.glass, lit ? 'glow' : 'glass', 0);
  interior(k, w, rng);
  if (kind === 'shut') { for (const s of [-1, 1]) { const sx = s < 0 ? x0 : x; Rr(k, sx, yt + (arched ? ww / 2 : 0), ww / 2, h - (arched ? ww / 2 : 0), HP.shutter, 'wood', 1); for (let y = yt + (arched ? ww / 2 : 0) + 2; y < yb - 1; y += 2.4) Ln(k, [[sx + 0.6, y], [sx + ww / 2 - 0.6, y]], '#4E5E70', 0.35, 0.45); } }
  // glazing bars
  const spring = arched ? yt + ww / 2 : yt;
  if (kind !== 'door' && kind !== 'vitrine') { Ln(k, [[x, yb], [x, yt + 0.5]], '#4A3A48', 0.45, 0.55); Ln(k, [[x0, spring + (yb - spring) * 0.38], [x1, spring + (yb - spring) * 0.38]], '#4A3A48', 0.45, 0.55); }
  else Ln(k, [[x0, spring], [x1, spring]], '#4A3A48', 0.5, 0.6);
  // reveals: light from the left, so the left jamb and the head throw shade onto the glass
  G(k, [[x0, yb], [x0, spring], [x0 + 1.8, spring + 1.5], [x0 + 1.8, yb]], '#2E2342', 0.42);
  if (!arched) GR(k, x0, yt, ww, 1.6, '#2E2342', 0.35); else G(k, arc(x, spring, ww / 2, ww / 2, Math.PI, 1.6 * Math.PI, 5).concat([[x, spring + 1.5]]), '#2E2342', 0.3);
  // sill and its shadow
  Rr(k, x0 - 3, yb, ww + 6, 2.2, HP.trim, 'trim', 1);
  G(k, [[x0 - 2, yb + 2.2], [x1 + 4, yb + 2.2], [x1 + 4, yb + 4.4], [x0 - 1, yb + 4.4]], HP.wallSh, 0.5);
  winHead(k, w);
  if (kind === 'cat') { const cx = x1 - 2.5, cy = yb; P(k, [[cx - 3, cy], [cx - 2.6, cy - 4], [cx, cy - 5], [cx + 2.4, cy - 3.6], [cx + 2.6, cy]], '#2A2030', 'glass', 0); P(k, [[cx - 2.2, cy - 4.4], [cx - 2, cy - 7], [cx - 1, cy - 5.6], [cx + 0.4, cy - 7], [cx + 0.6, cy - 4.6]], '#2A2030', 'glass', 0); Ln(k, [[cx + 2.6, cy], [cx + 4.5, cy + 2], [cx + 4, cy + 4]], '#2A2030', 0.7, 0.9); }
  if (kind === 'plant') { Rr(k, x0 - 1, yb - 1, ww + 2, 3.4, '#A0604A', 'wood', 1); for (let i = 0; i < 7; i++) { const fx = x0 + (i + 0.5) * (ww / 7); P(k, circ(fx, yb - 2.5 - (i % 2), 1.3, 6), i % 2 ? '#E2445E' : '#5E8A5A', 'plant', 0); } }
  if (railing) balcony(k, x, yb, ww, kind === 'rug');
}

function balcony(k: K, x: number, yb: number, ww: number, rug: boolean): void {
  const x0 = x - ww / 2 - 5, x1 = x + ww / 2 + 5;
  Rr(k, x0, yb + 1, x1 - x0, 2.6, HP.trim, 'trim', 1);
  for (const s of [-1, 1]) P(k, [[x + s * (ww / 2 + 2), yb + 3.6], [x + s * (ww / 2 + 4.5), yb + 3.6], [x + s * (ww / 2 + 3.6), yb + 7.5], [x + s * (ww / 2 + 2.6), yb + 7.5]], HP.trim, 'trim', 1);
  G(k, [[x0, yb + 3.6], [x1, yb + 3.6], [x1 + 3, yb + 9], [x0 + 2, yb + 9]], HP.wallSh, 0.45);
  Ln(k, [[x0 + 0.5, yb - 7], [x1 - 0.5, yb - 7]], HP.iron, 0.8, 0.9);
  for (let bx = x0 + 1.5; bx < x1 - 1; bx += 2.1) Ln(k, [[bx, yb + 1], [bx, yb - 7]], HP.iron, 0.4, 0.7);
  Ln(k, [[x0 + 1, yb - 3], [x1 - 1, yb - 3]], HP.iron, 0.35, 0.5);
  if (rug) { P(k, [[x - 7, yb - 7.5], [x + 6, yb - 7.5], [x + 6.5, yb + 9], [x - 6.5, yb + 9]], '#C4445E', 'cloth', 1); for (let i = 0; i < 6; i++) Ln(k, [[x - 6 + i * 2.4, yb + 9], [x - 6 + i * 2.4, yb + 11]], '#C4445E', 0.4, 0.8); Ln(k, [[x - 4, yb - 2], [x + 4, yb - 2]], '#F2C46A', 0.8, 0.8); }
}

// ---- walls and dressings
function quoins(k: K, x0: number, x1: number, yt: number, yb: number): void {
  let i = 0;
  for (let y = yb - 6; y > yt + 1; y -= 6, i++) {
    const a = i % 2 ? 5 : 9;
    Rr(k, x0, y, a, 5.4, HP.trim, 'trim', 1); Rr(k, x1 - (i % 2 ? 9 : 5), y, i % 2 ? 9 : 5, 5.4, HP.trim, 'trim', 1);
  }
}
function rustication(k: K, x0: number, x1: number, yt: number, yb: number): void {
  for (let y = yb - 5; y > yt + 2; y -= 5) Ln(k, [[x0 + 0.5, y], [x1 - 0.5, y]], '#9C5E74', 0.45, 0.42);
  for (let y = yb - 4.6; y > yt + 2; y -= 5) Ln(k, [[x0 + 0.5, y], [x1 - 0.5, y]], '#FBD3DA', 0.4, 0.35);
}
function stringCourse(k: K, x0: number, x1: number, y: number, h = 3, dent = false): void {
  Rr(k, x0 - 1.5, y - h, x1 - x0 + 3, h, HP.trim, 'trim', 1);
  GR(k, x0 - 1, y, x1 - x0 + 2, 2.4, HP.wallSh, 0.5);
  if (dent) for (let x = x0 + 1; x < x1 - 1; x += 3) Rr(k, x, y - h - 1.6, 1.4, 1.6, HP.trimSh, 'trim', 0);
}
function cornice(k: K, x0: number, x1: number, y: number): void {
  Rr(k, x0 - 4, y - 8, x1 - x0 + 8, 3, HP.trim, 'trim', 1);
  Rr(k, x0 - 3, y - 5, x1 - x0 + 6, 3.2, '#FBF0DE', 'trim', 1);
  for (let x = x0 - 1; x < x1; x += 4.2) P(k, [[x, y - 1.8], [x + 2, y - 1.8], [x + 1.6, y + 2.4], [x + 0.4, y + 2.4]], HP.trim, 'trim', 0); // modillions
  G(k, [[x0 - 3, y + 2.4], [x1 + 3, y + 2.4], [x1 + 3, y + 8], [x0 - 3, y + 8]], '#8E5F80', 0.5); // cast shadow of the cornice
}
function cresting(k: K, x0: number, x1: number, y: number): void {
  Ln(k, [[x0, y], [x1, y]], HP.iron, 0.8, 0.9);
  for (let x = x0 + 1.5; x < x1 - 1; x += 3.2) { Ln(k, [[x, y], [x, y - 3.2]], HP.iron, 0.45, 0.8); }
  for (let x = x0 + 3.1; x < x1 - 1; x += 6.4) P(k, circ(x, y - 3.4, 0.9, 5), HP.iron, 'metal', 0);
}
function slates(k: K, pts: Pt[], x0: number, x1: number, yt: number, yb: number, rng: Rng): void {
  // slate courses: horizontal lines with staggered butt-joints; the left third catches the low sun, the right third falls away
  const w = x1 - x0;
  for (let y = yb - 3.4, r = 0; y > yt + 1.5; y -= 3.4, r++) {
    const t = (yb - y) / (yb - yt), ix = (pts[1][0] - pts[0][0]) * t;
    Ln(k, [[x0 + ix, y], [x1 - ix, y]], '#3F4A66', 0.35, 0.32);
    for (let x = x0 + ix + 2 + (r % 2) * 2.5 + rng.range(0, 1); x < x1 - ix - 2; x += 5) Ln(k, [[x, y], [x, y - 3.2]], '#3F4A66', 0.3, 0.22);
  }
  G(k, [[x0, yb], [pts[1][0], yt], [x0 + w * 0.3, yt], [x0 + w * 0.26, yb]], HP.slateHi, 0.4);
  G(k, [[x0 + w * 0.7, yb], [x0 + w * 0.72, yt], [pts[2][0], yt], [x1, yb]], HP.slateSh, 0.45);
}
function mansard(k: K, rng: Rng, x0: number, x1: number, yb: number, yt: number, dorm: number[], style: 'pedi' | 'arch'): void {
  const inset = (yb - yt) * 0.35, pts: Pt[] = [[x0 - 3, yb], [x0 - 3 + inset, yt], [x1 + 3 - inset, yt], [x1 + 3, yb]];
  P(k, pts, HP.slate, 'roof', 1);
  slates(k, pts, x0 - 3, x1 + 3, yt, yb, rng);
  cresting(k, x0 - 3 + inset, x1 + 3 - inset, yt);
  for (const dx of dorm) dormer(k, dx, yb - 2, style);
}
function dormer(k: K, x: number, yb: number, style: 'pedi' | 'arch' | 'oeil', kind: Kind = 'dark'): void {
  const w = 11, h = 15, yt = yb - h;
  Rr(k, x - w / 2 - 2.5, yt, w + 5, h, HP.trim, 'trim', 1);
  G(k, [[x + w / 2, yt], [x + w / 2 + 2.5, yt], [x + w / 2 + 2.5, yb], [x + w / 2, yb]], HP.trimSh, 0.5);
  if (style === 'oeil') { P(k, circ(x, yt + 7, 4.6, 12), NIGHT || kind !== 'dark' ? HP.glassLit : HP.glass, 'glass', 1); Ln(k, [[x - 4.6, yt + 7], [x + 4.6, yt + 7]], '#4A3A48', 0.4, 0.5); }
  else { const lit = NIGHT ? kind !== 'dark' || true : kind !== 'dark'; P(k, archPts(x, yb - 1.5, w - 3, h - 4, 6), lit ? HP.glassLit : HP.glass, lit ? 'glow' : 'glass', 0); Ln(k, [[x, yb - 1.5], [x, yt + 4]], '#4A3A48', 0.4, 0.5); G(k, [[x - w / 2 + 1.5, yb - 1.5], [x - w / 2 + 1.5, yt + 6], [x - w / 2 + 2.8, yt + 6], [x - w / 2 + 2.8, yb - 1.5]], '#2E2342', 0.4); }
  if (style === 'pedi') { P(k, [[x - w / 2 - 4, yt + 0.5], [x + w / 2 + 4, yt + 0.5], [x, yt - 7]], HP.trim, 'trim', 1); G(k, [[x, yt - 7], [x + w / 2 + 4, yt + 0.5], [x + 2, yt + 0.5]], HP.trimSh, 0.5); }
  else { P(k, [[x - w / 2 - 3.5, yt + 0.5], ...arc(x, yt + 0.5, w / 2 + 3.5, 7, Math.PI, 2 * Math.PI, 8).slice(1, -1), [x + w / 2 + 3.5, yt + 0.5]], HP.slateSh, 'roof', 1); }
  Ln(k, [[x, yt - (style === 'pedi' ? 7 : 6.5)], [x, yt - 11]], HP.iron, 0.6, 0.9); P(k, circ(x, yt - 11.5, 0.9, 5), HP.gold, 'gold', 0);
}
function chimney(k: K, x: number, yb: number, h: number): void {
  Rr(k, x - 5, yb - h, 10, h, HP.brick, 'stone', 1);
  for (let y = yb - h + 3; y < yb; y += 3) Ln(k, [[x - 4.5, y], [x + 4.5, y]], '#7A4248', 0.3, 0.35);
  GR(k, x + 1.5, yb - h, 3.5, h, '#5E3A4E', 0.4);
  Rr(k, x - 6.5, yb - h - 2.5, 13, 3, HP.trim, 'trim', 1);
  for (const s of [-2.5, 2.5]) { Rr(k, x + s - 1.4, yb - h - 6.5, 2.8, 4, '#C9805E', 'stone', 1); }
}
export const CHIMNEYS: Pt[] = [[420, ROOF_TOP + 2], [452, ROOF_TOP + 2], [mir(420), ROOF_TOP + 2], [mir(452), ROOF_TOP + 2]].map(([x, y]) => [x, y - 6.5 - 16] as Pt);

function dome(k: K, cx: number, yb: number, r: number, h: number): void {
  const prof: Pt[] = [[cx - r, yb], [cx - r * 1.02, yb - h * 0.3], [cx - r * 0.82, yb - h * 0.66], [cx - r * 0.42, yb - h * 0.9], [cx, yb - h]];
  const side = smooth([...prof, ...prof.slice(0, -1).reverse().map(([x, y]): Pt => [2 * cx - x, y])], false, 5);
  P(k, [...side], HP.slate, 'roof', 2);
  // ribs, following the profile; scale rows between
  for (const f of [-0.72, -0.36, 0, 0.36, 0.72]) Ln(k, prof.map(([x, y]): Pt => [cx + (x - cx) * -f, y]).slice(0, -1).concat([[cx, yb - h]]), '#3F4A66', 0.5, 0.45);
  for (let t = 0.12; t < 0.9; t += 0.13) { const y = yb - h * t, hw = r * (1 - Math.pow(t, 2.2) * 0.9); Ln(k, arc(cx, y - 1.5, hw, 2.6, 0.05 * Math.PI, 0.95 * Math.PI, 8), '#3F4A66', 0.35, 0.3); }
  G(k, side.filter(([x]) => x <= cx - r * 0.25).concat([[cx - r * 0.25, yb]]), HP.slateHi, 0.45);
  G(k, side.filter(([x]) => x >= cx + r * 0.2).concat([[cx + r * 0.2, yb]]), HP.slateSh, 0.55);
}
function lantern(k: K, cx: number, yb: number): number {
  Rr(k, cx - 6, yb - 12, 12, 12, HP.trim, 'trim', 1);
  for (const s of [-1, 1]) P(k, archPts(cx + s * 2.8, yb - 2, 3, 8, 5), NIGHT ? HP.glassLit : '#8C86A8', 'glass', 0);
  Rr(k, cx - 7.5, yb - 14, 15, 2.4, HP.trim, 'trim', 1);
  P(k, [[cx - 6, yb - 14], ...arc(cx, yb - 14, 6, 8, Math.PI, 2 * Math.PI, 8).slice(1, -1), [cx + 6, yb - 14]], HP.slateSh, 'roof', 1);
  Ln(k, [[cx, yb - 22], [cx, yb - 40]], HP.iron, 0.9, 0.95); P(k, circ(cx, yb - 24, 1.5, 6), HP.gold, 'gold', 1);
  return yb - 40;
}
function flag(k: K, x: number, y: number, s: number): void {
  P(k, [[x, y], [x + 18 * s, y + 2.5], [x + 13 * s, y + 5], [x + 18 * s, y + 8], [x, y + 9]], HP.rasp, 'cloth', 1);
  G(k, [[x + 9 * s, y + 1.5], [x + 18 * s, y + 2.5], [x + 13 * s, y + 5], [x + 9 * s, y + 6]], '#7A2240', 0.3);
}
function clock(k: K, x: number, y: number, r: number): void {
  P(k, circ(x, y, r + 2.4, 18), HP.gold, 'gold', 1);
  P(k, circ(x, y, r, 18), '#FBF3E2', 'trim', 1);
  for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; Ln(k, [[x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78], [x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92]], PAL.ink, i % 3 ? 0.4 : 0.8, 0.8); }
  Ln(k, [[x, y], [x - r * 0.32, y - r * 0.46]], PAL.ink, 0.9, 0.9); Ln(k, [[x, y], [x + r * 0.62, y - r * 0.3]], PAL.ink, 0.6, 0.9);
}
function urn(k: K, x: number, yb: number, s = 1): void {
  P(k, smooth([[x - 2.4 * s, yb], [x + 2.4 * s, yb], [x + 1.2 * s, yb - 2 * s], [x + 3.6 * s, yb - 5 * s], [x + 3 * s, yb - 8 * s], [x - 3 * s, yb - 8 * s], [x - 3.6 * s, yb - 5 * s], [x - 1.2 * s, yb - 2 * s]], true, 3), HP.trim, 'trim', 1);
  G(k, [[x + 0.5 * s, yb - 8 * s], [x + 3 * s, yb - 8 * s], [x + 3.6 * s, yb - 5 * s], [x + 1 * s, yb - 2 * s]], HP.trimSh, 0.5);
}
function lampStandard(k: K, x: number, yb: number, h: number): void {
  Rr(k, x - 2.2, yb - 4, 4.4, 4, HP.iron, 'metal', 0);
  Ln(k, [[x, yb - 4], [x, yb - h]], HP.iron, 1.1, 0.95);
  for (const s of [-1, 1]) { Ln(k, [[x, yb - h + 4], [x + s * 5, yb - h + 1]], HP.iron, 0.6, 0.9); P(k, circ(x + s * 5, yb - h - 1.5, 2.4, 8), '#FFE8A8', 'glow', 1); }
  P(k, circ(x, yb - h - 3.5, 2.8, 8), '#FFE8A8', 'glow', 1);
  if (NIGHT) k.poly(circ(x, yb - h - 2, 22, 16), '#FFE2A0', 'mist', { alpha: 0.32, knock: 0 });
}

// ---- elevation
function section(k: K, s: Sec, rng: Rng, seed: number, cut: [number, number] | null): void {
  const top = s.kind === 'T' ? TOWER_DRUM : CORNICE, wall = s.kind === 'W' ? HP.wall : HP.wallP;
  Rr(k, s.x0, top, s.x1 - s.x0, BASE - top, wall, 'wall', 1);
  Rr(k, s.x0, FL[0][1], s.x1 - s.x0, BASE - FL[0][1], HP.wallLow, 'wall', 0);
  rustication(k, s.x0, s.x1, FL[0][1], BASE);
  if (s.kind === 'P' || s.kind === 'T' || s.kind === 'C') quoins(k, s.x0, s.x1, top, BASE);
  // storeys
  const bayIdx = (x: number): number => BAYS.indexOf(x);
  FL.forEach(([yb, yt], f) => {
    if (f > 0) stringCourse(k, s.x0, s.x1, yb, f === 1 ? 3.4 : f === 5 ? 3.6 : 2.4, f === 5);
    s.bays.forEach((x) => {
      const b = bayIdx(x); if (cut && x > cut[0] && x < cut[1]) return;
      const kind = kindAt(f, b, seed), hh = yb - yt;
      if (f === 0) {
        if (kind === 'door') return;
        if (kind === 'vitrine') { window_(k, { x, yb: yb - 3, w: 20, h: hh - 9, top: 'arch', kind, rust: true }, rng); awning(k, x, yt + 14, 24); return; }
        window_(k, { x, yb: yb - 6, w: 13, h: hh - 14, top: 'arch', kind, rust: true }, rng); return;
      }
      if (f === 1) { if (s.kind === 'C') return; window_(k, { x, yb: yb - 5, w: 13.5, h: hh - 15, top: s.kind === 'T' ? 'arch' : 'pedi', kind, shutters: false }, rng, s.kind !== 'T'); return; }
      if (f === 2) { window_(k, { x, yb: yb - 4, w: 12.5, h: hh - 11, top: 'arch', kind }, rng); return; }
      if (f === 3) { window_(k, { x, yb: yb - 4, w: 12.5, h: hh - 12, top: 'hood', kind, shutters: s.kind === 'W' && b % 2 === 0 }, rng); return; }
      if (f === 4) { window_(k, { x, yb: yb - 4, w: 12, h: hh - 12, top: 'ear', kind, shutters: s.kind === 'P' }, rng); return; }
      window_(k, { x, yb: yb - 6, w: 10, h: 10, top: 'sq', kind }, rng);
    });
  });
  // giant order on the frontispiece
  if (s.kind === 'C') {
    for (const px of [552.5, 586, 614, 647.5]) {
      Rr(k, px - 2.6, FL[4][1] + 2, 5.2, FL[1][0] - FL[4][1] - 2, HP.trim, 'trim', 1);
      GR(k, px + 0.8, FL[4][1] + 2, 1.8, FL[1][0] - FL[4][1] - 2, HP.trimSh, 0.5);
      Rr(k, px - 4, FL[4][1] - 1, 8, 3.4, HP.trim, 'trim', 1); Rr(k, px - 3.6, FL[1][0] - 3, 7.2, 3, HP.trim, 'trim', 1);
    }
    // piano nobile: three tall French windows on one long balcony
    s.bays.forEach((x, i) => window_(k, { x, yb: FL[1][0] - 5, w: 15, h: 30 + (i === 1 ? 2 : 0), top: i === 1 ? 'arch' : 'pedi', kind: kindAt(1, bayIdx(x), seed) }, rng));
    Rr(k, 556, FL[1][0] - 4, 88, 3, HP.trim, 'trim', 1);
    G(k, [[556, FL[1][0] - 1], [644, FL[1][0] - 1], [646, FL[1][0] + 5], [558, FL[1][0] + 5]], HP.wallSh, 0.5);
    Ln(k, [[557, FL[1][0] - 12], [643, FL[1][0] - 12]], HP.iron, 0.9, 0.9);
    for (let x = 558; x < 643; x += 2.2) Ln(k, [[x, FL[1][0] - 4], [x, FL[1][0] - 12]], HP.iron, 0.4, 0.7);
    for (let x = 562; x < 642; x += 13) P(k, [[x, FL[1][0] - 1], [x + 3, FL[1][0] - 1], [x + 2.4, FL[1][0] + 5], [x + 0.6, FL[1][0] + 5]], HP.trim, 'trim', 0);
  }
  if (s.kind === 'W' || s.kind === 'F' || s.kind === 'P' || s.kind === 'C') cornice(k, s.x0, s.x1, CORNICE);
  // modelling: projecting masses darken toward their right edge, and cast a shadow onto the next mass to the right
  const w = s.x1 - s.x0;
  if (s.depth >= 2) GR(k, s.x1 - w * 0.12, top, w * 0.12, BASE - top, HP.wallSh, 0.28);
  const i = SECS.indexOf(s), nxt = SECS[i + 1];
  if (nxt && s.depth > nxt.depth) GR(k, nxt.x0, s.kind === 'T' ? CORNICE : top, 3 + (s.depth - nxt.depth) * 3, BASE - (s.kind === 'T' ? CORNICE : top), '#9A6A8E', 0.42);
  // warm light thrown up from the snow onto the lower storeys
  GR(k, s.x0, FL[1][0] - 20, w, 20, '#F7C9A8', 0.18); GR(k, s.x0, FL[0][1], w, BASE - FL[0][1], '#F7C9A8', 0.14);
}

function awning(k: K, x: number, y: number, w: number): void {
  const x0 = x - w / 2, x1 = x + w / 2;
  P(k, [[x0, y], [x1, y], [x1 + 3, y + 7], [x0 - 3, y + 7]], HP.rasp, 'cloth', 1);
  for (let i = 0; i < 6; i += 2) { const a = x0 + (i * w) / 6, b = x0 + ((i + 1) * w) / 6; P(k, [[a, y], [b, y], [b + ((b - x) / w) * 6, y + 7], [a + ((a - x) / w) * 6, y + 7]], '#F8EBDA', 'cloth', 0); }
  for (let i = 0; i < 6; i++) P(k, arc(x0 - 3 + (i + 0.5) * ((w + 6) / 6), y + 7, (w + 6) / 12, 2.4, 0, Math.PI, 5), i % 2 ? '#F8EBDA' : HP.rasp, 'cloth', 1);
  G(k, [[x0 - 2, y + 9.5], [x1 + 3, y + 9.5], [x1 + 6, y + 16], [x0 + 1, y + 16]], '#7A3B5D', 0.35);
}

function roofs(k: K, rng: Rng, seed: number): void {
  // wings and flanks: one mansard each side, dormers over the bays, chimneys on the ridge
  for (const sgn of [1, -1]) {
    const X = (x: number): number => (sgn > 0 ? x : mir(x));
    const [a, b] = sgn > 0 ? [388, 548] : [mir(548), mir(388)];
    mansard(k, rng, a, b, CORNICE - 7, ROOF_TOP, [404, 436, 468, 500, 532].map(X), 'pedi');
    for (const cx of [420, 452]) chimney(k, X(cx), ROOF_TOP + 2, 16);
  }
  // laundry strung between two dormers on the right wing: a small story on the roof
  Ln(k, ([[mir(468), CORNICE - 18], [mir(500) - 1, CORNICE - 17], [mir(436), CORNICE - 18]] as Pt[]).sort((p, q) => p[0] - q[0]), '#6E5A62', 0.4, 0.6);
  [[mir(476), 0], [mir(484), 1], [mir(492), 0]].forEach(([x, c]) => Rr(k, x - 2, CORNICE - 17.5, 4, 4.5, c ? '#F6EEE2' : '#9DB8D2', 'cloth', 1));
  // pavilion roofs: tall and steep, an oeil-de-boeuf, cresting and finials
  for (const sgn of [1, -1]) {
    const [a, b] = sgn > 0 ? [318, 388] : [mir(388), mir(318)], cx = (a + b) / 2;
    const pts: Pt[] = [[a - 3, CORNICE - 7], [a + 8, PAV_TOP], [b - 8, PAV_TOP], [b + 3, CORNICE - 7]];
    P(k, pts, HP.slate, 'roof', 1); slates(k, pts, a - 3, b + 3, PAV_TOP, CORNICE - 7, rng);
    cresting(k, a + 8, b - 8, PAV_TOP);
    for (const fx of [a + 8, b - 8]) { Ln(k, [[fx, PAV_TOP], [fx, PAV_TOP - 9]], HP.iron, 0.8, 0.9); P(k, circ(fx, PAV_TOP - 9.5, 1.2, 6), HP.gold, 'gold', 0); }
    dormer(k, cx, CORNICE - 12, 'oeil', hash(sgn, 3, seed) < 0.5 ? 'lit' : 'dark');
  }
  // towers: a drum storey with a round window, a cornice, a ribbed dome, a lantern and a flag
  for (const sgn of [1, -1]) {
    const [a, b] = sgn > 0 ? [274, 318] : [mir(318), mir(274)], cx = (a + b) / 2;
    stringCourse(k, a, b, CORNICE, 3);
    P(k, circ(cx, (CORNICE + TOWER_DRUM) / 2 + 1, 7.5, 16), HP.trim, 'trim', 1);
    P(k, circ(cx, (CORNICE + TOWER_DRUM) / 2 + 1, 5.4, 14), NIGHT || sgn > 0 ? HP.glassLit : HP.glass, sgn > 0 ? 'glow' : 'glass', 0);
    Ln(k, [[cx - 5.4, (CORNICE + TOWER_DRUM) / 2 + 1], [cx + 5.4, (CORNICE + TOWER_DRUM) / 2 + 1]], '#4A3A48', 0.4, 0.5);
    cornice(k, a, b, TOWER_DRUM);
    dome(k, cx, TOWER_DRUM - 8, (b - a) / 2 + 1, 40);
    const top = lantern(k, cx, TOWER_DRUM - 46);
    flag(k, cx, top, sgn);
  }
}

function frontispiece(k: K, rng: Rng, seed: number): void {
  // attic storey above the cornice, then a gable with the clock; urns on the corners
  const a = 548, b = 652, yA = CORNICE - 8, yG = yA - 26;
  Rr(k, a + 2, yG, b - a - 4, yA - yG, HP.wallP, 'wall', 1);
  quoins(k, a + 2, b - 2, yG, yA);
  [578, 600, 622].forEach((x, i) => window_(k, { x, yb: yA - 5, w: 9, h: 14, top: 'arch', kind: kindAt(5, 8 + i, seed) === 'dark' ? 'dark' : 'lit' }, rng));
  GR(k, b - 14, yG, 12, yA - yG, HP.wallSh, 0.25);
  cornice(k, a + 2, b - 2, yG);
  const apex = yG - 36;
  P(k, [[a - 2, yG - 8], [b + 2, yG - 8], [AX, apex]], HP.trim, 'trim', 2);
  P(k, [[a + 10, yG - 11], [b - 10, yG - 11], [AX, apex + 7]], HP.wallP, 'wall', 1);
  G(k, [[AX, apex + 7], [b - 10, yG - 11], [AX + 10, yG - 11]], HP.wallSh, 0.4);
  for (let x = a + 4; x < b - 4; x += 3.4) { const t = Math.abs(x - AX) / ((b - a) / 2); const y = yG - 8 - (1 - t) * (yG - 8 - apex); Rr(k, x, y + 0.5, 1.3, 1.6, HP.trimSh, 'trim', 0); }
  clock(k, AX, yG - 21, 8);
  urn(k, a + 1, yG - 8, 1.2); urn(k, b - 1, yG - 8, 1.2);
  Ln(k, [[AX, apex], [AX, apex - 8]], HP.iron, 0.8, 0.9); P(k, circ(AX, apex - 8.5, 1.6, 6), HP.gold, 'gold', 1);
}

function entrance(k: K, rng: Rng): void {
  const x = AX, yb = BASE, w = 26, h = 34;
  P(k, archPts(x, yb, w + 8, h + 5, 12), HP.trim, 'trim', 2);
  for (let i = 0; i <= 10; i++) { const a = Math.PI + (i * Math.PI) / 10, r0 = w / 2 + 4, r1 = r0 + 6; Ln(k, [[x + Math.cos(a) * r0, yb - h + w / 2 + Math.sin(a) * r0], [x + Math.cos(a) * r1, yb - h + w / 2 + Math.sin(a) * r1]], '#8E5A6A', 0.6, 0.55); }
  P(k, archPts(x, yb, w, h, 12), HP.glassLit, 'glow', 1);
  for (const s of [-1, 1]) { Rr(k, x + (s < 0 ? -w / 2 + 1.5 : 1.5), yb - h + w / 2 + 2, w / 2 - 3, h - w / 2 - 3, '#C69A5A', 'wood', 1); Rr(k, x + (s < 0 ? -w / 2 + 3.5 : 3.5), yb - h + w / 2 + 4, w / 2 - 7, (h - w / 2) * 0.45, '#FFE2A0', 'glow', 0); }
  for (let i = 1; i < 6; i++) { const a = Math.PI + (i * Math.PI) / 6; Ln(k, [[x, yb - h + w / 2], [x + Math.cos(a) * (w / 2), yb - h + w / 2 + Math.sin(a) * (w / 2)]], '#8A5A1C', 0.5, 0.7); }
  P(k, [[x - 2.5, yb - h - 5.5], [x + 2.5, yb - h - 5.5], [x + 1.8, yb - h + 1], [x - 1.8, yb - h + 1]], HP.trim, 'trim', 1);
  // a glazed iron marquise: a fan of glass on brackets
  const cy = yb - h + 6, cw = 46;
  P(k, [[x - cw / 2, cy], [x + cw / 2, cy], [x + cw / 2 + 4, cy + 9], [x - cw / 2 - 4, cy + 9]], '#CFE0E4', 'glass', 1, { alpha: 0.85 });
  for (let i = 0; i <= 8; i++) { const t = i / 8; Ln(k, [[x - cw / 2 + t * cw, cy], [x - cw / 2 - 4 + t * (cw + 8), cy + 9]], HP.iron, 0.5, 0.85); }
  Ln(k, [[x - cw / 2 - 4, cy + 9], [x + cw / 2 + 4, cy + 9]], HP.iron, 1, 0.95);
  for (let i = 0; i < 12; i++) P(k, arc(x - cw / 2 - 4 + (i + 0.5) * ((cw + 8) / 12), cy + 9, (cw + 8) / 24, 1.8, 0, Math.PI, 4), HP.gold, 'gold', 0);
  for (const s of [-1, 1]) Ln(k, [[x + s * (cw / 2 + 2), cy + 9], [x + s * (w / 2 + 6), cy - 8]], HP.iron, 0.6, 0.9);
  G(k, [[x - cw / 2 - 2, cy + 11], [x + cw / 2 + 6, cy + 11], [x + cw / 2 + 10, cy + 20], [x - cw / 2 + 2, cy + 20]], '#6E3B5A', 0.3);
  // a plaque over the door for the crisp lettering
  Rr(k, x - 22, yb - h - 15, 44, 8, '#5A2D4B', 'plum', 1);
  Ln(k, [[x - 20.5, yb - h - 13.5], [x + 20.5, yb - h - 13.5], [x + 20.5, yb - h - 8.5], [x - 20.5, yb - h - 8.5], [x - 20.5, yb - h - 13.5]], HP.gold, 0.6, 0.9);
  for (let i = 0; i < 3; i++) Rr(k, x - 20 - i * 3, yb + 1 + i * 2.6, 40 + i * 6, 2.6, i % 2 ? '#D9C6C4' : '#EADCD8', 'stone', 1);
  void rng;
}

export function signItems(k: K): void {
  // the plaque: an annular sector on two iron posts, standing over the gable
  const { cx, cy, ri, ro, th } = SIGN;
  const top = arc(cx, cy, ro, ro, -Math.PI / 2 - th, -Math.PI / 2 + th, 30), bot = arc(cx, cy, ri, ri, -Math.PI / 2 + th, -Math.PI / 2 - th, 30);
  for (const s of [-1, 1]) { const x = cx + s * ri * Math.sin(th) * 0.7; Ln(k, [[x, cy - ri * Math.cos(th * 0.7) + 2], [x, CORNICE - 10]], HP.iron, 1.1, 0.95); }
  P(k, [...top, ...bot], '#5A2D4B', 'plum', 2);
  const t2 = arc(cx, cy, ro - 3, ro - 3, -Math.PI / 2 - th + 0.012, -Math.PI / 2 + th - 0.012, 30), b2 = arc(cx, cy, ri + 3, ri + 3, -Math.PI / 2 + th - 0.012, -Math.PI / 2 - th + 0.012, 30);
  Ln(k, [...t2, ...b2, t2[0]], HP.gold, 1, 0.95);
  for (const s of [-1, 1]) { const a = -Math.PI / 2 + s * (th + 0.035), r = (ri + ro) / 2; P(k, circ(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 6, 12), HP.rasp, 'cloth', 1); P(k, circ(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.6, 8), HP.gold, 'gold', 0); }
  P(k, circ(cx, cy - ro - 4, 3, 8), HP.gold, 'gold', 1);
}
export const SIGN = { cx: AX, cy: 372, ri: 194, ro: 220, th: 0.4 };

function terrace(k: K, rng: Rng, cut: [number, number] | null): void {
  // the terrace: a paved strip, a balustrade with piers and urns, then the retaining wall of coursed stone with an arcade
  const x0 = 206, x1 = 994, yT = BASE + 9, yW = BASE + 22, yF = 548;
  Rr(k, x0, BASE, x1 - x0, yT - BASE, '#E7D3D3', 'stone', 1);
  GR(k, x0, BASE, x1 - x0, 3, '#7E5A7E', 0.3);
  // retaining wall
  Rr(k, x0 - 6, yW, x1 - x0 + 12, yF - yW, HP.stone, 'stone', 1);
  for (let y = yW + 5, r = 0; y < yF; y += 5, r++) {
    Ln(k, [[x0 - 5, y], [x1 + 5, y]], '#6E5866', 0.4, 0.35);
    for (let x = x0 - 6 + (r % 2) * 6 + rng.range(0, 3); x < x1 + 5; x += 12 + rng.range(-2, 2)) Ln(k, [[x, y - 5], [x, y]], '#6E5866', 0.35, 0.28);
  }
  // a row of arches in the wall: dark vaults with cream voussoirs
  const arches = 13, sp = (x1 - x0 - 40) / arches;
  for (let i = 0; i < arches; i++) {
    const ax = x0 + 20 + (i + 0.5) * sp, aw = sp * 0.62, ah = (yF - yW) * 0.72;
    if (cut && ax > cut[0] - 10 && ax < cut[1] + 10) continue;
    for (let j = 0; j <= 9; j++) { const a = Math.PI + (j * Math.PI) / 9, r0 = aw / 2, r1 = r0 + 4; P(k, [[ax + Math.cos(a) * r0, yF - ah + aw / 2 + Math.sin(a) * r0], [ax + Math.cos(a) * r1, yF - ah + aw / 2 + Math.sin(a) * r1], [ax + Math.cos(a + 0.3) * r1, yF - ah + aw / 2 + Math.sin(a + 0.3) * r1], [ax + Math.cos(a + 0.3) * r0, yF - ah + aw / 2 + Math.sin(a + 0.3) * r0]], '#E5D6D0', 'stone', 0); }
    P(k, archPts(ax, yF, aw, ah, 10), NIGHT && i % 3 === 1 ? '#C98A4A' : '#4E4060', 'glass', 1);
    G(k, archPts(ax - aw * 0.15, yF, aw * 0.7, ah * 0.9, 8), '#2A2038', 0.4);
  }
  GR(k, x0 - 6, yW, x1 - x0 + 12, 5, '#5E4A68', 0.35);
  // coping, balustrade, piers and urns
  Rr(k, x0 - 8, yW - 3, x1 - x0 + 16, 4, HP.trim, 'trim', 1);
  const bal = (a: number, b: number): void => {
    Rr(k, a, yT - 1, b - a, 2.6, HP.trim, 'trim', 1); Rr(k, a, yW - 5.5, b - a, 2.6, HP.trim, 'trim', 1);
    for (let x = a + 2; x < b - 1.5; x += 3.6) P(k, [[x, yT + 1.6], [x + 1.8, yT + 1.6], [x + 1.4, yT + 4], [x + 2.2, yT + 6.5], [x + 1.6, yW - 5.5], [x + 0.2, yW - 5.5], [x - 0.4, yT + 6.5], [x + 0.4, yT + 4]], HP.trim, 'trim', 0);
    GR(k, a, yW - 3, b - a, 1.5, '#6E5A7E', 0.35);
  };
  const piers = [x0, 266, 340, 420, 500, 568, mir(568), mir(500), mir(420), mir(340), mir(266), x1 - 8];
  for (let i = 0; i < piers.length - 1; i++) { if (i === 5) continue; bal(piers[i] + 8, piers[i + 1]); }
  for (const px of piers) { Rr(k, px, yT - 4, 8, yW - yT + 1, HP.trim, 'trim', 1); GR(k, px + 5, yT - 4, 3, yW - yT + 1, HP.trimSh, 0.5); if (px !== 568 && px !== mir(568)) urn(k, px + 4, yT - 4, 1); }
  lampStandard(k, 568 + 4, yT - 4, 26); lampStandard(k, mir(568) - 4, yT - 4, 26);
  // a double stair down the face of the retaining wall, flights splitting left and right
  for (const s of [-1, 1]) {
    const xa = AX + s * 22, xb = AX + s * 120;
    const band: Pt[] = [[xa, yW - 1], [xa + s * 14, yW - 1], [xb + s * 14, yF], [xb, yF]];
    P(k, band, '#EADCD8', 'stone', 1);
    for (let t = 0.06; t < 1; t += 0.06) { const x = xa + (xb - xa) * t, y = yW - 1 + (yF - yW + 1) * t; Ln(k, [[x, y], [x + s * 14, y]], '#9A8090', 0.4, 0.5); }
    Ln(k, [[xa, yW - 7], [xb, yF - 7]], HP.trim, 1.6, 0.95);
    for (let t = 0.05; t < 1; t += 0.05) { const x = xa + (xb - xa) * t, y = yW - 1 + (yF - yW + 1) * t; Ln(k, [[x, y], [x, y - 6]], HP.trim, 0.6, 0.8); }
    G(k, [[xa + s * 14, yW], [xb + s * 14, yF], [xb + s * 24, yF], [xa + s * 18, yW + 4]].map(([x, y]): Pt => [x, y]), '#5E4A68', 0.3);
  }
  // the building's own shadow, thrown on the terrace to the right of the frontispiece
  G(k, [[652, BASE], [664, BASE], [676, yT], [652, yT]], '#6E4A7E', 0.35);
}

function conservatory(k: K, rng: Rng, x0: number, x1: number): void {
  const cx = (x0 + x1) / 2, w = x1 - x0, yb = BASE, yS = yb - 26, r = w / 2;
  const body: Pt[] = [[x0, yb], [x0, yS], ...arc(cx, yS, r, 22, Math.PI, 2 * Math.PI, 16).slice(1, -1), [x1, yS], [x1, yb]];
  P(k, body, '#BFD6D6', 'glass', 1, { alpha: 0.9 });
  P(k, body.map(([x, y]): Pt => [cx + (x - cx) * 0.9, yb - (yb - y) * 0.9]), NIGHT ? '#FFD890' : '#E6EEDD', 'glow', 0, { alpha: 0.6 });
  for (let i = 0; i < 7; i++) { const px = x0 + 5 + i * ((w - 10) / 6), ph = rng.range(8, 20); P(k, [[px - 3, yb], [px - 1.5, yb - ph * 0.7], [px + 0.5, yb - ph], [px + 3, yb]], i % 2 ? '#4E7A5A' : '#6E9A6A', 'plant', 0); }
  P(k, circ(cx, yb - 18, 5, 10), '#4E7A5A', 'plant', 0);
  for (let i = 1; i < 8; i++) { const px = x0 + (w * i) / 8; Ln(k, [[px, yb], [px, yS - 22 * Math.sqrt(Math.max(0, 1 - ((px - cx) / r) ** 2))]], HP.trim, 0.9, 0.9); }
  for (const f of [0.35, 0.7]) Ln(k, arc(cx, yS, r, 22 * f, Math.PI, 2 * Math.PI, 14), HP.trim, 0.6, 0.7);
  Ln(k, arc(cx, yS, r, 22, Math.PI, 2 * Math.PI, 18), HP.trim, 1.4, 0.95);
  Ln(k, [[x0, yS], [x1, yS]], HP.trim, 1.2, 0.9); Ln(k, [[x0, yb - 12], [x1, yb - 12]], HP.trim, 0.8, 0.8);
  P(k, circ(cx, yS - 24, 2, 6), HP.gold, 'gold', 1);
  Rr(k, x0 - 2, yb - 4, w + 4, 4, HP.trim, 'trim', 1);
  G(k, [[cx + r * 0.35, yS - 20], ...arc(cx, yS, r, 22, 1.7 * Math.PI, 2 * Math.PI, 5), [x1, yb], [cx + r * 0.35, yb]], '#6A7E9A', 0.35);
}

function station(k: K, rng: Rng): void {
  // the upper funicular station: a pink pavilion at the right end of the terrace, its floor stepped to the track
  const x0 = 994, x1 = 1052, yb = 548, yt = 506;
  // a masonry pier carries it down onto the hill
  P(k, [[x0 + 4, yb], [x1 - 4, yb], [x1 + 2, 640], [x0 - 2, 640]], HP.stone, 'stone', 1);
  for (let y = yb + 5; y < 640; y += 5) Ln(k, [[x0 + 3, y], [x1 - 3, y]], '#6E5866', 0.35, 0.3);
  P(k, archPts((x0 + x1) / 2, 640, 24, 54, 8), '#45384E', 'glass', 1);
  GR(k, x1 - 14, yb, 16, 92, '#4A3A68', 0.35);
  Rr(k, x0, yt, x1 - x0, yb - yt, HP.wallP, 'wall', 1);
  quoins(k, x0, x1, yt, yb);
  for (const x of [1011, 1035]) window_(k, { x, yb: yb - 8, w: 12, h: 20, top: 'arch', kind: NIGHT ? 'lit' : 'lamp' }, rng);
  cornice(k, x0, x1, yt);
  const roof: Pt[] = [[x0 - 4, yt - 6], [x0 + 10, yt - 26], [x1 - 10, yt - 26], [x1 + 4, yt - 6]];
  P(k, roof, HP.slate, 'roof', 1); slates(k, roof, x0 - 4, x1 + 4, yt - 26, yt - 6, rng); cresting(k, x0 + 10, x1 - 10, yt - 26);
  // fretwork bargeboard under the eaves
  for (let x = x0 - 2; x < x1 + 2; x += 5) P(k, arc(x + 2.5, yt - 6, 2.5, 3, 0, Math.PI, 5), HP.trim, 'trim', 0);
  GR(k, x1 - 10, yt, 10, yb - yt, HP.wallSh, 0.35);
  Rr(k, x0 - 4, yb - 3, x1 - x0 + 8, 4, '#E5D6D0', 'stone', 1);
}

export interface HouseOpts { seed: number; night: boolean; cut: [number, number] | null; }
/** The house as items in design coordinates. `cut` leaves the facade out between two x positions (the cutaway's opening). */
export function houseItems(k: K, o: HouseOpts): void {
  NIGHT = o.night; const rng = new Rng(o.seed * 131 + 7);
  const cut = o.cut;
  conservatory(k, rng, 210, 270); conservatory(k, rng, mir(270), mir(210));
  roofs(k, rng, o.seed);
  frontispiece(k, rng, o.seed);
  signItems(k);
  for (const s of SECS) section(k, s, rng, o.seed, cut);
  if (!cut) entrance(k, rng);
  terrace(k, rng, cut);
  station(k, rng);
  if (NIGHT) {
    // warm light washing up the facade from the terrace lamps and the open door
    for (const [x, r] of [[572, 70], [628, 70], [AX, 110]] as [number, number][]) k.poly(arc(x, BASE - 10, r, r * 0.9, Math.PI, 2 * Math.PI, 18), '#FFD9A0', 'mist', { alpha: 0.28, knock: 0 });
  }
}
export function transformItems(items: Item[], z: number, ox: number, oy: number): Item[] {
  return items.map((it) => ({ ...it, pts: it.pts.map((v, i) => (i % 2 ? oy + (v - BASE) * z : ox + (v - AX) * z)), ...(it.k === 'line' ? { w: it.w * Math.sqrt(z) } : {}) } as Item));
}
