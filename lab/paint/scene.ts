// The establishing shot: the house of Aldous & Fig on its hill. One description, painted three ways.
import { Rng, mix, vnoise } from './rng';
import { Kit, PAL, Pt, Scene, arc, archPts, bays, flat, lighten, shade } from './kit';

export const W = 1200, H = 750;
let NIGHT = false;
export const SKY_NIGHT: [number, string][] = [[0, '#1B2058'], [0.3, '#2C2F72'], [0.6, '#4A3F85'], [0.85, '#7A5A94'], [1, '#A8708E']];
export const SKY: [number, string][] = [[0, '#9496C2'], [0.2, '#B7A1BE'], [0.45, '#E2B0B6'], [0.72, '#F3C4A8'], [1, '#F8D6B4']];
const CX = 600;

function ridge(rng: Rng, base: number, peaks: [number, number, number][], rough: number, step = 8): Pt[] {
  const out: Pt[] = [];
  for (let x = -10; x <= W + 10; x += step) {
    let h = 0;
    for (const [px, ph, pw] of peaks) { const t = Math.max(0, 1 - Math.abs(x - px) / pw); h = Math.max(h, ph * Math.pow(t, 0.85)); }
    const n = (vnoise(x * 0.03, 3.3, 11) - 0.5) * rough + (vnoise(x * 0.11, 9.1, 5) - 0.5) * rough * 0.5 + (rng.next() - 0.5) * rough * 0.25;
    out.push([x, base - h + n * (0.4 + h / 160)]);
  }
  return out;
}

function mountains(k: Kit, rng: Rng, base: number, peaks: [number, number, number][], body: string, snow: string, sh: string, rough: number, haze: string, snowLine: number): void {
  const r = ridge(rng, base, peaks, rough);
  k.poly([...r, [W + 10, base + 140], [-10, base + 140]], body, 'far', { knock: 1, load: 0.9 });
  // right-hand (shadow) facets below each local summit
  for (let i = 2; i < r.length - 2; i++) {
    if (r[i][1] < r[i - 1][1] && r[i][1] <= r[i + 1][1] && r[i][1] < base - 40) {
      const [px, py] = r[i]; let j = i; while (j < r.length - 1 && r[j + 1][1] >= r[j][1] - 1 && j - i < 7) j++;
      const [vx, vy] = r[j]; const mid: Pt = [px + (vx - px) * 0.25 + rng.range(-4, 6), py + (base + 30 - py) * rng.range(0.5, 0.8)];
      k.glaze([[px, py], ...r.slice(i + 1, j + 1), [vx, vy + 14], mid], sh, 0.38);
    }
  }
  // snow caps
  let run: Pt[] = [];
  const flush = (): void => {
    if (run.length > 2) {
      const bot = run.map(([x, y]): Pt => [x, Math.max(y + 6, snowLine + (vnoise(x * 0.07, 2, 3) - 0.5) * 36 - (base - y) * 0.15)]).reverse();
      k.poly([...run, ...bot], snow, 'snow', { alpha: 0.95, load: 0.5, knock: 0.7 });
    }
    run = [];
  };
  for (const p of r) { if (p[1] < snowLine - 10 + (vnoise(p[0] * 0.05, 7, 3) - 0.5) * 30) run.push(p); else flush(); }
  flush();
  // mist at the foot
  k.poly([[-10, base + 40], ...r.map(([x, y]): Pt => [x, base + 8 + (vnoise(x * 0.02, 5, 8) - 0.5) * 30]), [W + 10, base + 40]], haze, 'mist', { alpha: 0.55, knock: 0 });
}

function pine(k: Kit, rng: Rng, x: number, y: number, h: number, haze = 0, lean = 0): void {
  const col = mix(PAL.pine, '#9C94B4', haze), dark = mix(PAL.pineSh, '#8780A4', haze), snow = mix('#F4F1F6', '#C9C2D8', haze);
  const w = h * 0.38, tiers = Math.max(3, Math.round(h / 17));
  k.poly([[x - 1.2, y], [x + 1.2, y], [x + 1.2 + lean, y - h * 0.15], [x - 1.2 + lean, y - h * 0.15]], '#4B3A44', 'wood', { knock: 0.8 });
  const ink = h > 60 ? 1 : 0;
  for (let i = 0; i < tiers; i++) {
    const t0 = i / tiers, t1 = (i + 1.35) / tiers;
    const yb = y - h * 0.1 - h * 0.88 * t0, yt = y - h * 0.1 - h * 0.88 * Math.min(1, t1 + 0.1);
    const ww = w * (1 - t0 * 0.8) * rng.range(0.9, 1.1), cx = x + lean * (1 - t0);
    const pts: Pt[] = [[cx, yt], [cx - ww * 0.55, yb - (yb - yt) * 0.35], [cx - ww, yb + 1], [cx - ww * 0.45, yb - 2], [cx, yb + 3], [cx + ww * 0.45, yb - 2], [cx + ww, yb + 1], [cx + ww * 0.55, yb - (yb - yt) * 0.35]];
    k.poly(pts, col, 'pine', { ink, knock: 1 });
    k.poly([[cx + ww * 0.05, yt + 2], [cx + ww * 0.55, yb - (yb - yt) * 0.35], [cx + ww, yb + 1], [cx + ww * 0.45, yb - 2], [cx + ww * 0.1, yb + 2]], dark, 'pine', { knock: 0, alpha: 0.7 });
    if (h > 28) k.poly([[cx, yt + 1], [cx - ww * 0.5, yb - (yb - yt) * 0.38], [cx - ww * 0.15, yb - (yb - yt) * 0.5], [cx - ww * 0.05, yb - (yb - yt) * 0.62]], snow, 'snow', { knock: 0.8, alpha: 0.95 });
  }
}

function rock(k: Kit, rng: Rng, x: number, y: number, s: number): void {
  const n = 7, pts: Pt[] = [];
  for (let i = 0; i < n; i++) { const a = Math.PI + (Math.PI * i) / (n - 1); pts.push([x + Math.cos(a) * s * rng.range(0.8, 1.2), y + Math.sin(a) * s * 0.7 * rng.range(0.7, 1.15)]); }
  pts.push([x + s * 0.95, y + 2], [x - s * 0.95, y + 2]);
  k.poly(pts, PAL.rock, 'rock', { ink: 1, knock: 1 });
  k.glaze([[x + s * 0.1, y - s * 0.65], pts[4], pts[5], [x + s * 0.95, y + 2], [x + s * 0.1, y + 2]], PAL.rockSh, 0.6);
  k.poly([pts[0], pts[1], pts[2], pts[3], [x + s * 0.2, y - s * 0.5], [x - s * 0.3, y - s * 0.35]], PAL.snow, 'snow', { knock: 0.8, alpha: 0.95 });
}

export type WK = 'dark' | 'lit' | 'curtain' | 'silhouette' | 'lamp' | 'blind' | 'shutters';
function pickKind(r: Rng, p: number, night: boolean): WK {
  if (night) return r.pick(['lit', 'lit', 'curtain', 'silhouette', 'lamp', 'lit', 'shutters', 'blind'] as WK[]);
  if (r.chance(p)) return r.pick(['lit', 'lit', 'lit', 'curtain', 'silhouette', 'lamp', 'blind'] as WK[]);
  return r.chance(0.16) ? 'shutters' : 'dark';
}
function window_(k: Kit, rng: Rng, cx: number, yb: number, w: number, h: number, kind: WK): void {
  const lit = kind !== 'dark' && kind !== 'shutters';
  k.poly(archPts(cx, yb + 4, w + 8, h + 8), PAL.cream, 'trim', { ink: 1, knock: 1 });
  if (kind === 'shutters') for (const s of [-1, 1]) { const x0 = cx + s * (w / 2 + 5); k.rect(Math.min(x0, x0 + s * 5), yb - h + 4, 5, h, '#6E8C8A', 'wood', { ink: 1, knock: 1 }); for (let y = yb - h + 8; y < yb; y += 5) k.line([[Math.min(x0, x0 + s * 5), y], [Math.min(x0, x0 + s * 5) + 5, y]], PAL.ink, 0.4, 0.4); }
  k.poly(archPts(cx, yb, w, h), lit ? PAL.glassLit : PAL.glass, lit ? 'glow' : 'glass', { ink: 1, knock: 1 });
  if (kind === 'lit') k.poly([[cx - w / 2, yb], [cx - w / 2, yb - h * 0.45], [cx - w * 0.15, yb - h * 0.55], [cx - w * 0.15, yb]], '#F28FA3', 'cloth', { alpha: 0.45, knock: 0 });
  if (kind === 'curtain') for (const s of [-1, 1]) k.poly([[cx + s * w / 2, yb], [cx + s * w / 2, yb - h + w / 2], [cx + s * w * 0.1, yb - h * 0.78], [cx + s * w * 0.2, yb - h * 0.3], [cx + s * w * 0.12, yb]], '#D9667F', 'cloth', { ink: 1, knock: 1 });
  if (kind === 'silhouette') { k.poly(arc(cx, yb - h * 0.52, w * 0.15, w * 0.17, 0, 2 * Math.PI, 8), '#3A2A3C', 'glass', { knock: 1 }); k.poly([[cx - w * 0.3, yb], [cx - w * 0.26, yb - h * 0.34], [cx, yb - h * 0.4], [cx + w * 0.26, yb - h * 0.34], [cx + w * 0.3, yb]], '#3A2A3C', 'glass', { knock: 1 }); }
  if (kind === 'lamp') { k.poly([[cx - w * 0.22, yb - h * 0.3], [cx + w * 0.22, yb - h * 0.3], [cx + w * 0.14, yb - h * 0.5], [cx - w * 0.14, yb - h * 0.5]], '#E88CA0', 'cloth', { ink: 1, knock: 1 }); k.line([[cx, yb - h * 0.3], [cx, yb]], PAL.ink, 1, 0.7); }
  if (kind === 'blind') k.poly(archPts(cx, yb - h * 0.4, w, h * 0.6), '#F3E4CC', 'trim', { ink: 1, knock: 1, alpha: 0.95 });
  k.glaze([[cx - w / 2, yb], [cx - w / 2, yb - h + w / 2], [cx - w / 2 + 4, yb - h + w / 2 - 2], [cx - w / 2 + 4, yb]], '#2E2342', 0.5);
  k.line([[cx, yb], [cx, yb - h + 2]], PAL.ink, 0.7, 0.5);
  k.line([[cx - w / 2, yb - h * 0.45], [cx + w / 2, yb - h * 0.45]], PAL.ink, 0.7, 0.5);
  k.rect(cx - w / 2 - 5, yb, w + 10, 4, PAL.cream, 'trim', { ink: 1, knock: 1 });
  k.glaze([[cx - w / 2 - 5, yb + 4], [cx + w / 2 + 8, yb + 4], [cx + w / 2 + 8, yb + 9], [cx - w / 2 - 3, yb + 9]], PAL.wallSh, 0.5);
  k.poly([[cx - 3, yb - h - 4], [cx + 3, yb - h - 4], [cx + 2, yb - h - 10], [cx - 2, yb - h - 10]], PAL.cream, 'trim', { ink: 1, knock: 1 });
  if (lit && NIGHT) k.poly(arc(cx, yb - h * 0.5, w * 1.1, w * 1.1, 0, 2 * Math.PI, 10), '#FFE2A0', 'glaze', { alpha: 0, knock: 0, lift: 0.22 });
  void rng;
}

function quoins(k: Kit, x0: number, x1: number, yt: number, yb: number): void {
  let i = 0;
  for (let y = yb - 12; y > yt; y -= 12, i++) {
    const wl = i % 2 ? 9 : 15;
    k.rect(x0, y, wl, 11, PAL.cream, 'trim', { ink: 1, knock: 1 });
    k.rect(x1 - (i % 2 ? 15 : 9), y, i % 2 ? 15 : 9, 11, PAL.cream, 'trim', { ink: 1, knock: 1 });
  }
}

function cornice(k: Kit, x0: number, x1: number, y: number): void {
  k.rect(x0 - 5, y - 6, x1 - x0 + 10, 8, PAL.cream, 'trim', { ink: 1, knock: 1 });
  k.rect(x0 - 2, y + 2, x1 - x0 + 4, 4, lighten(PAL.cream, 0.3), 'trim', { ink: 1, knock: 1 });
  for (let x = x0; x < x1 - 3; x += 6) k.rect(x, y + 6, 3, 4, PAL.creamSh, 'trim', { knock: 1 });
  k.glaze([[x0 - 2, y + 10], [x1 + 2, y + 10], [x1 + 2, y + 22], [x0 - 2, y + 22]], PAL.wallSh, 0.5);
}

function mansard(k: Kit, rng: Rng, x0: number, x1: number, yb: number, hh: number, dorm: number[]): void {
  const pts: Pt[] = [[x0 - 5, yb], [x0 + 12, yb - hh], [x1 - 12, yb - hh], [x1 + 5, yb]];
  k.poly(pts, PAL.roof, 'roof', { ink: 1, knock: 1 });
  k.glaze([[x0 + (x1 - x0) * 0.72, yb], [x0 + (x1 - x0) * 0.72 + 8, yb - hh], [x1 - 12, yb - hh], [x1 + 5, yb]], PAL.roofSh, 0.5);
  k.glaze([[x0 - 5, yb], [x0 + 12, yb - hh], [x0 + (x1 - x0) * 0.3, yb - hh], [x0 + (x1 - x0) * 0.22, yb]], PAL.roofHi, 0.35);
  for (let y = yb - 6; y > yb - hh + 2; y -= 6) {
    k.line([[x0 - 5 + ((yb - y) / hh) * 17, y], [x1 + 5 - ((yb - y) / hh) * 17, y]], PAL.ink, 0.5, 0.35);
    for (let x = x0 + rng.range(0, 8); x < x1 - 8; x += 9) k.line([[x, y], [x, y - 6]], PAL.ink, 0.4, 0.2);
  }
  k.rect(x0 + 6, yb - hh - 3, x1 - x0 - 12, 4, PAL.gold, 'gold', { ink: 1, knock: 1 });
  for (const dx of dorm) {
    const yb2 = yb - 8;
    k.rect(dx - 9, yb2 - 22, 18, 22, PAL.cream, 'trim', { ink: 1, knock: 1 });
    k.poly([[dx - 12, yb2 - 22], [dx, yb2 - 36], [dx + 12, yb2 - 22]], PAL.roofSh, 'roof', { ink: 1, knock: 1 });
    k.poly(archPts(dx, yb2 - 2, 10, 18, 6), rng.chance(0.55) ? PAL.glassLit : PAL.glass, 'glass', { ink: 1, knock: 1 });
    k.glaze([[dx + 5, yb2 - 22], [dx + 12, yb2 - 22], [dx, yb2 - 36]], PAL.roofSh, 0.4);
  }
}

function tower(k: Kit, rng: Rng, x0: number, x1: number, lit: WK[]): void {
  const cx = (x0 + x1) / 2, w = x1 - x0;
  k.rect(x0, 410, w, 240, PAL.wall, 'wall', { ink: 1, knock: 1 });
  k.glaze([[x1 - 16, 410], [x1, 410], [x1, 650], [x1 - 16, 650]], PAL.wallSh, 0.55);
  quoins(k, x0, x1, 410, 650);
  [[585, 650], [530, 585], [470, 530], [425, 470]].forEach(([yt, yb], i) => {
    k.rect(x0, yt - 2, w, 4, PAL.cream, 'trim', { ink: 1, knock: 1 });
    window_(k, rng, cx, yb - 9, 20, Math.max(26, yb - yt - 26), lit[i]);
  });
  cornice(k, x0, x1, 410);
  // dome on a drum
  k.rect(x0 + 6, 392, w - 12, 18, PAL.cream, 'trim', { ink: 1, knock: 1 });
  const dome: Pt[] = [[x0 + 2, 392], ...arc(cx, 392, w / 2 + 2, 66, Math.PI, 2 * Math.PI, 22).slice(1, -1), [x1 - 2, 392]];
  k.poly(dome, PAL.roof, 'roof', { ink: 2, knock: 1 });
  k.glaze([[cx + 6, 392], ...arc(cx, 392, w / 2 + 2, 66, 1.5 * Math.PI, 2 * Math.PI, 10), [x1 - 2, 392]], PAL.roofSh, 0.6);
  k.glaze([[x0 + 5, 388], ...arc(cx, 392, w / 2 - 4, 60, Math.PI, 1.38 * Math.PI, 7), [cx - 14, 392]], PAL.roofHi, 0.5);
  for (const f of [-0.5, -0.15, 0.2, 0.55]) k.line(arc(cx + f * w * 0.5, 392, Math.abs(f) * 0.0 + (w / 2) * (1 - Math.abs(f) * 0.15), 64, 1.5 * Math.PI - f * 1.2, 1.5 * Math.PI, 8).map(([x, y]): Pt => [cx + (x - cx) * 0.3 * Math.sign(f || 1) + f * 8, y]), PAL.ink, 0.5, 0.35);
  k.poly(archPts(cx, 384, 10, 16, 6), PAL.glassLit, 'glow', { ink: 1, knock: 1 });
  k.rect(cx - 1.5, 308, 3, 20, PAL.gold, 'gold', { knock: 1 });
  k.poly(arc(cx, 330, 4, 4, 0, 2 * Math.PI, 8), PAL.gold, 'gold', { ink: 1, knock: 1 });
  k.line([[cx, 306], [cx, 286]], PAL.gold, 1.4, 0.9);
  k.poly([[cx, 288], [cx + 20, 293], [cx, 300]], PAL.rasp, 'cloth', { ink: 1, knock: 1 });
}

function conservatory(k: Kit, rng: Rng, x0: number, x1: number): void {
  const cx = (x0 + x1) / 2, w = x1 - x0, r = w / 2;
  const body: Pt[] = [[x0, 650], [x0, 614], ...arc(cx, 614, r, 40, Math.PI, 2 * Math.PI, 16).slice(1, -1), [x1, 614], [x1, 650]];
  k.poly(body, '#B9D3D2', 'glass', { ink: 1, knock: 1, alpha: 0.95 });
  k.poly(body.map(([x, y]): Pt => [cx + (x - cx) * 0.9, 650 - (650 - y) * 0.92]), PAL.glassLit, 'glow', { alpha: 0.55, knock: 0 });
  for (let i = 0; i < 6; i++) { const px = x0 + 8 + i * ((w - 16) / 5); k.poly([[px - 4, 650], [px - 2, 630 - rng.range(0, 12)], [px + 1, 622 - rng.range(0, 18)], [px + 4, 650]], '#476650', 'plant', { knock: 0.6 }); }
  for (let i = 1; i < 5; i++) { const px = x0 + (w * i) / 5; k.line([[px, 650], [px, 614 - 40 * Math.sqrt(Math.max(0, 1 - ((px - cx) / r) ** 2))]], PAL.cream, 1.5, 0.9); }
  k.line(arc(cx, 614, r, 40, Math.PI, 2 * Math.PI, 16), PAL.cream, 2, 0.9);
  k.line([[x0, 632], [x1, 632]], PAL.cream, 1.4, 0.8);
  k.rect(x0 - 3, 644, w + 6, 8, PAL.wall, 'wall', { ink: 1, knock: 1 });
  k.glaze([[x1 - 12, 580], ...arc(cx, 614, r, 40, 1.65 * Math.PI, 2 * Math.PI, 6), [x1, 650], [x1 - 12, 650]], PAL.roofSh, 0.4);
}

function facade(k: Kit, rng: Rng, litSeed: Rng): void {
  const L = (p: number): WK => pickKind(litSeed, p, NIGHT);
  // main masses
  const wings: [number, number][] = [[316, 424], [776, 884]];
  for (const [a, b] of wings) {
    k.rect(a, 470, b - a, 180, PAL.wall, 'wall', { ink: 1, knock: 1 });
    [[585, 650], [530, 585], [470, 530]].forEach(([yt, yb]) => bays(a, b, 3).forEach((x) => window_(k, rng, x, yb - 9, 22, yb - yt - 25, L(0.4))));
    [585, 530].forEach((y) => k.rect(a, y - 2, b - a, 4, PAL.cream, 'trim', { ink: 1, knock: 1 }));
    cornice(k, a, b, 470);
    mansard(k, rng, a, b, 470 - 6, 40, bays(a, b, 2));
  }
  for (const [a, b] of [[424, 534], [666, 776]] as [number, number][]) {
    k.rect(a, 425, b - a, 225, PAL.wall, 'wall', { ink: 1, knock: 1 });
    [[585, 650], [530, 585], [478, 530], [425, 478]].forEach(([yt, yb]) => bays(a, b, 3).forEach((x) => window_(k, rng, x, yb - 9, 22, yb - yt - 25, L(0.45))));
    [585, 530, 478].forEach((y) => k.rect(a, y - 2, b - a, 4, PAL.cream, 'trim', { ink: 1, knock: 1 }));
    cornice(k, a, b, 425);
    mansard(k, rng, a, b, 425 - 6, 52, bays(a, b, 2));
  }
  // right-hand side of everything is in the building's own shade (light from the left)
  k.glaze([[776, 425], [884, 470], [884, 650], [776, 650]], PAL.wallSh, 0.22);
  // cast shadows: the left tower and the pavilion throw shade to the right
  k.glaze([[316, 470], [346, 470], [346, 650], [316, 650]], PAL.wallSh, 0.3);
  k.glaze([[666, 425], [694, 425], [694, 650], [666, 650]], PAL.wallSh, 0.34);
  k.glaze([[424, 425], [440, 425], [440, 650], [424, 650]], PAL.wallSh, 0.18);
  // pavilion
  k.rect(534, 398, 132, 252, lighten(PAL.wall, 0.12), 'wall', { ink: 1, knock: 1 });
  quoins(k, 534, 666, 398, 650);
  k.glaze([[646, 398], [666, 398], [666, 650], [646, 650]], PAL.wallSh, 0.5);
  [[585, 650], [530, 585], [478, 530], [425, 478]].forEach(([yt, yb]) => { k.rect(534, yt - 2, 132, 4, PAL.cream, 'trim', { ink: 1, knock: 1 }); });
  [[530, 585, true], [478, 530, true], [425, 478, true]].forEach(([yt, yb]) => bays(548, 652, 3).forEach((x, i) => { if (i === 1 && yb === 585) return; window_(k, rng, x, (yb as number) - 9, 22, (yb as number) - (yt as number) - 25, L(0.6)); }));
  // balcony over the door
  k.poly(archPts(600, 575, 30, 38, 10), PAL.glassLit, 'glow', { ink: 1, knock: 1 });
  k.rect(578, 560, 44, 14, PAL.cream, 'trim', { ink: 1, knock: 1 });
  for (let x = 580; x < 622; x += 6) k.rect(x, 563, 2.4, 9, PAL.creamSh, 'trim', { knock: 1 });
  // oeil-de-boeuf in the gable
  cornice(k, 534, 666, 398);
  k.poly([[524, 396], [676, 396], [600, 340]], PAL.cream, 'trim', { ink: 2, knock: 1 });
  k.poly([[540, 390], [660, 390], [600, 348]], lighten(PAL.wall, 0.2), 'wall', { ink: 1, knock: 1 });
  k.glaze([[600, 348], [660, 390], [622, 390]], PAL.wallSh, 0.5);
  k.poly(arc(600, 376, 11, 11, 0, 2 * Math.PI, 14), PAL.cream, 'trim', { ink: 1, knock: 1 });
  k.poly(arc(600, 376, 7, 7, 0, 2 * Math.PI, 12), PAL.glassLit, 'glow', { ink: 1, knock: 1 });
  // grand entrance: door, marquee, scalloped awning
  k.poly(archPts(600, 650, 46, 68, 12), PAL.cream, 'trim', { ink: 1, knock: 1 });
  k.poly(archPts(600, 650, 38, 62, 12), PAL.glassLit, 'glow', { ink: 1, knock: 1 });
  k.line([[600, 650], [600, 592]], PAL.ink, 0.8, 0.6);
  k.glaze([[581, 650], [581, 606], [587, 600], [587, 650]], '#8A4A52', 0.4);
  k.rect(556, 590, 88, 6, PAL.cream, 'trim', { ink: 1, knock: 1 });
  const aw: Pt[] = [[552, 590], [648, 590], [654, 604], [546, 604]];
  k.poly(aw, PAL.rasp, 'cloth', { ink: 1, knock: 1 });
  for (let i = 0; i < 8; i++) { const x = 552 + i * 12; if (i % 2 === 0) k.poly([[x, 590], [x + 12, 590], [x + 13, 604], [x - 1, 604]], PAL.cream, 'cloth', { knock: 1, alpha: 0.9 }); }
  for (let i = 0; i < 8; i++) k.poly(arc(551 + i * 12.5 + 6, 604, 6, 5, 0, Math.PI, 6), i % 2 ? PAL.cream : PAL.rasp, 'cloth', { ink: 1, knock: 1 });
  k.glaze([[546, 612], [654, 612], [656, 624], [544, 624]], '#7A3B4D', 0.35);
  for (const sx of [-1, 1]) { const x = CX + sx * 50; window_(k, rng, x, 641, 20, 40, L(0.8)); }
  // pilasters
  for (const x of [534, 658]) { k.rect(x, 398, 8, 252, PAL.cream, 'trim', { ink: 1, knock: 1 }); }
  // towers
  tower(k, rng, 250, 316, [L(0.7) , L(0.5), L(0.7), L(0.4)]);
  tower(k, rng, 884, 950, [L(0.7), L(0.5), L(0.7), L(0.4)]);
}

function sign(k: Kit): void {
  // the plaque: an annular sector centred far below, so its arc reads as a curved sign over the gable
  const cx = CX, cy = 546, ri = 224, ro = 272, th = 0.5;
  const top = arc(cx, cy, ro, ro, -Math.PI / 2 - th, -Math.PI / 2 + th, 24), bot = arc(cx, cy, ri, ri, -Math.PI / 2 + th, -Math.PI / 2 - th, 24);
  for (const x of [-46, 46]) k.rect(cx + x - 2, 318, 4, 36, PAL.gold, 'gold', { ink: 1, knock: 1 });
  k.poly([...top, ...bot], PAL.plum, 'plum', { ink: 2, knock: 1 });
  const t2 = arc(cx, cy, ro - 4, ro - 4, -Math.PI / 2 - th + 0.02, -Math.PI / 2 + th - 0.02, 24), b2 = arc(cx, cy, ri + 4, ri + 4, -Math.PI / 2 + th - 0.02, -Math.PI / 2 - th + 0.02, 24);
  k.line([...t2, t2[0]].slice(0, -1).concat(b2).concat([t2[0]]), PAL.gold, 1.4, 0.95);
  for (const s of [-1, 1]) { const a = -Math.PI / 2 + s * (th + 0.05); k.poly(arc(cx + Math.cos(a) * 248, cy + Math.sin(a) * 248, 9, 9, 0, 2 * Math.PI, 12), PAL.rasp, 'cloth', { ink: 1, knock: 1 }); k.poly(arc(cx + Math.cos(a) * 248, cy + Math.sin(a) * 248, 4, 4, 0, 2 * Math.PI, 8), PAL.gold, 'gold', { knock: 1 }); }
  k.poly(arc(cx, 276 - 4, 5, 5, 0, 2 * Math.PI, 8), PAL.gold, 'gold', { ink: 1, knock: 1 });
}

function terrace(k: Kit, rng: Rng): void {
  // plinth wall
  k.rect(168, 676, 864, 32, PAL.stone, 'stone', { ink: 1, knock: 1 });
  for (let y = 684; y < 708; y += 8) k.line([[168, y], [1032, y]], PAL.ink, 0.5, 0.3);
  for (let y = 676, r = 0; y < 708; y += 8, r++) for (let x = 168 + (r % 2) * 20; x < 1032; x += 40) k.line([[x, y], [x, y + 8]], PAL.ink, 0.5, 0.25);
  k.glaze([[168, 706], [1032, 706], [1032, 712], [168, 712]], PAL.snowSh, 0.5);
  k.glaze([[168, 676], [1032, 676], [1032, 683], [168, 683]], '#6D5870', 0.3);
  k.rect(162, 670, 876, 8, PAL.cream, 'trim', { ink: 1, knock: 1 });
  // balustrade
  const bal = (a: number, b: number): void => {
    k.rect(a, 650, b - a, 5, PAL.cream, 'trim', { ink: 1, knock: 1 });
    k.rect(a, 666, b - a, 5, PAL.cream, 'trim', { ink: 1, knock: 1 });
    for (let x = a + 4; x < b - 3; x += 10) k.poly([[x, 655], [x + 4.4, 655], [x + 3, 659], [x + 5, 663], [x + 4.4, 666], [x, 666], [x - 0.6, 663], [x + 1.4, 659]], PAL.cream, 'trim', { ink: 1, knock: 1 });
    k.glaze([[a, 671], [b, 671], [b, 676], [a, 676]], PAL.snowSh, 0.4);
  };
  bal(250, 528); bal(672, 950);
  for (const x of [250, 528 - 6, 672, 944, 390, 810]) { k.rect(x - 2, 636, 14, 36, PAL.cream, 'trim', { ink: 1, knock: 1 }); k.rect(x - 4, 632, 18, 6, PAL.cream, 'trim', { ink: 1, knock: 1 }); k.glaze([[x + 8, 636], [x + 12, 636], [x + 12, 672], [x + 8, 672]], PAL.creamSh, 0.5); }
  // lamps on the pier tops
  for (const x of [522, 678]) {
    k.poly([[x - 1, 632], [x + 1, 632], [x + 1, 600], [x - 1, 600]], PAL.ink, 'metal', { knock: 1 });
    k.poly(arc(x, 596, 6, 7, 0, 2 * Math.PI, 10), '#FFE3A0', 'glow', { ink: 1, knock: 1 });
    k.poly(arc(x, 596, 16, 16, 0, 2 * Math.PI, 14), '#FFD9A0', 'mist', { alpha: 0.32, knock: 0 });
  }
  // steps
  for (let i = 0; i < 6; i++) {
    const y = 674 + i * 8, hx = 66 + i * 9;
    k.rect(CX - hx, y, hx * 2, 3.5, lighten(PAL.stone, 0.45), 'stone', { ink: 1, knock: 1 });
    k.rect(CX - hx, y + 3.5, hx * 2, 4.5, mix(PAL.stone, '#6B5C8E', 0.38), 'stone', { ink: 1, knock: 1 });
  }
  k.glaze([[CX + 70, 700], [CX + 120, 726], [CX + 150, 726], [CX + 80, 696]], PAL.snowSh, 0.4);
  void rng;
}

function funicular(k: Kit, rng: Rng, t: number | null): void {
  const A: Pt = [1046, 716], B: Pt = [1178, 530];
  const dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const at = (s: number, o = 0): Pt => [A[0] + ux * s + nx * o, A[1] + uy * s + ny * o];
  // pylons: A-frames with cross braces, planted in the snow
  for (let s = 34; s < len - 10; s += 46) {
    const p = at(s, 6), g: Pt = [p[0] + 2, p[1] + 30];
    k.glaze([[p[0], g[1] - 2], [p[0] + 26, g[1] + 2], [p[0] + 24, g[1] + 6], [p[0] - 2, g[1] + 3]], PAL.snowSh, 0.5);
    k.line([[p[0] - 7, g[1]], p], '#4B3A44', 2.2, 0.9); k.line([[p[0] + 8, g[1]], p], '#4B3A44', 2.2, 0.9);
    k.line([[p[0] - 5, g[1] - 14], [p[0] + 6, g[1] - 6]], '#4B3A44', 1.2, 0.8); k.line([[p[0] + 6, g[1] - 14], [p[0] - 4, g[1] - 6]], '#4B3A44', 1.2, 0.8);
  }
  for (let s = 0; s <= len; s += 9) k.line([at(s, -7), at(s, 7)], '#4B3A44', 2.2, 0.85);
  k.line([at(0, 4.5), at(len, 4.5)], PAL.ink, 2.6, 0.95); k.line([at(0, -4.5), at(len, -4.5)], PAL.ink, 2.6, 0.95);
  k.line([at(0, 0), at(len, 0)], '#8E8499', 1, 0.7);
  // lower station: a little hut with a sloping roof and a lit door
  const ax = A[0], ay = A[1];
  k.rect(ax - 62, ay - 32, 54, 44, PAL.wall, 'wall', { ink: 1, knock: 1 });
  k.glaze([[ax - 18, ay - 32], [ax - 8, ay - 32], [ax - 8, ay + 12], [ax - 18, ay + 12]], PAL.wallSh, 0.5);
  k.poly([[ax - 68, ay - 32], [ax - 35, ay - 52], [ax - 2, ay - 32]], PAL.roof, 'roof', { ink: 1, knock: 1 });
  k.glaze([[ax - 35, ay - 52], [ax - 2, ay - 32], [ax - 22, ay - 32]], PAL.roofSh, 0.5);
  k.poly(archPts(ax - 40, ay + 12, 16, 28, 6), PAL.glassLit, 'glow', { ink: 1, knock: 1 });
  k.rect(ax - 58, ay - 22, 12, 12, PAL.glassLit, 'glow', { ink: 1, knock: 1 });
  k.rect(ax - 62, ay - 36, 54, 4, PAL.cream, 'trim', { ink: 1, knock: 1 });
  k.glaze([[ax - 66, ay + 12], [ax + 20, ay + 16], [ax + 30, ay + 24], [ax - 56, ay + 22]], PAL.snowSh, 0.5);
  // upper station
  const bx = B[0], by = B[1];
  k.rect(bx - 6, by - 40, 52, 44, PAL.wall, 'wall', { ink: 1, knock: 1 });
  k.poly([[bx - 12, by - 40], [bx + 20, by - 62], [bx + 52, by - 40]], PAL.roof, 'roof', { ink: 1, knock: 1 });
  k.poly(archPts(bx + 20, by + 4, 16, 26, 6), PAL.glassLit, 'glow', { ink: 1, knock: 1 });
  if (t !== null) carItems(k, A, B, t);
  void rng;
}
export const TRACK: [Pt, Pt] = [[1046, 716], [1178, 530]];
export function carItems(k: Kit, A: Pt, B: Pt, t: number, sc = 1.3, cable = true): void {
  const dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
  const s = len * (0.2 + 0.6 * t), cx = A[0] + ux * s, cy = A[1] + uy * s - 8 * sc;
  const tf = (x: number, y: number): Pt => [cx + x * sc, cy + y * sc];
  k.poly([tf(-26, 6), tf(26, 6), tf(26, 12), tf(-26, 20)], '#4B3A44', 'metal', { ink: 1, knock: 1 });
  k.line([tf(-18, 20), tf(-18, 24)], '#4B3A44', 2, 0.9); k.line([tf(18, 12), tf(18, 16)], '#4B3A44', 2, 0.9);
  k.poly([tf(-26, -28), tf(26, -28), tf(26, 6), tf(-26, 6)], PAL.cream, 'trim', { ink: 1, knock: 1 });
  k.poly([tf(-30, -28), tf(30, -28), tf(24, -38), tf(-24, -38)], PAL.rasp, 'cloth', { ink: 1, knock: 1 });
  k.poly([tf(-26, -4), tf(26, -4), tf(26, 2), tf(-26, 2)], PAL.rasp, 'cloth', { knock: 1 });
  [-19, -5, 9].forEach((x) => k.poly(archPts(cx + (x + 6) * sc, cy - 6 * sc, 12 * sc, 18 * sc, 6), PAL.glassLit, 'glow', { ink: 1, knock: 1 }));
  k.glaze([tf(16, -28), tf(26, -28), tf(26, 6), tf(16, 6)], PAL.wallSh, 0.4);
  if (!cable) return;
  k.line([[cx, cy - 38 * sc], [cx + ux * 200, cy + uy * 200 - 38 * sc]], PAL.ink, 1.2, 0.8);
  k.line([[cx - 2, cy - 38 * sc], [cx - 2 + ux * 200, cy + uy * 200 - 38 * sc]], PAL.ink, 0.6, 0.4);
}

export function buildScene(seed: number, carT: number | null = 0.5, mood: 'dusk' | 'night' = 'dusk'): Scene {
  NIGHT = mood === 'night';
  const rng = new Rng(seed * 7919 + 17), k = new Kit(rng), lit = new Rng(seed + 99);
  const sky = NIGHT ? SKY_NIGHT : SKY;
  k.lay = 0; k.poly([[-10, -10], [W + 10, -10], [W + 10, 470], [-10, 470]], '#B79DB6', 'sky', { knock: 1, grad: ['#9496C2', '#F8D6B4'] });
  if (NIGHT) stars(k, rng);
  // clouds: long soft streaks, pink and violet
  k.next();
  for (let i = 0; i < 9; i++) { const cx = rng.range(40, 1160), cy = rng.range(120, 330), w = rng.range(120, 300), h = rng.range(8, 20); k.poly([[cx - w, cy], [cx - w * 0.5, cy - h], [cx + w * 0.2, cy - h * 1.2], [cx + w, cy - h * 0.2], [cx + w * 0.4, cy + h], [cx - w * 0.4, cy + h * 0.8]], i % 3 ? '#EBB3B8' : '#A99BBE', 'mist', { alpha: 0.4, knock: 0 }); }
  k.next();
  mountains(k, rng, 360, [[150, 150, 190], [420, 110, 150], [660, 190, 210], [930, 125, 170], [1140, 150, 150]], '#ABA3C4', '#EFE8EE', '#8C86AE', 26, '#F0C6B6', 285);
  k.next();
  mountains(k, rng, 450, [[60, 120, 150], [330, 90, 140], [610, 70, 160], [880, 100, 150], [1130, 140, 160]], '#8F88AD', '#E6DFEA', '#6F6A94', 22, '#EBB9B4', 380);
  // pines along the far ridge
  k.next();
  for (let i = 0; i < 46; i++) { const x = rng.range(-10, 1210); pine(k, rng, x, 455 + rng.range(0, 14) + Math.abs(x - 600) * 0.02, rng.range(18, 30), 0.6); }
  // hills left and right (behind and beside the building)
  k.next();
  const hillL: Pt[] = [[-10, 500], [60, 512], [130, 560], [190, 636], [260, 670], [260, 760], [-10, 760]];
  const hillR: Pt[] = [[940, 670], [1010, 636], [1090, 586], [1150, 546], [1210, 516], [1210, 760], [940, 760]];
  k.poly([[-10, 470], [300, 520], [600, 560], [900, 520], [1210, 480], [1210, 700], [-10, 700]], '#DCCFE0', 'snow', { knock: 1, load: 0.6 });
  k.poly(hillL, '#DCD2E8', 'snow', { ink: 1, knock: 1, load: 0.6 });
  k.poly(hillR, '#DCD2E8', 'snow', { ink: 1, knock: 1, load: 0.6 });
  k.glaze([[0, 620], [160, 600], [250, 660], [250, 700], [0, 700]], PAL.snowSh, 0.35);
  k.glaze([[1010, 640], [1210, 560], [1210, 700], [1010, 700]], PAL.snowSh, 0.3);
  // drifts: curved ink shadings on the snow
  for (let i = 0; i < 16; i++) { const x = rng.range(0, 250), y = rng.range(540, 680); k.line(arc(x, y, rng.range(14, 36), 5, 0.1 * Math.PI, 0.9 * Math.PI, 8), PAL.snowSh, 1, 0.5); }
  for (let i = 0; i < 16; i++) { const x = rng.range(1000, 1200), y = rng.range(560, 690); k.line(arc(x, y, rng.range(14, 36), 5, 0.1 * Math.PI, 0.9 * Math.PI, 8), PAL.snowSh, 1, 0.5); }
  // long drift shadows modelling the slopes, and warm sky-light on the lit faces
  for (let i = 0; i < 9; i++) { const y = 520 + i * 18, x = rng.range(-20, 140); k.glaze([[x, y + 30], [x + 90, y + 8], [x + 210, y + 14], [x + 250, y + 40], [x + 120, y + 52]], i % 2 ? '#9E98C8' : '#BBA9D4', 0.42); }
  for (let i = 0; i < 8; i++) { const y = 560 + i * 18, x = rng.range(1010, 1130); k.glaze([[x, y + 30], [x + 70, y + 6], [x + 190, y + 10], [x + 220, y + 40], [x + 100, y + 50]], i % 2 ? '#9E98C8' : '#BBA9D4', 0.42); }
  k.glaze([[-10, 500], [60, 512], [130, 560], [20, 600], [-10, 600]], '#F6C9B8', 0.3);
  k.glaze([[1210, 516], [1150, 546], [1100, 586], [1170, 600], [1210, 600]], '#F6C9B8', 0.22);
  k.next();
  // pines on slopes (back to front)
  const left: [number, number, number][] = [[30, 520, 62], [78, 534, 56], [120, 556, 70], [160, 598, 60], [205, 640, 52], [-5, 560, 78], [240, 662, 40], [100, 590, 74]];
  const right: [number, number, number][] = [[1190, 520, 70], [1150, 548, 52], [1110, 580, 64], [1090, 612, 56], [1040, 640, 46], [1180, 600, 80], [1010, 650, 38]];
  [...left, ...right].sort((a, b) => a[1] - b[1]).forEach(([x, y, h]) => { const lean = rng.range(-3, 3); k.glaze([[x, y], [x + h * 0.9, y + 3], [x + h * 0.8, y + 10], [x, y + 6]], PAL.snowSh, 0.45); pine(k, rng, x, y, h, 0.05, lean); });
  rock(k, rng, 215, 668, 22); rock(k, rng, 22, 640, 30); rock(k, rng, 1070, 640, 20); rock(k, rng, 1194, 640, 28);
  // outcrops breaking through the snow, and mounds with a cool shadow on the side away from the light
  rock(k, rng, 60, 600, 24); rock(k, rng, 128, 622, 16); rock(k, rng, 1120, 570, 18); rock(k, rng, 1060, 600, 14); rock(k, rng, 175, 560, 12);
  for (const [x, y, w, h] of [[20, 580, 90, 26], [130, 640, 70, 18], [60, 660, 110, 24], [1030, 620, 80, 20], [1120, 640, 100, 24], [1000, 668, 60, 14], [200, 690, 80, 16]] as number[][]) mound(k, x, y, w, h);
  k.next();
  // the building's shadow, thrown to the right across the snow (light comes from the left)
  k.glaze([[950, 640], [1130, 670], [1150, 714], [950, 700]], '#5A4B88', 0.5);
  k.glaze([[950, 676], [1090, 694], [1110, 722], [950, 710]], '#4A3F7A', 0.35);
  facade(k, rng, lit);
  sign(k);
  k.next();
  conservatory(k, rng, 168, 250); conservatory(k, rng, 950, 1032);
  terrace(k, rng);
  k.next();
  funicular(k, rng, carT);
  // foreground snow apron and corner banks
  k.next();
  k.poly([[-10, 724], [150, 706], [330, 716], [600, 740], [880, 716], [1050, 706], [1210, 724], [1210, 760], [-10, 760]], '#CFC4E0', 'snow', { knock: 1, load: 0.7 });
  k.poly([[-10, 690], [60, 672], [130, 694], [168, 706], [168, 760], [-10, 760]], '#F0E9EF', 'snow', { ink: 1, knock: 1, load: 0.4 });
  k.glaze([[-10, 728], [168, 712], [330, 722], [-10, 760]], PAL.snowSh, 0.35);
  for (const [x, y, h] of [[34, 742, 150], [96, 748, 112], [1168, 744, 146], [1104, 748, 108]] as [number, number, number][]) { k.glaze([[x, y], [x + h * 0.9, y + 2], [x + h * 0.9, y + 12], [x, y + 8]], PAL.snowSh, 0.45); pine(k, rng, x, y, h, 0, rng.range(-4, 4)); }
  for (let i = 0; i < 7; i++) { const y = 712 + i * 7, x = rng.range(150, 500); k.glaze([[x, y + 9], [x + 120, y], [x + 300, y + 4], [x + 330, y + 12], [x + 150, y + 15]], i % 2 ? '#9E98C8' : '#BBA9D4', 0.42); }
  k.glaze([[168, 708], [1032, 708], [1090, 738], [110, 738]], '#6B5C8E', 0.3);
  k.glaze([[1032, 676], [1062, 700], [1062, 726], [1032, 708]], '#6B5C8E', 0.4);
  rock(k, rng, 280, 738, 16); rock(k, rng, 930, 740, 14);
  for (let i = 0; i < 6; i++) k.line(arc(CX + rng.range(-200, 200), 730 + rng.range(0, 12), rng.range(20, 50), 3, 0.1 * Math.PI, 0.9 * Math.PI, 6), PAL.snowSh, 1, 0.4);
  for (const [x, y, w, h] of [[300, 722, 130, 18], [760, 726, 150, 16], [520, 742, 90, 10], [90, 724, 100, 16]] as number[][]) mound(k, x, y, w, h);
  // a trodden path from the steps, with footprints and sled tracks
  k.glaze([[CX - 56, 724], [CX + 56, 724], [CX + 120, 760], [CX - 150, 760]], '#9D8FC4', 0.6);
  k.glaze([[CX + 60, 724], [CX + 56, 724], [CX + 120, 760], [CX + 150, 760]], '#6B5C8E', 0.3);
  for (let i = 0; i < 7; i++) { const y = 730 + i * 4.2, x = CX - 18 - i * 6 + (i % 2) * 14; k.poly(arc(x, y, 4.4, 2.3, 0, 2 * Math.PI, 6), '#5B4E80', 'glaze', { alpha: 0.7, knock: 0 }); }
  k.line(arc(CX - 40, 748, 140, 24, 0.9 * Math.PI, 1.55 * Math.PI, 14), '#8F84B4', 1.1, 0.6); k.line(arc(CX - 36, 752, 140, 24, 0.9 * Math.PI, 1.55 * Math.PI, 14), '#8F84B4', 1.1, 0.6);
  // life, sparingly: chimney smoke, a few birds, a lamp-lit door
  smoke(k, rng, 372, 428); smoke(k, rng, 828, 428);
  if (!NIGHT) for (const [x, y, sz] of [[760, 170, 9], [790, 152, 7], [822, 176, 8], [300, 205, 6]] as number[][]) k.line([[x - sz, y - sz * 0.5], [x - sz * 0.3, y], [x, y - sz * 0.15], [x + sz * 0.3, y], [x + sz, y - sz * 0.5]], PAL.ink, 1.1, 0.75);
  return { w: W, h: H, seed, items: k.items, skyStops: sky };
}

export const SIGN = { cx: CX, cy: 546, r1: 246, r2: 230 };
export { flat, shade };

export function carSprite(seed: number, t = 0.5): Scene {
  const k = new Kit(new Rng(seed)); carItems(k, TRACK[0], TRACK[1], t, 1.3, false);
  return { w: 160, h: 120, seed, items: k.items, skyStops: [] };
}

function stars(k: Kit, rng: Rng): void {
  for (let i = 0; i < 90; i++) { const x = rng.range(10, 1190), y = rng.range(10, 300), r = rng.range(0.7, 2); k.poly(arc(x, y, r, r, 0, 2 * Math.PI, 5), '#FFF6DC', 'snow', { knock: 0.9 }); }
  for (let i = 0; i < 6; i++) { const x = rng.range(60, 1140), y = rng.range(20, 200); k.line([[x - 5, y], [x + 5, y]], '#FFF6DC', 0.9, 0.9); k.line([[x, y - 5], [x, y + 5]], '#FFF6DC', 0.9, 0.9); }
  for (let i = 0; i < 7; i++) k.poly(arc(930, 120, 80 - i * 10, 80 - i * 10, 0, 2 * Math.PI, 20), '#FFF2D0', 'glaze', { alpha: 0, knock: 0, lift: 0.07 });
  k.poly(arc(930, 120, 26, 26, 0, 2 * Math.PI, 24), '#FFF6DC', 'snow', { ink: 1, knock: 1 });
  k.glaze(arc(944, 126, 20, 22, -1.2, 1.9, 12), '#C9C0D8', 0.45);
}
function mound(k: Kit, x: number, y: number, w: number, h: number): void {
  const top = arc(x + w / 2, y + h, w / 2, h, Math.PI, 2 * Math.PI, 12);
  k.poly([...top, [x + w, y + h], [x, y + h]], '#F4EEF2', 'snow', { alpha: 0.8, knock: 0.6, load: 0.5 });
  k.glaze([...arc(x + w / 2, y + h, w / 2, h, 1.62 * Math.PI, 2 * Math.PI, 7), [x + w, y + h + 4], [x + w * 0.55, y + h + 5]], '#7A6FAE', 0.6);
  k.glaze([[x + w * 0.1, y + h + 1], [x + w * 0.8, y + h + 1], [x + w * 1.05, y + h + 5], [x + w * 0.2, y + h + 5]], '#9E98C8', 0.5);
}
function smoke(k: Kit, rng: Rng, x: number, y: number): void {
  k.rect(x - 7, y - 24, 14, 26, '#B9706E', 'stone', { ink: 1, knock: 1 }); k.rect(x - 9, y - 28, 18, 5, PAL.cream, 'trim', { ink: 1, knock: 1 });
  k.glaze([[x + 2, y - 24], [x + 7, y - 24], [x + 7, y + 2], [x + 2, y + 2]], PAL.wallSh, 0.5);
  const w: Pt[] = []; for (let i = 0; i < 12; i++) w.push([x + i * 5.5 + Math.sin(i * 0.8) * 6, y - 32 - i * 7 + rng.range(-1, 1)]);
  k.poly([...w.map(([a, b], i): Pt => [a - 2 - i * 0.9, b]), ...w.map(([a, b], i): Pt => [a + 3 + i * 1.6, b]).reverse()], '#CFC3D6', 'mist', { alpha: 0.5, knock: 0 });
  k.line(w, '#9C90B4', 0.8, 0.4);
}
