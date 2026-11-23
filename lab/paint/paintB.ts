// Technique B: canvas-2D watercolour. Layered deformed polygons, wet edges, blooms, dry brush, wobbling ink, granulation,
// multiplied onto procedural parchment. Self-contained, no dependencies.
import { Rng, hex, mix, toHex, vnoise } from './rng';
import { Item, Mat, Poly, Line, Scene } from './kit';
import { Paper, PAPER_RGB, makePaper, grainTile } from './paper';

/** A look is a handling of the same painter: how loose the edges, how much line, how opaque, what palette and light. */
export interface Look {
  id: string; name: string;
  layers: number; dev: number; load: number; hue: number; blots: number; bleed: number; edge: number; knock: number; dry: number;
  inkA: number; inkW: number; inkKeep: number; inkBreak: number; inkOff: [number, number];
  hatch: boolean; coursing: boolean; grain: number; opaque: boolean; flatSky: boolean; chalk: number; snowLoad: number;
  minGlaze: number; skipMist: boolean; fade: number; pal?: (c: string, mat: Mat) => string;
}
export const HOUSE: Look = { id: 'a', name: 'House', layers: 1, dev: 1, load: 1, hue: 0.18, blots: 1, bleed: 0, edge: 1, knock: 1, dry: 1, inkA: 1, inkW: 1, inkKeep: 1, inkBreak: 1, inkOff: [0, 0], hatch: false, coursing: false, grain: 1, opaque: false, flatSky: false, chalk: 0, snowLoad: 1, minGlaze: 0, skipMist: false, fade: 46 };
let L: Look = HOUSE;

const A0 = 0.82; // pigment concentration at full strength
function pigment(T0: string, a = 1, mat?: Mat): string {
  const T = L.pal && mat ? L.pal(T0, mat) : T0;
  if (L.opaque) { const h = hex(T); return `rgba(${h[0]},${h[1]},${h[2]},${a})`; }
  const t = hex(T), c = t.map((v, i) => Math.max(0, Math.min(1, 1 - (1 - v / PAPER_RGB[i]) / A0)));
  return `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;
}
const lum = (T: string): number => { const c = hex(T); return (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) / 255; };
const PAPER_LUM = (0.3 * 240 + 0.59 * 227 + 0.11 * 200) / 255;

type P = number[];
function subdivide(p: P, maxSeg: number): P {
  const o: P = [], n = p.length / 2;
  for (let i = 0; i < n; i++) {
    const ax = p[i * 2], ay = p[i * 2 + 1], bx = p[((i + 1) % n) * 2], by = p[((i + 1) % n) * 2 + 1];
    const k = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / maxSeg));
    for (let j = 0; j < k; j++) o.push(ax + ((bx - ax) * j) / k, ay + ((by - ay) * j) / k);
  }
  return o;
}
function deform(p: P, levels: number, dev: number, rng: Rng, jv: number): P {
  let q = p;
  for (let l = 0; l < levels; l++) {
    const o: P = [], n = q.length / 2;
    for (let i = 0; i < n; i++) {
      const ax = q[i * 2], ay = q[i * 2 + 1], bx = q[((i + 1) % n) * 2], by = q[((i + 1) % n) * 2 + 1];
      const amp = Math.min(dev, Math.hypot(bx - ax, by - ay) * 0.4);
      o.push(ax + rng.gauss() * dev * jv, ay + rng.gauss() * dev * jv, (ax + bx) / 2 + rng.gauss() * amp, (ay + by) / 2 + rng.gauss() * amp);
    }
    q = o; dev *= 0.62;
  }
  return q;
}
function path(ctx: CanvasRenderingContext2D, p: P): void {
  ctx.beginPath(); ctx.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
  ctx.closePath();
}
function bbox(p: P): [number, number, number, number] {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
  return [x0, y0, x1, y1];
}
function area(p: P): number { let s = 0; const n = p.length / 2; for (let i = 0; i < n; i++) { const j = (i + 1) % n; s += p[i * 2] * p[j * 2 + 1] - p[j * 2] * p[i * 2 + 1]; } return Math.abs(s) / 2; }

const SOFT: Partial<Record<Mat, number>> = { sky: 2.4, mist: 3, far: 1.4, snow: 1.1, glaze: 1.2, rock: 0.9, pine: 0.7, skin: 0.5, box: 0.4, wall: 0.6, glow: 0.6 };
let STOPS: [number, string][] = [];

function hatchFill(ctx: CanvasRenderingContext2D, master: P, rng: Rng, alpha: number, bb: [number, number, number, number]): void {
  ctx.save(); path(ctx, master); ctx.clip();
  const [x0, y0, x1, y1] = bb, sp = 2.6 + (1 - Math.min(1, alpha * 1.6)) * 4.5;
  ctx.strokeStyle = pigment('#3A2A3C', 0.5); ctx.lineWidth = 0.55; ctx.lineCap = 'round';
  for (const dir of alpha > 0.38 ? [1, -1] : [1]) {
    ctx.beginPath();
    for (let o = -(y1 - y0); o < x1 - x0; o += sp * (dir > 0 ? 1 : 1.5)) { const j = rng.range(-0.6, 0.6); ctx.moveTo(x0 + o + j, dir > 0 ? y1 : y0); ctx.lineTo(x0 + o + (y1 - y0) * dir + j, dir > 0 ? y0 : y1); }
    ctx.stroke();
  }
  ctx.restore();
}

let KNOCK: CanvasRenderingContext2D | null = null;
function wash(ctx: CanvasRenderingContext2D, p0: Poly, rng: Rng, S: number, skyH: number): void {
  // an interior lit from within keeps its lamp-light under a relighting palette: it is looked up as 'glow'
  const p: Poly = p0.lit && L.pal ? { ...p0, mat: p0.mat === 'glaze' || p0.mat === 'mist' ? p0.mat : 'glow' } : p0;
  const base = p.pts, ar = area(base) + 1, rt = Math.sqrt(ar), [x0, y0, x1, y1] = bbox(base);
  const glaze = p.mat === 'glaze' || p.mat === 'mist';
  if (p.lift) { ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = `rgba(0,0,0,${p.lift})`; path(ctx, base); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; return; }
  if (p.mat === 'mist' && L.skipMist) return;
  if (p.mat === 'glaze' && (p.alpha ?? 1) < L.minGlaze) return;
  let alpha0 = (p.alpha ?? 1) * (p.load ?? 1) * (L.opaque ? (glaze ? 0.92 : 0.97) : A0 * L.load);
  if (p.mat === 'snow' && (p.load ?? 1) < 0.7) alpha0 *= L.snowLoad;
  if (L.opaque && glaze) alpha0 = Math.min(0.95, alpha0 * 2.2);
  if (!glaze && (p.knock ?? 1) > 0 && p.mat !== 'sky') {
    ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = Math.min(1, (p.knock ?? 1) * L.knock); ctx.fillStyle = '#000'; path(ctx, base); ctx.fill(); ctx.globalAlpha = 1;
    if (KNOCK) { KNOCK.globalAlpha = Math.min(1, (p.knock ?? 1) * L.knock); KNOCK.fillStyle = '#000'; path(KNOCK, base); KNOCK.fill(); KNOCK.globalAlpha = 1; }
  }
  ctx.globalCompositeOperation = 'source-over';
  const fine = p.fine ?? 1, soft = SOFT[p.mat] ?? 0.7, dev = Math.max(0.3 * fine, Math.min(8, (0.3 + rt * 0.018) * soft * L.dev * fine));
  const small = rt < 14, big = rt > 160;
  const master = deform(subdivide(base, big ? 36 : small ? 99 : 14), small ? 2 : 3, dev, rng, 0.25);
  const n = Math.min(p.layers ?? 99, small ? 3 : Math.max(3, Math.min(big ? 26 : 16, Math.round((4 + rt / 6) * L.layers))));
  const a = 1 - Math.pow(1 - Math.min(0.97, alpha0 * (0.92 + rng.next() * 0.16)), 1 / n);
  const cool = mix(p.fill, '#A890B8', L.hue), warm = mix(p.fill, '#F2B890', L.hue * 0.9);
  // colour running over the edge: a blurred, offset copy beneath
  if (L.bleed > 0 && ar > 700 && !glaze && p.mat !== 'sky') {
    ctx.filter = `blur(${(L.bleed * S).toFixed(1)}px)`; ctx.fillStyle = pigment(rng.chance(0.5) ? cool : warm, Math.min(0.5, alpha0 * 0.4), p.mat);
    path(ctx, master.map((v, i) => v + (i % 2 ? 2.5 : -2))); ctx.fill(); ctx.filter = 'none';
  }
  let style: string | CanvasGradient;
  if (p.grad && L.flatSky) {
    ctx.fillStyle = pigment('#F3E3CA', 0.98, 'sky'); path(ctx, master); ctx.fill();
    ctx.save(); path(ctx, master); ctx.clip();
    for (const [yy, c] of [[262, '#E8A2B2'], [150, '#9189B6']] as [number, string][]) { ctx.fillStyle = pigment(c, 0.98, 'sky'); ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(W_MAX, -10); for (let x = W_MAX; x >= -10; x -= 60) ctx.lineTo(x, yy + Math.sin(x * 0.02) * 10 + rng.range(-5, 5)); ctx.closePath(); ctx.fill(); }
    ctx.restore(); return;
  }
  for (let i = 0; i < n; i++) {
    const Lp = deform(master, small ? 1 : 2, dev * 0.55, rng, 0.2);
    if (p.grad) {
      const g = ctx.createLinearGradient(0, 0, 0, skyH + (rng.next() - 0.5) * 30);
      for (const [o, c] of STOPS) g.addColorStop(o, pigment(c, a, 'sky'));
      style = g;
    } else if (i % 5 === 3) style = pigment(cool, a, p.mat); else if (i % 5 === 1) style = pigment(warm, a, p.mat); else style = pigment(p.fill, a, p.mat);
    ctx.fillStyle = style; path(ctx, Lp); ctx.fill();
  }
  const dark = mix(p.fill, '#3C2850', 0.28);
  if (L.hatch && p.mat === 'glaze' && ar > 120) hatchFill(ctx, master, rng, p.alpha ?? 0.4, [x0, y0, x1, y1]);
  if (ar > 600 && !L.opaque) {
    ctx.save(); path(ctx, master); ctx.clip();
    const blots = Math.min(p.mat === 'sky' ? 34 : 9, Math.round((ar / (p.mat === 'sky' ? 14000 : 1800)) * L.blots));
    for (let i = 0; i < blots; i++) {
      const cx = rng.range(x0, x1), cy = rng.range(y0, y1), r = Math.max(8, rt * rng.range(0.12, p.mat === 'sky' ? 0.4 : 0.35));
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r), t = rng.next();
      if (t < 0.55 || p.mat === 'sky') { const c = p.mat === 'sky' ? rng.pick(STOPS.length ? STOPS.map((q) => q[1]) : ['#9FA0C8']) : dark; g.addColorStop(0, pigment(c, (p.mat === 'sky' ? 0.12 : rng.range(0.1, 0.2)) * Math.min(2, L.blots), p.mat)); g.addColorStop(1, pigment(c, 0, p.mat)); ctx.globalCompositeOperation = 'source-over'; }
      else { const lv = Math.min(0.26, 0.16 * L.blots); g.addColorStop(0, `rgba(0,0,0,${lv})`); g.addColorStop(0.8, `rgba(0,0,0,${lv * 0.75})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalCompositeOperation = 'destination-out'; }
      ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      if (t >= 0.55 && p.mat !== 'sky' && ar > 3000 * (L.blots > 1.5 ? 0.3 : 1)) { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = pigment(dark, 0.1 * L.edge * 1.5, p.mat); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0, 7); ctx.stroke(); }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }
  if (ar > 600) {
    const dry = p.mat === 'rock' || p.mat === 'pine' || p.mat === 'roof' || p.mat === 'far' || p.mat === 'stone' || (p.mat === 'snow' && ar > 5000) || (p.mat === 'wall' && ar > 4000);
    if (dry && L.dry > 0) {
      ctx.save(); path(ctx, master); ctx.clip();
      const cnt = Math.min(260, Math.round((ar / (p.mat === 'far' ? 120 : 40)) * L.dry));
      const ang = p.mat === 'rock' ? -0.9 : p.mat === 'pine' ? 0.5 : p.mat === 'wall' ? 1.57 : p.mat === 'far' ? -0.25 : 0.04;
      for (let i = 0; i < cnt; i++) {
        const sx = rng.range(x0, x1), sy = rng.range(y0, y1), len = rng.range(5, p.mat === 'far' ? 40 : 20), an = ang + rng.gauss() * 0.22 * (p.mat === 'pine' && i % 2 ? -1 : 1);
        const lift = rng.chance(L.opaque ? 0.5 : 0.38);
        ctx.globalCompositeOperation = lift ? 'destination-out' : 'source-over';
        ctx.strokeStyle = lift ? `rgba(0,0,0,${rng.range(0.06, 0.16)})` : pigment(dark, rng.range(0.06, 0.16), p.mat);
        ctx.lineWidth = rng.range(0.4, 1.3); ctx.setLineDash([rng.range(1, 4), rng.range(0.5, 3)]);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + Math.cos(an) * len * 0.5 + rng.gauss(), sy + Math.sin(an) * len * 0.5 + rng.gauss(), sx + Math.cos(an) * len, sy + Math.sin(an) * len); ctx.stroke();
      }
      ctx.setLineDash([]); ctx.globalCompositeOperation = 'source-over'; ctx.restore();
    }
    if (L.coursing && p.mat === 'wall' && ar > 2500) {
      ctx.save(); path(ctx, master); ctx.clip(); ctx.strokeStyle = pigment('#7A4A5A', 0.3, 'wall'); ctx.lineWidth = 0.5; ctx.beginPath();
      let r = 0; for (let y = y0 + 6; y < y1; y += 8, r++) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); for (let x = x0 + (r % 2) * 14; x < x1; x += 28) { ctx.moveTo(x, y); ctx.lineTo(x, y + 8); } }
      ctx.stroke(); ctx.restore();
    }
  }
  if (!glaze && p.mat !== 'sky' && !small && !L.opaque) {
    ctx.strokeStyle = pigment(dark, 0.2 * L.edge * Math.min(1, alpha0 + 0.2), p.mat); ctx.lineJoin = 'round';
    for (let k = 0; k < 2; k++) { ctx.lineWidth = rng.range(0.7, 1.5); path(ctx, deform(master, 1, dev * 0.25, rng, 0.1)); ctx.stroke(); }
  } else if (!glaze && small && !L.opaque) { ctx.strokeStyle = pigment(dark, 0.18 * L.edge, p.mat); ctx.lineWidth = 0.8 * (0.5 + 0.5 * fine); path(ctx, master); ctx.stroke(); }
  void S;
}
const W_MAX = 1210;

/** a hand-drawn ink line: wanders off the true path, breaks now and then, doubled at low alpha */
function inkStroke(ctx: CanvasRenderingContext2D, pts: P, closed: boolean, col: string, w: number, a: number, rng: Rng, seed: number, fine = 1): void {
  const n = pts.length / 2, [ox0, oy0] = L.inkOff;
  const lift = lum(col) > PAPER_LUM * 0.93;
  ctx.globalCompositeOperation = lift ? 'destination-out' : 'source-over';
  const style = lift ? (al: number) => `rgba(0,0,0,${al})` : (al: number) => pigment(col, al);
  const brk = L.inkBreak;
  ctx.save(); if (!lift) ctx.translate(ox0, oy0);
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = style(a * (pass ? 0.5 : 0.85)); ctx.lineWidth = w * (pass ? 0.7 : 1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const segs = closed ? n : n - 1;
    ctx.beginPath(); let pen = true, sinceBreak = 0, nextBreak = brk > 0 ? rng.range(30, 160) / brk : 1e9;
    for (let i = 0; i < segs; i++) {
      const ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[((i + 1) % n) * 2], by = pts[((i + 1) % n) * 2 + 1];
      const len = Math.hypot(bx - ax, by - ay), k = Math.max(1, Math.ceil(len / 7));
      for (let j = 0; j <= k; j++) {
        const t = j / k, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        const wob = (brk > 1.5 ? 2.8 : brk === 0 ? 0.9 : 1.8) * fine;
        const ox = (vnoise(x * 0.09 + pass * 7, y * 0.09, seed) - 0.5) * wob, oy = (vnoise(x * 0.09, y * 0.09 + 11 + pass * 5, seed + 1) - 0.5) * wob;
        sinceBreak += len / k;
        if (pen && sinceBreak > nextBreak && !lift) { pen = false; nextBreak = sinceBreak + rng.range(1.5, 4) * Math.max(1, brk); }
        else if (!pen && sinceBreak > nextBreak) { pen = true; nextBreak = sinceBreak + rng.range(30, 200) / Math.max(brk, 0.3); ctx.moveTo(x + ox, y + oy); continue; }
        if (j === 0 && i === 0) ctx.moveTo(x + ox, y + oy); else if (pen) ctx.lineTo(x + ox, y + oy); else ctx.moveTo(x + ox, y + oy);
      }
    }
    ctx.stroke();
  }
  ctx.restore(); ctx.globalCompositeOperation = 'source-over';
}

export function paintItems(ctx: CanvasRenderingContext2D, items: Item[], S: number, seed: number, skyH = 470, stops: [number, string][] = STOPS, look: Look = HOUSE, knock: CanvasRenderingContext2D | null = null): void {
  STOPS = stops; L = look; KNOCK = knock;
  const rng = new Rng(seed * 101 + 3);
  ctx.save(); ctx.scale(S, S); if (KNOCK) { KNOCK.save(); KNOCK.setTransform(S, 0, 0, S, 0, 0); }
  for (const it of items) {
    if (it.k === 'poly') {
      wash(ctx, it, rng, S, skyH);
      if (it.ink && !it.lift) {
        const keep = it.ink > 1 || L.inkKeep >= 1 || rng.next() < L.inkKeep; // consume rng either way
        if (keep) inkStroke(ctx, subdivide(it.pts, 40), true, PAL_INK, (0.55 + it.ink * 0.35) * L.inkW * (0.6 + 0.4 * (it.fine ?? 1)), Math.min(1, (it.ink > 1 ? 0.8 : 0.62) * L.inkA), rng, seed, it.fine ?? 1);
      }
    } else if (L.inkKeep >= 0.5 || lum(it.col) > PAPER_LUM * 0.93 || it.w > 1.8) inkStroke(ctx, it.pts, false, it.col, it.w * (it.w < 1.8 ? L.inkW : 1), Math.min(1, it.a * (it.w < 1.8 ? L.inkA : 1)), rng, seed);
  }
  ctx.restore(); if (KNOCK) KNOCK.restore(); KNOCK = null;
}
const PAL_INK = '#3A2A3C';

/** pigment granulation: pigment settles into the paper's valleys. A tileable noise table makes this a lookup, not per-pixel noise. */
export function granulate(c: HTMLCanvasElement, S: number, seed: number, look: Look = HOUSE): void {
  const ctx = c.getContext('2d', { willReadFrequently: true })!, W = c.width, H = c.height, d = ctx.getImageData(0, 0, W, H), D = d.data;
  const tile = grainTile(S, seed), amt = look.grain, chalk = look.chalk;
  for (let py = 0; py < H; py++) {
    const row = (py & 255) << 8; let i = py * W * 4;
    for (let px = 0; px < W; px++, i += 4) {
      const al = D[i + 3]; if (al === 0) continue;
      const g = tile[row | (px & 255)];
      if (chalk > 0) { const f = 1 + (g - 0.5) * chalk; D[i] *= f; D[i + 1] *= f; D[i + 2] *= f; if (al < 255) D[i + 3] = al * (1 - amt * 0.12 + amt * 0.24 * g); continue; }
      D[i + 3] = al * (1 - amt * 0.3 + amt * 0.6 * g);
      const s = 1 - amt * 0.07 * (1 - g); D[i] *= s; D[i + 1] *= s; D[i + 2] *= s;
    }
  }
  ctx.putImageData(d, 0, 0);
}

export interface BResult { canvas: HTMLCanvasElement; ms: number; parts: Record<string, number>; paper: Paper; plate: HTMLCanvasElement; }
export function renderB(scene: Scene, o: { seed: number; scale: number; paper?: Paper; look?: Look }): BResult {
  const t0 = performance.now(), S = o.scale, W = Math.round(scene.w * S), H = Math.round(scene.h * S), parts: Record<string, number> = {}, look = o.look ?? HOUSE;
  const paper = o.paper ?? makePaper(scene.w, scene.h, S, o.seed, { fade: look.fade }); parts.paper = o.paper ? 0 : paper.ms;
  let t = performance.now();
  const plate = document.createElement('canvas'); plate.width = W; plate.height = H;
  const pc = plate.getContext('2d', { willReadFrequently: true })!;
  paintItems(pc, scene.items, S, o.seed, 470, scene.skyStops, look); pc.getImageData(0, 0, 1, 1); /* forces the deferred canvas raster, so 'paint' is honest */ parts.paint = performance.now() - t; t = performance.now(); t = performance.now();
  granulate(plate, S, o.seed, look); parts.grain = performance.now() - t; t = performance.now();
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  composite(out.getContext('2d')!, plate, paper, W, H, look.opaque);
  parts.composite = performance.now() - t;
  return { canvas: out, ms: performance.now() - t0, parts, paper, plate };
}
export function composite(ctx: CanvasRenderingContext2D, plate: HTMLCanvasElement, paper: Paper, W: number, H: number, opaque = false): void {
  const m = document.createElement('canvas'); m.width = W; m.height = H;
  const mc = m.getContext('2d')!; mc.drawImage(plate, 0, 0); mc.globalCompositeOperation = 'destination-in'; mc.drawImage(paper.mask, 0, 0);
  ctx.drawImage(paper.base, 0, 0);
  ctx.globalCompositeOperation = opaque ? 'source-over' : 'multiply'; ctx.drawImage(m, 0, 0);
  ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = opaque ? 0.45 : 0.7; ctx.drawImage(paper.bump, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(paper.base, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}
export { toHex };
