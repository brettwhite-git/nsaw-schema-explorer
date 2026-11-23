// The grand establishing plate: the house of Aldous & Fig on its forested hill under a painted alpine backdrop.
// Five static paint layers (sky, far, hill, house, fore) plus sprites (the funicular car, chimney smoke) kept out of the plate.
import { Rng, fbm, mix, vnoise } from './rng';
import { Item, Kit, PAL, Pt, Scene, arc, smooth } from './kit';
import { BASE, CHIMNEYS, HP, houseItems, setNight, transformItems } from './house';

export const W = 1200, H = 750, CX = 600;
export type LayerName = 'sky' | 'far' | 'hill' | 'house' | 'fore';
export const LAYERS: LayerName[] = ['sky', 'far', 'hill', 'house', 'fore'];
export interface Grand { layers: Record<LayerName, Scene>; sprites: { car: Item[]; smoke: Item[][] }; night: boolean; counts: Record<string, number>; }

export const SKY_DUSK: [number, string][] = [[0, '#8E9CC8'], [0.22, '#ADA2C8'], [0.45, '#D9AFC0'], [0.68, '#F0BFAE'], [0.86, '#F7CFA8'], [1, '#F9DDB8']];
export const SKY_NIGHT: [number, string][] = [[0, '#141A4E'], [0.3, '#232A68'], [0.58, '#3E3A80'], [0.82, '#6E5592'], [1, '#B07890']];
let NIGHT = false;

// ---- geometry helpers
/** midpoint displacement between two points: a craggy line */
function crag(a: Pt, b: Pt, rough: number, depth: number, rng: Rng): Pt[] {
  if (depth === 0) return [a, b];
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const nx = -(b[1] - a[1]) / (len || 1), ny = (b[0] - a[0]) / (len || 1), d = rng.gauss() * rough * len * 0.5;
  const m: Pt = [mx + nx * d, my + ny * d];
  return [...crag(a, m, rough, depth - 1, rng).slice(0, -1), ...crag(m, b, rough, depth - 1, rng)];
}
/** upper envelope of a closed outline sampled every `step` px: env[i] = min y at x = x0 + i*step */
function envelope(pts: Pt[], x0: number, x1: number, step: number): number[] {
  const n = Math.ceil((x1 - x0) / step) + 1, e = new Array(n).fill(1e9);
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
    const lo = Math.max(0, Math.ceil((Math.min(ax, bx) - x0) / step)), hi = Math.min(n - 1, Math.floor((Math.max(ax, bx) - x0) / step));
    for (let j = lo; j <= hi; j++) { const x = x0 + j * step, t = bx === ax ? 0 : (x - ax) / (bx - ax); e[j] = Math.min(e[j], ay + (by - ay) * t); }
  }
  return e;
}
const gauss1 = (x: number, w: number): number => Math.exp(-(x * x) / (w * w));
const circ = (x: number, y: number, r: number, n = 10): Pt[] => arc(x, y, r, r, 0, 2 * Math.PI, n);

// ---- mountains: faceted massifs with arêtes, gullies, form-following snow, strata, fissures and scree
interface Tone { body: string; lit: string; shadow: string; snow: string; ink: number; mat: 'far' | 'rock'; detail: number; haze: string; hazeA: number; dry: number; }
interface Massif { x: number; top: number; base: number; wl: number; wr: number; snow: number; spurs: number; shL?: [number, number]; shR?: [number, number]; }

function massif(k: Kit, rng: Rng, m: Massif, t: Tone): void {
  const sum: Pt = [m.x, m.top], Lf: Pt = [m.x - m.wl, m.base], Rf: Pt = [m.x + m.wr, m.base], h = m.base - m.top;
  const [slx, sly] = m.shL ?? [0.45, 0.42], [srx, sry] = m.shR ?? [0.5, 0.5];
  const shL: Pt = [m.x - m.wl * slx, m.top + h * sly], shR: Pt = [m.x + m.wr * srx, m.top + h * sry];
  const rough = 0.09 + t.detail * 0.05, dep = t.detail > 0.5 ? 5 : 4;
  const left = [...crag(sum, shL, rough, dep, rng), ...crag(shL, Lf, rough * 0.8, dep, rng).slice(1)];
  const right = [...crag(sum, shR, rough, dep, rng), ...crag(shR, Rf, rough * 0.8, dep, rng).slice(1)];
  const outline: Pt[] = [...left.slice().reverse(), ...right.slice(1), [Rf[0], m.base + 40], [Lf[0], m.base + 40]];
  k.poly(outline, t.body, t.mat, { ink: t.ink, knock: 1, load: 0.95, fine: t.mat === 'far' ? 1.3 : 1, layers: t.mat === 'far' ? 8 : 12 });
  const x0 = Lf[0] - 2, x1 = Rf[0] + 2, step = 2, env = envelope(outline, x0, x1, step);
  const envAt = (x: number): number => env[Math.max(0, Math.min(env.length - 1, Math.round((x - x0) / step)))];
  // the main arête divides a lit face (left, warm) from a shadow face (right, cool)
  const foot: Pt = [m.x + m.wr * rng.range(0.1, 0.3), m.base + 10];
  const arete = crag(sum, foot, rough * 0.9, dep, rng);
  // spurs: secondary ridges running down each face; gullies lie to their right
  const spurs: Pt[][] = [];
  for (let i = 0; i < m.spurs; i++) {
    const onLeft = i % 2 === 0, fl = onLeft ? left : right, j = Math.floor(rng.range(0.15, 0.75) * (fl.length - 1)), s0 = fl[j];
    if (onLeft && s0[1] > m.base - h * 0.2) continue;
    const dx = (onLeft ? 1 : 1) * rng.range(0.05, 0.3) * (onLeft ? m.wl : m.wr) * (onLeft ? 1 : -0.3);
    spurs.push(crag(s0, [s0[0] + dx, m.base + 10], rough, dep - 1, rng));
  }
  // snow lies down from the ridge line, deeper in the gullies, thin on the spurs and steep faces; never a level cap
  const gullies = spurs.map((s) => s[Math.floor(s.length * 0.35)][0] + rng.range(5, 12)).concat(arete[Math.floor(arete.length * 0.35)][0] + rng.range(6, 14));
  const spurXs = spurs.map((s) => s[Math.floor(s.length * 0.25)][0]).concat(arete[Math.floor(arete.length * 0.25)][0]);
  const tongue = gullies.map(() => h * rng.range(0.14, 0.38)), tw = gullies.map(() => rng.range(3, 8));
  const depthAt = (x: number, e: number): number => {
    const lower = (e - m.top) / h; // 0 at the summit, 1 at the foot
    let d = h * m.snow * (0.25 + 1.2 * fbm(x * 0.045, m.top * 0.07, 7)) * Math.max(0, 1 - lower * 1.4);
    d += (vnoise(x * 0.5, 3, 9) - 0.5) * 3;
    gullies.forEach((g, i) => { d += tongue[i] * gauss1(x - g, tw[i]) * Math.max(0.2, 1 - lower); });
    spurXs.forEach((sx) => { d *= 1 - 0.75 * gauss1(x - sx, 5); });
    return d;
  };
  const ys = (x: number): number => { const e = envAt(x); return e + depthAt(x, e); };
  if (m.snow > 0) {
    let run: Pt[] = [], low: Pt[] = [];
    const flush = (): void => { if (run.length > 2) k.poly([...run, ...low.reverse()], t.snow, 'snow', { knock: 0.9, alpha: 0.96, load: 0.6, fine: 0.8, layers: 8 }); run = []; low = []; };
    for (let x = x0; x <= x1; x += step) { const e = envAt(x); if (e > 1e8 || e >= m.base) { flush(); continue; } const d = depthAt(x, e); if (d > 2) { run.push([x, e - 0.6]); low.push([x, Math.min(e + d, m.base + 4)]); } else flush(); }
    flush();
    // couloirs: thin snow streaks continuing down the gullies
    gullies.forEach((g) => {
      if (rng.next() > 0.8) return;
      const y0 = ys(g) - 2, len = h * rng.range(0.1, 0.3), dr = rng.range(-4, 4);
      const c: Pt[] = []; for (let q = 0; q <= 8; q++) c.push([g + dr * (q / 8) + rng.range(-1, 1), y0 + (len * q) / 8]);
      k.poly([...c.map(([x, y], q): Pt => [x - (2.4 * (1 - q / 8) + 0.4), y]), ...c.slice().reverse().map(([x, y], q): Pt => [x + (2.4 * (q / 8) + 0.4), y])], t.snow, 'snow', { knock: 0.8, alpha: 0.9, fine: 0.7 });
    });
    // rock ribs breaking through the snow along the spurs
    if (t.detail > 0.4) for (const sp of spurs.concat([arete])) { const top = sp.slice(0, Math.max(3, Math.floor(sp.length * 0.4))); k.poly([...top.map(([x, y]): Pt => [x - 0.8, y]), ...top.slice().reverse().map(([x, y], i): Pt => [x + 1.5 + i * 0.12, y + 1])], t.body, t.mat, { knock: 1, fine: 0.6, alpha: 0.9 }); }
  }
  // shadow face and the shadow sides of the spurs (glazed over the snow, which turns blue-violet in shade)
  k.poly([...arete, [Rf[0] + 2, m.base + 40], ...right.slice().reverse()], t.shadow, 'glaze', { alpha: 0.55, knock: 0, layers: 6 });
  for (const s of spurs) {
    const wd = rng.range(6, 16) * (0.5 + t.detail);
    const edge = s.map(([x, y], i): Pt => [x + wd * (i / (s.length - 1)) ** 0.7 + rng.range(-0.6, 0.6), y + 1]);
    k.poly([...s, ...edge.reverse()], t.shadow, 'glaze', { alpha: 0.36, knock: 0, layers: 4 });
  }
  // facets: a lit plane on the left of every spur, painted as rock so it takes its own wet edge and dry brush
  if (t.detail >= 0.5) for (const sp of spurs.concat([arete])) {
    const top = sp.slice(0, Math.max(3, Math.floor(sp.length * rng.range(0.55, 0.85)))), wd = rng.range(8, 22) * t.detail;
    const edge = top.map(([x, y], i): Pt => [x - wd * Math.pow(i / (top.length - 1), 0.6) - rng.range(0, 2), y + 1]);
    k.poly([...top, ...edge.reverse()], mix(t.body, t.lit, 0.3), t.mat, { alpha: 0.5, knock: 0, layers: 4, fine: 0.8 });
  }
  // fall-line strokes (shade, dragged down the slope) and lifted scratches of light on the lit face
  const nFall = Math.round(h * (m.wl + m.wr) * 0.0016 * t.detail);
  for (let i = 0; i < nFall; i++) {
    const x = rng.range(x0 + 4, x1 - 4), e = envAt(x); if (e > 1e8) continue;
    const y = rng.range(e + 2, m.base - 6), lit = x < m.x, a = Math.PI / 2 + (lit ? 0.45 : -0.45) + rng.range(-0.25, 0.25), L = rng.range(5, 18) * (0.5 + t.detail * 0.5);
    const pts: Pt[] = [[x, y], [x + Math.cos(a) * L * 0.5 + rng.range(-0.8, 0.8), y + Math.sin(a) * L * 0.5], [x + Math.cos(a) * L, y + Math.sin(a) * L]];
    if (rng.chance(lit ? 0.3 : 0.12)) k.line(pts, '#FFFFFF', rng.range(0.5, 1.1), 0.3 + t.detail * 0.15);
    else k.line(pts, t.shadow, rng.range(0.5, 1.2), rng.range(0.15, 0.32));
  }
  // warm light on the lit face, cool reflected light in the shadow
  k.poly([...left, [foot[0] - 6, m.base + 20], ...arete.slice().reverse()], t.lit, 'glaze', { alpha: 0.22, knock: 0, layers: 5 });
  // strata, fissures and snow ledges, proportional to detail
  const nStr = Math.round(h * (m.wl + m.wr) * 0.0008 * t.detail), dip = rng.range(-0.18, 0.12);
  for (let i = 0; i < nStr; i++) {
    const x = rng.range(x0 + 6, x1 - 6), e = envAt(x); if (e > 1e8) continue;
    const y = rng.range(e + 4, m.base - 4), L = rng.range(6, 26) * (0.6 + t.detail * 0.6);
    const pts: Pt[] = [[x, y], [x + L * 0.5, y + Math.sin(dip) * L * 0.5 + rng.range(-1, 1)], [x + L, y + Math.sin(dip) * L]];
    if (envAt(x + L) > y - 2) continue;
    const inSnow = y < ys(x);
    k.line(pts, inSnow ? '#8A86A8' : PAL.ink, rng.range(0.4, 0.8), inSnow ? 0.25 : 0.2 + t.detail * 0.18);
    if (!inSnow && x < m.x + 10 && rng.chance(0.45)) k.line(pts.slice(0, 2).map(([px, py]): Pt => [px + 1, py - 1.4]), '#FFFFFF', rng.range(0.7, 1.2), 0.25 + t.detail * 0.2);
  }
  const nF = Math.round(nStr * 0.6);
  for (let i = 0; i < nF; i++) {
    const x = rng.range(x0 + 6, x1 - 6), e = envAt(x); if (e > 1e8) continue;
    const y = rng.range(e + 3, m.base - 8), L = rng.range(5, 18), a = Math.PI / 2 + rng.range(-0.5, 0.5);
    k.line([[x, y], [x + Math.cos(a) * L * 0.5 + rng.range(-1, 1), y + Math.sin(a) * L * 0.5], [x + Math.cos(a) * L, y + Math.sin(a) * L]], PAL.ink, rng.range(0.4, 0.9), 0.16 + t.detail * 0.2);
  }
  // scree fans at the feet of the gullies
  if (t.detail > 0.4) for (const g of gullies) {
    const gy = m.base - 4, sw = rng.range(10, 22);
    k.poly([[g, gy - sw * 1.3], [g + sw, gy + 4], [g - sw * 0.9, gy + 4]], '#CFC4D6', 'glaze', { alpha: 0.4, knock: 0 });
    for (let d = 0; d < 10; d++) { const px = g + rng.range(-sw * 0.8, sw * 0.8), py = gy + rng.range(-sw * 0.5, 3); k.line([[px, py], [px + 0.8, py + 0.5]], '#6E6488', 0.8, 0.35); }
  }
  // haze at the foot
  k.poly([[x0 - 20, m.base + 30], ...Array.from({ length: 16 }, (_, i): Pt => [x0 + ((x1 - x0) * i) / 15, m.base - h * 0.12 + (vnoise(i * 0.7, m.x, 3) - 0.5) * h * 0.1]), [x1 + 20, m.base + 30]], t.haze, 'mist', { alpha: t.hazeA, knock: 0, layers: 6 });
}

/** a crag of bedded sandstone: one mass, its silhouette stepping in as it rises, split by vertical joints into blocks;
 *  each block lit on the left and shaded on the right, a dark crevice under every bed, snow lying on every ledge. */
interface CragSpec { x0: number; x1: number; base: number; profile: [number, number, number][]; joints: number[]; cleft?: [number, number, number]; }
function massCrag(k: Kit, rng: Rng, c: CragSpec, o: { body: string; shadow: string; snow: string; pines?: boolean }): void {
  const prof = (y: number): [number, number] => {
    const P = c.profile; if (y >= P[0][0]) return [P[0][1], P[0][2]];
    for (let i = 0; i < P.length - 1; i++) { const [ya, la, ra] = P[i], [yb, lb, rb] = P[i + 1]; if (y <= ya && y >= yb) { const t = (ya - y) / (ya - yb); return [la + (lb - la) * t, ra + (rb - ra) * t]; } }
    return [P[P.length - 1][1], P[P.length - 1][2]];
  };
  const top = c.profile[c.profile.length - 1][0];
  let y = c.base;
  while (y > top + 3) {
    const bh = Math.min(y - top, rng.range(11, 34)), y0 = y - bh;
    const [l, r] = prof(y0 + bh * 0.3);
    const cuts = [l + rng.range(-5, 5), ...c.joints.filter(() => rng.chance(0.62)).map((j) => j + rng.range(-9, 9)).filter((j) => j > l + 14 && j < r - 14), r + rng.range(-5, 5)];
    if (c.cleft && y0 < c.cleft[0]) { const [cy, cx, cw] = c.cleft, w2 = cw * Math.min(1, (cy - y0) / (cy - top)); cuts.push(cx - w2 / 2, cx + w2 / 2); cuts.sort((p, q) => p - q); }
    for (let i = 0; i < cuts.length - 1; i++) {
      const bl = cuts[i], br = cuts[i + 1];
      if (c.cleft && y0 < c.cleft[0] && Math.abs((bl + br) / 2 - c.cleft[1]) < 1 && br - bl < c.cleft[2] + 1) continue; // the open cleft
      if (br - bl < 5) continue;
      const isTop = y0 <= top + 6;
      const yj = isTop ? 0 : rng.range(-3.5, 3.5); // beds are not ruled: each block sits a little high or low
      const rnd = isTop ? Math.min(5, bh * 0.35) : Math.min(2, bh * 0.12);
      const topEdge: Pt[] = isTop ? smooth([[bl + 1, y0 + rnd], [bl + (br - bl) * 0.25, y0 + 1], [bl + (br - bl) * 0.65, y0 - rnd * 0.4], [br - 1, y0 + rnd]], false, 4)
        : crag([bl + rnd * 0.6, y0 + yj + rng.range(-1, 1)], [br - rnd * 0.6, y0 + yj + rng.range(-1, 1)], 0.04, 3, rng);
      const block: Pt[] = [[bl + 1.2, y + 0.5], ...crag([bl + 1.2, y], [bl, y0 + rnd], 0.18, 2, rng).slice(1, -1), ...topEdge, ...crag([br, y0 + rnd], [br - 1.2, y], 0.18, 2, rng).slice(1, -1), [br - 1.2, y + 0.5]];
      k.poly(block, mix(o.body, rng.chance(0.5) ? '#C9A2A2' : '#8A7C98', rng.range(0, 0.18)), 'rock', { ink: 0, knock: 1, fine: 0.8, layers: 6 });
      const sx = bl + (br - bl) * rng.range(0.55, 0.75);
      k.poly([[sx, y0 + 1], [br, y0 + rnd], [br - 1, y + 0.5], [sx + rng.range(-3, 3), y + 0.5]], o.shadow, 'glaze', { alpha: 0.45, knock: 0 });
      k.poly([[bl + 1, y0 + rnd], [sx - 4, y0 + 1], [bl + (br - bl) * 0.25, y], [bl + 1.2, y]], '#F8D2BA', 'glaze', { alpha: 0.24, knock: 0 });
      // weathering: a few vertical runnels and a horizontal grain
      for (let q = 0; q < (br - bl) / 14; q++) { const fx = rng.range(bl + 3, br - 3); k.line([[fx, y0 + rnd + 1], [fx + rng.range(-1.5, 1.5), y0 + rnd + 1 + (y - y0 - rnd) * rng.range(0.4, 0.9)]], '#5A4058', 0.5, 0.3); }
      // snow on the ledge: thicker on the lit end, thinning into the shade, overhanging the edge a little
      const sd = isTop ? 4 : rng.range(1.6, 3.4);
      const ledge = topEdge.map(([x, yy], j): Pt => [x, yy - 0.6 - sd * (1 - 0.6 * (j / topEdge.length))]);
      k.poly([...ledge, [topEdge[topEdge.length - 1][0] + 1, topEdge[topEdge.length - 1][1] + 1.2], ...topEdge.slice().reverse().map(([x, yy]): Pt => [x, yy + 1.3]), [topEdge[0][0] - 1, topEdge[0][1] + 1.5]], o.snow, 'snow', { knock: 1, alpha: 0.96, fine: 0.6 });
      k.line(topEdge.map(([x, yy]): Pt => [x, yy + 2.6]), '#33243C', 0.9, 0.5);
      if (o.pines && !isTop && rng.chance(0.18)) pine(k, rng, rng.range(bl + 5, br - 5), y0 - 0.4, rng.range(8, 16), { haze: 0.12, snow: 0.7, ink: 0 });
    }
    y = y0;
  }
  // the big form: the whole mass turns away from the light on its right, and a cool shadow pools at its foot
  const rows: Pt[] = []; for (let yy = c.base; yy >= top; yy -= 8) rows.push([yy, 0]);
  const rightEdge = rows.map(([yy]): Pt => [prof(yy)[1] + 4, yy]), mid = rows.map(([yy]): Pt => { const [l, r] = prof(yy); return [l + (r - l) * 0.62, yy]; });
  k.poly([...mid, ...rightEdge.reverse()], o.shadow, 'glaze', { alpha: 0.3, knock: 0, layers: 5 });
  const leftEdge = rows.map(([yy]): Pt => [prof(yy)[0] - 2, yy]), lmid = rows.map(([yy]): Pt => { const [l, r] = prof(yy); return [l + (r - l) * 0.3, yy]; });
  k.poly([...leftEdge, ...lmid.reverse()], '#F8D2BA', 'glaze', { alpha: 0.16, knock: 0, layers: 4 });
}

// ---- trees
interface TreeOpts { haze: number; snow: number; ink: number; dark?: number; }
export function pine(k: Kit, rng: Rng, x: number, y: number, h: number, o: TreeOpts): void {
  const col = mix(mix(PAL.pine, '#24383E', o.dark ?? 0), '#8E92B4', o.haze), dark = mix(PAL.pineSh, '#7C7CA4', o.haze), snow = mix('#F6F2F6', '#CFCBE0', o.haze * 0.8);
  const tiers = h < 18 ? 3 : h < 40 ? 4 + Math.floor(h / 20) : Math.max(6, Math.round(h / 11)), w = h * rng.range(0.3, 0.38), lean = rng.range(-0.6, 0.6) * (h / 40);
  const fine = h < 30 ? 1 : 0.6;
  // outline: boughs droop to a tip at each tier
  const Lp: Pt[] = [], Rp: Pt[] = [];
  for (let i = 0; i < tiers; i++) {
    const t0 = i / tiers, t1 = (i + 1) / tiers, yb = y - h * 0.08 - h * 0.9 * t0, yt = y - h * 0.08 - h * 0.9 * t1;
    const ww = w * (1 - t0 * 0.85) * rng.range(0.85, 1.12), cx = x + lean * t0;
    Lp.push([cx - ww * 0.32, yt + (yb - yt) * 0.3], [cx - ww, yb + 1 + rng.range(0, 1.5)]);
    Rp.push([cx + ww * 0.32, yt + (yb - yt) * 0.3], [cx + ww * rng.range(0.9, 1.05), yb + 1 + rng.range(0, 1.5)]);
  }
  const tip: Pt = [x + lean, y - h];
  const outline: Pt[] = [[x - 1, y - h * 0.08], ...Lp, tip, ...Rp.slice().reverse(), [x + 1, y - h * 0.08]];
  if (h > 24) k.poly([[x - h * 0.018 - 0.4, y], [x + h * 0.018 + 0.4, y], [x + 0.6, y - h * 0.2], [x - 0.6, y - h * 0.2]], '#4B3A44', 'wood', { knock: 1, fine });
  k.poly(outline, col, 'pine', { ink: o.ink, knock: 1, fine, layers: h > 50 ? 8 : 4 });
  // the shaded right half
  k.poly([[x + 0.5, y - h * 0.08], tip, ...Rp.slice().reverse()], dark, 'glaze', { alpha: 0.55, knock: 0, fine, layers: 3 });
  // snow loads on the upper left of each bough
  if (o.snow > 0.05 && h < 22) {
    // small trees: one snow stroke down the lit side
    const sl: Pt[] = [tip, ...Lp.filter((_, i) => i % 2 === 1).map(([px, py]): Pt => [px + 0.6, py - 0.8])];
    k.poly([...sl, ...sl.slice().reverse().map(([px, py], i): Pt => [px + 1.4 + i * 0.2, py + 1.2])], snow, 'snow', { knock: 0.9, alpha: 0.9 * Math.min(1, o.snow + 0.3), fine: 1 });
  } else if (o.snow > 0.05) {
    const load = o.snow;
    for (let i = 0; i < tiers; i++) {
      if (rng.next() > 0.35 + load * 0.6) continue;
      const a = Lp[i * 2], b = Lp[i * 2 + 1], c: Pt = i + 1 < tiers ? [x + lean * ((i + 1) / tiers), Lp[i * 2 + 2][1] + 0.5] : tip;
      const th = Math.max(0.8, h * 0.025 * load * rng.range(0.6, 1.3));
      k.poly([[c[0], c[1] + 0.6], [a[0] + 0.4, a[1] - th * 0.5], [b[0] - 0.3, b[1] - th], [b[0] + 1.5, b[1] - 0.2], [a[0] + 1.6, a[1] + th * 0.4], [c[0] + 1, c[1] + th]], snow, 'snow', { knock: 0.9, alpha: 0.95, fine: 0.7 });
      if (h > 26 && rng.next() < load) { const r = Rp[i * 2 + 1]; k.poly([[r[0] - 1, r[1] - 0.6], [r[0] - h * 0.12, r[1] - th - 0.6], [r[0] - h * 0.2, r[1] - 0.2]], mix(snow, '#AAA6CC', 0.5), 'snow', { knock: 0.9, alpha: 0.9, fine: 0.7 }); }
    }
  }
  if (o.ink > 0 && h > 55) {
    // drawn boughs: needles flicked along each bough
    for (let i = 0; i < tiers; i++) for (const side of [Lp, Rp]) {
      const a = side[i * 2], b = side[i * 2 + 1];
      for (let s = 0.2; s < 1; s += 0.14) { const px = a[0] + (b[0] - a[0]) * s, py = a[1] + (b[1] - a[1]) * s; k.line([[px, py], [px + (b[0] > a[0] ? 1 : -1) * 2.5, py + 3.2]], '#24343A', 0.5, 0.45); }
    }
  }
}

/** a dark belt of forest: a wash with a serrated top of tree tips, painted before the individual trees */
function belt(k: Kit, rng: Rng, pts: Pt[], depth: number, col: string, tipH: number, alpha = 0.92): void {
  const top: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / (tipH * 0.55)));
    for (let j = 0; j < n; j++) { const t = j / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t, th = tipH * rng.range(0.6, 1.3); top.push([x - tipH * 0.25, y], [x, y - th], [x + tipH * 0.25, y]); }
  }
  const bot = pts.slice().reverse().map(([x, y]): Pt => [x, y + depth]);
  k.poly([...top, ...bot], col, 'pine', { knock: 1, alpha, fine: 1, layers: 6 });
}

// ---- sky
function sky(k: Kit, rng: Rng): void {
  k.poly([[-10, -10], [W + 10, -10], [W + 10, 520], [-10, 520]], '#B79DB6', 'sky', { knock: 1, grad: ['#9496C2', '#F8D6B4'] });
  if (NIGHT) {
    for (let i = 0; i < 120; i++) { const x = rng.range(10, 1190), y = rng.range(10, 300), r = rng.range(0.6, 1.8); k.poly(circ(x, y, r, 5), '#FFF6DC', 'snow', { knock: 0.9 }); }
    for (let i = 0; i < 6; i++) { const x = rng.range(60, 1140), y = rng.range(20, 200); k.line([[x - 5, y], [x + 5, y]], '#FFF6DC', 0.9, 0.9); k.line([[x, y - 5], [x, y + 5]], '#FFF6DC', 0.9, 0.9); }
    for (let i = 0; i < 6; i++) k.poly(circ(980, 96, 70 - i * 10, 20), '#FFF2D0', 'glaze', { alpha: 0, knock: 0, lift: 0.08 });
    k.poly(circ(980, 96, 22, 24), '#FFF6DC', 'snow', { ink: 1, knock: 1 });
    k.poly(arc(992, 101, 17, 19, -1.2, 1.9, 12), '#C9C0D8', 'glaze', { alpha: 0.45, knock: 0 });
  }
  // cloud bands: long, flat-bottomed, rose on top, warm-lit undersides near the horizon
  k.next();
  for (let i = 0; i < 14; i++) {
    const cy = 40 + i * 19 + rng.range(-8, 8), cx = rng.range(-50, 1250), w = rng.range(160, 420), h = rng.range(6, 16) * (1 - i * 0.03);
    const top: Pt[] = []; for (let s = 0; s <= 10; s++) { const t = s / 10; top.push([cx - w / 2 + w * t, cy - h * Math.sin(Math.PI * t) ** 0.7 * rng.range(0.6, 1.2)]); }
    const band: Pt[] = [...top, [cx + w / 2 + 20, cy + 2], [cx - w / 2 - 20, cy + 2]];
    const c = NIGHT ? (i % 3 ? '#4C4A8A' : '#6E5C96') : i < 5 ? (i % 2 ? '#A69CC4' : '#B8A6C8') : i % 2 ? '#E8AEB8' : '#F2BFAE';
    k.poly(band, c, 'mist', { alpha: NIGHT ? 0.4 : 0.42, knock: 0 });
    if (i > 5 && !NIGHT) k.poly([[cx - w * 0.4, cy - 1], [cx + w * 0.45, cy - 1], [cx + w * 0.5, cy + 2], [cx - w * 0.45, cy + 2]], '#FBE0BC', 'glaze', { alpha: 0, knock: 0, lift: 0.18 });
  }
  if (!NIGHT) k.poly([[-10, 250], [W + 10, 240], [W + 10, 330], [-10, 330]], '#FBDDB8', 'glaze', { alpha: 0, knock: 0, lift: 0.12 });
}

// ---- the far layer: three ranges receding, then the bold crag at the left
function far(k: Kit, rng: Rng): void {
  const T1: Tone = { body: '#B7B0CF', lit: '#F4D4C4', shadow: '#9690BA', snow: '#F2EEF4', ink: 0, mat: 'far', detail: 0.25, haze: '#F2CDBA', hazeA: 0.55, dry: 0.3 };
  const T2: Tone = { body: '#A097BA', lit: '#F2C8B4', shadow: '#77709E', snow: '#EEE8F0', ink: 0, mat: 'far', detail: 0.55, haze: '#ECC2B6', hazeA: 0.5, dry: 0.6 };
  const T3: Tone = { body: '#93879F', lit: '#F0C0A8', shadow: '#5E5682', snow: '#F2ECF0', ink: 1, mat: 'rock', detail: 1, haze: '#E6BAB6', hazeA: 0.42, dry: 1 };
  // farthest: a long serrated range of pale peaks
  for (const m of [[140, 150, 330, 170, 160], [380, 120, 330, 150, 170], [610, 92, 330, 190, 180], [860, 128, 330, 170, 160], [1090, 104, 330, 170, 180]] as number[][])
    massif(k, rng, { x: m[0], top: m[1], base: m[2], wl: m[3], wr: m[4], snow: 0.55, spurs: 4 }, T1);
  k.next();
  // middle: rockier, snow in the gullies
  for (const m of [[250, 190, 380, 160, 150], [480, 210, 385, 150, 140], [960, 175, 380, 170, 150], [1170, 210, 390, 140, 150]] as number[][])
    massif(k, rng, { x: m[0], top: m[1], base: m[2], wl: m[3], wr: m[4], snow: 0.42, spurs: 6 }, T2);
  k.next();
  // nearest range: the distinctive peak, set off-axis to the right of the house, with a hanging glacier
  massif(k, rng, { x: 760, top: 132, base: 420, wl: 210, wr: 230, snow: 0.38, spurs: 9, shL: [0.35, 0.3], shR: [0.4, 0.45] }, T3);
  massif(k, rng, { x: 1080, top: 238, base: 430, wl: 140, wr: 170, snow: 0.3, spurs: 6 }, T3);
  massif(k, rng, { x: 420, top: 236, base: 430, wl: 150, wr: 130, snow: 0.3, spurs: 6 }, T3);
  k.next();
  // the bold crag: stacked sandstone towers on the left, breaking the skyline
  const CR = { body: '#A08690', shadow: '#54406A', snow: '#F6F0F2', pines: true };
  massCrag(k, rng, { x0: -10, x1: 290, base: 520, profile: [[520, -10, 296], [450, -10, 282], [400, -8, 280], [372, -6, 262], [300, 0, 258], [270, 6, 240], [214, 14, 236], [186, 24, 214], [140, 40, 206], [116, 58, 184], [100, 76, 170]], joints: [40, 90, 138, 180, 226], cleft: [236, 128, 14] }, CR);
  k.poly([[-10, 470], [-10, 420], [80, 430], [200, 440], [290, 452], [290, 500], [-10, 500]], '#E7BDB6', 'mist', { alpha: 0.35, knock: 0 });
}

// ---- the hill layer: a frosted forest behind the house, the hill it stands on, the forest, outcrops and the viaduct
export const TRACK: [Pt, Pt] = [[548, 730], [998, 546]];
// outcrops on the hill: [x0, x1, foot y, top y]
const OUTCROPS: [number, number, number, number][] = [[118, 196, 640, 590], [1010, 1090, 650, 600], [300, 372, 650, 606], [826, 890, 618, 586], [40, 110, 712, 668]];
const trackY = (x: number): number => TRACK[0][1] + ((x - TRACK[0][0]) / (TRACK[1][0] - TRACK[0][0])) * (TRACK[1][1] - TRACK[0][1]);

function hill(k: Kit, rng: Rng, cut: boolean, counts: Record<string, number>): void {
  let trees = 0;
  // backdrop: a distant forested ridge behind the house, frosted and blue with distance
  const ridge: Pt[] = []; for (let x = -10; x <= W + 10; x += 20) ridge.push([x, 392 + Math.pow(Math.abs(x - 600) / 600, 1.4) * 34 + (fbm(x * 0.01, 1, 4) - 0.5) * 24]);
  k.poly([...ridge, [W + 10, 600], [-10, 600]], '#9096B4', 'far', { knock: 1, fine: 1.2, layers: 8 });
  k.next();
  belt(k, rng, ridge, 40, '#7A82A2', 10, 0.8);
  for (let row = 0; row < 4; row++) for (let x = -6; x < W + 6; x += rng.range(6, 10)) {
    if (x > 250 && x < 950) continue; // hidden behind the house anyway
    const y = ridge[Math.max(0, Math.min(ridge.length - 1, Math.round((x + 10) / 20)))][1] + row * 8 + rng.range(-2, 4);
    pine(k, rng, x, y, rng.range(8, 12) + row, { haze: 0.62 - row * 0.04, snow: 0.8, ink: 0 }); trees++;
  }
  // the valley between: mist, and two paler wooded spurs receding on each side
  k.poly([[-10, 430], [W + 10, 430], [W + 10, 760], [-10, 760]], '#E4D2E0', 'mist', { alpha: 0.5, knock: 0, layers: 6 });
  for (const [y0, hz] of [[500, 0.6], [560, 0.48]] as [number, number][]) for (const [xa, xb] of [[-10, 260], [940, W + 10]]) {
    const pts: Pt[] = []; for (let x = xa; x <= xb; x += 15) pts.push([x, y0 + (fbm(x * 0.012, y0, 61) - 0.5) * 30 + (xa < 0 ? (x - xa) * 0.12 : (xb - x) * 0.12)]);
    belt(k, rng, pts, 46, mix('#5E6E8A', '#C4C0D8', hz), 9, 0.7);
    k.poly([[xa, y0 + 30], [xb, y0 + 30], [xb, y0 + 70], [xa, y0 + 70]], '#E6D8E4', 'mist', { alpha: 0.4, knock: 0, layers: 4 });
  }
  k.next();
  // the hill the house stands on: a cone under the terrace, its flanks falling away to both sides
  const hillTop: Pt[] = [[-10, 742], [40, 722], [90, 690], [134, 648], [170, 604], [196, 572], [214, 552], [986, 552], [1004, 572], [1030, 604], [1066, 648], [1110, 690], [1160, 722], [W + 10, 742]];
  k.poly([...hillTop, [W + 10, 760], [-10, 760]], '#D9CEDF', 'snow', { knock: 1, load: 0.7 });
  // snow modelling on the hill: cool shadow sides of the swells, warm sky light on the tops
  for (let i = 0; i < 14; i++) { const x = rng.range(100, 1100), y = rng.range(570, 720), w = rng.range(60, 160); k.poly([[x, y + 6], [x + w * 0.45, y - 4], [x + w, y + 3], [x + w * 0.9, y + 12], [x + w * 0.3, y + 14]], i % 2 ? '#A49CCB' : '#B8AAD6', 'glaze', { alpha: 0.4, knock: 0 }); }
  for (let i = 0; i < 8; i++) { const x = rng.range(120, 1050), y = rng.range(570, 700); k.poly([[x, y], [x + 70, y - 6], [x + 120, y + 2], [x + 40, y + 6]], '#F8D2BC', 'glaze', { alpha: 0.3, knock: 0 }); }
  // outcrops on the flanks
  const OC = { body: '#A3909A', shadow: '#54426A', snow: '#F6F0F2', pines: true };
  for (const [x0, x1, y1, y0] of OUTCROPS) massCrag(k, rng, { x0, x1, base: y1, profile: [[y1, x0, x1], [y1 - (y1 - y0) * 0.5, x0 + (x1 - x0) * 0.12, x1 - (x1 - x0) * 0.08], [y0, x0 + (x1 - x0) * 0.3, x1 - (x1 - x0) * 0.25]], joints: [x0 + (x1 - x0) * 0.4, x0 + (x1 - x0) * 0.7] }, OC);
  k.next();
  // the forest: belts first (density), then rows of trees back to front; clearings follow a noise field, outcrops stay bare
  const bare = (x: number, y: number): boolean => OUTCROPS.some(([x0, x1, y1, y0]) => x > x0 - 2 && x < x1 + 2 && y > y0 - 4 && y < y1 + 6);
  const onHill = (x: number, y: number): boolean => { for (let i = 0; i < hillTop.length - 1; i++) { const [ax, ay] = hillTop[i], [bx, by] = hillTop[i + 1]; if (x >= ax && x <= bx) return y > ay + (by - ay) * ((x - ax) / (bx - ax)) + 2; } return false; };
  for (let b = 0; b < 4; b++) {
    const y0 = 576 + b * 40; const pts: Pt[] = []; for (let x = -10; x <= W + 10; x += 15) { const y = y0 + (fbm(x * 0.008, b, 33) - 0.5) * 30; if (onHill(x, y - 4) && onHill(x, y + 24)) pts.push([x, y]); else if (pts.length > 1) { belt(k, rng, pts.splice(0), 26, mix('#2F4A4C', '#55607E', 0.35 - b * 0.08), 10 + b * 3, 0.8); } else pts.length = 0; }
    if (pts.length < 2) continue;
    belt(k, rng, pts, 26, mix('#2F4A4C', '#55607E', 0.35 - b * 0.08), 10 + b * 3, 0.8);
  }
  const rows: [number, number, number][] = [];
  for (let y = 552; y < 742; y += 4.2 + (y - 552) * 0.018) {
    const h = 11 + (y - 552) * 0.24;
    for (let x = -8; x < W + 8; x += h * rng.range(0.55, 0.85)) {
      const xx = x + rng.range(-2, 2), yy = y + rng.range(-1.5, 1.5);
      if (!onHill(xx, yy - 3) || bare(xx, yy)) continue;
      if (cut && xx > 150 && xx < 1050) continue; // hidden behind the scaled-up house in the cutaway
      const clear = fbm(xx * 0.006, yy * 0.012, 44); if (clear > 0.58) continue;
      if (!cut && xx > TRACK[0][0] - 30 && xx < TRACK[1][0] + 30 && yy > trackY(xx) - 6 && yy < trackY(xx) + 50 + h * 0.8) continue; // the viaduct stays clear
      rows.push([xx, yy, h * rng.range(0.8, 1.2)]);
    }
  }
  for (let i = 0; i < hillTop.length - 1; i++) { const [ax, ay] = hillTop[i], [bx, by] = hillTop[i + 1]; if (ay === by) continue; for (let t = 0; t < 1; t += 0.22) { const x = ax + (bx - ax) * t, y = ay + (by - ay) * t + rng.range(3, 7); if (!bare(x, y)) rows.push([x, y, 13 + (y - 552) * 0.22]); } }
  rows.sort((p, q) => p[1] - q[1]);
  for (const [x, y, h] of rows) { const fz = fbm(x * 0.01, y * 0.02, 55); pine(k, rng, x, y, h, { haze: Math.max(0, 0.32 - (y - 552) * 0.0018 + (fz - 0.5) * 0.3) + (fz > 0.56 ? 0.18 : 0), snow: fz > 0.56 ? 1.2 : 0.3 + fz * 0.6, ink: h > 40 ? 1 : 0, dark: fz < 0.45 ? 0.5 : 0.1 }); trees++; }
  // snow-dusted boulders among the trees
  for (let i = 0; i < 16; i++) boulder(k, rng, rng.range(20, 1180), rng.range(600, 735), rng.range(5, 12));
  if (!cut) { k.next(); viaduct(k, rng); trees += viaductTrees(k, rng); }
  counts.trees = trees;
}

function boulder(k: Kit, rng: Rng, x: number, y: number, s: number): void {
  const pts: Pt[] = []; for (let i = 0; i < 7; i++) { const a = Math.PI + (Math.PI * i) / 6; pts.push([x + Math.cos(a) * s * rng.range(0.8, 1.15), y + Math.sin(a) * s * 0.7 * rng.range(0.7, 1.1)]); }
  k.poly(pts, '#9C8C98', 'rock', { ink: 1, knock: 1, fine: 0.7 });
  k.poly([[x + s * 0.1, y - s * 0.6], pts[4], pts[5], pts[6], [x + s * 0.1, y]], '#56466C', 'glaze', { alpha: 0.5, knock: 0 });
  k.poly([pts[0], pts[1], pts[2], pts[3], [x + s * 0.3, y - s * 0.55], [x - s * 0.5, y - s * 0.3]], '#F6F0F2', 'snow', { knock: 1, alpha: 0.95, fine: 0.7 });
  k.poly([[x - s * 1.1, y + 0.5], [x + s * 1.8, y + 1], [x + s * 1.6, y + 3], [x - s * 0.8, y + 2.5]], '#8A82B8', 'glaze', { alpha: 0.45, knock: 0 });
}

function viaduct(k: Kit, rng: Rng): void {
  // a stone viaduct of arches climbing the hill to the station; the funicular car runs on its deck (as a sprite)
  const [A, B] = TRACK, depth = 44, n = 15;
  const at = (t: number): Pt => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
  const wall: Pt[] = [A, B, [B[0], B[1] + depth], [A[0], A[1] + depth]];
  k.poly(wall, '#B8A2AC', 'stone', { ink: 1, knock: 1, fine: 0.6 });
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, [xa, ya] = at(t0), [xb] = at(t1), pier = (xb - xa) * 0.2, x0 = xa + pier, x1 = xb, r = (x1 - x0) / 2, cx = (x0 + x1) / 2, yc = trackY(cx) + 8 + r;
    const bot = trackY(cx) + depth + 2;
    k.poly([[x0, bot], [x0, yc], ...arc(cx, yc, r, r, Math.PI, 2 * Math.PI, 8).slice(1, -1), [x1, yc], [x1, bot]], '#45384E', 'glass', { ink: 1, knock: 1, fine: 0.6 });
    k.poly([[x0, bot], [x0, yc], [x0 + r * 0.6, yc - r * 0.8], [x0 + r * 0.6, bot]], '#1E1628', 'glaze', { alpha: 0.35, knock: 0 });
    for (let j = 0; j <= 6; j++) { const a = Math.PI + (j * Math.PI) / 6; k.line([[cx + Math.cos(a) * r, yc + Math.sin(a) * r], [cx + Math.cos(a) * (r + 3.5), yc + Math.sin(a) * (r + 3.5)]], '#5E4A5E', 0.5, 0.5); }
    for (let y = trackY(xa) + 6; y < bot; y += 4) k.line([[xa + 0.5, y], [x0 - 0.5, y]], '#5E4A5E', 0.35, 0.35);
    void ya;
  }
  // coping, sleepers, rails, cable and a cast shadow down the right side of the deck
  const off = (o: number): [Pt, Pt] => [[A[0], A[1] + o], [B[0], B[1] + o]];
  k.poly([...off(-2), ...off(4).reverse()], HP.trim, 'trim', { ink: 1, knock: 1, fine: 0.5 });
  for (let t = 0; t <= 1; t += 0.012) { const [x, y] = at(t); k.line([[x - 0.6, y - 2], [x + 0.6, y - 5]], '#4B3A44', 1.3, 0.8); }
  k.line(off(-5), PAL.ink, 1.2, 0.95); k.line(off(-3), PAL.ink, 1.2, 0.95);
  k.line(off(-6.5), '#8E8499', 0.5, 0.6);
  k.poly([...off(4), ...off(10).reverse()], '#4A3A68', 'glaze', { alpha: 0.35, knock: 0 });
  void rng;
}
function viaductTrees(k: Kit, rng: Rng): number {
  let n = 0;
  for (let x = TRACK[0][0] - 20; x < TRACK[1][0] + 10; x += rng.range(9, 18)) {
    const y = trackY(x) + rng.range(44, 56); if (y > 745) continue; const h = (11 + (y - 552) * 0.24) * 0.75;
    pine(k, rng, x, y, h * rng.range(0.85, 1.15), { haze: 0.05, snow: 0.6, ink: h > 40 ? 1 : 0, dark: 0.4 }); n++;
  }
  return n;
}

// ---- foreground: snow banks with form, a strip of village at the foot, and big drawn pines at the corners
function fore(k: Kit, rng: Rng, cut: boolean): void {
  if (!cut) village(k, rng);
  k.next();
  const banks: Pt[][] = [
    [[-10, 700], [60, 684], [150, 690], [240, 708], [330, 726], [380, 760], [-10, 760]],
    [[W + 10, 696], [1130, 682], [1040, 692], [960, 712], [880, 730], [840, 760], [W + 10, 760]],
  ];
  for (const b of banks) {
    k.poly(b, '#F3EEF2', 'snow', { ink: 1, knock: 1, load: 0.5, fine: 1.2 });
    const lr = b[1][0] < b[0][0] ? -1 : 1;
    // shadow side of the drift, the wind-scoured lip and ripples
    k.poly([b[2], b[3], b[4], [b[4][0] - lr * 30, b[4][1] + 18], [b[2][0] + lr * 10, b[2][1] + 30]], '#9C94C8', 'glaze', { alpha: 0.5, knock: 0 });
    k.poly([b[0], b[1], b[2], [b[2][0], b[2][1] + 6], [b[0][0], b[0][1] + 8]], '#F8D8C2', 'glaze', { alpha: 0.3, knock: 0 });
    for (let i = 0; i < 7; i++) { const x = rng.range(Math.min(b[0][0], b[4][0]) + 20, Math.max(b[0][0], b[4][0]) - 20), y = rng.range(712, 745); k.line(arc(x, y, rng.range(14, 34), 3.5, 0.1 * Math.PI, 0.9 * Math.PI, 8), '#8A82B8', 0.9, 0.45); k.line(arc(x, y - 1.6, rng.range(10, 24), 2.5, 0.15 * Math.PI, 0.85 * Math.PI, 6), '#FFFFFF', 1.2, 0.6); }
  }
  k.next();
  for (const [x, y, h] of [[26, 742, 170], [92, 748, 120], [150, 752, 84], [1176, 744, 160], [1112, 750, 112], [1058, 752, 78]] as number[][]) {
    k.poly([[x - h * 0.1, y], [x + h * 0.9, y + 2], [x + h * 0.8, y + 10], [x - h * 0.1, y + 7]], '#7C74AE', 'glaze', { alpha: 0.4, knock: 0 });
    pine(k, rng, x, y, h, { haze: 0, snow: 0.9, ink: 1, dark: 0.2 });
  }
}

function village(k: Kit, rng: Rng): void {
  // a strip of small houses and a lamp-lit road at the foot of the hill, and the lower station where the track begins
  const cols = ['#F1C9B8', '#E7B7C4', '#C9C3DE', '#F3DDB8', '#D7B4C8', '#BFD2D2'];
  k.poly([[-10, 724], [W + 10, 724], [W + 10, 760], [-10, 760]], '#E4DCE6', 'snow', { knock: 1, load: 0.6 });
  let x = 170;
  while (x < 1030) {
    const w = rng.range(26, 40), h = rng.range(18, 28), yb = 728, c = rng.pick(cols);
    if (x > 500 && x < 596) { x = 600; continue; }
    k.rect(x, yb - h, w, h, c, 'wall', { ink: 1, knock: 1, fine: 0.5 });
    const roofH = rng.range(10, 16);
    k.poly([[x - 3, yb - h], [x + w / 2, yb - h - roofH], [x + w + 3, yb - h]], rng.chance(0.5) ? '#7E8DAA' : '#9A6A72', 'roof', { ink: 1, knock: 1, fine: 0.5 });
    k.poly([[x - 3, yb - h], [x + w / 2, yb - h - roofH], [x + w / 2 + 2, yb - h - roofH + 3], [x + 1, yb - h + 0.5]], '#F6F2F6', 'snow', { knock: 1, alpha: 0.95, fine: 0.5 });
    for (let i = 0; i < Math.floor(w / 11); i++) { const wx = x + 5 + i * 11, lit = NIGHT || rng.chance(0.45); k.rect(wx, yb - h + 5, 5, 7, lit ? '#FFD486' : '#6F6A8E', lit ? 'glow' : 'glass', { ink: 1, knock: 1, fine: 0.4 }); }
    k.rect(x + w * 0.65, yb - h, w * 0.35, h, '#8A6A9A', 'glaze', { alpha: 0.25, knock: 0 });
    x += w + rng.range(4, 14);
  }
  // the lower station
  const sx = 516, sw = 60;
  k.rect(sx, 700, sw, 28, HP.wallP, 'wall', { ink: 1, knock: 1, fine: 0.5 });
  k.poly([[sx - 5, 700], [sx + 10, 686], [sx + sw - 10, 686], [sx + sw + 5, 700]], HP.slate, 'roof', { ink: 1, knock: 1, fine: 0.5 });
  k.poly([[sx - 5, 700], [sx + 10, 686], [sx + 30, 686], [sx + 20, 699]], '#F6F2F6', 'snow', { knock: 1, alpha: 0.9, fine: 0.5 });
  for (const wx of [sx + 10, sx + 40]) k.rect(wx, 706, 10, 14, '#FFD486', 'glow', { ink: 1, knock: 1, fine: 0.4 });
  // the road and its lamps
  k.poly([[-10, 732], [W + 10, 732], [W + 10, 740], [-10, 740]], '#B8AACB', 'glaze', { alpha: 0.4, knock: 0 });
  for (let lx = 200; lx < 1020; lx += 96) { k.line([[lx, 733], [lx, 712]], PAL.ink, 1, 0.9); k.poly(circ(lx, 710, 2.4, 8), '#FFE8A8', 'glow', { ink: 1, knock: 1, fine: 0.4 }); if (NIGHT) k.poly(circ(lx, 714, 16, 14), '#FFE2A0', 'mist', { alpha: 0.3, knock: 0 }); }
}

// ---- sprites
export function carItems(t: number, night = NIGHT): Item[] {
  // a stepped two-cabin car: level floors over an inclined chassis; cream and raspberry, a lamp at the front
  const k = new Kit(new Rng(3)), [A, B] = TRACK, s = 0.12 + 0.76 * t, x = A[0] + (B[0] - A[0]) * s, y = trackY(x) - 6;
  const slope = (B[1] - A[1]) / (B[0] - A[0]), cw = 22;
  k.poly([[x - cw - 2, y + 2 - slope * (-cw - 2)], [x + cw + 2, y + 2 + slope * (cw + 2)], [x + cw + 2, y + 6 + slope * (cw + 2)], [x - cw - 2, y + 6 - slope * (-cw - 2)]].map(([px, py]): Pt => [px, py - slope * 0 + (py - y) * 0]), '#3B2A3E', 'metal', { ink: 1, knock: 1, fine: 0.5 });
  for (const s2 of [-1, 1]) { const cx = x + s2 * cw * 0.5, floor = y + 2 + slope * (s2 * cw * 0.5) - 1; const top = floor - 22;
    k.rect(cx - cw * 0.5, top, cw, floor - top, '#F5E5CB', 'trim', { ink: 1, knock: 1, fine: 0.5 });
    k.rect(cx - cw * 0.5, floor - 7, cw, 7, HP.rasp, 'cloth', { ink: 1, knock: 1, fine: 0.5 });
    for (const wx of [-6, 0, 6]) k.poly([[cx + wx - 2.2, top + 13], [cx + wx - 2.2, top + 5], [cx + wx + 2.2, top + 5], [cx + wx + 2.2, top + 13]], night ? '#FFD486' : '#FFE2A0', 'glow', { ink: 1, knock: 1, fine: 0.4 });
    k.poly([[cx - cw * 0.5 - 2, top], [cx + cw * 0.5 + 2, top], [cx + cw * 0.5, top - 4], [cx - cw * 0.5, top - 4]], '#7E8DAA', 'roof', { ink: 1, knock: 1, fine: 0.5 });
    k.poly([[cx + cw * 0.2, top], [cx + cw * 0.5, top], [cx + cw * 0.5, floor], [cx + cw * 0.2, floor]], '#6E4A7E', 'glaze', { alpha: 0.3, knock: 0 });
  }
  k.poly(circ(x + cw + 1, y - 6 + slope * cw, 1.8, 6), '#FFE8A8', 'glow', { ink: 1, knock: 1, fine: 0.4 });
  for (const wx of [-cw + 4, cw - 4]) k.poly(circ(x + wx, y + 7 + slope * wx, 2, 6), '#2A2030', 'metal', { knock: 1, fine: 0.4 });
  return k.items;
}
export function smokeItems(i: number): Item[] {
  const k = new Kit(new Rng(40 + i)), [x, y] = CHIMNEYS[i], rng = new Rng(77 + i);
  const w: Pt[] = []; for (let j = 0; j < 14; j++) w.push([x + j * 4.2 + Math.sin(j * 0.7 + i) * 4, y - 3 - j * 5.5 + rng.range(-1, 1)]);
  k.poly([...w.map(([a, b], j): Pt => [a - 1.5 - j * 0.8, b]), ...w.map(([a, b], j): Pt => [a + 2 + j * 1.3, b]).reverse()], NIGHT ? '#8A86B0' : '#D8CCDC', 'mist', { alpha: 0.55, knock: 0 });
  k.line(w, '#9C90B4', 0.7, 0.35);
  return k.items;
}

// ---- assembly
function scene(k: Kit, seed: number, stops: [number, string][] = []): Scene { return { w: W, h: H, seed, items: k.items, skyStops: stops }; }
export interface GrandOpts { seed: number; night?: boolean; cut?: boolean; }
export function buildGrand(o: GrandOpts): Grand {
  NIGHT = !!o.night; setNight(NIGHT);
  const seed = o.seed, counts: Record<string, number> = {};
  const ks = Object.fromEntries(LAYERS.map((n, i) => [n, new Kit(new Rng(seed * 7919 + 101 * (i + 1)))])) as Record<LayerName, Kit>;
  sky(ks.sky, ks.sky.rng);
  far(ks.far, ks.far.rng);
  hill(ks.hill, ks.hill.rng, !!o.cut, counts);
  if (o.cut) {
    const hk = new Kit(new Rng(seed * 13 + 1)); houseItems(hk, { seed, night: NIGHT, cut: CUT });
    // the cutaway rooms are added by the cutaway module; the house is scaled up so the rooms read
    ks.house.items.push(...transformItems(hk.items, CUT_Z, CX, CUT_BASE));
  } else houseItems(ks.house, { seed, night: NIGHT, cut: null });
  fore(ks.fore, ks.fore.rng, !!o.cut);
  for (const n of LAYERS) counts[n] = ks[n].items.length;
  const stops = NIGHT ? SKY_NIGHT : SKY_DUSK;
  const layers = Object.fromEntries(LAYERS.map((n) => [n, scene(ks[n], seed, n === 'sky' ? stops : [])])) as Record<LayerName, Scene>;
  return { layers, sprites: { car: carItems(0.45), smoke: [smokeItems(0), smokeItems(3)] }, night: NIGHT, counts };
}
export const CUT: [number, number] = [388, 812], CUT_Z = 1.6, CUT_BASE = 596;
export { BASE };
