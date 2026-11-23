// The building in section, drawn as a dollhouse: five rooms, five workers, a shaft up one side, a roofline and a
// ground line. Three views use it: the establishing shot, the front-office close-up, the opening bookend.
// Rooms rhyme: the same plaque place, skirting, cornice, two pendant lamps and an opening on the right wall on every floor.
// Hatching varies by surface: wall cuts dense at 45 degrees, floor slabs sparse the other way, shadow sides short strokes.
import { writeText } from '../../ink/written';
import { KINDS, CAB, drawerAt, Pen, ptsD, rectPts, tornPts, TYPE, type Pt, type Tone } from '../../figures/scenes/objects';
import { POSES, drawPose, type PoseDef } from './poses';

export const HOUSE = 1;
const INK2 = 'var(--ink-2)';
const SLAB = 10, RH = 98;
export const FLOORS = [700, 592, 484, 376, 268];   // floor surface of each room, bottom to top
const GROUND = 736;
const X0 = 250, X1 = 950, SHAFT = 322, RX0 = SHAFT, RX1 = 938;
const ROOMS = [
  { plain: 'front office', product: 'NetSuite' }, { plain: 'post room', product: 'getting it out' }, { plain: 'stock room', product: 'the warehouse' },
  { plain: 'catalogue desk', product: 'the model' }, { plain: 'counter and dock', product: 'the doors' },
];
const pose = (role: string, name: string): PoseDef => POSES[role].find((d) => d.name === name)!;
const rect = (x: number, y: number, w: number, h: number): Pt[] => rectPts(x, y, w, h);

/** a cut slab: wall (dense, 45 degrees) or floor (sparse, 135 degrees) */
function slab(p: Pen, g: Element, x: number, y: number, w: number, h = SLAB, kind: 'wall' | 'floor' = 'floor'): void {
  if (w <= 0 || h <= 0) return;
  const d = ptsD(rect(x, y, w, h));
  p.fill(g, d); p.hatch(g, d, { x0: x, y0: y, x1: x + w, y1: y + h }, kind === 'wall' ? 45 : 135, kind === 'wall' ? 2.6 : 5.4, kind === 'wall' ? 0.75 : 0.55); p.stroke(g, d, 'support');
}
/** the shadow side of a piece of furniture: short light strokes */
function shade(p: Pen, g: Element, x: number, y: number, w: number, h: number): void {
  const r = { x0: x, y0: y, x1: x + w, y1: y + h };
  p.hatch(g, ptsD(rect(x, y, w, h)), r, 135, 2.6, 0.45);
}
function plaque(p: Pen, g: Element, x: number, y: number, plain: string, product: string, size = 16): void {
  p.text(g, x, y, plain.toUpperCase(), { size, weight: 500, track: 0.16 });
  p.text(g, x, y + size * 0.95, product, { size: Math.max(13, size - 3), face: 'mono', fill: INK2 });
}
const tape = (p: Pen, g: Element, x: number, y: number, w: number): void => {
  const d = ptsD(rect(x, y, w, 12)); p.fill(g, d); p.stroke(g, d, 'support');
  for (let t = 0; t <= w; t += 8) p.hair(g, `M${x + t} ${y}V${y + (t % 40 === 0 ? 8 : 4)}`, { w: 0.8, op: 0.8 });
};
const parcel = (p: Pen, g: Element, x: number, y: number, w: number, h: number): void => {
  const d = ptsD(rect(x, y - h, w, h)); p.fill(g, d); p.stroke(g, d, 'support'); p.hair(g, `M${x + w / 2} ${y - h}V${y}`, { w: 0.9, op: 0.8 }); shade(p, g, x + w - 4, y - h + 1, 3, h - 2);
};
const miniCabinet = (p: Pen, g: Element, x: number, y: number, w: number, h: number, openIdx = -1): void => {
  const d = ptsD(rect(x, y - h, w, h)); p.fill(g, d); p.stroke(g, d, 'support');
  const n = 4, dh = h / n;
  for (let i = 0; i < n; i++) {
    const dy = y - h + i * dh;
    p.stroke(g, ptsD(rect(x + 3, dy + 3, w - 6, dh - 6)), 'ghost');
    p.hair(g, `M${x + w / 2 - 5} ${dy + dh / 2}h10`, { w: 1.1, op: 0.9 });
    if (i === openIdx) { const o = ptsD(rect(x - 12, dy + 4, 12, dh - 8)); p.fill(g, o); p.stroke(g, o, 'support'); }
  }
  shade(p, g, x + w - 6, y - h + 2, 5, h - 4);
};
const lamp = (p: Pen, g: Element, x: number, y: number): void => {
  p.hair(g, `M${x} ${y - RH + 4}V${y - RH + 20}`, { w: 0.9, op: 0.9 });
  const s = ptsD([[x - 5, y - RH + 20], [x + 5, y - RH + 20], [x + 11, y - RH + 29], [x - 11, y - RH + 29]]); p.fill(g, s); p.stroke(g, s, 'support');
};

export interface HouseOpts { mode: 'est' | 'ask'; lit: boolean[] }

/** the whole building, in establishing-shot coordinates (design 1200 x 750) */
export function building(p: Pen, g: SVGGElement, o: HouseOpts): { customer: { x: number; y: number } } {
  const arch = p.g(g);
  // ground, base course and plinth
  p.stroke(arch, `M110 ${GROUND}H1090`, 'support');
  slab(p, arch, X0 - 12, 710, X1 - X0 + 24, 14, 'floor');
  const plinth = ptsD(rect(X0 - 12, 724, X1 - X0 + 24, GROUND - 724)); p.fill(arch, plinth); p.stroke(arch, plinth, 'support');
  for (let x = X0 + 20; x < X1; x += 52) p.hair(arch, `M${x} 724V${GROUND}`, { w: 0.8, op: 0.6 });
  FLOORS.forEach((y, i) => {
    const room = p.g(g, { opacity: o.lit[i] ? 1 : 0.28 });
    const bw = ptsD(rect(RX0, y - RH, RX1 - RX0, RH)); p.fill(room, bw); p.stroke(room, bw, 'ghost');
    // skirting, cornice, two pendant lamps on the same rhythm, the plaque in the same place
    const sk = ptsD(rect(RX0, y - 7, RX1 - RX0, 7)); p.fill(room, sk); p.hatch(room, sk, { x0: RX0, y0: y - 7, x1: RX1, y1: y }, 135, 3, 0.35); p.stroke(room, sk, 'ghost');
    p.hair(room, `M${RX0} ${y - RH + 5}H${RX1}`, { op: 0.55 }); p.hair(room, `M${RX0} ${y - RH + 8}H${RX1}`, { op: 0.3 });
    lamp(p, room, 610, y);
    plaque(p, room, RX0 + 22, y - RH + 30, ROOMS[i].plain, ROOMS[i].product);
    slab(p, room, X0, y, X1 - X0);
    ROOM_DRAW[i](p, room, o);
  });
  // walls (dense 45 degrees), the shaft, the roof
  const w = p.g(g);
  slab(p, w, X0, 160, 12, 550, 'wall');
  const gaps: [number, number][] = [[FLOORS[4] - 58, FLOORS[4] - 24], [FLOORS[2] - 64, FLOORS[2] - 6], [FLOORS[1] - 78, FLOORS[1] - 38]];
  let yy = 160;
  for (const [a, b] of gaps) { slab(p, w, X1 - 12, yy, 12, a - yy, 'wall'); yy = b; }
  slab(p, w, X1 - 12, yy, 12, 710 - yy, 'wall');
  slab(p, w, X0, 150, X1 - X0, 10, 'wall');
  // dentils under the parapet
  for (let x = X0 + 16; x < X1 - 16; x += 12) { const d = ptsD(rect(x, 160, 6, 5)); p.fill(w, d); p.stroke(w, d, 'ghost'); }
  // the shaft, with an opening at every floor
  const sh = ptsD(rect(X0 + 12, 170, SHAFT - X0 - 12, 540)); p.fill(w, sh); p.stroke(w, sh, 'ghost');
  FLOORS.forEach((y, i) => { p.stroke(w, `M${SHAFT} ${y - RH}V${y - 50}`, 'support'); p.stroke(w, `M${SHAFT} ${y - 4}V${y}`, 'support'); if (i < 4) p.hair(w, `M${X0 + 12} ${y}H${SHAFT}`, { op: 0.6 }); });
  p.hair(w, `M292 142V${FLOORS[0] - 52}`, { w: 1.1, op: 0.9 });
  const car = ptsD(rect(272, FLOORS[0] - 52, 40, 44)); p.fill(w, car); p.stroke(w, car, 'support'); p.hair(w, `M272 ${FLOORS[0] - 30}H312`, { op: 0.6 }); shade(p, w, 306, FLOORS[0] - 50, 5, 40);
  const ph = ptsD(rect(268, 122, 48, 28)); p.fill(w, ph); p.stroke(w, ph, 'support');
  p.stroke(w, `M292 134m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0`, 'support');
  // pediment with an oculus, and a cornice band
  const ped = ptsD([[540, 150], [600, 124], [660, 150]]); p.fill(w, ped); p.hatch(w, ped, { x0: 540, y0: 124, x1: 660, y1: 150 }, 135, 4, 0.3); p.stroke(w, ped, 'support');
  p.stroke(w, `M600 142m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0`, 'support');
  p.hair(w, 'M548 150L600 129L652 150', { op: 0.5 });
  // the counter window: a sill, an awning, and a balcony with a railing
  const wy = FLOORS[4];
  const sill = ptsD(rect(RX1 - 12, wy - 24, 30, 4)); p.fill(w, sill); p.stroke(w, sill, 'support');
  const awn = ptsD([[RX1 - 12, wy - 92], [X1 + 16, wy - 84], [X1 + 16, wy - 77], [RX1 - 12, wy - 85]]); p.fill(w, awn); p.hatch(w, awn, { x0: RX1 - 12, y0: wy - 76, x1: X1 + 16, y1: wy - 77 }, 90, 7, 0.7); p.stroke(w, awn, 'support');
  slab(p, w, X1, wy, 112, 8, 'floor');
  p.stroke(w, `M${X1 + 64} ${wy - 40}H${X1 + 112}`, 'support');
  [X1 + 64, X1 + 80, X1 + 96, X1 + 112].forEach((x) => p.hair(w, `M${x} ${wy - 40}V${wy}`, { op: 0.8 }));
  return { customer: { x: X1 + 38, y: wy } };
}

type RoomFn = (p: Pen, g: Element, o: HouseOpts) => void;
const H = 76;
const ROOM_DRAW: RoomFn[] = [
  // 0 front office: the clerk files the amber card; the order form on a sloping desk; the cabinet; a door
  (p, g) => {
    const y = FLOORS[0];
    p.stroke(g, `M368 ${y} V${y - 34}`, 'support'); p.stroke(g, `M452 ${y}V${y - 34}`, 'support');
    const top = ptsD([[356, y - 34], [466, y - 34], [458, y - 44], [364, y - 44]]); p.fill(g, top); p.stroke(g, top, 'support');
    const form = ptsD([[384, y - 36], [440, y - 36], [436, y - 42], [388, y - 42]]); p.fill(g, form); p.stroke(g, form, 'ghost');
    p.hair(g, `M392 ${y - 39}H432`, { op: 0.6, dash: '2 3' });
    miniCabinet(p, g, 700, y, 54, 84, 0);
    const door = ptsD(rect(880, y - 74, 36, 74)); p.fill(g, door, 'var(--paper)'); p.stroke(g, door, 'support');
    p.stroke(g, ptsD(rect(886, y - 66, 24, 26)), 'ghost'); p.stroke(g, ptsD(rect(886, y - 34, 24, 26)), 'ghost'); p.hair(g, `M908 ${y - 36}h3`, { w: 2, op: 1 });
    const j = drawPose(p, g, 'clerk', pose('clerk', 'filing'), 640, y, H, false, { noSet: true, noProps: true, handsW: [[664, y - 50], [674, y - 52]] });
    const c = ptsD(rect(j.hands[1][0] - 3, j.hands[1][1] - 5, 17, 10)); p.fill(g, c); p.stroke(g, c, 'support', 'accent', { w: 1.8 });
  },
  // 1 post room: the courier pushes a trolley of parcels toward the shaft; a parcel arrives by the side hatch
  (p, g) => {
    const y = FLOORS[1];
    p.stroke(g, `M${RX1 - 4} ${y - 70}L${RX1 - 50} ${y - 36}`, 'support'); p.stroke(g, `M${RX1 - 4} ${y - 44}L${RX1 - 50} ${y - 10}`, 'support');
    parcel(p, g, RX1 - 74, y - 38, 24, 18);
    drawPose(p, g, 'courier', pose('courier', 'pushing'), 560, y, H, true);
  },
  // 2 stock room: the stock-keeper on a short ladder at the ledgers; a calendar; the dock outside
  (p, g) => {
    const y = FLOORS[2];
    const sh = ptsD(rect(660, y - 66, 150, 4)); p.fill(g, sh); p.stroke(g, sh, 'support');
    for (let i = 0; i < 9; i++) { const hh = 22 + (i % 3) * 3; const b = ptsD(rect(664 + i * 16, y - 66 - hh, 12, hh)); p.fill(g, b); p.stroke(g, b, 'ghost'); }
    const sh2 = ptsD(rect(660, y - 30, 150, 4)); p.fill(g, sh2); p.stroke(g, sh2, 'support');
    for (let i = 0; i < 9; i++) { const b = ptsD(rect(664 + i * 16, y - 52, 12, 22)); p.fill(g, b); p.stroke(g, b, 'ghost'); }
    const cal = ptsD(rect(834, y - 74, 34, 40)); p.fill(g, cal); p.stroke(g, cal, 'support'); p.hair(g, `M834 ${y - 62}H868`, { op: 0.8 });
    [0, 1, 2].forEach((r) => [0, 1, 2].forEach((c) => p.hair(g, `M${840 + c * 9} ${y - 56 + r * 7}h3`, { w: 1.2, op: 0.7 })));
    drawPose(p, g, 'stock', pose('stock', 'climbing'), 530, y, H, false);
    slab(p, g, X1, y - 30, 44, 6, 'floor');
    parcel(p, g, X1 + 10, y - 30, 22, 16);
  },
  // 3 catalogue desk: the cataloguer at the catalogue; name plates; one tape on the wall; a window
  (p, g) => {
    const y = FLOORS[3];
    tape(p, g, 620, y - 66, 220);
    [0, 1, 2, 3].forEach((i) => { const pl = ptsD(rect(640 + i * 52, y - 48, 40, 16)); p.fill(g, pl); p.stroke(g, pl, 'support'); p.hair(g, `M${646 + i * 52} ${y - 40}h28`, { w: 0.9, op: 0.7 }); });
    const win = ptsD(rect(884, y - 78, 36, 42)); p.fill(g, win, 'var(--paper)'); p.stroke(g, win, 'support'); p.hair(g, `M902 ${y - 78}V${y - 36}M884 ${y - 57}H920`, { op: 0.8 });
    drawPose(p, g, 'cataloguer', pose('cataloguer', 'writing'), 480, y, H, false);
  },
  // 4 counter: the clerk hands a report through the window to the customer outside
  (p, g, o) => {
    const y = FLOORS[4];
    const ctr = ptsD(rect(760, y - 40, RX1 - 760, 40)); p.fill(g, ctr); p.stroke(g, ctr, 'support');
    p.hair(g, `M764 ${y - 36}H${RX1 - 4}`, { op: 0.4 }); [800, 840, 880].forEach((x) => p.hair(g, `M${x} ${y - 32}V${y - 4}`, { w: 0.8, op: 0.35 })); shade(p, g, RX1 - 14, y - 38, 12, 36);
    if (o.mode === 'est') {
      drawPose(p, g, 'counter', pose('counter', 'handing across'), 862, y, H, false, { noProps: true, handsW: [[884, y - 42], [903, y - 46]] });
      const r = ptsD(rect(900, y - 56, 22, 14)); p.fill(g, r); p.stroke(g, r, 'support'); p.hair(g, `M904 ${y - 51}h14`, { w: 0.8, op: 0.7 });
    } else {
      drawPose(p, g, 'counter', pose('counter', 'listening'), 850, y, H, false, { noProps: true, handsW: [null, [893, y - 46]] });
    }
  },
];

/** customer on the balcony */
function customer(p: Pen, g: Element, o: HouseOpts, at: { x: number; y: number }): void {
  if (o.mode === 'est') drawPose(p, g, 'customer', pose('customer', 'receiving'), at.x, at.y - 8, H, true, { noProps: true, handsW: [[at.x - 22, at.y - 8 - 46], [at.x - 28, at.y - 8 - 50]] });
  else drawPose(p, g, 'customer', pose('customer', 'asking'), at.x, at.y - 8, H, true);
}

export function establishing(p: Pen, g: SVGGElement): void {
  p.text(g, 600, 78, 'How NetSuite Data Intelligence is put together.', { size: TYPE.headline - 2, weight: 700, anchor: 'middle' });
  const o: HouseOpts = { mode: 'est', lit: [true, true, true, true, true] };
  const b = building(p, g, o);
  customer(p, g, o, b.customer);
}

function setKeys(g: Element, map: Record<string, number>): void {
  g.querySelectorAll('[data-k]').forEach((e) => { const k = e.getAttribute('data-k')!; const inv = k.startsWith('!'); const n = k.replace(/^!/, ''); if (n in map) (e as SVGElement).style.opacity = String(inv ? 1 - map[n] : map[n]); });
}
const DR = [
  { word: 'orders', sys: 'Transactions', cards: ['', 'SO1041', ''] }, { word: 'lines', sys: 'TransactionLine', cards: ['', 'line 2', ''] },
  { word: 'customers', sys: 'customer', cards: ['', 'Harbor Supply 88', ''] }, { word: 'items', sys: 'item', cards: ['', 'Pallet jack 12', ''] },
];

export function closeup(p: Pen, g: SVGGElement): void {
  p.text(g, 600, 78, 'Someone files every order as separate cards.', { size: TYPE.headline - 2, weight: 700, anchor: 'middle' });
  // the room, cut open: ceiling and floor slabs, two hatched walls, a back wall
  const bw = ptsD(rect(74, 110, 1052, 540)); p.fill(g, bw); p.stroke(g, bw, 'ghost');
  p.hair(g, 'M74 596H1126', { op: 0.25 });
  slab(p, g, 60, 96, 1080, 14); slab(p, g, 60, 650, 1080, 26); slab(p, g, 60, 96, 14, 580); slab(p, g, 1126, 96, 14, 580);
  plaque(p, g, 110, 152, 'front office', 'NetSuite', 20);
  // the sloping desk with the torn order form
  const dy = 500;
  p.stroke(g, `M260 650V${dy + 16}`, 'support'); p.stroke(g, `M510 650V${dy + 16}`, 'support');
  const top = ptsD([[230, dy + 16], [540, dy + 16], [520, dy], [250, dy]]); p.fill(g, top); p.stroke(g, top, 'support');
  const piece = (x: number, w: number, h: number, seed: number): void => {
    const t = tornPts([x + w, dy + 12], [x, dy + 12], 9, 4, seed, 1);
    const pts: Pt[] = [[x + 14, dy + 12 - h], [x + w + 14, dy + 12 - h], [x + w, dy + 12], ...t.slice(1)];
    const d = ptsD(pts); p.fill(g, d); p.stroke(g, d, 'support');
    for (let r = 1; r < h / 9; r++) p.hair(g, `M${x + 14 - r * 14 / (h / 9) + 12} ${dy + 12 - h + r * 9}h${w - 24}`, { op: 0.35 });
  };
  piece(260, 112, 44, 31);
  piece(400, 86, 22, 33);
  p.text(g, 292, dy - 8, 'SO1041', { size: 14, face: 'mono', weight: 600, fill: INK2 });
  // the cabinet: the object kit, drawn at 0.72 with the lines drawer open
  const s = 0.72, x0 = 770, y0 = 650 - 518 * s;
  p.nss = true;
  const cab = p.g(g, { transform: `translate(${x0} ${y0}) scale(${s})` });
  KINDS.cabinet.draw(p, cab as SVGGElement, {});
  const order = [0, 3, 1, 2];
  for (const i of order) {
    const open = i === 1 ? 1 : 0;
    const [dx, dyy] = drawerAt(i);
    const dg = p.g(g, { transform: `translate(${x0 + (dx + CAB.pull[0] * open) * s} ${y0 + (dyy + CAB.pull[1] * open) * s}) scale(${s})` }) as SVGGElement;
    KINDS.drawer.draw(p, dg, { word: DR[i].word, sys: DR[i].sys, cards: DR[i].cards, raised: 1, lift: 0 });
    setKeys(dg, { inner: open, words: 1 });
  }
  // the clerk files line 1: the amber card with its slip
  const cx = 646;
  const j = drawPose(p, g, 'clerk', pose('clerk', 'filing'), cx, 650, 340, false, { noSet: true, noProps: true, handsW: [[722, 378], [736, 372]], lean: 12 });
  const hand = j.hands[1];
  const cs = 0.3, cw = 340 * cs, ch = 112 * cs;
  const cg = p.g(g, { transform: `translate(${hand[0] - 14} ${hand[1] - ch / 2 - 6}) rotate(-4 ${cw / 2} ${ch / 2}) scale(${cs})` });
  KINDS.lineCard.draw(p, cg as SVGGElement, { n: 1 });
  setKeys(cg, { sys: 0 });
  const sg = p.g(g, { transform: `translate(${hand[0] - 8} ${hand[1] + ch / 2 - 8}) scale(${cs})` });
  KINDS.slip.draw(p, sg as SVGGElement, { a: 'Order:', b: 'see card SO1041' });
  p.nss = false;
  p.text(g, 600, 716, 'The line card carries a slip saying where to find its order.', { size: 24, italic: true, fill: INK2, anchor: 'middle' });
}

export function bookend(p: Pen, g: SVGGElement, st: HTMLElement): void {
  const o: HouseOpts = { mode: 'ask', lit: [false, false, false, false, true] };
  p.nss = true;
  const bg = p.g(g, { transform: 'translate(-475 -120) scale(1.6)' }) as SVGGElement;
  const b = building(p, bg, o);
  customer(p, bg, o, b.customer);
  p.nss = false;
  const div = document.createElement('div'); div.className = 'hand';
  Object.assign(div.style, { left: `${(680 / 1200) * 100}%`, top: `${(20 / 750) * 100}%`, fontSize: 'calc(36 / 1200 * 100cqw)' });
  st.append(div);
  st.style.containerType = 'inline-size';
  writeText(div, ['How do we compare with last year,', 'when last year is in the old system?'], { seed: 31, reduced: true, tilt: 0.6 });
}
