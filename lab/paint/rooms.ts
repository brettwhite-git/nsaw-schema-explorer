// The cutaway: the same house with the front of the central block taken off, dollhouse fashion.
// Five story rooms on the centre line (bottom to top: the pastry shop; the lift and post room; the store room; the catalogue
// desk; the concierge desk), each lit and furnished with one small worker. Either side: a lift shaft and a staircase, then
// quieter ancillary rooms; under the terrace, the basement with the boiler. Cut floors and walls are painted as cut masonry.
import { Rng } from './rng';
import { Kit, Mat, PAL, Poly, Pt, arc, archPts, smooth } from './kit';
import { BASE, FL, HP, transformItems } from './house';
import { CUT, CUT_BASE, CUT_Z, CX, Grand, buildGrand } from './grand';

const FINE = 0.35;
const P = (k: Kit, p: Pt[], c: string, mat: Mat, ink = 1, o: Partial<Poly> = {}): void => k.poly(p, c, mat, { ink, knock: 1, fine: FINE, ...o });
const R = (k: Kit, x: number, y: number, w: number, h: number, c: string, mat: Mat, ink = 1, o: Partial<Poly> = {}): void => k.rect(x, y, w, h, c, mat, { ink, knock: 1, fine: FINE, ...o });
const G = (k: Kit, p: Pt[], c: string, a: number): void => k.poly(p, c, 'glaze', { alpha: a, knock: 0, fine: FINE });
const GR = (k: Kit, x: number, y: number, w: number, h: number, c: string, a: number): void => G(k, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], c, a);
const Ln = (k: Kit, p: Pt[], c = PAL.ink, w = 0.5, a = 0.5): void => k.line(p, c, w, a);
const circ = (x: number, y: number, r: number, n = 10): Pt[] => arc(x, y, r, r, 0, 2 * Math.PI, n);

// plan of the opening (design coordinates)
const X0 = CUT[0], X1 = CUT[1], LIFT: [number, number] = [486, 514], STAIR: [number, number] = [686, 714], STORY: [number, number] = [514, 686];
const BSMT: [number, number] = [BASE + 4, 546];
const FLOORS: [number, number][] = [...FL]; // [bottom, top]
export const CUT_FLOORS: [number, number][] = [0, 1, 2, 3, 4].map((f) => [FL[f][1] + 6.5, f + 1]);
let NIGHT = false;

// ---- cut masonry: a stone section with diagonal hatching
function cutStone(k: Kit, x: number, y: number, w: number, h: number): void {
  R(k, x, y, w, h, '#CDB6AE', 'stone', 1);
  for (let o = -h; o < w; o += 2.6) {
    const t0 = Math.max(0, -o), t1 = Math.min(h, w - o);
    if (t1 > t0) Ln(k, [[x + o + t0, y + h - t0], [x + o + t1, y + h - t1]], '#7A5A64', 0.35, 0.45);
  }
}

// ---- the small painted worker: plum uniform, cream apron, a baker's cap with a raspberry band
type Pose = 'stand' | 'carry' | 'reach' | 'sit' | 'bell';
function worker(k: Kit, x: number, yb: number, s: number, pose: Pose): void {
  const skin = '#EBB99C', uni = '#6D4C7E', apron = '#F6EAD6', trou = '#4A2D55';
  const u = s / 40; // a 40-unit-tall figure is the reference
  const T = (p: Pt[]): Pt[] => p.map(([px, py]): Pt => [x + px * u, yb + py * u]);
  if (pose !== 'sit') for (const sd of [-1, 1]) P(k, T([[sd * 1, -16], [sd * 6, -16], [sd * 5, -1], [sd * 1.5, -1]]), trou, 'cloth', 1);
  else { P(k, T([[-6, -16], [6, -16], [10, -14], [10, -10], [-10, -10], [-10, -14]]), trou, 'cloth', 1); }
  if (pose !== 'sit') for (const sd of [-1, 1]) P(k, T([[sd * 1, -1.5], [sd * 7, -1.5], [sd * 7.5, 0.5], [sd * 1, 0.5]]), '#2E2026', 'wood', 0);
  P(k, T(smooth([[-7, -31], [-3, -33], [3, -33], [7, -31], [7.5, -16], [-7.5, -16]], true, 3)), uni, 'cloth', 1);
  P(k, T([[-4.5, -29], [4.5, -29], [6, -13], [-6, -13]]), apron, 'cloth', 1);
  Ln(k, T([[-4.5, -29], [4.5, -29]]), HP.rasp, 0.9, 0.9);
  G(k, T([[2, -32], [7, -31], [7.5, -16], [3, -16]]), '#2D1B4A', 0.35);
  // arms by pose
  const arm = (sd: number, hand: Pt): void => { P(k, T([[sd * 6, -31], [sd * 8.5, -29], [hand[0] + sd * 1.5, hand[1] + 1], [hand[0] - sd * 1.5, hand[1] - 1], [sd * 5.5, -27]]), uni, 'cloth', 1); P(k, T(circ(hand[0], hand[1], 1.6, 6)), skin, 'skin', 0); };
  if (pose === 'carry') { arm(-1, [-4, -22]); arm(1, [4, -22]); R(k, x - 6 * u, yb - 30 * u, 12 * u, 9 * u, '#F5E7CF', 'box', 1); R(k, x - 0.8 * u, yb - 30 * u, 1.6 * u, 9 * u, HP.rasp, 'ribbon', 0); P(k, T([[0, -30], [-3, -32.5], [-4, -30.5]]), HP.rasp, 'ribbon', 0); P(k, T([[0, -30], [3, -32.5], [4, -30.5]]), HP.rasp, 'ribbon', 0); }
  else if (pose === 'reach') { arm(-1, [-9, -19]); arm(1, [7, -44]); }
  else if (pose === 'sit') { arm(-1, [-7, -20]); arm(1, [7, -20]); }
  else if (pose === 'bell') { arm(-1, [-8, -18]); arm(1, [9, -19]); }
  else { arm(-1, [-8, -17]); arm(1, [8, -17]); }
  P(k, T(smooth([[-4, -37], [-3.6, -40.5], [0, -42], [3.6, -40.5], [4, -37], [2.6, -33.5], [0, -32.8], [-2.6, -33.5]], true, 3)), skin, 'skin', 1);
  G(k, T([[1, -41], [4, -37], [2.6, -33.5], [0.5, -33]]), '#B0705C', 0.35);
  P(k, T(smooth([[-4.6, -39.5], [-3.6, -44], [0, -45.5], [3.6, -44], [4.6, -39.5], [0, -40.5]], true, 3)), apron, 'cloth', 1);
  Ln(k, T([[-4.4, -40], [0, -41], [4.4, -40]]), HP.rasp, 0.9, 0.9);
}

// ---- room shell: back wall, a dado, floorboards, a ceiling shadow and a lamp; quiet rooms are dimmed
function shell(k: Kit, x0: number, x1: number, yb: number, yt: number, wall: string, o: { story: boolean; paper?: 'stripe' | 'dots' | 'panel'; lamp?: boolean }): void {
  R(k, x0, yt, x1 - x0, yb - yt, wall, 'wall', 0, { fine: 0.5 });
  const h = yb - yt;
  if (o.paper === 'stripe') for (let x = x0 + 3; x < x1 - 2; x += 7) Ln(k, [[x, yt + 1], [x, yb - h * 0.3]], '#FFFFFF', 1.6, 0.35);
  if (o.paper === 'dots') for (let y = yt + 4; y < yb - h * 0.35; y += 5) for (let x = x0 + 3 + ((y / 5) % 2) * 2.5; x < x1 - 2; x += 5) Ln(k, [[x, y], [x + 0.4, y + 0.3]], '#FFFFFF', 0.9, 0.45);
  // dado rail and floor
  R(k, x0, yb - h * 0.3, x1 - x0, 1.2, '#F6E6CD', 'trim', 0);
  GR(k, x0, yb - h * 0.3 + 1.2, x1 - x0, h * 0.3 - 3, '#7A4A68', o.story ? 0.12 : 0.18);
  R(k, x0, yb - 2.6, x1 - x0, 2.6, '#9A6A52', 'wood', 0);
  for (let x = x0 + 4; x < x1; x += 9) Ln(k, [[x, yb - 2.4], [x, yb]], '#5E3A30', 0.3, 0.4);
  GR(k, x0, yt, x1 - x0, h * 0.22, '#3A2A48', o.story ? 0.22 : 0.3); // ceiling shade
  GR(k, x0, yt, 3, yb - yt, '#3A2A48', 0.3); GR(k, x1 - 3, yt, 3, yb - yt, '#3A2A48', 0.22);
  if (o.lamp !== false) {
    const lx = (x0 + x1) / 2, ly = yt + 3;
    Ln(k, [[lx, yt], [lx, ly]], '#6E4A3A', 0.5, 0.8);
    P(k, [[lx - 3, ly], [lx + 3, ly], [lx + 2, ly + 2.4], [lx - 2, ly + 2.4]], o.story ? HP.gold : '#C9A86A', 'gold', 1);
    k.poly(arc(lx, ly + 6, (x1 - x0) * (o.story ? 0.45 : 0.3), h * 0.75, 0, 2 * Math.PI, 18), '#FFE6B0', 'mist', { alpha: o.story ? 0.4 : 0.12, knock: 0 });
  }
  if (!o.story) GR(k, x0, yt, x1 - x0, yb - yt, '#3E3054', NIGHT ? 0.26 : 0.36);
}
function picture(k: Kit, x: number, y: number, w: number, h: number, c: string): void { R(k, x - w / 2, y, w, h, HP.gold, 'gold', 1); R(k, x - w / 2 + 1, y + 1, w - 2, h - 2, c, 'glass', 0); }
function shelfRow(k: Kit, rng: Rng, x0: number, x1: number, y: number, kind: 'ledgers' | 'jars' | 'linen' | 'books' | 'boxes'): void {
  R(k, x0, y, x1 - x0, 1.2, '#7A4A44', 'wood', 0);
  let x = x0 + 0.6;
  while (x < x1 - 2) {
    if (kind === 'ledgers' || kind === 'books') { const w = rng.range(1.4, 2.4), h = rng.range(4.5, 6.5); R(k, x, y - h, w, h, rng.pick(kind === 'ledgers' ? ['#8A3A4A', '#3E5A6E', '#6E5A2E', '#4E6E4A', '#7A4A6E'] : ['#B8705E', '#6E86A0', '#C9A25A', '#8E6AA0']), 'wood', 0); if (kind === 'ledgers') Ln(k, [[x + 0.3, y - h * 0.7], [x + w - 0.3, y - h * 0.7]], HP.gold, 0.3, 0.8); x += w + 0.2; }
    else if (kind === 'jars') { const w = 2.6, h = rng.range(3, 4.6); R(k, x, y - h, w, h, rng.pick(['#E8C68A', '#D97A5A', '#C9D6A8', '#F1E2C6']), 'glass', 0); R(k, x - 0.2, y - h - 0.8, w + 0.4, 0.8, '#7A6A5A', 'wood', 0); x += w + 1; }
    else if (kind === 'linen') { const w = rng.range(5, 8); for (let j = 0; j < 3; j++) R(k, x, y - 1.4 * (j + 1), w, 1.4, j % 2 ? '#F6F0E6' : '#E8E0EE', 'cloth', 0); x += w + 1.2; }
    else { const w = rng.range(4, 6), h = rng.range(3, 4.5); R(k, x, y - h, w, h, '#F5E7CF', 'box', 0); R(k, x + w / 2 - 0.4, y - h, 0.8, h, rng.pick([HP.rasp, '#8FA8C8', '#B7A2CC']), 'ribbon', 0); x += w + 0.8; }
  }
}

// ---- the five story rooms
function shop(k: Kit, rng: Rng, x0: number, x1: number, yb: number, yt: number): void {
  shell(k, x0, x1, yb, yt, '#F2A9BC', { story: true, paper: 'stripe' });
  const cx = (x0 + x1) / 2, h = yb - yt;
  // shelves of ribboned boxes either side, a counter across the middle, cakes on stands
  for (const s of [-1, 1]) { const a = s < 0 ? x0 + 4 : cx + 34, b = s < 0 ? cx - 34 : x1 - 4; R(k, a - 1, yt + 6, b - a + 2, h * 0.5, '#E2A9B8', 'wall', 0); for (const y of [yt + 13, yt + 21, yt + 29]) shelfRow(k, rng, a, b, y, 'boxes'); }
  picture(k, cx, yt + 5, 22, 9, '#8FA8C8');
  worker(k, cx, yb - 2.6, h * 0.66, 'stand');
  const cy = yb - 13;
  R(k, x0 + 20, cy, x1 - x0 - 40, 10.4, '#6E3C5A', 'plum', 1);
  for (let i = 0; i < 5; i++) { const px = x0 + 23 + i * ((x1 - x0 - 46) / 5); R(k, px, cy + 2, (x1 - x0 - 46) / 5 - 3, 6.5, '#7E4A68', 'plum', 0); Ln(k, [[px + 0.6, cy + 2.6], [px + (x1 - x0 - 46) / 5 - 3.6, cy + 2.6]], HP.gold, 0.4, 0.8); }
  R(k, x0 + 17, cy - 2.2, x1 - x0 - 34, 2.4, '#EDE2E4', 'stone', 1);
  for (const [dx, tiers] of [[-48, 3], [-26, 2], [26, 2], [48, 3]] as [number, number][]) {
    const bx = cx + dx; R(k, bx - 0.6, cy - 6, 1.2, 4, HP.gold, 'gold', 0); R(k, bx - 6, cy - 6.4, 12, 0.8, HP.gold, 'gold', 0);
    let y = cy - 6.4; for (let t = 0; t < tiers; t++) { const w = 9 - t * 2.6, th = 3; R(k, bx - w / 2, y - th, w, th, '#FBF0E4', 'box', 1); Ln(k, [[bx - w / 2, y - th + 0.8], [bx + w / 2, y - th + 0.8]], '#E9708C', 0.7, 0.85); y -= th; }
    P(k, circ(bx, y - 0.8, 0.8, 5), HP.rasp, 'cloth', 0);
  }
  // the bell on the counter
  P(k, [[cx - 2.4, cy - 2.2], ...arc(cx, cy - 2.2, 2.4, 3.6, Math.PI, 2 * Math.PI, 6).slice(1, -1), [cx + 2.4, cy - 2.2]], '#E2B552', 'gold', 1);
}
function postRoom(k: Kit, rng: Rng, x0: number, x1: number, yb: number, yt: number): void {
  shell(k, x0, x1, yb, yt, '#A9D6C2', { story: true, paper: 'dots' });
  const cx = (x0 + x1) / 2, h = yb - yt;
  // pigeonholes on the back wall, symmetrical
  for (const s of [-1, 1]) {
    const a = s < 0 ? x0 + 6 : cx + 20, b = s < 0 ? cx - 20 : x1 - 6, top = yt + 7, bot = yb - 14;
    R(k, a, top, b - a, bot - top, '#8A5A48', 'wood', 1);
    const cols = 7, rows = 4, cw = (b - a - 2) / cols, rh = (bot - top - 2) / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const px = a + 1 + c * cw, py = top + 1 + r * rh; R(k, px + 0.3, py + 0.3, cw - 0.6, rh - 0.6, '#3E2A30', 'glass', 0); if (rng.chance(0.6)) R(k, px + 0.8, py + rh * 0.35, cw - 1.6, rh * 0.5, rng.pick(['#F6EEE2', '#F2DCC8', '#E9E2F0']), 'cloth', 0); }
  }
  // the sorting table with parcels, and a clock between the pigeonholes
  R(k, cx - 40, yb - 12, 80, 2, '#7A4A44', 'wood', 1);
  for (const lx of [cx - 37, cx + 35]) R(k, lx, yb - 10, 2, 7.4, '#7A4A44', 'wood', 0);
  for (const [dx, w, hh, c] of [[-30, 9, 6, '#8FA8C8'], [-20, 7, 4.5, HP.rasp], [18, 8, 5, '#B7A2CC'], [28, 10, 7, '#9DB8A6']] as [number, number, number, string][]) { R(k, cx + dx - w / 2, yb - 12 - hh, w, hh, '#F5E7CF', 'box', 1); R(k, cx + dx - 0.5, yb - 12 - hh, 1, hh, c, 'ribbon', 0); }
  P(k, circ(cx, yt + 10, 4.2, 14), '#FBF3E2', 'trim', 1); Ln(k, [[cx, yt + 10], [cx, yt + 7.4]], PAL.ink, 0.5, 0.9); Ln(k, [[cx, yt + 10], [cx + 2, yt + 10.6]], PAL.ink, 0.5, 0.9);
  worker(k, cx, yb - 2.6, h * 0.7, 'carry');
}
function storeRoom(k: Kit, rng: Rng, x0: number, x1: number, yb: number, yt: number): void {
  shell(k, x0, x1, yb, yt, '#EDCB8E', { story: true });
  const cx = (x0 + x1) / 2, h = yb - yt;
  for (const s of [-1, 1]) {
    const a = s < 0 ? x0 + 4 : cx + 14, b = s < 0 ? cx - 14 : x1 - 4;
    R(k, a - 1, yt + 4, b - a + 2, yb - yt - 7, '#7A4A44', 'wood', 1);
    for (let y = yt + 11; y < yb - 3; y += 7) shelfRow(k, rng, a, b, y, 'ledgers');
  }
  // a library ladder against the middle bay, the worker up it reaching for a ledger
  R(k, cx - 12, yt + 4, 24, yb - yt - 7, '#7A4A44', 'wood', 1);
  for (let y = yt + 11; y < yb - 3; y += 7) shelfRow(k, rng, cx - 11, cx + 11, y, 'ledgers');
  Ln(k, [[cx - 7, yb], [cx - 2, yt + 6]], '#5E3A2A', 1, 0.95); Ln(k, [[cx + 5, yb], [cx + 9, yt + 6]], '#5E3A2A', 1, 0.95);
  for (let t = 0.12; t < 1; t += 0.14) Ln(k, [[cx - 7 + 5 * t, yb - (yb - yt - 6) * t], [cx + 5 + 4 * t, yb - (yb - yt - 6) * t]], '#5E3A2A', 0.6, 0.9);
  Ln(k, [[x0 + 4, yt + 5], [x1 - 4, yt + 5]], '#8A6A3A', 0.6, 0.8);
  worker(k, cx + 1.5, yb - (yb - yt) * 0.36, h * 0.62, 'reach');
}
function catalogue(k: Kit, rng: Rng, x0: number, x1: number, yb: number, yt: number): void {
  shell(k, x0, x1, yb, yt, '#C6B6EA', { story: true, paper: 'stripe' });
  const cx = (x0 + x1) / 2, h = yb - yt;
  // card-catalogue cabinets either side: banks of small brass-pulled drawers
  for (const s of [-1, 1]) {
    const a = s < 0 ? x0 + 6 : cx + 26, b = s < 0 ? cx - 26 : x1 - 6, top = yt + 6, bot = yb - 3;
    R(k, a, top, b - a, bot - top, '#9A6A52', 'wood', 1);
    const cols = 8, rows = 5, cw = (b - a - 2) / cols, rh = (bot - top - 2) / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const px = a + 1 + c * cw, py = top + 1 + r * rh; R(k, px + 0.3, py + 0.3, cw - 0.6, rh - 0.6, '#B8866A', 'wood', 0); Ln(k, [[px + cw / 2 - 0.6, py + rh / 2], [px + cw / 2 + 0.6, py + rh / 2]], HP.gold, 0.5, 0.9); }
  }
  // the long desk with its row of name plates; the worker seated behind
  worker(k, cx, yb - 6, h * 0.8, 'sit');
  R(k, cx - 30, yb - 13, 60, 2.2, '#6E3C5A', 'plum', 1);
  R(k, cx - 28, yb - 10.8, 56, 8, '#7E4A68', 'plum', 1);
  for (let i = 0; i < 7; i++) { const px = cx - 26 + i * 8; R(k, px, yb - 16.4, 6, 3.4, '#F6EAD0', 'trim', 1); Ln(k, [[px + 1, yb - 14.7], [px + 5, yb - 14.7]], '#5A2D4B', 0.35, 0.8); }
  P(k, [[cx + 22, yb - 13], [cx + 27, yb - 13], [cx + 26, yb - 18], [cx + 23, yb - 18]], '#4F8A68', 'cloth', 1);
  void rng;
}
function concierge(k: Kit, rng: Rng, x0: number, x1: number, yb: number, yt: number): void {
  shell(k, x0, x1, yb, yt, '#F5B994', { story: true, paper: 'panel' });
  const cx = (x0 + x1) / 2, h = yb - yt;
  for (const s of [-1, 1]) picture(k, cx + s * 58, yt + 6, 16, 10, s < 0 ? '#A9B8D2' : '#C9A2B8');
  // the key board: a sage panel of brass hooks, each with a key and a tag
  const a = cx - 34, b = cx + 34, top = yt + 4, bot = yt + h * 0.62;
  R(k, a, top, b - a, bot - top, '#8FA88E', 'wood', 1);
  Ln(k, [[a + 1, top + 1], [b - 1, top + 1], [b - 1, bot - 1], [a + 1, bot - 1], [a + 1, top + 1]], HP.gold, 0.6, 0.9);
  const cols = 11, rows = 3;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const px = a + 4 + (c * (b - a - 8)) / (cols - 1), py = top + 3.5 + r * ((bot - top - 6) / rows);
    P(k, circ(px, py, 0.6, 5), HP.gold, 'gold', 0);
    if (rng.chance(0.8)) { Ln(k, [[px, py], [px, py + 2.6]], '#C9A04A', 0.6, 0.9); R(k, px - 0.9, py + 2.6, 1.8, 2.2, rng.chance(0.5) ? '#F6EAD0' : HP.rasp, 'cloth', 0); }
  }
  worker(k, cx, yb - 2.6, h * 0.74, 'bell');
  // the desk: pink marble top, plum front with gold panels, a bell and a register
  R(k, cx - 32, yb - 12, 64, 9.4, '#6E3C5A', 'plum', 1);
  for (let i = 0; i < 4; i++) { const px = cx - 29 + i * 15; R(k, px, yb - 10.4, 12.5, 6, '#7E4A68', 'plum', 0); Ln(k, [[px + 0.6, yb - 9.8], [px + 11.9, yb - 9.8], [px + 11.9, yb - 5], [px + 0.6, yb - 5], [px + 0.6, yb - 9.8]], HP.gold, 0.35, 0.8); }
  R(k, cx - 34, yb - 14.4, 68, 2.6, '#EBC6CC', 'stone', 1);
  for (let i = 0; i < 6; i++) { const vx = cx - 32 + rng.range(0, 60); Ln(k, [[vx, yb - 13.8], [vx + rng.range(4, 9), yb - 12.6]], '#C98A9A', 0.4, 0.6); }
  P(k, [[cx + 18, yb - 14.4], ...arc(cx + 18, yb - 14.4, 2.2, 3.2, Math.PI, 2 * Math.PI, 6).slice(1, -1), [cx + 20.2, yb - 14.4]], '#E2B552', 'gold', 1);
  R(k, cx - 24, yb - 17.4, 9, 3, '#F6EAD0', 'trim', 1);
}

// ---- the ancillary rooms, quieter
function ancillary(k: Kit, rng: Rng, kind: string, x0: number, x1: number, yb: number, yt: number): void {
  const cx = (x0 + x1) / 2, h = yb - yt, walls: Record<string, string> = { kitchen: '#D6CCBE', pantry: '#D2C6B4', linen: '#D2CCD8', office: '#C9BFB4', bed: '#D6C2C8', sitting: '#CDBFC8', bath: '#C2D0D2', writing: '#C9C2B4', staff: '#C8BEB8', trunks: '#C9BBAE', wine: '#9E8A88', boiler: '#B09A8E', coal: '#A89890' };
  shell(k, x0, x1, yb, yt, walls[kind] ?? '#CCC0C4', { story: false, lamp: kind !== 'wine' });
  switch (kind) {
    case 'kitchen': {
      R(k, x0 + 6, yb - 16, 34, 13.4, '#2E2A34', 'metal', 1);
      for (let i = 0; i < 3; i++) { R(k, x0 + 8 + i * 11, yb - 12, 9, 7, '#46404E', 'metal', 1); P(k, circ(x0 + 12.5 + i * 11, yb - 8.5, 0.7, 5), HP.gold, 'gold', 0); }
      R(k, x0 + 18, yt + 3, 10, yb - 16 - yt - 3, '#5A4E58', 'metal', 1);
      for (let i = 0; i < 4; i++) P(k, circ(x0 + 50 + i * 9, yt + 12, 3, 8), '#C27A4A', 'gold', 1);
      R(k, x0 + 48, yb - 10, 40, 2, '#9A7A5A', 'wood', 1);
      for (const lx of [x0 + 50, x0 + 85]) R(k, lx, yb - 8, 1.6, 5.4, '#9A7A5A', 'wood', 0);
      if (NIGHT || true) P(k, [[x0 + 9, yb - 4.4], [x0 + 37, yb - 4.4], [x0 + 37, yb - 3], [x0 + 9, yb - 3]], '#F28A3A', 'glow', 0);
      break;
    }
    case 'pantry': for (let y = yt + 9; y < yb - 4; y += 8) shelfRow(k, rng, x0 + 5, x1 - 5, y, 'jars'); for (let i = 0; i < 3; i++) P(k, smooth([[x0 + 8 + i * 9, yb - 2.6], [x0 + 15 + i * 9, yb - 2.6], [x0 + 14 + i * 9, yb - 9], [x0 + 11.5 + i * 9, yb - 10.4], [x0 + 9 + i * 9, yb - 9]], true, 3), '#D9C6A0', 'cloth', 1); break;
    case 'linen': for (let y = yt + 9; y < yb - 6; y += 7) shelfRow(k, rng, x0 + 5, x1 - 30, y, 'linen'); R(k, x1 - 24, yb - 11, 16, 8, '#B8A27A', 'wood', 1); for (let i = 0; i < 3; i++) P(k, circ(x1 - 20 + i * 4, yb - 11.5, 2.4, 6), '#F4EEE8', 'cloth', 0); break;
    case 'office': R(k, cx - 16, yb - 10, 32, 2, '#7A4A44', 'wood', 1); R(k, cx - 15, yb - 8, 8, 5.4, '#7A4A44', 'wood', 0); R(k, x1 - 16, yt + 6, 10, yb - yt - 9, '#7E6A5E', 'metal', 1); for (let y = yt + 9; y < yb - 4; y += 5) Ln(k, [[x1 - 15, y], [x1 - 7, y]], '#3E2E2A', 0.4, 0.6); P(k, [[cx + 6, yb - 10], [cx + 11, yb - 10], [cx + 10, yb - 15], [cx + 7, yb - 15]], '#4F8A68', 'cloth', 1); picture(k, cx - 6, yt + 6, 12, 8, '#B8A27A'); break;
    case 'bed': case 'staff': {
      const iron = kind === 'staff';
      R(k, cx - 22, yb - 9, 38, 5.4, iron ? '#E8E2EC' : '#E9B8C4', 'cloth', 1); R(k, cx - 22, yb - 10.4, 9, 2.4, '#F6F2F0', 'cloth', 1);
      Ln(k, [[cx - 23, yb], [cx - 23, yb - 15]], iron ? '#3E3448' : '#7A4A44', 1, 0.9); Ln(k, [[cx + 17, yb], [cx + 17, yb - 10]], iron ? '#3E3448' : '#7A4A44', 1, 0.9);
      R(k, cx + 22, yb - 8, 6, 5.4, '#7A4A44', 'wood', 1); P(k, [[cx + 23, yb - 8], [cx + 27, yb - 8], [cx + 26, yb - 11], [cx + 24, yb - 11]], '#F2B8C6', 'cloth', 1);
      if (!iron) picture(k, cx - 4, yt + 5, 14, 9, '#A9B8D2');
      break;
    }
    case 'sitting': R(k, cx - 16, yb - 10, 32, 7, '#B86A7E', 'cloth', 1); R(k, cx - 18, yb - 13, 5, 10, '#B86A7E', 'cloth', 1); R(k, cx + 13, yb - 13, 5, 10, '#B86A7E', 'cloth', 1); R(k, x1 - 20, yb - 15, 14, 12.4, '#E8DCCC', 'stone', 1); R(k, x1 - 17, yb - 11, 8, 8.4, '#2E2430', 'metal', 0); P(k, [[x1 - 15, yb - 3], [x1 - 13, yb - 7], [x1 - 11, yb - 3]], '#F28A3A', 'glow', 0); picture(k, cx, yt + 4, 16, 10, '#8FA8C8'); break;
    case 'bath': P(k, [[cx - 18, yb - 10], [cx + 14, yb - 10], [cx + 12, yb - 4], [cx - 16, yb - 4]], '#F6F2F0', 'stone', 1); for (const fx of [cx - 14, cx + 10]) R(k, fx, yb - 4, 2, 1.4, HP.gold, 'gold', 0); R(k, x1 - 16, yt + 5, 8, 11, '#C9D8E0', 'glass', 1); break;
    case 'writing': R(k, x0 + 6, yt + 4, 24, yb - yt - 7, '#7A4A44', 'wood', 1); for (let y = yt + 10; y < yb - 3; y += 6) shelfRow(k, rng, x0 + 7, x0 + 29, y, 'books'); R(k, cx, yb - 10, 26, 2, '#7A4A44', 'wood', 1); break;
    case 'trunks': for (let i = 0; i < 5; i++) { const w = rng.range(14, 22), x = x0 + 6 + i * ((x1 - x0 - 12) / 5); R(k, x, yb - 9 - (i % 2) * 2, w * 0.8, 6.4 + (i % 2) * 2, rng.pick(['#7A4A44', '#3E5A6E', '#8A6A3A']), 'wood', 1); } break;
    case 'wine': for (let r = 0; r < 4; r++) for (let c = 0; c < Math.floor((x1 - x0 - 10) / 4.4); c++) P(k, circ(x0 + 7 + c * 4.4, yt + 10 + r * 4.4, 1.6, 6), rng.chance(0.7) ? '#4A1E2E' : '#2E2A34', 'glass', 0); break;
    case 'coal': P(k, [[x0 + 6, yb - 2], [cx, yb - 22], [x1 - 6, yb - 2]], '#2E2A34', 'metal', 1); for (let i = 0; i < 20; i++) P(k, circ(rng.range(x0 + 14, x1 - 14), rng.range(yb - 12, yb - 3), 1, 5), '#4A4452', 'metal', 0); break;
    default: break;
  }
}
function boiler(k: Kit, rng: Rng, x0: number, x1: number, yb: number, yt: number): void {
  shell(k, x0, x1, yb, yt, '#A89088', { story: false });
  const cx = (x0 + x1) / 2;
  k.next();
  // a great copper boiler on its brick bed, the firebox glowing, pipes climbing out of the room
  R(k, cx - 46, yb - 12, 92, 10, '#9A5A4E', 'stone', 1);
  for (let y = yb - 9; y < yb - 2; y += 3) Ln(k, [[cx - 45, y], [cx + 45, y]], '#5E3A34', 0.35, 0.4);
  P(k, [[cx - 40, yb - 12], [cx - 40, yb - 40], ...arc(cx - 26, yb - 40, 14, 10, Math.PI, 1.5 * Math.PI, 5), [cx + 26, yb - 50], ...arc(cx + 26, yb - 40, 14, 10, 1.5 * Math.PI, 2 * Math.PI, 5), [cx + 40, yb - 12]], '#C27A4A', 'gold', 2);
  for (const rx of [-24, -8, 8, 24]) Ln(k, [[cx + rx, yb - 12], [cx + rx, yb - 49]], '#8A4A2A', 0.6, 0.7);
  for (let i = 0; i < 14; i++) P(k, circ(cx - 38 + i * 5.8, yb - 44, 0.6, 4), '#7A3A1A', 'gold', 0);
  G(k, [[cx + 14, yb - 50], [cx + 40, yb - 40], [cx + 40, yb - 12], [cx + 16, yb - 12]], '#5A2A3A', 0.35);
  R(k, cx - 10, yb - 24, 20, 11, '#2E2430', 'metal', 1);
  P(k, [[cx - 8, yb - 14], [cx + 8, yb - 14], [cx + 6, yb - 21], [cx, yb - 18], [cx - 5, yb - 22]], '#F2723A', 'glow', 0);
  k.poly(arc(cx, yb - 16, 26, 18, 0, 2 * Math.PI, 16), '#FF9A50', 'mist', { alpha: 0.3, knock: 0 });
  for (const [gx, gy] of [[-20, -30], [20, -30]] as [number, number][]) { P(k, circ(cx + gx, yb + gy, 3.2, 12), '#FBF3E2', 'trim', 1); Ln(k, [[cx + gx, yb + gy], [cx + gx + 2, yb + gy - 1.6]], PAL.ink, 0.5, 0.9); }
  for (const px of [cx - 30, cx + 30]) { Ln(k, [[px, yb - 46], [px, yt]], '#8A5A3A', 2.4, 0.95); Ln(k, [[px - 1, yb - 46], [px - 1, yt]], '#E8B080', 0.6, 0.6); }
  // the stoker's coal and shovel
  P(k, [[x1 - 26, yb - 2.6], [x1 - 16, yb - 12], [x1 - 6, yb - 2.6]], '#2E2A34', 'metal', 1);
  Ln(k, [[x1 - 30, yb - 2.6], [x1 - 22, yb - 16]], '#7A5A3A', 0.8, 0.9);
  GR(k, x0, yt, x1 - x0, yb - yt, '#3E3054', NIGHT ? 0.18 : 0.28);
  void rng;
}

function liftShaft(k: Kit, carFloor: number): void {
  const [a, b] = LIFT, top = FL[5][1], bot = BSMT[1];
  R(k, a, top, b - a, bot - top, '#3E3346', 'glass', 1);
  for (const x of [a + 3, b - 3]) Ln(k, [[x, top], [x, bot]], '#8A7A6A', 0.6, 0.7);
  for (const x of [a + 12.5, a + 15.5]) Ln(k, [[x, top], [x, FL[carFloor][1] + 2]], '#B8A27A', 0.4, 0.8);
  // the car: a gilded cage
  const [yb, yt] = FL[carFloor];
  R(k, a + 2.5, yt + 3, b - a - 5, yb - yt - 4, '#F0C870', 'glow', 1, { alpha: 0.9 });
  for (let x = a + 4; x < b - 3; x += 2.2) Ln(k, [[x, yt + 3], [x, yb - 1]], '#8A5A1C', 0.4, 0.85);
  R(k, a + 2, yt + 2, b - a - 4, 1.6, '#C99A3A', 'gold', 1); R(k, a + 2, yb - 1.6, b - a - 4, 1.6, '#C99A3A', 'gold', 1);
  R(k, a + 7, yb - 7.6, 9, 6, '#F5E7CF', 'box', 1); R(k, a + 11, yb - 7.6, 1, 6, HP.rasp, 'ribbon', 0);
  R(k, a + 6, bot - 18, b - a - 12, 12, '#5A5060', 'metal', 1); // counterweight at rest below
}
function staircase(k: Kit): void {
  const [a, b] = STAIR, levels = [BSMT[1], ...FL.map((f) => f[0]), FL[5][1]];
  R(k, a, FL[5][1], b - a, BSMT[1] - FL[5][1], '#D8C8C4', 'wall', 0);
  GR(k, a, FL[5][1], b - a, BSMT[1] - FL[5][1], '#4A3A5E', 0.22);
  for (let i = 0; i < levels.length - 1; i++) {
    const y0 = levels[i], y1 = levels[i + 1], ym = (y0 + y1) / 2, l2r = i % 2 === 0;
    const flight = (ya: number, yb2: number, ltr: boolean): void => {
      const xa = ltr ? a + 2 : b - 2, xb = ltr ? b - 2 : a + 2, n = 7;
      const pts: Pt[] = [[xa, ya]];
      for (let s = 1; s <= n; s++) { const x = xa + ((xb - xa) * s) / n, yPrev = ya + ((yb2 - ya) * (s - 1)) / n, y = ya + ((yb2 - ya) * s) / n; pts.push([x - (xb - xa) / n, y], [x, y]); void yPrev; }
      P(k, [...pts, [xb, ya + 2], [xa, ya + 2]], '#B89A8E', 'stone', 1);
      Ln(k, [[xa, ya - 6], [xb, yb2 - 6]], '#6E4A3A', 0.7, 0.9);
      for (let s = 0; s <= n; s++) { const x = xa + ((xb - xa) * s) / n, y = ya + ((yb2 - ya) * s) / n; Ln(k, [[x, y], [x, y - 6]], '#6E4A3A', 0.35, 0.7); }
    };
    flight(y0, ym, l2r); flight(ym, y1, !l2r);
    R(k, a, ym - 0.6, b - a, 1.4, '#B89A8E', 'stone', 0);
  }
}

function roomsItems(k: Kit, rng: Rng): void {
  // rooms (design coordinates); slabs and cross walls are painted last so they sit on top as cut masonry
  const story = [shop, postRoom, storeRoom, catalogue, concierge];
  const anc: [string, string][] = [['kitchen', 'pantry'], ['linen', 'office'], ['bed', 'sitting'], ['bath', 'bed'], ['bed', 'writing'], ['staff', 'staff']];
  for (let f = 0; f < 6; f++) {
    const [yb, yt] = FLOORS[f];
    if (f < 5) story[f](k, rng, STORY[0], STORY[1], yb, yt); else ancillary(k, rng, 'trunks', STORY[0], STORY[1], yb, yt);
    ancillary(k, rng, anc[f][0], X0 + 4, LIFT[0], yb, yt); ancillary(k, rng, anc[f][1], STAIR[1], X1 - 4, yb, yt);
  }
  ancillary(k, rng, 'wine', X0 + 4, LIFT[0], BSMT[1], BSMT[0]); boiler(k, rng, STORY[0], STORY[1], BSMT[1], BSMT[0]); ancillary(k, rng, 'coal', STAIR[1], X1 - 4, BSMT[1], BSMT[0]);
  liftShaft(k, 1); staircase(k);
  // cut masonry: floor slabs, the cross walls, the facade's own thickness at the sides
  for (const y of [BSMT[0], ...FL.map((f) => f[0]), FL[5][1]]) cutStone(k, X0, y - 2, X1 - X0, 4);
  cutStone(k, X0, BSMT[1], X1 - X0, 4);
  for (const x of [LIFT[0], LIFT[1], STAIR[0], STAIR[1]]) cutStone(k, x - 1.5, FL[5][1], 3, BSMT[1] - FL[5][1]);
  for (const x of [X0, X1 - 4]) cutStone(k, x, FL[5][1] - 2, 4, BSMT[1] - FL[5][1] + 6);
  // broken brick edge where the facade was taken away
  for (const [x, s] of [[X0 - 2, -1], [X1 + 2, 1]] as [number, number][]) for (let y = FL[5][1]; y < BSMT[1]; y += 5) if (rng.chance(0.6)) R(k, s < 0 ? x - rng.range(1, 4) : x, y, rng.range(1.5, 4), 4.4, HP.wallP, 'wall', 1);
  // the story rooms glow a little brighter than the rest: a warm wash over the centre column
  for (let f = 0; f < 5; f++) { const [yb, yt] = FLOORS[f]; k.poly([[STORY[0] + 2, yt + 2], [STORY[1] - 2, yt + 2], [STORY[1] - 2, yb - 2], [STORY[0] + 2, yb - 2]], '#FFE2B0', 'mist', { alpha: 0.18, knock: 0 }); }
}

export function buildCutaway(o: { seed: number; night?: boolean }): Grand {
  const g = buildGrand({ ...o, cut: true });
  NIGHT = !!o.night;
  const k = new Kit(new Rng(o.seed * 271 + 5)); roomsItems(k, k.rng);
  for (const it of k.items) if (it.k === 'poly' && it.mat !== 'stone' && it.fill !== '#CDB6AE') it.lit = true;
  g.layers.house.items.push(...transformItems(k.items, CUT_Z, CX, CUT_BASE));
  g.counts.house = g.layers.house.items.length; g.counts.rooms = k.items.length;
  g.sprites.car = []; g.sprites.smoke = g.sprites.smoke.map((items) => transformItems(items, CUT_Z, CX, CUT_BASE));
  return g;
}
export { archPts };
