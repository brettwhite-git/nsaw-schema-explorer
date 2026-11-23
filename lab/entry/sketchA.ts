// Sketch A: "The building". An isometric cutaway of a literal warehouse building. Illustration first.
import type { V3 } from '../../ink/iso';
import { Sketch, layoutCallouts, paintFarToNear, type Pt } from './kit';
import { drawThread, fitBasis, gate, person, type Counts } from './common';

const W = 100, D = 48, T = 3, WH = 25, FH = T + WH, GAP = 20;
const YAW = -0.6;
export const floorTop = (i: number, g: number): number => i * FH + g * GAP * i + T;

export function drawA(svg: SVGSVGElement, W0: number, H0: number, g: number, c: Counts, narrow: boolean): Sketch {
  const sk = new Sketch(svg);
  const corners = (gg: number): V3[] => {
    const top = floorTop(2, gg) + WH + 6 + gg * GAP * 0.6;
    const out: V3[] = [];
    for (const x of [0, W + 34]) for (const z of [0, D]) for (const y of [0, top + 4]) out.push([x, y, z]);
    return out;
  };
  sk.setBasis(fitBasis(YAW, corners(1), corners(g), { w: 440, h: H0 - 70, cx: W0 / 2, cy: H0 / 2 + 6 }));
  const P = (x: number, y: number, z: number): Pt => sk.P(x, y, z);
  const ft = (i: number) => floorTop(i, g);

  // ---------------------------------------------------------------- the three floors
  for (let i = 0; i < 3; i++) {
    const base = ft(i);
    sk.group(`floor f${i}`, () => {
      sk.box({ x: 0, y: base - T, z: 0, w: W, h: T, d: D }, { hatch: 1.6 });                 // slab
      sk.box({ x: 0, y: base, z: 0, w: 2, h: WH, d: D }, { hatch: false });                    // back-left wall
      sk.box({ x: 0, y: base, z: 0, w: W, h: WH, d: 2 }, { hatch: false });                    // back wall
      const items: { d: number; draw: () => void }[] = [];
      const add = (x: number, y: number, z: number, draw: () => void) => items.push({ d: sk.depth(x, y, z), draw });
      if (i === 0) floor0(sk, base, add);
      if (i === 1) floor1(sk, base, add);
      if (i === 2) floor2(sk, base, add);
      paintFarToNear(items);
      // shaft piece (ingestion), pencil, drawn in front of the back wall
      shaft(sk, base, i);
      // the two front corner posts hold the floor above
      for (const [x, z] of [[0, D - 2], [W - 2, D - 2]]) sk.box({ x, y: base, z, w: 2, h: WH, d: 2 }, { hatch: false, w: 0.9 });
    });
  }
  // roof frame: four beams round an open middle, lifted off in the apart state
  const roofY = ft(2) + WH + g * GAP * 0.6;
  sk.group('roof', () => {
    for (const [x, z, w, d] of [[0, 0, W, 5], [0, D - 5, W, 5], [0, 5, 5, D - 10], [W - 5, 5, 5, D - 10]] as number[][]) sk.box({ x, y: roofY, z, w, h: 3, d }, { hatch: 1.6 });
  });

  // ---------------------------------------------------------------- doors, people, gates (outside the building)
  const dock = ft(1), desk = ft(2);
  sk.group('outside', () => {
    // 5a: the loading dock into the warehouse floor: a door frame, a platform, a keyed gate, a person with rows
    const mDoor = sk.plane([W + 0.2, dock, 26], [0, 0, 1], [0, 1, 0]);
    sk.localPoly(mDoor, [[0, 0], [0, 17], [20, 17], [20, 0]], { fill: false, w: 1.5 });
    for (let k = 0; k < 4; k++) sk.localLine(mDoor, [[0.5, 14 - k * 1.6], [19.5, 14 - k * 1.6]], { w: 0.6, cls: 'hairline' });
    sk.box({ x: W, y: dock - 1, z: 25, w: 18, h: 1.4, d: 22 }, { hatch: 1.6 });
    const mG = sk.plane([W + 10, dock + 0.4, 25], [0, 0, 1], [0, 1, 0]);
    gate(sk, mG, 3, 0, 18, 11);
    const mP = sk.plane([W + 24, dock - 1, 25], [0, 0, 1], [0, 1, 0]);
    person(sk, mP, 6, 0, 0.9);
    // rows coming out: a small grid sheet
    sk.localPoly(mP, [[11, 5], [11, 17], [23, 17], [23, 5]], { pencil: true, w: 1 });
    for (let k = 1; k < 4; k++) sk.localLine(mP, [[11, 5 + k * 3], [23, 5 + k * 3]], { pencil: true, w: 0.7 });
    sk.localLine(mP, [[15, 5], [15, 17]], { pencil: true, w: 0.7 }); sk.localLine(mP, [[19, 5], [19, 17]], { pencil: true, w: 0.7 });
    // 5b: the front desk of the reading room
    sk.box({ x: W - 6, y: desk, z: 22, w: 14, h: 8, d: 24 }, { hatch: 1.8 });
    const mG2 = sk.plane([W + 12, desk + 0.2, 22], [0, 0, 1], [0, 1, 0]);
    gate(sk, mG2, 2, 0, 18, 11);
    const mP2 = sk.plane([W + 26, desk - 1, 20], [0, 0, 1], [0, 1, 0]);
    person(sk, mP2, 6, 0, 0.9);
    // a report: a page with one number and a bar
    sk.localPoly(mP2, [[11, 5], [11, 18], [24, 18], [24, 5]], { pencil: true, w: 1 });
    sk.localLine(mP2, [[13, 15], [22, 15]], { pencil: true, w: 0.9 });
    sk.localPoly(mP2, [[13, 6.5], [13, 10], [15.5, 10], [15.5, 6.5]], { pencil: true, w: 0.8, fill: false });
    sk.localPoly(mP2, [[17, 6.5], [17, 12], [19.5, 12], [19.5, 6.5]], { pencil: true, w: 0.8, fill: false });
    sk.localPoly(mP2, [[21, 6.5], [21, 8.5], [23, 8.5], [23, 6.5]], { pencil: true, w: 0.8, fill: false });
  });

  // ---------------------------------------------------------------- the order line (the one amber thread)
  const formP: V3 = [25, ft(0) + 10.6, 17.5];
  const belt: V3 = [W - 15, ft(0) + 4.5, 11];
  const lift: V3 = [W - 9, ft(1) + 1, 11];
  const ledger: V3 = [10.5, ft(1) + 18.6, 12];
  const drawer: V3 = [8 + 1.5 + 5.4 * 2 + 2.4, ft(2) + 17.4, 17.2];
  const counterP: V3 = [W + 1, ft(2) + 8.4, 30];
  const reportP: V3 = [W + 27, ft(2) + 13, 28];
  const S = (v: V3): Pt => P(v[0], v[1], v[2]);
  drawThread(sk, [
    { pts: [S(formP), S(belt)], pencil: true },
    { pts: [S(belt), S([W - 9, ft(0) + 14, 11]), S(lift)], pencil: true },
    { pts: [S(lift), S(ledger)], pencil: false },
    { pts: [S(ledger), S(drawer)], pencil: false },
    { pts: [S(drawer), S(counterP), S(reportP)], pencil: true, arrow: true },
  ]);

  // ---------------------------------------------------------------- callouts
  const fp = S(formP);
  sk.callout({ n: '1', ax: P(16, ft(0) + 10, 12)[0], ay: P(16, ft(0) + 10, 12)[1], side: 'l', lines: ['NetSuite: where an', 'order is written'], sub: `${c.records} source records` });
  sk.callout({ n: '2', ax: P(W - 9, ft(0) + 18, 11)[0], ay: P(W - 9, ft(0) + 18, 11)[1], side: 'r', lines: ['Ingestion: a lift', 'that carries rows up'], sub: 'Oracle runs it', pencil: true });
  sk.callout({ n: '3', ax: P(20, ft(1) + 8, 18)[0], ay: P(20, ft(1) + 8, 18)[1], side: 'l', lines: ['The warehouse:', 'ledger racks, card drawers'], sub: `${c.tables} tables` });
  sk.callout({ n: '4', ax: drawerAnchor(sk, g)[0], ay: drawerAnchor(sk, g)[1], side: 'l', lines: ['The model: a catalogue', 'with a drawer per subject'], sub: `${c.subjectAreas} subject areas` });
  sk.callout({ n: '5a', ax: P(W + 0.2, dock + 8, 36)[0], ay: P(W + 0.2, dock + 8, 36)[1], side: 'r', lines: ['Door one: the dock,', 'SQL on the tables'], pencil: true });
  sk.callout({ n: '5b', ax: P(W + 1, desk + 8, 34)[0], ay: P(W + 1, desk + 8, 34)[1], side: 'r', lines: ['Door two: the front desk,', 'through the model'], pencil: true });
  sk.callout({ n: 'S', ax: P(W + 12, dock + 6, 33)[0], ay: P(W + 12, dock + 6, 33)[1], side: 'r', lines: ['Security: a keyed gate', 'at each door'], pencil: true, by: P(W + 12, dock + 6, 33)[1] + 34 });
  sk.callout({ n: '', ax: fp[0], ay: fp[1], side: 'l', lines: ['one order line,', 'followed all the way up'], accent: true, by: fp[1] + 44 });
  void narrow;
  return sk;
}

function drawerAnchor(sk: Sketch, g: number): Pt {
  const y = floorTop(2, g) + 17.4;
  return sk.P(8 + 1.5 + 5.4 * 2 + 2.4, y, 17.2);
}

// ------------------------------------------------------------------------------------------------ floor contents

type Add = (x: number, y: number, z: number, draw: () => void) => void;

function floor0(sk: Sketch, base: number, add: Add): void {
  // desk with a monitor and the paper form where the order is written
  add(25, base + 5, 17, () => {
    sk.box({ x: 10, y: base, z: 10, w: 30, h: 10, d: 15 }, { hatch: 1.8 });
    sk.box({ x: 13, y: base + 10, z: 11.2, w: 10, h: 7, d: 1.2 }, { hatch: false });            // monitor
    sk.box({ x: 17, y: base + 10, z: 11.6, w: 2, h: 2.5, d: 2 }, { hatch: false, w: 0.9 });
    const m = sk.plane([0, base + 10.4, 0], [1, 0, 0], [0, 0, 1]);
    sk.localPoly(m, [[22, 13.5], [34, 13.5], [34, 22.5], [22, 22.5]], { w: 1.3 });              // the form
    for (let k = 0; k < 4; k++) sk.localLine(m, [[23.5, 15.5 + k * 1.8], [32.5 - (k === 3 ? 4 : 0), 15.5 + k * 1.8]], { w: 0.7, cls: 'hairline' });
  });
  // chair
  add(29, base + 4, 33, () => {
    sk.box({ x: 27, y: base, z: 31, w: 2, h: 6, d: 2 }, { hatch: false, w: 0.9 });
    sk.box({ x: 24, y: base + 6, z: 28, w: 9, h: 1.6, d: 9 }, { hatch: false });
    sk.box({ x: 24, y: base + 7.6, z: 36, w: 9, h: 7, d: 1.2 }, { hatch: false });
  });
  // a filing shelf behind, so the room reads as an office
  add(60, base + 6, 8, () => {
    sk.box({ x: 46, y: base, z: 4, w: 18, h: 13, d: 8 }, { hatch: 1.8 });
    const m = sk.plane([46, base, 12], [1, 0, 0], [0, 1, 0]);
    for (let r = 0; r < 3; r++) sk.localPoly(m, [[2, 1.4 + r * 4], [16, 1.4 + r * 4], [16, 3.8 + r * 4], [2, 3.8 + r * 4]], { fill: false, w: 0.7 });
  });
  // conveyor belt at the foot of the lift, with rows riding it
  add(W - 15, base + 2, 11, () => {
    sk.box({ x: W - 30, y: base, z: 8, w: 24, h: 3, d: 6 }, { hatch: false, pencil: true });
    for (let k = 0; k < 3; k++) sk.box({ x: W - 28 + k * 7, y: base + 3, z: 9.2, w: 4, h: 3, d: 3.6 }, { hatch: false, pencil: true, w: 0.9 });
  });
}

function floor1(sk: Sketch, base: number, add: Add): void {
  // fact racks: shelves of ledgers (many rows, stacked)
  for (let r = 0; r < 3; r++) {
    const rx = 8 + r * 25;
    add(rx + 10, base + 11, 12, () => {
      for (const [dx, dz] of [[0, 0], [18, 0], [0, 11], [18, 11]]) sk.box({ x: rx + dx, y: base, z: 6 + dz, w: 1.2, h: 23, d: 1.2 }, { hatch: false, w: 0.9 });
      for (let lv = 0; lv < 2; lv++) {
        const y0 = base + lv * 11.4;
        sk.box({ x: rx, y: y0, z: 6, w: 19.2, h: 1, d: 12.2 }, { hatch: false });
        for (let st = 0; st < 2; st++) for (let k = 0; k < 3; k++) {
          sk.box({ x: rx + 2 + st * 8.6, y: y0 + 1 + k * 2.4, z: 7.4 + (k % 2) * 0.6, w: 7, h: 2.2, d: 9 }, { hatch: false, w: 0.9 });
        }
      }
    });
  }
  // dimension cabinets: card-index drawers
  for (let k = 0; k < 2; k++) {
    const cx = 58 + k * 19;
    add(cx + 7, base + 8, 36, () => {
      sk.box({ x: cx, y: base, z: 28, w: 16, h: 17, d: 12 }, { hatch: 1.8 });
      const m = sk.plane([cx, base, 40], [1, 0, 0], [0, 1, 0]);
      for (let r = 0; r < 4; r++) for (let q = 0; q < 2; q++) {
        const u0 = 1.2 + q * 7.4, v0 = 1.1 + r * 4;
        sk.localPoly(m, [[u0, v0], [u0 + 6.6, v0], [u0 + 6.6, v0 + 3.2], [u0, v0 + 3.2]], { w: 0.8, fill: false });
        sk.localLine(m, [[u0 + 2.6, v0 + 1.8], [u0 + 4, v0 + 1.8]], { w: 0.8, cls: 'hairline' });
      }
    });
  }
}

function floor2(sk: Sketch, base: number, add: Add): void {
  // the card catalogue: a drawer per subject area, one drawer pulled out
  add(36, base + 10, 8, () => {
    sk.box({ x: 8, y: base, z: 4, w: 58, h: 22, d: 9 }, { hatch: 2 });
    const m = sk.plane([8, base, 13], [1, 0, 0], [0, 1, 0]);
    for (let r = 0; r < 4; r++) for (let q = 0; q < 10; q++) {
      const u0 = 1.5 + q * 5.4, v0 = 1.4 + r * 5;
      if (r === 3 && q === 2) continue;
      sk.localPoly(m, [[u0 + 0.8, v0], [u0 + 4, v0], [u0 + 4.8, v0 + 1.6], [u0 + 4, v0 + 3.2], [u0 + 0.8, v0 + 3.2], [u0, v0 + 1.6]], { w: 0.8, fill: false });
      sk.localLine(m, [[u0 + 1.6, v0 + 1.6], [u0 + 3.2, v0 + 1.6]], { w: 0.7, cls: 'hairline' });
    }
    // the pulled-out drawer (Sales Order)
    sk.box({ x: 8 + 1.5 + 5.4 * 2 + 0.6, y: base + 1.4 + 15, z: 13, w: 4.2, h: 3.2, d: 4.5 }, { hatch: false, w: 1.2 });
  });
  // the front desk is drawn outside; a reading table with an open book inside
  add(40, base + 4, 38, () => {
    sk.box({ x: 28, y: base, z: 30, w: 20, h: 8, d: 10 }, { hatch: 1.8 });
    sk.box({ x: 33, y: base + 8, z: 32, w: 9, h: 0.8, d: 6 }, { hatch: false, w: 0.9 });
  });
}

function shaft(sk: Sketch, base: number, i: number): void {
  // the lift shaft: four posts and a crate, pencil (documented, not in the lineage file)
  const x = W - 14, z = 6, s = 10;
  for (const [dx, dz] of [[0, 0], [s, 0], [0, s], [s, s]]) sk.box({ x: x + dx, y: base, z: z + dz, w: 1, h: WH, d: 1 }, { hatch: false, pencil: true, w: 0.9 });
  if (i > 0) sk.box({ x: x + 2.5, y: base, z: z + 2.5, w: 5, h: 4, d: 5 }, { hatch: false, pencil: true, w: 0.9 });
}
