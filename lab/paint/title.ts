// Title card: a painted frame, fig branches, a ribboned box and flourishes on parchment. The words themselves are real SVG text.
import { Rng } from './rng';
import { Kit, PAL, Pt, Scene, arc, smooth } from './kit';
import { box } from './interior';

const W = 1200, H = 750;
const mirror = (p: Pt[]): Pt[] => p.map(([x, y]): Pt => [W - x, y]);

function leaf(k: Kit, x: number, y: number, a: number, s: number, col: string): void {
  const base: Pt[] = [[0, 0], [-10, -6], [-17, -17], [-6, -19], [0, -32], [6, -19], [17, -17], [10, -6]];
  const pts = smooth(base, true, 4).map(([px, py]): Pt => { const X = px * s, Y = py * s; return [x + X * Math.cos(a) - Y * Math.sin(a), y + X * Math.sin(a) + Y * Math.cos(a)]; });
  k.poly(pts, col, 'plant', { ink: 1, knock: 1 });
  const e = (t: number): Pt => { const X = 0, Y = -t * 28 * s; return [x + X * Math.cos(a) - Y * Math.sin(a), y + X * Math.sin(a) + Y * Math.cos(a)]; };
  k.line([e(0), e(1)], '#4F6446', 0.7, 0.6);
}
function fig(k: Kit, x: number, y: number, s: number): void {
  const pear: Pt[] = smooth([[0, -16 * s], [8 * s, -9 * s], [12 * s, 3 * s], [8 * s, 12 * s], [0, 15 * s], [-8 * s, 12 * s], [-12 * s, 3 * s], [-8 * s, -9 * s]], true, 5).map(([a, b]): Pt => [x + a, y + b]);
  k.poly(pear, '#7C4A78', 'plum', { ink: 1, knock: 1 });
  k.glaze(pear.filter((_, i) => i % 3 !== 1).map(([a, b]): Pt => [a * 0.5 + x * 0.5 + 4, b * 0.7 + y * 0.3]), '#2D1530', 0.35);
  k.poly(arc(x - 3, y + 1, 3.4, 2.4, 0, 2 * Math.PI, 8), '#F0A5B4', 'skin', { knock: 0, alpha: 0.7 });
  k.poly([[x - 1.5, y - 16 * s], [x + 1.5, y - 16 * s], [x + 1.5, y - 20 * s], [x - 1.5, y - 20 * s]], '#6F8764', 'plant', { ink: 1, knock: 1 });
}
function branch(k: Kit, rng: Rng, left: boolean): void {
  const spine: Pt[] = smooth([[440, 128], [360, 112], [280, 124], [214, 160], [168, 222], [150, 300]], false, 8);
  const P = left ? spine : mirror(spine);
  k.line(P, '#6B5A42', 2.4, 0.9);
  P.forEach(([x, y], i) => {
    if (i % 6 !== 3) return;
    const side = (i / 6) % 2 ? 1 : -1, ang = (left ? 1 : -1) * (side * 1.0 + 0.3) + (left ? 0 : 0);
    leaf(k, x, y, ang + (left ? -0.4 : 0.4) + rng.range(-0.15, 0.15), rng.range(0.9, 1.3), rng.chance(0.5) ? '#9DB08A' : '#86A07C');
  });
  [[0.35, 14], [0.62, -12], [0.82, 12]].forEach(([t, d]) => { const [x, y] = P[Math.floor(t * (P.length - 1))]; fig(k, x + (left ? 1 : -1) * d, y + 22, 1.1); });
}
function frame(k: Kit): void {
  const o = 44, i = 56;
  const rect = (m: number): Pt[] => [[m, m], [W - m, m], [W - m, H - m], [m, H - m], [m, m]];
  k.line(rect(o), '#5A2D4B', 2.4, 0.85); k.line(rect(i), '#5A2D4B', 0.9, 0.8);
  for (const [cx, cy, sx, sy] of [[o, o, 1, 1], [W - o, o, -1, 1], [o, H - o, 1, -1], [W - o, H - o, -1, -1]] as number[][]) {
    const T = (p: Pt[]): Pt[] => p.map(([x, y]): Pt => [cx + sx * x, cy + sy * y]);
    k.line(T(arc(22, 22, 20, 20, 0, 1.5 * Math.PI, 18).map(([x, y]): Pt => [x, y])), '#5A2D4B', 1.2, 0.8);
    const sp: Pt[] = []; for (let t = 0; t < 4.4; t += 0.2) { const r = 17 * Math.exp(-0.32 * t); sp.push([34 + Math.cos(t * 1.3) * r, 34 + Math.sin(t * 1.3) * r]); }
    k.line(T(sp), PAL.gold, 1.6, 0.95);
    k.poly(T(arc(10, 10, 5, 5, 0, 2 * Math.PI, 8)), PAL.rasp, 'cloth', { ink: 1, knock: 1 });
  }
}
function divider(k: Kit, y: number): void {
  const L = (p: Pt[]): void => { k.line(p, PAL.gold, 1.8, 0.95); k.line(mirror(p), PAL.gold, 1.8, 0.95); };
  L([[560, y], [470, y], [420, y - 8], [380, y - 6], [350, y + 4], [364, y + 14], [384, y + 6]]);
  L([[470, y + 3], [420, y + 10], [390, y + 18]]);
  k.poly([[600, y - 12], [612, y], [600, y + 12], [588, y]], PAL.rasp, 'cloth', { ink: 1, knock: 1 });
  k.poly(arc(572, y, 4, 4, 0, 2 * Math.PI, 8), PAL.gold, 'gold', { ink: 1, knock: 1 }); k.poly(arc(628, y, 4, 4, 0, 2 * Math.PI, 8), PAL.gold, 'gold', { ink: 1, knock: 1 });
}

export function buildTitle(seed: number): Scene {
  const rng = new Rng(seed * 211 + 9), k = new Kit(rng);
  // watercolour stains behind the lettering, uneven and pale
  k.poly(smooth([[190, 230], [420, 206], [760, 210], [1010, 232], [1020, 360], [760, 392], [420, 390], [180, 366]], true, 8), '#F4CFD2', 'mist', { alpha: 0.5, knock: 0 });
  k.next(); frame(k);
  k.next(); branch(k, rng, true); branch(k, rng, false);
  k.poly(arc(600, 138, 44, 44, 0, 2 * Math.PI, 26), PAL.plum, 'plum', { ink: 2, knock: 1 });
  k.line(arc(600, 138, 38, 38, 0, 2 * Math.PI, 26), PAL.gold, 1.6, 0.95);
  k.next(); divider(k, 380);
  k.next();
  box(k, 600, 562, 96, 70, -0.03, PAL.rasp, true, true);
  box(k, 478, 562, 56, 40, 0.06, '#8FA8C8'); box(k, 722, 562, 56, 40, -0.05, '#B7A2CC');
  k.glaze([[470, 562], [740, 562], [752, 576], [460, 576]], '#6B5C8E', 0.25);
  divider(k, 664);
  return { w: W, h: H, seed, items: k.items, skyStops: [] };
}
