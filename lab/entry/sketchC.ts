// Sketch C: "The section". A side-on cross-section, no isometric: strata read bottom to top like a building section.
// The order line rises as one thread through the bands; the two doors are two openings at different heights on the
// right edge. The plainest of the three, included as the control.
import { hatchSegments } from '../../ink/hatch';
import { INGEST_LANES } from '../../content/entry';
import type { Affine } from '../../ink/iso';
import { Sketch, type Pt } from './kit';
import { drawThread, gate, person, type Counts } from './common';

const X0 = 250, WID = 420, BH = 82, GAPC = 26;
const bandTop = (i: number, g: number): number => i * (BH + g * GAPC);   // i counted from the top (0 = model)

/** 2D plane: u right, v up, origin at screen (x, y) */
const flat = (x: number, y: number): Affine => ({ a: 1, b: 0, c: 0, d: -1, e: x, f: y });

export function drawC(svg: SVGSVGElement, W0: number, H0: number, g: number, c: Counts, narrow: boolean): Sketch {
  const sk = new Sketch(svg);
  const total = 4 * BH + 3 * GAPC * g;
  const yTop = (H0 - total) / 2 + 6;
  const bt = (i: number): number => yTop + bandTop(i, g);          // i = 0 model, 1 warehouse, 2 ingestion, 3 netsuite
  const bottom = (i: number): number => bt(i) + BH;

  const band = (i: number, hatchDeg: number | null, pencil: boolean): void => {
    const y0 = bt(i), y1 = bottom(i);
    sk.group(`band b${i}`, () => {
      sk.poly([[X0, y0], [X0 + WID, y0], [X0 + WID, y1], [X0, y1]], { w: i === 2 ? 1.2 : 1.6, pencil });
      // the layer's hatch as a ground strip along the bottom of the band
      const m = flat(0, 0);
      if (hatchDeg !== null) sk.hatch(sk.segs(hatchSegments({ x0: X0 + 1, y0: -(y1 - 1), x1: X0 + WID - 1, y1: -(y1 - 9) }, hatchDeg, 3.6), m), pencil);
    });
  };

  // ---------------------------------------------------------------- bands (drawn bottom to top)
  band(3, 0, false); band(2, null, true); band(1, 45, false); band(0, 135, false);

  // 1: NetSuite: a form and a row of record tags (rectangles)
  sk.group('ns', () => {
    const y = bt(3);
    const form = (x: number, yy: number): void => {
      sk.poly([[x, yy], [x + 34, yy], [x + 34, yy + 44], [x, yy + 44]], { w: 1.3 });
      for (let k = 0; k < 5; k++) sk.line([[x + 5, yy + 9 + k * 7], [x + 29 - (k === 4 ? 10 : 0), yy + 9 + k * 7]], { w: 0.7, cls: 'hairline' });
      sk.line([[x + 5, yy + 4], [x + 18, yy + 4]], { w: 1.3 });
    };
    form(X0 + 22, y + 10);
    ['transactions', 'transactionline', 'customer', 'item'].forEach((n, k) => {
      const x = X0 + 78 + (k % 2) * 150, yy = y + 12 + Math.floor(k / 2) * 26;
      sk.poly([[x, yy], [x + 128, yy], [x + 128, yy + 20], [x, yy + 20]], { w: 0.9 });
      sk.line([[x + 4, yy + 6], [x + 124, yy + 6]], { w: 0.6, cls: 'hairline' });
      sk.text(x + 64, yy + 16, n, 'tx mono', 'middle');
    });
    sk.text(X0 + WID - 8, y + BH - 12, `and ${Math.max(0, c.records - 4)} more`, 'tx mono2', 'end');
  });

  // 2: ingestion: a conduit with chevrons and rows riding it (pencil)
  sk.group('ing', () => {
    const y = bt(2);
    INGEST_LANES.forEach((n, k) => {
      const yy = y + 10 + k * 21;
      sk.poly([[X0 + 18, yy], [X0 + WID - 18, yy], [X0 + WID - 18, yy + 15], [X0 + 18, yy + 15]], { pencil: true, w: 1, fill: false });
      for (let q = 0; q < 3; q++) sk.line([[X0 + 120 + q * 48, yy + 3], [X0 + 126 + q * 48, yy + 7.5], [X0 + 120 + q * 48, yy + 12]], { pencil: true, w: 0.9 });
      sk.text(X0 + WID - 26, yy + 11.5, n.join(' '), 'tx mono', 'end');
    });
  });

  // 3: warehouse: representative tables in their layer shape, plus an honest "and N more"
  sk.group('wh', () => {
    const y = bt(1);
    const tags: [string, number, number, 'fact' | 'dim'][] = [['CUSTOMER_D', 14, 82, 'dim'], ['ITEM_D', 104, 62, 'dim'], ['DAY_D', 174, 60, 'dim'], ['SALES_ORDER_LINES_F', 244, 140, 'fact']];
    for (const [n, dx, w, kind] of tags) {
      const x = X0 + dx, yy = y + 12, h = 28, ch = 6;
      sk.poly([[x + ch, yy], [x + w, yy], [x + w, yy + h], [x + ch, yy + h], [x, yy + h - ch], [x, yy + ch]], { w: kind === 'fact' ? 1.7 : 1.1 });
      if (kind === 'fact') sk.hatch(sk.segs(hatchSegments({ x0: x + w - 22, y0: -(yy + h - 2), x1: x + w - 2, y1: -(yy + 2) }, 45, 3), flat(0, 0)));
      else sk.poly([[x + 9, yy + 5], [x + 13, yy + 5], [x + 13, yy + 9], [x + 9, yy + 9]], { w: 0.8, fill: false });
      sk.text(x + w / 2 + 2, yy + h / 2 + 4, n, 'tx mono', 'middle');
    }
    const x = X0 + 14, yy = y + 52;
    for (let k = 2; k >= 0; k--) sk.poly([[x + k * 3, yy - k * 2], [x + 60 + k * 3, yy - k * 2], [x + 60 + k * 3, yy + 10 - k * 2], [x + k * 3, yy + 10 - k * 2]], { pencil: true, w: 0.9 });
    sk.text(x + 74, yy + 8, `and ${c.tables - 4} more tables`, 'tx mono2', 'start');
  });

  // 4: the model: representative subject areas as pills
  sk.group('mod', () => {
    const y = bt(0);
    const pills: [string, number, number][] = [['Item Fulfillment', 14, 120], ['Purchase Order', 142, 118], ['Sales Order', 268, 104]];
    for (const [n, dx, w] of pills) {
      const x = X0 + dx, yy = y + 12, h = 28, r = h / 2;
      sk.poly([[x + r, yy], [x + w - r, yy], [x + w - r * 0.3, yy + h * 0.2], [x + w, yy + h / 2], [x + w - r * 0.3, yy + h * 0.8], [x + w - r, yy + h], [x + r, yy + h], [x + r * 0.3, yy + h * 0.8], [x, yy + h / 2], [x + r * 0.3, yy + h * 0.2]], { w: 1.2 });
      sk.text(x + w / 2, yy + h / 2 + 4.5, n, 'tx ser', 'middle');
    }
    const x = X0 + 14, yy = y + 52;
    for (let k = 2; k >= 0; k--) sk.poly([[x + k * 3, yy - k * 2], [x + 60 + k * 3, yy - k * 2], [x + 60 + k * 3, yy + 10 - k * 2], [x + k * 3, yy + 10 - k * 2]], { pencil: true, w: 0.9 });
    sk.text(x + 74, yy + 8, `and ${c.subjectAreas - 3} more subject areas`, 'tx mono2', 'start');
  });

  // ---------------------------------------------------------------- the two doors, on the right edge
  const xr = X0 + WID;
  const doorA = bt(1) + 12, doorB = bt(0) + 12;         // y of each opening's top
  sk.group('doors', () => {
    for (const [y0, name] of [[doorA, 'a'], [doorB, 'b']] as [number, string][]) {
      sk.poly([[xr - 1, y0], [xr + 3, y0], [xr + 3, y0 + 46], [xr - 1, y0 + 46]], { w: 1.2, pencil: true });
      gate(sk, flat(xr + 8, y0 + 46), 0, 0, 16, 26);
      person(sk, flat(xr + 56, y0 + 46), 0, 0, 1.4);
      const mm = flat(xr + 72, y0 + 46);
      if (name === 'a') {      // rows
        sk.localPoly(mm, [[0, 6], [26, 6], [26, 26], [0, 26]], { pencil: true, w: 1 });
        for (let k = 1; k < 4; k++) sk.localLine(mm, [[0, 6 + k * 5], [26, 6 + k * 5]], { pencil: true, w: 0.7 });
        sk.localLine(mm, [[9, 6], [9, 26]], { pencil: true, w: 0.7 }); sk.localLine(mm, [[18, 6], [18, 26]], { pencil: true, w: 0.7 });
      } else {                 // a report: one number and a bar chart
        sk.localPoly(mm, [[0, 6], [26, 6], [26, 30], [0, 30]], { pencil: true, w: 1 });
        sk.localLine(mm, [[4, 25], [22, 25]], { pencil: true, w: 1.5 });
        sk.localPoly(mm, [[4, 8], [8, 8], [8, 16], [4, 16]], { pencil: true, w: 0.8, fill: false });
        sk.localPoly(mm, [[11, 8], [15, 8], [15, 20], [11, 20]], { pencil: true, w: 0.8, fill: false });
        sk.localPoly(mm, [[18, 8], [22, 8], [22, 13], [18, 13]], { pencil: true, w: 0.8, fill: false });
      }
    }
  });

  // ---------------------------------------------------------------- the order line
  const form: Pt = [X0 + 39, bt(3) + 32];
  const tx = X0 + 320;                                   // the thread's column through the fact tag and the Sales Order pill
  const lane = bt(2) + 17.5;
  const doorPt: Pt = [xr + 1, bt(0) + 26];
  drawThread(sk, [
    { pts: [form, [form[0], lane], [tx, lane]], pencil: true },
    { pts: [[tx, lane], [tx, bt(1) + 40]], pencil: true },
    { pts: [[tx, bt(1) + 40], [tx, bt(0) + 26]], pencil: false },
    { pts: [[tx, bt(0) + 26], doorPt, [xr + 66, bt(0) + 26]], pencil: true, arrow: true },
  ]);

  // ---------------------------------------------------------------- callouts
  const L = X0, R = X0 + WID;
  sk.callout({ n: '1', ax: L + 3, ay: bt(3) + 40, side: 'l', lines: ['NetSuite: where an', 'order is written'], sub: `${c.records} source records` });
  sk.callout({ n: '2', ax: L + 3, ay: bt(2) + 40, side: 'l', lines: ['Ingestion: Oracle lands', 'the rows'], pencil: true });
  sk.callout({ n: '3', ax: L + 3, ay: bt(1) + 40, side: 'l', lines: ['The warehouse: tables,', 'facts and dimensions'], sub: `${c.tables} tables` });
  sk.callout({ n: '4', ax: L + 3, ay: bt(0) + 40, side: 'l', lines: ['The model: subject areas', 'with business names'], sub: `${c.subjectAreas} subject areas` });
  sk.callout({ n: '5a', ax: R + 1, ay: doorA + 23, side: 'r', lines: ['Door one: SQL on', 'the tables'], pencil: true, by: doorA + 70 });
  sk.callout({ n: '5b', ax: R + 1, ay: doorB + 23, side: 'r', lines: ['Door two: through the', 'model'], pencil: true, by: doorB + 8 });
  sk.callout({ n: 'S', ax: R + 16, ay: doorB + 40, side: 'r', lines: ['Security: a keyed gate', 'in each door'], pencil: true, by: doorB + 130 });
  sk.callout({ n: '', ax: form[0], ay: form[1], side: 'l', lines: ['one order line,', 'followed all the way up'], accent: true, by: bt(3) + BH + 22 });
  void narrow;
  return sk;
}
