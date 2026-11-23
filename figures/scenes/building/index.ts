// The building in section (the dollhouse): five rooms, a dumbwaiter shaft up the left side, a facade, a counter window
// and a loading dock on the right. World units are the building's own (a floor is 108 high). Rooms are drawn in groups
// that the scene dims or lights (props f0..f4: 1 lit, 0.28 dim). Hatching varies by surface: wall cuts dense at
// 45 degrees, floor slabs sparse at 135, shadow sides short strokes.
import { el } from '../../../ink/svg';
import { Pen, ptsD, rectPts, type Pt } from '../objects';
import { LOOKS, POSES, paintFigure, solveFigure, type Pose } from '../figures';
import type { KindDef } from '../objects';
import { ROOM_COPY } from '../../../content/scenes';

export const SLAB = 10, RH = 98;
/** floor surface of each room, bottom (front office) to top (counter and dock) */
export const FLOORS = [700, 592, 484, 376, 268];
export const GROUND = 736;
export const X0 = 250, X1 = 950, SHAFT = 322, RX0 = SHAFT, RX1 = 938;
export const ROOMS = ROOM_COPY;
/** where things are in the building (used by scenes) */
export const SPOT = {
  office: { desk: [340, 470] as [number, number], deskTop: 664, cabinet: { x: 700, w: 54, h: 84 }, door: 880 },
  counter: { x: 760, win: { x: RX1, y0: FLOORS[4] - 58, y1: FLOORS[4] - 24 }, balcony: { x0: X1, x1: X1 + 112, y: FLOORS[4] }, board: { x: 782, y: FLOORS[4] - 82 } },
  car: { x: 272, w: 40, h: 44 },
};
const INK2 = 'var(--ink-2)';
const rect = (x: number, y: number, w: number, h: number): Pt[] => rectPts(x, y, w, h);

function slab(p: Pen, g: Element, x: number, y: number, w: number, h = SLAB, kind: 'wall' | 'floor' = 'floor'): void {
  if (w <= 0 || h <= 0) return;
  const d = ptsD(rect(x, y, w, h));
  p.fill(g, d); p.hatch(g, d, { x0: x, y0: y, x1: x + w, y1: y + h }, kind === 'wall' ? 45 : 135, kind === 'wall' ? 2.6 : 5.4, kind === 'wall' ? 0.75 : 0.55); p.stroke(g, d, 'support');
}
export function shade(p: Pen, g: Element, x: number, y: number, w: number, h: number): void {
  p.hatch(g, ptsD(rect(x, y, w, h)), { x0: x, y0: y, x1: x + w, y1: y + h }, 135, 2.6, 0.45);
}
/** a label whose size on screen stays constant under the camera */
function label(p: Pen, g: Element, x: number, y: number, s: string, size: number, o: { face?: 'serif' | 'mono'; weight?: number; fill?: string; track?: number } = {}): void {
  const t = p.text(g, x, y, s, { size, ...o });
  t.setAttribute('data-c', '1'); t.setAttribute('data-fs', String(size));
}
const lamp = (p: Pen, g: Element, x: number, y: number): void => {
  p.hair(g, `M${x} ${y - RH + 4}V${y - RH + 20}`, { w: 0.9, op: 0.9 });
  const s = ptsD([[x - 5, y - RH + 20], [x + 5, y - RH + 20], [x + 11, y - RH + 29], [x - 11, y - RH + 29]]); p.fill(g, s); p.stroke(g, s, 'support');
};
const parcel = (p: Pen, g: Element, x: number, y: number, w: number, h: number): void => {
  const d = ptsD(rect(x, y - h, w, h)); p.fill(g, d); p.stroke(g, d, 'support'); p.hair(g, `M${x + w / 2} ${y - h}V${y}`, { w: 0.9, op: 0.8 }); shade(p, g, x + w - 4, y - h + 1, 3, h - 2);
};
function silhouette(p: Pen, g: Element, role: string, pose: Pose, x: number, y: number, H: number, flip = false): void {
  const look = LOOKS[role];
  paintFigure(p.g(g), solveFigure(look, pose, { x, y, H, flip }), H * look.h);
}

const D = 0.28;
type RoomFn = (p: Pen, g: Element) => void;
const ROOM_DRAW: RoomFn[] = [
  // 0 front office: the desk and the door (the cabinet, the clerk and the cards are the scene's)
  (p, g) => {
    const y = FLOORS[0], [dx0, dx1] = SPOT.office.desk;
    p.stroke(g, `M${dx0 + 12} ${y} V${y - 36}`, 'support'); p.stroke(g, `M${dx1 - 12} ${y}V${y - 36}`, 'support');
    const top = ptsD([[dx0, y - 36], [dx1, y - 36], [dx1 - 8, y - 44], [dx0 + 8, y - 44]]); p.fill(g, top); p.stroke(g, top, 'support');
    shade(p, g, dx0 + 20, y - 34, dx1 - dx0 - 40, 4);
    const door = ptsD(rect(SPOT.office.door, y - 74, 36, 74)); p.fill(g, door, 'var(--paper)'); p.stroke(g, door, 'support');
    p.stroke(g, ptsD(rect(SPOT.office.door + 6, y - 66, 24, 26)), 'ghost'); p.stroke(g, ptsD(rect(SPOT.office.door + 6, y - 34, 24, 26)), 'ghost'); p.hair(g, `M${SPOT.office.door + 28} ${y - 36}h3`, { w: 2, op: 1 });
  },
  // 1 post room: the courier pushes a trolley toward the shaft; a hatch on the right
  (p, g) => {
    const y = FLOORS[1];
    p.stroke(g, `M${RX1 - 4} ${y - 70}L${RX1 - 50} ${y - 36}`, 'support'); p.stroke(g, `M${RX1 - 4} ${y - 44}L${RX1 - 50} ${y - 10}`, 'support');
    parcel(p, g, RX1 - 74, y - 38, 24, 18);
    p.hair(g, `M${480 - 26} ${y - 8}H${480 + 80}`, { w: 1.2, op: 1 });
    const tr = ptsD(rect(484, y - 16, 56, 4)); p.fill(g, tr); p.stroke(g, tr, 'support');
    p.hair(g, `M484 ${y - 12}V${y - 52}`, { w: 1.2, op: 1 });
    parcel(p, g, 494, y - 16, 20, 14); parcel(p, g, 518, y - 16, 16, 9);
    silhouette(p, g, 'courier', POSES.push, 460, y, 76, false);
  },
  // 2 stock room: ledgers on shelves, a calendar, a ladder
  (p, g) => {
    const y = FLOORS[2];
    for (const sy of [y - 66, y - 30]) { const sh = ptsD(rect(660, sy, 150, 4)); p.fill(g, sh); p.stroke(g, sh, 'support'); }
    for (let i = 0; i < 9; i++) { const hh = 22 + (i % 3) * 3; const b = ptsD(rect(664 + i * 16, y - 66 - hh, 12, hh)); p.fill(g, b); p.stroke(g, b, 'ghost'); const b2 = ptsD(rect(664 + i * 16, y - 52, 12, 22)); p.fill(g, b2); p.stroke(g, b2, 'ghost'); }
    const cal = ptsD(rect(834, y - 74, 34, 40)); p.fill(g, cal); p.stroke(g, cal, 'support'); p.hair(g, `M834 ${y - 62}H868`, { op: 0.8 });
    p.hair(g, `M551 ${y}L565 ${y - 74}M560 ${y}L574 ${y - 74}`, { w: 1.2, op: 1 });
    silhouette(p, g, 'stock', POSES.climb, 530, y, 76, false);
    slab(p, g, X1, y - 30, 44, 6, 'floor'); parcel(p, g, X1 + 10, y - 30, 22, 16);
  },
  // 3 catalogue desk: a window, name plates, a tape on the wall
  (p, g) => {
    const y = FLOORS[3];
    const tp = ptsD(rect(620, y - 66, 220, 12)); p.fill(g, tp); p.stroke(g, tp, 'support');
    for (let t = 0; t <= 220; t += 8) p.hair(g, `M${620 + t} ${y - 66}V${y - 66 + (t % 40 === 0 ? 8 : 4)}`, { w: 0.8, op: 0.8 });
    [0, 1, 2, 3].forEach((i) => { const pl = ptsD(rect(640 + i * 52, y - 48, 40, 16)); p.fill(g, pl); p.stroke(g, pl, 'support'); p.hair(g, `M${646 + i * 52} ${y - 40}h28`, { w: 0.9, op: 0.7 }); });
    const win = ptsD(rect(884, y - 78, 36, 42)); p.fill(g, win, 'var(--paper)'); p.stroke(g, win, 'support'); p.hair(g, `M902 ${y - 78}V${y - 36}M884 ${y - 57}H920`, { op: 0.8 });
    p.hair(g, `M${436} ${y - 28}H${498}`, { w: 1.2, op: 1 }); p.hair(g, `M${440} ${y}V${y - 28}M${494} ${y}V${y - 28}`, { w: 1.1, op: 1 });
    silhouette(p, g, 'cataloguer', POSES.sit, 470, y, 76, false);
  },
  // 4 counter and dock: the counter (the clerk and the board are the scene's)
  (p, g) => {
    const y = FLOORS[4];
    const ctr = ptsD(rect(SPOT.counter.x, y - 40, RX1 - SPOT.counter.x, 40)); p.fill(g, ctr); p.stroke(g, ctr, 'support');
    p.hair(g, `M${SPOT.counter.x + 4} ${y - 36}H${RX1 - 4}`, { op: 0.4 }); [800, 840, 880].forEach((x) => p.hair(g, `M${x} ${y - 32}V${y - 4}`, { w: 0.8, op: 0.35 })); shade(p, g, RX1 - 14, y - 38, 12, 36);
  },
];

export function drawBuilding(p: Pen, g: Element): void {
  const arch = p.g(g);
  p.stroke(arch, `M110 ${GROUND}H1090`, 'support');
  slab(p, arch, X0 - 12, 710, X1 - X0 + 24, 14, 'floor');
  const plinth = ptsD(rect(X0 - 12, 724, X1 - X0 + 24, GROUND - 724)); p.fill(arch, plinth); p.stroke(arch, plinth, 'support');
  for (let x = X0 + 20; x < X1; x += 52) p.hair(arch, `M${x} 724V${GROUND}`, { w: 0.8, op: 0.6 });
  FLOORS.forEach((y, i) => {
    const room = p.g(g, { 'data-k': `f${i}` });
    const bw = ptsD(rect(RX0, y - RH, RX1 - RX0, RH)); p.fill(room, bw); p.stroke(room, bw, 'ghost');
    const sk = ptsD(rect(RX0, y - 7, RX1 - RX0, 7)); p.fill(room, sk); p.hatch(room, sk, { x0: RX0, y0: y - 7, x1: RX1, y1: y }, 135, 3, 0.35); p.stroke(room, sk, 'ghost');
    p.hair(room, `M${RX0} ${y - RH + 5}H${RX1}`, { op: 0.55 }); p.hair(room, `M${RX0} ${y - RH + 8}H${RX1}`, { op: 0.3 });
    lamp(p, room, 610, y);
    label(p, room, RX0 + 22, y - RH + 30, ROOMS[i].plain.toUpperCase(), 16, { weight: 500, track: 0.16 });
    label(p, room, RX0 + 22, y - RH + 45, ROOMS[i].product, 13, { face: 'mono', fill: INK2 });
    slab(p, room, X0, y, X1 - X0);
    ROOM_DRAW[i](p, room);
  });
  const w = p.g(g);
  slab(p, w, X0, 160, 12, 550, 'wall');
  const gaps: [number, number][] = [[SPOT.counter.win.y0, SPOT.counter.win.y1], [FLOORS[2] - 64, FLOORS[2] - 6], [FLOORS[1] - 78, FLOORS[1] - 38]];
  let yy = 160;
  for (const [a, b] of gaps) { slab(p, w, X1 - 12, yy, 12, a - yy, 'wall'); yy = b; }
  slab(p, w, X1 - 12, yy, 12, 710 - yy, 'wall');
  slab(p, w, X0, 150, X1 - X0, 10, 'wall');
  for (let x = X0 + 16; x < X1 - 16; x += 12) { const d = ptsD(rect(x, 160, 6, 5)); p.fill(w, d); p.stroke(w, d, 'ghost'); }
  const sh = ptsD(rect(X0 + 12, 170, SHAFT - X0 - 12, 540)); p.fill(w, sh); p.stroke(w, sh, 'ghost');
  FLOORS.forEach((y, i) => { p.stroke(w, `M${SHAFT} ${y - RH}V${y - 50}`, 'support'); p.stroke(w, `M${SHAFT} ${y - 4}V${y}`, 'support'); if (i < 4) p.hair(w, `M${X0 + 12} ${y}H${SHAFT}`, { op: 0.6 }); });
  p.hair(w, `M292 142V${FLOORS[4] - 60}`, { w: 1.1, op: 0.9 });
  const ph = ptsD(rect(268, 122, 48, 28)); p.fill(w, ph); p.stroke(w, ph, 'support');
  p.stroke(w, `M292 134m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0`, 'support');
  const ped = ptsD([[540, 150], [600, 124], [660, 150]]); p.fill(w, ped); p.hatch(w, ped, { x0: 540, y0: 124, x1: 660, y1: 150 }, 135, 4, 0.3); p.stroke(w, ped, 'support');
  p.stroke(w, `M600 142m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0`, 'support');
  // the counter window: a sill, a thin scalloped awning, a balcony with a railing
  const wy = FLOORS[4];
  const sill = ptsD(rect(RX1 - 12, wy - 24, 30, 4)); p.fill(w, sill); p.stroke(w, sill, 'support');
  const aw = ptsD([[RX1 - 12, wy - 64], [X1 + 22, wy - 62], [X1 + 22, wy - 58], [RX1 - 12, wy - 60]]); p.fill(w, aw); p.stroke(w, aw, 'support');
  for (let x = RX1 - 6; x < X1 + 22; x += 10) p.stroke(w, `M${x} ${wy - 59}a5 5 0 0 0 10 0`, 'ghost');
  slab(p, w, X1, wy, 112, 8, 'floor');
  p.stroke(w, `M${X1 + 64} ${wy - 38}H${X1 + 112}`, 'support');
  [X1 + 64, X1 + 80, X1 + 96, X1 + 112].forEach((x) => p.hair(w, `M${x} ${wy - 38}V${wy}`, { op: 0.8 }));
}

/** the dumbwaiter car */
function drawCar(p: Pen, g: Element): void {
  const d = ptsD(rect(0, 0, SPOT.car.w, SPOT.car.h)); p.fill(g, d); p.stroke(g, d, 'support'); p.hair(g, `M0 ${SPOT.car.h * 0.4}H${SPOT.car.w}`, { op: 0.6 }); shade(p, g, SPOT.car.w - 6, 2, 5, SPOT.car.h - 4);
  p.hair(g, `M${SPOT.car.w / 2} 0V-14`, { w: 1.1, op: 0.9 });
}
/** a cork board with three notes (props n0, n1, n2) */
function drawBoard(p: Pen, g: Element): void {
  const d = ptsD(rect(0, 0, 44, 32)); p.fill(g, d); p.stroke(g, d, 'support');
  [0, 1, 2].forEach((i) => {
    const k = p.g(g, { 'data-k': `n${i}` });
    const n = ptsD(rect(4 + i * 13, 6 + (i % 2) * 8, 11, 12)); p.fill(k, n, 'var(--paper)'); p.stroke(k, n, 'ghost');
    p.hair(k, `M${6 + i * 13} ${10 + (i % 2) * 8}h7`, { w: 0.7, op: 0.8 }); el('circle', { cx: 9.5 + i * 13, cy: 7.5 + (i % 2) * 8, r: 1.2, fill: 'var(--ink)', stroke: 'none', 'data-r': 'f' }, k);
  });
}
const K = (w: number, h: number, draw: (p: Pen, g: Element) => void): KindDef => ({ size: () => ({ w, h }), draw: (p, g) => draw(p, g), anchors: () => ({}) });
const drawVeil = (p: Pen, g: Element): void => { p.fill(g, ptsD(rect(-2000, -2000, 5200, 4800)), 'var(--paper)'); };
export const BUILD_KINDS = { veil: K(1200, 780, drawVeil), building: K(1100, 760, drawBuilding), car: K(SPOT.car.w, SPOT.car.h, drawCar), board: K(44, 32, drawBoard) };
void D;
