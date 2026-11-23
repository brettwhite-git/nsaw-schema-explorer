import { C, R, P, Ci, El, Ln, H, T, put, mirror, mat, person, heroBox, plainBox, plate, svgWrap, FONT, esc } from './kit';
import { T1, T2, T3, T4, T5 } from './rooms';

const FLOORS = [
  { n: 5, name: 'The concierge desk', layer: 'the two ways out', c: C.pink },
  { n: 4, name: 'The switchboard', layer: 'the semantic model', c: C.lav },
  { n: 3, name: 'The store room', layer: 'the warehouse', c: C.must },
  { n: 2, name: 'The lift and post room', layer: 'getting data in', c: C.red },
  { n: 1, name: 'The pastry shop', layer: 'NetSuite', c: C.rose },
];

// ---------- 1. title card ----------
function flourish(): string {
  // one corner, drawn for the top-left of the card (0,0 = card corner)
  return `<path d="M0,64Q0,0 64,0" fill="none" stroke-width="2.5"/><path d="M12,64Q12,12 64,12" fill="none" stroke-width="1.2"/><path d="M0,34Q22,34 22,12" fill="none" stroke-width="1.5"/>` + Ci(30, 30, 5, C.must) + P('M72,0L80,6L72,12L64,6Z', C.deep, { sw: 1.5 }) + P('M0,72L6,80L12,72L6,64Z', C.deep, { sw: 1.5 });
}
const rule = (y: number, w: number): string => Ln(600 - w, y, 600 - 14, y, { sw: 1.5 }) + Ln(600 + 14, y, 600 + w, y, { sw: 1.5 }) + P(`M600,${y - 8}L608,${y}L600,${y + 8}L592,${y}Z`, C.must, { sw: 1.5 });
export function view1(): string {
  let s = mat(C.pink);
  // pattern of tiny diamonds in tidy rows
  for (let r = 0; r < 2; r++) for (let c = 0; c < 28; c++) { const x = 60 + c * 41, y = r ? 690 : 60; s += P(`M${x},${y - 6}L${x + 6},${y}L${x},${y + 6}L${x - 6},${y}Z`, C.rose, { sw: 1 }); }
  for (let r = 0; r < 14; r++) for (const x of [60, 1140]) { const y = 110 + r * 40; s += P(`M${x},${y - 6}L${x + 6},${y}L${x},${y + 6}L${x - 6},${y}Z`, C.rose, { sw: 1 }); }
  s += R(150, 90, 900, 570, C.cream, { sw: 4 }) + R(164, 104, 872, 542, 'none', { sw: 1.5 }) + R(172, 112, 856, 526, 'none', { sw: 1 });
  s += `<g transform="translate(170 110)">${flourish()}</g><g transform="translate(1030 110) scale(-1 1)">${flourish()}</g><g transform="translate(170 640) scale(1 -1)">${flourish()}</g><g transform="translate(1030 640) scale(-1 -1)">${flourish()}</g>`;
  s += heroBox(600, 222, 120, true);
  s += rule(252, 150);
  s += T(600, 322, 'How NetSuite', 56, { font: 'serif', weight: 600 }) + T(600, 388, 'Data Intelligence', 56, { font: 'serif', weight: 600 }) + T(600, 454, 'is put together', 56, { font: 'serif', weight: 400, italic: true });
  s += rule(488, 90);
  s += T(600, 530, 'A story in five floors', 24, { track: 0.32, weight: 500 });
  s += T(600, 578, 'Aldous & Fig, Patissiers', 22, { font: 'serif', italic: true, caps: false, track: 0.02 });
  s += T(600, 610, 'Hotel Corvina has placed an order', 15, { track: 0.2, weight: 500, fill: C.plum });
  return svgWrap(s);
}

// ---------- 2. the building ----------
const half = (n: number): { outer: string; left: string; right: string } => {
  // local frame 267 x 92, floor at y = 84. Left half carries the worker; the right half carries the other feature.
  if (n === 1) return {
    outer: R(6, 8, 64, 76, C.roseD) + R(6, 40, 64, 5, C.blueD) + R(6, 79, 64, 5, C.blueD) + [20, 38, 56].map((x) => plainBox(x, 40, 16) + plainBox(x, 79, 16)).join(''),
    left: person({ x: 134, y: 84, h: 74, coat: C.plum, detail: 'apron', legs: false }) + R(94, 58, 80, 26, C.cream) + R(88, 54, 92, 6, C.deep) + R(144, 40, 20, 14, C.paper, { sw: 1.5 }),
    right: R(124, 14, 56, 70, C.blue) + [0, 1, 2].map((j) => [0, 1].map((i) => R(128 + i * 26, 18 + j * 22, 24, 19, C.cream, { sw: 1.5 })).join('')).join(''),
  };
  if (n === 2) return {
    outer: R(10, 10, 54, 40, C.plum) + R(10, 6, 54, 6, C.must) + R(10, 48, 54, 5, C.must),
    left: R(84, 74, 100, 5, C.mustD) + Ci(100, 82, 4, C.cocoa) + Ci(168, 82, 4, C.cocoa) + [0, 1, 2, 3].map((i) => R(92 + i * 22, 54, 18, 20, C.paper, { sw: 1.5 })).join(''),
    right: R(84, 74, 100, 5, C.mustD) + Ci(100, 82, 4, C.cocoa) + Ci(168, 82, 4, C.cocoa) + [0, 1, 2].map((i) => R(94, 74 - 13 * (i + 1), 80, 13, i % 2 ? C.creamD : C.must, { sw: 1.5 }) + Ln(134, 74 - 13 * (i + 1), 134, 74 - 13 * i, { sw: 1.2 })).join(''),
  };
  if (n === 3) {
    const sp = (): string => { let a = R(4, 4, 58, 80, C.teal); const cols = [C.cream, C.must, C.paper, C.deep]; for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) a += R(8 + i * 9, 26 + r * 23 - (i % 3) * 2 - 6 + 6, 7, 18 + (i % 3) * 2 - 0, cols[(i + r) % 4], { sw: 1 }); return a; };
    return {
      outer: sp(),
      left: Ln(70, 6, 200, 6, { sw: 3 }) + Ln(122, 6, 122, 84, { sw: 3 }) + Ln(148, 6, 148, 84, { sw: 3 }) + [16, 30, 44, 58, 72].map((y) => Ln(122, y, 148, y, { sw: 2 })).join('') + person({ x: 135, y: 64, h: 58, coat: C.plum, hat: 'cap', detail: 'cap', hands: [[123, 32], [147, 32]] }),
      right: R(84, 10, 38, 44, C.paper) + R(84, 10, 38, 12, C.cream) + R(134, 46, 56, 38, C.cream) + Ln(134, 65, 190, 65, { sw: 1.5 }) + Ci(162, 55, 2.5, C.mustD, { sw: 1 }) + Ci(162, 75, 2.5, C.mustD, { sw: 1 }),
    };
  }
  if (n === 4) return {
    outer: [0, 1].map((j) => [0, 1].map((i) => R(8 + i * 30, 14 + j * 28, 26, 22, C.mint, { sw: 1.5 })).join('')).join(''),
    left: person({ x: 134, y: 84, h: 72, coat: C.cocoa, detail: 'cravat', legs: false }) + R(98, 58, 72, 26, C.lavD) + R(94, 54, 80, 6, C.plum),
    right: Ci(134, 30, 13, C.must, { sw: 2 }) + Ci(134, 30, 7, C.cream, { sw: 1.5 }) + R(130, 43, 8, 34, C.paper, { sw: 1.5 }),
  };
  return {
    outer: R(6, 6, 22, 78, C.creamD) + R(3, 6, 28, 6, C.must),
    left: person({ x: 134, y: 84, h: 72, coat: C.plum, detail: 'buttons', legs: false }) + R(96, 58, 76, 26, C.deep) + R(92, 54, 84, 6, C.must) + R(100, 30, 68, 12, C.must, { sw: 1.5, op: 0 }),
    right: R(120, 22, 58, 62, C.teal) + R(128, 30, 42, 26, C.tealD, { sw: 1.5 }),
  };
};

export function buildingScene(): string {
  let s = R(30, 30, 1140, 690, 'url(#skyg)', { stroke: 'none' });
  const cloud = (x: number, y: number): string => Ci(x, y, 16, C.cream, { sw: 1.5 }) + Ci(x + 22, y - 8, 20, C.cream, { sw: 1.5 }) + Ci(x + 46, y, 16, C.cream, { sw: 1.5 }) + R(x - 12, y, 72, 16, C.cream, { stroke: 'none' }) + Ln(x - 12, y + 16, x + 60, y + 16, { sw: 1.5 });
  s += cloud(80, 110) + `<g transform="translate(1200 0) scale(-1 1)">${cloud(80, 110)}</g>`;
  // hillside, with trees in rows
  s += P('M30,720L30,610Q300,540 600,528Q900,540 1170,610L1170,720Z', C.mint) + P('M30,720L30,670Q300,630 600,622Q900,630 1170,670L1170,720Z', C.mintD);
  const tree = (x: number, y: number, r: number): string => Ln(x, y, x, y + r * 1.3, { sw: 2.5 }) + Ci(x, y, r, C.tealD, { sw: 2 }) + Ci(x - r * 0.3, y - r * 0.3, r * 0.3, C.teal, { stroke: 'none' });
  let trees = '';
  for (let i = 0; i < 3; i++) trees += tree(60 + i * 44, 700, 12);
  s += mirror(trees, 600);
  // steps and plinth
  s += R(160, 684, 880, 14, C.cream) + R(180, 670, 840, 14, C.cream) + R(200, 654, 800, 16, C.creamD);
  // facade
  const fx = 220, fw = 760, top = 168, fy1 = 654;
  s += R(fx, top, fw, fy1 - top, C.pink, { sw: 3 }) + H(fx, 640, fw, 14);
  // mansard, pediment, turrets
  s += P('M200,170L262,128L938,128L1000,170Z', C.deep, { sw: 3 });
  for (let r = 0; r < 2; r++) for (let c = 0; c < 36; c++) { const x = 232 + c * 19.5 + (r ? 9 : 0), y = 140 + r * 12; if (x < 960) s += P(`M${x - 9},${y}Q${x},${y + 12} ${x + 9},${y}`, 'none', { sw: 1, op: 0.5 }); }
  s += R(480, 84, 240, 46, C.pink, { sw: 3 }) + R(520, 64, 160, 22, C.pink, { sw: 3 }) + R(560, 50, 80, 16, C.pink, { sw: 3 });
  s += mirror(R(300, 96, 58, 34, C.pink, { sw: 3 }) + P('M292,96L366,96L329,50Z', C.deep, { sw: 3 }) + Ln(329, 50, 329, 32, { sw: 2 }) + P('M329,32L350,38L329,44Z', C.must, { sw: 1.5 }) + R(318, 106, 12, 18, C.blue, { rx: 6, sw: 1.5 }), 600);
  // the dial: floor indicator on the roof
  s += Ci(600, 108, 40, C.cream, { sw: 3 }) + Ci(600, 108, 33, 'none', { sw: 1 });
  for (let n = 1; n <= 5; n++) { const th = ((180 - (n - 1) * 45) * Math.PI) / 180; s += T(600 + 26 * Math.cos(th), 108 - 26 * Math.sin(th) + 5, String(n), 14, { weight: 700, caps: false, track: 0 }); }
  const th2 = (135 * Math.PI) / 180;
  s += Ln(600, 108, 600 + 18 * Math.cos(th2), 108 - 18 * Math.sin(th2), { sw: 3 }) + Ci(600, 108, 4, C.cocoa) + T(600, 130, 'Lift', 11, { weight: 600 });
  // cornice and name plate
  s += R(210, 168, 780, 24, C.deep, { sw: 3 });
  for (let x = 220; x < 980; x += 16) s += R(x, 192, 8, 6, C.rose, { sw: 1.2 });
  s += R(410, 166, 380, 26, C.must, { rx: 3, sw: 2.5 }) + T(600, 185, 'Aldous & Fig  ·  Patissiers', 16, { weight: 600, track: 0.2 });
  // five rooms, bottom to top, with the lift shaft down the middle
  const x0 = 290, x1 = 910, sx0 = 557, sx1 = 643;
  s += R(sx0, 198, sx1 - sx0, 454, C.redD, { sw: 3 }) + H(sx0, 198, 86, 454);
  FLOORS.forEach((f, i) => {
    const top2 = 198 + i * 90.4, hgt = 90;
    const bot = top2 + hgt;
    const colors = { 5: [C.pink, C.must], 4: [C.lav, C.plum], 3: [C.must, C.teal], 2: [C.cream, C.red], 1: [C.rose, C.cream] }[f.n]!;
    const wall = f.n === 5 ? C.pink : colors[0];
    const mk = (xa: number, wdt: number, flip: boolean, inner: string, outer: string): string => {
      const body = R(0, 0, 267, hgt - 8, wall, { sw: 0 }) + (f.n === 2 ? R(0, 56, 267, 28, C.red, { stroke: 'none' }) : '') + R(0, hgt - 8, 267, 8, colors[1], { sw: 2 }) + (f.n === 5 ? '' : '') + outer;
      void wdt;
      return `<g transform="translate(${flip ? xa + 267 : xa} ${top2 - 8 + 8}) scale(${flip ? -1 : 1} 1)" clip-path="none">${R(0, 0, 267, hgt, wall, { stroke: 'none' })}${body}${flip ? '' : ''}${inner}</g>`;
    };
    const h = half(f.n);
    // outer decor mirrored; inner feature not mirrored
    const left = `<g transform="translate(${x0} ${top2})">${R(0, 0, 267, hgt, wall, { stroke: 'none' })}${f.n === 2 ? R(0, 54, 267, 28, C.red, { stroke: 'none' }) : ''}${R(0, hgt - 8, 267, 8, colors[1])}${h.outer}${h.left}</g>`;
    const right = `<g transform="translate(${x1 + 0} ${top2}) scale(-1 1)">${R(0, 0, 267, hgt, wall, { stroke: 'none' })}${f.n === 2 ? R(0, 54, 267, 28, C.red, { stroke: 'none' }) : ''}${R(0, hgt - 8, 267, 8, colors[1])}${h.outer}</g><g transform="translate(${sx1} ${top2})">${h.right}</g>`;
    void mk;
    s += left + right + Ln(x0, bot, x1, bot, { sw: 3 });
    // carpet on the concierge floor
    // wing windows and string course
    for (const wx of [255, 945]) s += P(`M${wx - 15},${bot - 18}L${wx - 15},${top2 + 26}A15,15 0 0 1 ${wx + 15},${top2 + 26}L${wx + 15},${bot - 18}Z`, C.blueD, { sw: 2 }) + Ln(wx, top2 + 12, wx, bot - 18, { sw: 1.5 }) + Ln(wx - 15, top2 + 44, wx + 15, top2 + 44, { sw: 1.5 });
    s += Ln(fx, bot, x0, bot, { sw: 2.5 }) + Ln(x1, bot, fx + fw, bot, { sw: 2.5 });
    // plaques: name and layer on the left, floor number on the right
    const lines = f.name.length > 18 ? [f.name.slice(0, f.name.indexOf(' and ') + 4), f.name.slice(f.name.indexOf(' and ') + 5)] : [f.name];
    const py = top2 + hgt / 2, ph = lines.length * 17 + 30;
    s += Ln(fx, py, 210, py, { sw: 2 }) + R(28, py - ph / 2, 182, ph, C.cream, { sw: 2.5, rx: 3 }) + R(28, py - ph / 2, 10, ph, f.c, { sw: 2.5 });
    lines.forEach((l, k) => { s += T(124, py - ph / 2 + 22 + k * 17, l, 14, { weight: 600, track: 0 }); });
    s += T(124, py - ph / 2 + 22 + lines.length * 17 + 2, f.layer, 15, { font: 'serif', italic: true, caps: false, track: 0 });
    s += Ln(fx + fw, py, 1000 + 40, py, { sw: 2 }) + Ci(1066, py, 22, f.c, { sw: 2.5 }) + Ci(1066, py, 17, 'none', { sw: 1, op: 0.7 }) + T(1066, py + 8, String(f.n), 22, { font: 'serif', caps: false, weight: 700, track: 0, fill: f.n === 2 ? C.cream : C.cocoa });
  });
  // pastry box rides in the shaft? no: it sits on the desk of floor 1; the lift car waits at floor 2 with its operator
  const f2top = 198 + 3 * 90.4;
  s += Ln(600, 198, 600, f2top + 6, { sw: 2.5 }) + R(566, f2top + 8, 68, 76, C.red, { sw: 2.5 }) + R(572, f2top + 14, 56, 66, C.creamD, { sw: 1.5 }) + R(566, f2top + 78, 68, 6, C.must, { sw: 1.5 });
  s += person({ x: 600, y: f2top + 80, h: 54, coat: C.plum, detail: 'gloves', hat: 'pill', hands: [[587, f2top + 60], [613, f2top + 60]] });
  const f1top = 198 + 4 * 90.4;
  s += heroBox(404, f1top + 58, 40, false);
  // flower beds, a lantern either side of the steps
  return s;
}
export function view2(): string { return svgWrap(mat(C.blue) + buildingScene()); }

// ---------- 3. floor 1 close-up ----------
const captionPlate = (text: string, y = 672, w = 1000, size = 24): string => R(600 - w / 2, y, w, 44, C.cream, { sw: 3, rx: 2 }) + R(600 - w / 2 + 5, y + 5, w - 10, 34, 'none', { sw: 1 }) + T(600, y + 30, text, size, { font: 'serif', italic: true, caps: false, track: 0 });
export function view3(): string {
  let s = mat(C.rose);
  s += put(120, 42, 1.2, T1('torn'), 3);
  s += Ci(150, 76, 22, C.cream, { sw: 3 }) + T(150, 86, '1', 28, { font: 'serif', caps: false, weight: 700, track: 0 });
  s += captionPlate('The clerk tears it into cards: one for the order, one for each line.');
  return svgWrap(s);
}

// ---------- 4. floor 5 close-up ----------
export function view4(): string {
  let s = mat(C.pink);
  // the first question, lettered on a banner above
  s += P('M200,40L1000,40L1000,126L200,126Z', C.cream, { sw: 3 }) + P('M200,48L160,48L180,83L160,118L200,118Z', C.creamD, { sw: 3 }) + P('M1000,48L1040,48L1020,83L1040,118L1000,118Z', C.creamD, { sw: 3 }) + R(210, 48, 780, 70, 'none', { sw: 1 });
  s += T(600, 78, '“How do we compare with last year,', 28, { font: 'serif', italic: true, caps: false, track: 0 }) + T(600, 110, 'when last year is in the old system?”', 28, { font: 'serif', italic: true, caps: false, track: 0 });
  s += put(160, 138, 1.1, T5('open'), 3);
  s += Ci(190, 172, 22, C.cream, { sw: 3 }) + T(190, 182, '5', 28, { font: 'serif', caps: false, weight: 700, track: 0 });
  return svgWrap(s);
}

// ---------- 5. the lift ----------
export function view5(): string {
  let s = mat(C.cream);
  // the shaft, cables, and the car cut open
  s += R(420, 30, 360, 636, C.redD, { stroke: 'none' }) + H(420, 30, 360, 636) + R(420, 30, 360, 636, 'none', { sw: 3 });
  s += Ln(560, 30, 560, 262, { sw: 3 }) + Ln(640, 30, 640, 262, { sw: 3 });
  // indicator above the door: a dial of five floors
  s += P('M470,250A130,110 0 0 1 730,250Z', C.must, { sw: 3 }) + P('M486,250A114,96 0 0 1 714,250Z', C.cream, { sw: 2 });
  for (let n = 1; n <= 5; n++) { const th = ((180 - (n - 1) * 45) * Math.PI) / 180, cx = 600 + 82 * Math.cos(th), cy = 246 - 72 * Math.sin(th) + 0; s += Ci(cx, cy - 4, 17, n <= 2 ? C.must : C.paper, { sw: 2 }) + T(cx, cy + 4, String(n), 22, { font: 'serif', caps: false, weight: 700, track: 0 }); }
  const th2 = (141 * Math.PI) / 180;
  s += Ln(600, 246, 600 + 50 * Math.cos(th2), 246 - 44 * Math.sin(th2), { sw: 4 }) + Ci(600, 246, 7, C.cocoa);
  // the car
  s += R(440, 262, 320, 392, C.red, { sw: 4 }) + R(458, 280, 284, 354, C.creamD, { sw: 3 }) + H(458, 600, 284, 34) + R(440, 634, 320, 20, C.must, { sw: 3 });
  s += R(458, 520, 284, 8, C.must, { sw: 2 });
  for (const x of [476, 724]) s += Ln(x, 300, x, 520, { sw: 1.5, op: 0.5 });
  s += R(470, 330, 30, 120, C.must, { rx: 4, sw: 2.5 }) + [0, 1, 2, 3, 4].map((j) => Ci(485, 346 + j * 22, 6, j < 2 ? C.cream : C.paper, { sw: 1.5 })).join('');
  s += person({ x: 600, y: 624, h: 330, coat: C.plum, detail: 'gloves', hat: 'pill', hands: [[548, 500], [652, 500]] });
  s += heroBox(600, 548, 120, true);
  // the five floors on either side, colour-keyed
  const L = FLOORS;
  L.forEach((f, i) => {
    const y = 70 + i * 116, hgt = 96;
    const dark = f.n === 2;
    for (const side of [0, 1]) {
      const x = side ? 810 : 60, w = 330;
      s += R(x, y, w, hgt, f.c, { sw: 3 }) + R(x + 6, y + 6, w - 12, hgt - 12, 'none', { sw: 1, op: 0.6 });
      const dx = side ? x + w - 44 : x + 44;
      s += Ci(dx, y + hgt / 2, 26, C.cream, { sw: 2.5 }) + T(dx, y + hgt / 2 + 9, String(f.n), 26, { font: 'serif', caps: false, weight: 700, track: 0 });
      const tx = side ? x + w - 88 : x + 88, an = side ? 'end' : 'start';
      const tf = dark ? C.cream : C.cocoa;
      s += T(tx, y + hgt / 2 - 2, side ? f.layer : f.name, side ? 17 : 15, side ? { anchor: an, font: 'serif', italic: true, caps: false, track: 0, fill: tf } : { anchor: an, weight: 600, fill: tf, track: 0.08 });
      if (!side) s += T(tx, y + hgt / 2 + 20, 'floor ' + f.n, 13, { anchor: an, weight: 500, fill: tf, op: 0.8 });
    }
    // door connecting each floor to the shaft
    s += Ln(390, y + hgt / 2, 420, y + hgt / 2, { sw: 3 }) + Ln(780, y + hgt / 2, 810, y + hgt / 2, { sw: 3 });
  });
  s += captionPlate('A copy of our line goes upstairs.', 674, 520);
  return svgWrap(s);
}

// ---------- 6. colour script ----------
interface Panel { title: string; note: string; chips: string[]; art: string; asr?: number }
export function view6(): string {
  let s = mat(C.cream);
  s += T(600, 74, 'Colour script', 34, { font: 'serif', caps: false, weight: 600, track: 0 }) + T(600, 100, 'Seven moments in story order, one colour key for each place', 14, { weight: 500, track: 0.16 });
  const panels: Panel[] = [
    { title: '1  At the counter', note: 'A grand front desk seen straight on. One guest, one question.', chips: [C.pink, C.must, C.red], art: put(0, 0, 0.327, T5('open'), 1.3) },
    { title: '2  The pastry shop', note: 'A shop back room. Identical boxes in rows, the clerk dead centre.', chips: [C.rose, C.cream, C.blue], art: put(0, 0, 0.327, T1('plain'), 1.3) },
    { title: '3  The lift and post room', note: 'A lacquer-red lift with its operator. Parcels wait at a hatch.', chips: [C.red, C.plum, C.cream], art: put(0, 0, 0.327, T2(), 1.3) },
    { title: '4  The store room', note: 'A tall archive. One ladder on a rail, ledgers on both sides.', chips: [C.must, C.teal, C.cream], art: put(0, 0, 0.327, T3(), 1.3) },
    { title: '5  The switchboard', note: 'A wall of name plates, one measuring tape hung like a trophy.', chips: [C.lav, C.plum, C.mint], art: put(0, 0, 0.327, T4(), 1.3) },
    { title: '6  The desk, again', note: 'The same desk. The guest now holds the report.', chips: [C.pink, C.must, C.red], art: put(0, 0, 0.327, T5('return'), 1.3) },
    { title: '7  The whole building', note: 'A miniature on a hillside, all five floors lit.', chips: [C.pink, C.deep, C.mint], art: put(0, 0, 0.218, buildingScene(), 1.3), asr: 1 },
  ];
  const cw = 262, gap = 22, x0 = 600 - (4 * cw + 3 * gap) / 2;
  const cell = (p: Panel, i: number): string => {
    const col = i % 4, row = Math.floor(i / 4), x = x0 + col * (cw + gap), y = 126 + row * 296;
    let g = R(x - 2, y - 2, cw + 4, 172, C.cocoa, { stroke: 'none', op: 0.0 });
    const ah = p.asr ? 163 : 170;
    g += `<g transform="translate(${x} ${y})">${p.art}</g>` + R(x, y, cw, ah, 'none', { sw: 2 });
    g += T(x, y + ah + 24, p.title, 14, { anchor: 'start', weight: 600, track: 0.08 });
    p.chips.forEach((c, k) => { g += R(x + k * 54, y + ah + 34, 48, 16, c, { sw: 1.5 }); });
    g += R(x + 3 * 54, y + ah + 34, 16, 16, C.ribbon, { sw: 1.5 });
    p.chips.forEach((c, k) => { g += T(x + k * 54 + 24, y + ah + 63, c, 10, { weight: 500, track: 0, caps: false }); });
    const words = p.note.split(' ');
    const ls: string[] = ['']; for (const w of words) { const l = ls[ls.length - 1]; if ((l + ' ' + w).length > 36) ls.push(w); else ls[ls.length - 1] = (l + ' ' + w).trim(); }
    ls.forEach((l, k) => { g += T(x, y + ah + 82 + k * 17, l, 14, { anchor: 'start', font: 'serif', italic: true, caps: false, track: 0 }); });
    return g;
  };
  panels.forEach((p, i) => { s += cell(p, i); });
  // the comparison strip: the same floor, two looks
  const x = x0 + 3 * (cw + gap), y = 126 + 296;
  s += T(x, y + 14, 'The same floor, two looks', 14, { anchor: 'start', weight: 600, track: 0.08 });
  s += `<image href="/lab/scenes/shots/01-front-office/click9-dark.jpg" x="${x}" y="${y + 26}" width="127" height="84" preserveAspectRatio="xMidYMid slice"/>` + R(x, y + 26, 127, 84, 'none', { sw: 2 });
  s += put(x + 135, y + 26, 0.159, T1('plain'), 1.2) + R(x + 135, y + 26, 127, 84, 'none', { sw: 2 });
  s += T(x, y + 132, 'Dark ink', 14, { anchor: 'start', weight: 600, track: 0.1 }) + T(x + 135, y + 132, 'Pastry shop', 14, { anchor: 'start', weight: 600, track: 0.1 });
  s += T(x, y + 152, 'Night paper, light line, one amber card.', 14, { anchor: 'start', font: 'serif', italic: true, caps: false, track: 0 });
  s += T(x, y + 170, 'Confection fills, cocoa line, one ribbon.', 14, { anchor: 'start', font: 'serif', italic: true, caps: false, track: 0 });
  return svgWrap(s);
}
export const VIEWS = [
  { key: '1', label: 'Title', fn: view1 }, { key: '2', label: 'Building', fn: view2 }, { key: '3', label: 'Pastry shop', fn: view3 },
  { key: '4', label: 'Concierge', fn: view4 }, { key: '5', label: 'Lift', fn: view5 }, { key: '6', label: 'Colour script', fn: view6 },
];
void FONT; void esc; void El; void H; void plate; void plainBox;
