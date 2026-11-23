// The five tableaux, each 800 x 520 in its own coordinates, centred on x = 400, flat-on, mirrored where it matters.
import { C, R, P, Ci, El, Ln, H, T, mirror, person, silhouette, heroBox, plainBox, card, plate } from './kit';

interface Shell { wall: string; trim: string; trimD: string; wain: string; wainD: string; fA: string; fB: string }
function shell(o: Shell): string {
  let s = R(0, 0, 800, 430, o.wall, { stroke: 'none' }) + R(0, 318, 800, 100, o.wain, { stroke: 'none' }) + Ln(0, 318, 800, 318);
  for (let i = 0; i < 10; i++) s += R(i * 80 + 9, 330, 62, 76, o.wainD, { sw: 1.5 });
  s += R(0, 0, 800, 26, o.trim) + Ln(0, 26, 800, 26);
  for (let x = 6; x < 800; x += 16) s += R(x, 26, 8, 8, o.trimD, { sw: 1.5 });
  s += R(0, 418, 800, 14, o.trim);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 16; c++) s += R(c * 50, 432 + r * 44, 50, 44, (r + c) % 2 ? o.fB : o.fA, { sw: 1.5 });
  return s;
}
const border = (): string => R(0, 0, 800, 520, 'none', { sw: 7 });
const bell = (x: number, y: number, r = 17): string => P(`M${x - r},${y}A${r},${r} 0 0 1 ${x + r},${y}Z`, C.must) + R(x - r - 4, y, 2 * r + 8, 5, C.mustD) + Ci(x, y - r - 3, 3.5, C.mustD);

// ---------------- 1. the pastry shop ----------------
export function T1(mode: 'plain' | 'torn' = 'plain'): string {
  let s = shell({ wall: C.rose, trim: C.cream, trimD: C.blue, wain: C.pink, wainD: C.roseD, fA: C.cream, fB: C.blue });
  // shelves of identical boxes, in neat rows (mirrored)
  let sh = R(30, 100, 220, 318, C.roseD) + H(30, 100, 220, 318);
  for (let r = 0; r < 4; r++) {
    const by = 168 + r * 80;
    sh += R(30, by, 220, 8, C.blueD);
    for (let i = 0; i < 4; i++) sh += plainBox(60 + i * 52, by, 44);
  }
  sh += R(30, 100, 220, 8, C.blueD);
  s += mirror(sh);
  s += R(80, 74, 120, 24, C.cream, { rx: 3 }) + T(140, 91, 'Boxes', 14, { weight: 600 }) + R(600, 74, 120, 24, C.cream, { rx: 3 }) + T(660, 91, 'Ribbon', 14, { weight: 600 });
  // card-index cabinet, centred behind the desk
  s += R(262, 128, 276, 292, C.blue) + R(256, 118, 288, 12, C.blueD);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const dx = 268 + i * 66 + 3, dy = 136 + j * 69;
    s += R(dx, dy, 60, 63, C.cream) + R(dx + 14, dy + 12, 32, 14, C.paper, { sw: 1.2 }) + R(dx + 18, dy + 40, 24, 6, C.must, { sw: 1.5, rx: 3 });
  }
  // sign
  s += El(400, 62, 124, 30, C.cream, { sw: 3 }) + El(400, 62, 114, 22, 'none', { sw: 1.2 }) + T(400, 63, 'Aldous & Fig', 20, { weight: 600 }) + T(400, 80, 'Patissiers', 12, { weight: 500 });
  // clerk
  const torn = mode === 'torn';
  s += person({ x: 400, y: 418, h: 250, coat: C.plum, detail: 'apron', hat: 'none', legs: false, hands: torn ? [[356, 252], [444, 252]] : undefined });
  // desk
  s += R(170, 332, 460, 86, C.cream) + H(170, 400, 460, 18);
  for (const x of [184, 340, 496]) s += R(x, 344, 120, 62, C.creamD, { sw: 1.5 });
  s += plate(400, 376, 90, 24, 'Orders', 13, C.must) + R(160, 320, 480, 14, C.deep);
  // desk top
  if (torn) {
    s += card(298 - 48, 240, 96, 82, ['Line 1', '24 pastry', 'boxes', '1,240.00'], { torn: true, size: 12, tag: C.ribbon });
    s += card(400 - 48, 240, 96, 82, ['SO1041', 'Hotel', 'Corvina'], { torn: true, size: 12 });
    s += card(502 - 48, 240, 96, 82, ['Line 2', 'Ribbon and', 'tissue', '310.50'], { torn: true, size: 12 });
  } else {
    s += R(350, 264, 100, 56, C.paper) + Ln(400, 264, 400, 320, { sw: 1.5 });
    for (let i = 0; i < 4; i++) s += Ln(358, 278 + i * 11, 392, 278 + i * 11, { sw: 1.2 }) + Ln(408, 278 + i * 11, 442, 278 + i * 11, { sw: 1.2 });
  }
  s += bell(585, 320) + heroBox(212, 320, 76, true);
  return s + border();
}

// ---------------- 2. the lift and post room ----------------
export function T2(): string {
  let s = shell({ wall: C.cream, trim: C.red, trimD: C.redD, wain: C.red, wainD: C.redD, fA: C.cream, fB: C.red });
  // hatches (mirrored)
  let hat = R(44, 120, 150, 120, C.plum, { rx: 4 }) + R(56, 132, 126, 96, C.plumD) + R(44, 112, 150, 14, C.must) + R(44, 238, 150, 12, C.must);
  hat += P('M56,228L182,228L192,300L46,300Z', C.creamD) + H(56, 228, 126, 6);
  s += mirror(hat);
  // left trolley: copied cards, neat stacks
  const trolley = (x: number): string => R(x - 80, 372, 160, 12, C.mustD) + Ln(x - 74, 384, x - 74, 410) + Ln(x + 74, 384, x + 74, 410) + Ci(x - 56, 412, 13, C.cocoa) + Ci(x + 56, 412, 13, C.cocoa) + Ci(x - 56, 412, 4, C.cream, { sw: 1 }) + Ci(x + 56, 412, 4, C.cream, { sw: 1 }) + Ln(x - 80, 372, x - 90, 320) + Ln(x - 90, 320, x - 98, 320);
  s += trolley(120);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) s += R(64 + i * 36 + k * 2, 344 - k * 3 + 0, 28, 28 - 0, C.paper, { sw: 1.5 });
  s += plate(120, 300, 150, 24, 'Copied cards', 13);
  s += trolley(680);
  ['Web store', 'Web analytics', 'Marketing', 'Old system'].forEach((l, i) => { const y = 372 - (i + 1) * 28; s += R(620, y, 120, 28, i % 2 ? C.creamD : C.must) + Ln(680, y, 680, y + 28, { sw: 1.5 }) + R(626, y + 6, 68, 16, C.paper, { sw: 1 }) + T(660, y + 18, l, 11, { weight: 600, track: 0.04 }); });
  s += plate(680, 258, 150, 24, 'Other senders', 13);
  // the lift: arch, car, operator, indicator
  s += P('M290,418L290,200A110,96 0 0 1 510,200L510,418Z', C.must, { sw: 3 }) + P('M304,418L304,204A96,82 0 0 1 496,204L496,418Z', C.red);
  s += R(320, 214, 160, 204, C.creamD, { sw: 2 }) + H(320, 398, 160, 20);
  s += R(304, 414, 192, 8, C.plum);
  s += R(452, 250, 22, 86, C.must, { rx: 3, sw: 2 });
  for (let j = 0; j < 5; j++) s += Ci(463, 262 + j * 15, 4.2, C.cream, { sw: 1.2 });
  s += person({ x: 396, y: 412, h: 210, coat: C.plum, detail: 'gloves', hat: 'pill', hands: [[366, 346], [426, 346]] });
  s += R(318, 46, 164, 44, C.redD, { rx: 4, sw: 3 });
  for (let n = 1; n <= 5; n++) { const cx = 340 + (n - 1) * 30; s += Ci(cx, 68, 12, n === 2 ? C.must : C.cream, { sw: 1.5 }) + T(cx, 73, String(n), 14, { weight: 700, caps: false, track: 0 }); }
  s += Ln(400, 90, 400, 108, { sw: 2 });
  return s + border();
}

// ---------------- 3. the store room ----------------
export function T3(): string {
  let s = shell({ wall: C.must, trim: C.teal, trimD: C.cream, wain: C.mustD, wainD: '#A8791F', fA: C.cream, fB: C.creamD });
  const cols = [C.cream, C.must, C.paper, C.deep, C.cream, C.blue];
  let sh = R(24, 40, 232, 378, C.teal) + H(24, 40, 232, 378);
  for (let r = 0; r < 4; r++) {
    const by = 100 + r * 62;
    let x = 34;
    for (let i = 0; i < 16; i++) { const w = 10 + ((i * 7 + r * 3) % 4) * 2, hh = 34 + ((i * 5 + r) % 3) * 5; if (x + w > 246) break; sh += R(x, by - hh, w, hh, cols[(i + r) % cols.length], { sw: 1.5 }); x += w + 2; }
    sh += R(24, by, 232, 6, C.tealD);
  }
  for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) { const dx = 32 + i * 55, dy = 350 + j * 34; sh += R(dx, dy, 51, 30, C.cream, { sw: 1.5 }) + R(dx + 14, dy + 10, 23, 5, C.paper, { sw: 1 }) + Ci(dx + 25, dy + 22, 2.5, C.mustD, { sw: 1 }); }
  s += mirror(sh);
  s += R(0, 34, 800, 8, C.mustD);
  // calendar
  s += R(335, 52, 130, 134, C.paper) + R(335, 52, 130, 30, C.teal) + T(400, 72, 'January', 13, { fill: C.cream, weight: 600 }) + T(400, 100, '2024', 14, { weight: 700, caps: false, track: 0.1 });
  for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) s += R(342 + c * 16.5, 110 + r * 17, 12, 12, r === 0 && c === 0 ? C.mustD : C.creamD, { sw: 1 });
  // ladder on the rail
  s += Ln(372, 42, 372, 418, { sw: 6 }) + Ln(428, 42, 428, 418, { sw: 6 });
  for (let y = 62; y < 418; y += 30) s += Ln(372, y, 428, y, { sw: 4 });
  s += Ci(372, 38, 7, C.mustD) + Ci(428, 38, 7, C.mustD);
  s += person({ x: 400, y: 346, h: 170, coat: C.plum, hat: 'cap', detail: 'cap', band: C.cream, legs: true, hands: [[374, 250], [426, 250]] });
  s += R(360, 418, 80, 6, C.cocoa, { stroke: 'none', op: 0.2 });
  return s + border();
}

// ---------------- 4. the switchboard (catalogue desk) ----------------
export function T4(): string {
  let s = shell({ wall: C.lav, trim: C.plum, trimD: C.mint, wain: C.lavD, wainD: C.lav, fA: C.cream, fB: C.lav });
  const names = ['Customer', 'Item', 'Order', 'Line', 'Date', 'Amount', 'Region', 'Channel', 'Year', 'Quarter'];
  let wallL = '';
  for (let j = 0; j < 5; j++) for (let i = 0; i < 2; i++) wallL += R(44 + i * 116, 84 + j * 50, 106, 40, C.mint, { rx: 3 }) + R(48 + i * 116, 88 + j * 50, 98, 32, 'none', { sw: 1, op: 0.6 });
  s += mirror(wallL);
  const right = ['Price', 'Units', 'Store', 'Brand', 'Season', 'Cost', 'Margin', 'Country', 'Return', 'Rep'];
  names.forEach((n, k) => { s += T(44 + (k % 2) * 116 + 53, 84 + Math.floor(k / 2) * 50 + 25, n, 12.5, { weight: 600, track: 0.08, fill: C.plumD }); });
  right.forEach((n, k) => { s += T(800 - 44 - (k % 2) * 116 - 53 + (0), 84 + Math.floor(k / 2) * 50 + 25, n, 12.5, { weight: 600, track: 0.08, fill: C.plumD }); });
  // the trophy: a measuring tape hung on a shield
  s += P('M336,70L464,70L464,150Q464,190 400,206Q336,190 336,150Z', C.plum, { sw: 3 }) + P('M345,78L455,78L455,150Q455,182 400,196Q345,182 345,150Z', 'none', { stroke: C.must, sw: 2 });
  s += R(388, 150, 24, 124, C.paper) + R(388, 270, 24, 10, C.must);
  for (let y = 156; y < 270; y += 8) s += Ln(388, y, y % 16 === 4 ? 400 : 395, y, { sw: 1.2 });
  s += Ci(400, 120, 34, C.must, { sw: 3 }) + Ci(400, 120, 22, C.cream) + Ci(400, 120, 6, C.mustD);
  // chain of hands along the frieze
  for (let k = 0; k < 7; k++) { const x = 232 + k * 56, y = 62; s += Ln(x + 10, y - 2, x + 46, y - 2, { sw: 2 }); }
  for (let k = 0; k < 7; k++) { const x = 232 + k * 56; s += Ci(x, 48, 6, C.plum, { sw: 1.5 }) + P(`M${x - 8},66L${x - 5},54L${x + 5},54L${x + 8},66Z`, C.plum, { sw: 1.5 }); }
  s += R(398 - 3 + 56 * 0, 58, 0.1, 0.1, 'none', { stroke: 'none' });
  // cataloguer at a symmetrical desk
  s += person({ x: 400, y: 418, h: 240, coat: C.cocoa, detail: 'cravat', hat: 'none', legs: false, hands: [[358, 318], [442, 318]] });
  s += R(236, 332, 328, 86, C.lavD) + H(236, 400, 328, 18) + R(226, 320, 348, 14, C.plum);
  s += plate(400, 376, 120, 24, 'Catalogue', 13);
  for (const x of [262, 508]) s += R(x - 14, 296, 28, 24, C.paper, { sw: 2 }) + Ln(x - 6, 306, x + 6, 306, { sw: 1.2 });
  s += Ci(300, 312, 7, C.must, { sw: 2 }) + Ln(300, 305, 300, 284) + Ci(500, 312, 7, C.must, { sw: 2 }) + Ln(500, 305, 500, 284);
  return s + border();
}

// ---------------- 5. the concierge desk ----------------
export type Mode5 = 'open' | 'return';
export function T5(mode: Mode5 = 'open'): string {
  let s = shell({ wall: C.pink, trim: C.must, trimD: C.mustD, wain: C.rose, wainD: C.roseD, fA: C.cream, fB: C.pink });
  // pilasters, mirrored
  s += mirror(R(22, 34, 52, 384, C.creamD) + R(14, 34, 68, 14, C.must) + R(14, 404, 68, 14, C.must) + Ln(36, 48, 36, 404, { sw: 1.5 }) + Ln(48, 48, 48, 404, { sw: 1.5 }) + Ln(60, 48, 60, 404, { sw: 1.5 }));
  // the key rack: who may see what
  s += R(290, 58, 220, 130, C.deep, { sw: 3 }) + R(300, 68, 200, 110, C.roseD, { sw: 1.5 });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) { const x = 322 + c * 31, y = 90 + r * 32; s += Ci(x, y, 3, C.cocoa, { sw: 1 }) + Ln(x, y + 3, x, y + 14, { sw: 2.5 }) + Ci(x, y + 17, 4, C.must, { sw: 1.2 }) + R(x - 6, y + 22 - 2, 12, 5, C.paper, { sw: 1 }); }
  s += plate(400, 54, 90, 22, 'Keys', 13, C.must);
  // service door and trolley of boxes (the loading dock)
  s += R(652, 220, 112, 198, C.teal, { sw: 3 }) + R(664, 234, 88, 76, C.tealD) + Ln(708, 234, 708, 310, { sw: 1.5 }) + R(740, 330, 8, 24, C.must, { rx: 3 }) + plate(708, 204, 100, 22, 'Service', 13, C.must);
  s += R(610, 392, 120, 10, C.mustD) + Ci(630, 410, 8, C.cocoa) + Ci(710, 410, 8, C.cocoa) + Ln(610, 392, 602, 352);
  for (let i = 0; i < 2; i++) for (let k = 0; k < 2 - i; k++) s += plainBox(646 + k * 48 + i * 24, 392 - i * 33, 40, C.mustD);
  // the concierge
  const ret = mode === 'return';
  s += person({ x: 400, y: 418, h: 240, coat: C.plum, detail: 'buttons', hat: 'none', legs: false, hands: ret ? [[316, 290], [440, 330]] : [[360, 318], [440, 318]] });
  // desk: grand, symmetrical
  s += R(200, 332, 400, 86, C.deep) + R(190, 318, 420, 16, C.must);
  for (let i = 0; i < 6; i++) s += R(212 + i * 62, 344, 50, 62, C.roseD, { sw: 1.5 });
  s += plate(400, 376, 130, 26, 'Concierge', 14, C.must) + bell(400, 316, 16);
  // red carpet runner
  s += R(330, 432, 140, 88, C.red) + R(338, 432, 124, 88, 'none', { stroke: C.must, sw: 3 }) + H(330, 480, 140, 40);
  // the guest, in strict profile, from the silhouette system
  s += silhouette('customer', ret ? 'hand' : 'wait', 150, 430, 205, C.cocoa);
  if (ret) s += R(286, 270, 40, 52, C.paper, { sw: 2.5 }) + Ln(293, 308, 293, 292, { sw: 3, stroke: C.teal }) + Ln(302, 308, 302, 286, { sw: 3, stroke: C.teal }) + Ln(311, 308, 311, 280, { sw: 3, stroke: C.teal }) + Ln(292, 278, 318, 278, { sw: 1.5 });
  return s + border();
}

