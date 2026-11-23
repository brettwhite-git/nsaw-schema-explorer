// Sketch B: "The machine". An exploded patent drawing of one appliance: parts on a common dashed axis, numbered
// balloons. Each plate carries a handful of LARGE, named representative items in their layer shapes, plus an honest
// "and N more" stack. The mass of real tiles is not shown at rest.
import type { V3 } from '../../ink/iso';
import { hatchSegments } from '../../ink/hatch';
import { INGEST_LANES } from '../../content/entry';
import { Sketch, type Pt } from './kit';
import { drawThread, fitBasis, gate, type Counts } from './common';

const PW = 130, PD = 52, T = 3.4, GAPB = 44, STACK = 2.5;
const YAW = -0.28;
const topOf = (i: number, g: number): number => i * (T + STACK) + g * GAPB * i + T;

type M = ReturnType<Sketch['plane']>;

function tag(sk: Sketch, m: M, x: number, z: number, w: number, h: number, kind: 'rect' | 'fact' | 'dim' | 'pill' | 'ghost', label: string): void {
  const o = { w: kind === 'fact' ? 1.7 : kind === 'rect' ? 0.9 : 1.2 };
  if (kind === 'rect') {
    sk.localPoly(m, [[x, z], [x + w, z], [x + w, z + h], [x, z + h]], o);
    sk.localLine(m, [[x + 2, z + h * 0.3], [x + w - 2, z + h * 0.3]], { w: 0.6, cls: 'hairline' });
  } else if (kind === 'fact' || kind === 'dim') {
    const c = 3;
    sk.localPoly(m, [[x + c, z], [x + w, z], [x + w, z + h], [x + c, z + h], [x, z + h - c], [x, z + c]], o);
    if (kind === 'fact') sk.hatch(sk.segs(hatchSegments({ x0: x + w * 0.62, y0: z + 1, x1: x + w - 1, y1: z + h - 1 }, 45, 1.6), m));
    else sk.localPoly(m, [[x + w - 5, z + h / 2 - 1], [x + w - 3, z + h / 2 - 1], [x + w - 3, z + h / 2 + 1], [x + w - 5, z + h / 2 + 1]], { w: 0.8, fill: false });
  } else if (kind === 'pill') {
    const r = h / 2;
    sk.localPoly(m, [[x + r, z], [x + w - r, z], [x + w - r * 0.3, z + h * 0.2], [x + w, z + h / 2], [x + w - r * 0.3, z + h * 0.8], [x + w - r, z + h], [x + r, z + h], [x + r * 0.3, z + h * 0.8], [x, z + h / 2], [x + r * 0.3, z + h * 0.2]], o);
    sk.hatch(sk.segs(hatchSegments({ x0: x + w * 0.66, y0: z + 1, x1: x + w - r, y1: z + h - 1 }, 135, 1.6), m));
  } else {
    // "and N more": the same tag three times over, offset, dashed (drawn as pencil: it stands for tiles not drawn)
    for (let k = 2; k >= 0; k--) sk.localPoly(m, [[x + k * 2.4, z - k * 1.6], [x + w + k * 2.4, z - k * 1.6], [x + w + k * 2.4, z + h - k * 1.6], [x + k * 2.4, z + h - k * 1.6]], { w: 0.9, pencil: true });
  }
  const [lx, ly] = sk.at(m, x + w / 2, z + h / 2);
  sk.text(lx, ly + 3.5, label, kind === 'pill' ? 'tx ser' : 'tx mono', 'middle');
}

export function drawB(svg: SVGSVGElement, W0: number, H0: number, g: number, c: Counts, narrow: boolean): Sketch {
  const sk = new Sketch(svg);
  const corners = (gg: number): V3[] => {
    const out: V3[] = [];
    for (const x of [0, PW]) for (const z of [0, PD]) for (const y of [0, topOf(4, gg) + 34]) out.push([x, y, z]);
    return out;
  };
  sk.setBasis(fitBasis(YAW, corners(1), corners(g), { w: 440, h: H0 - 70, cx: W0 / 2, cy: H0 / 2 + 8 }));
  const top = (i: number) => topOf(i, g);
  const P = (x: number, y: number, z: number): Pt => sk.P(x, y, z);

  // the dashed assembly axis, behind everything
  sk.dashed([P(PW / 2, -8, PD / 2), P(PW / 2, top(4) + 40, PD / 2)]);

  const names = ['NetSuite', 'Ingestion', 'Warehouse', 'Model', 'Outlets'];
  void names;
  for (let i = 0; i < 5; i++) {
    const pencil = i === 1;
    sk.group(`plate p${i}`, () => {
      sk.box({ x: 0, y: top(i) - T, z: 0, w: PW, h: T, d: PD }, { hatch: 1.6, pencil: pencil || i === 4 ? false : false });
      const m = sk.plane([0, top(i), 0], [1, 0, 0], [0, 0, 1]);
      const detail = g > 0.15 || i === 4;       // assembled, only the top part shows; the rest are inside it
      if (i === 0 && detail) {
        tag(sk, m, 6, 20, 54, 10, 'rect', 'transactionline');
        tag(sk, m, 66, 20, 46, 10, 'rect', 'transactions');
        tag(sk, m, 6, 38, 36, 10, 'rect', 'customer');
        tag(sk, m, 48, 38, 28, 10, 'rect', 'item');
        tag(sk, m, 82, 38, 40, 8, 'ghost', `and ${Math.max(0, c.records - 4)} more`);
      }
      if (i === 1 && detail) {
        [16, 28, 40].forEach((z, k) => {
          sk.box({ x: 6, y: top(1), z, w: 118, h: 4, d: 7 }, { hatch: false, pencil: true, w: 1 });
          for (let q = 0; q < 5; q++) sk.localLine(m, [[44 + q * 17, z + 1.5], [48 + q * 17, z + 3.5], [44 + q * 17, z + 5.5]], { pencil: true, w: 0.9 });
          const [lx, ly] = sk.at(sk.plane([0, top(1) + 4, 0], [1, 0, 0], [0, 0, 1]), 8, z + 5.2);
          sk.text(lx, ly, INGEST_LANES[k].join(' '), 'tx mono', 'start');
        });
      }
      if (i === 2 && detail) {
        tag(sk, m, 6, 20, 80, 11, 'fact', 'SALES_ORDER_LINES_F');
        tag(sk, m, 92, 20, 34, 11, 'dim', 'CUSTOMER_D');
        tag(sk, m, 6, 38, 32, 10, 'dim', 'ITEM_D');
        tag(sk, m, 44, 38, 30, 10, 'dim', 'DAY_D');
        tag(sk, m, 84, 38, 38, 8, 'ghost', `and ${c.tables - 4} more`);
      }
      if (i === 3 && detail) {
        tag(sk, m, 6, 20, 46, 11, 'pill', 'Sales Order');
        tag(sk, m, 58, 20, 58, 11, 'pill', 'Item Fulfillment');
        tag(sk, m, 6, 38, 52, 10, 'pill', 'Purchase Order');
        tag(sk, m, 84, 38, 38, 8, 'ghost', `and ${c.subjectAreas - 3} more`);
      }
      if (i === 4) outlets(sk, top(4));
    });
  }

  // the order line
  const mTop = (i: number) => sk.plane([0, top(i), 0], [1, 0, 0], [0, 0, 1]);
  const S = (i: number, x: number, z: number): Pt => sk.at(mTop(i), x, z);
  const out: Pt = P(98, top(4) + 32, 34);
  drawThread(sk, [
    { pts: [S(0, 33, 25), S(1, 40, 30), S(2, 46, 25)], pencil: true },
    { pts: [S(2, 46, 25), S(3, 29, 25)], pencil: false },
    { pts: [S(3, 29, 25), P(98, top(4) + 14, 34), out], pencil: true, arrow: true },
  ]);

  const cs: [string, number, number, number, 'l' | 'r', string[], string | undefined, boolean?][] = [
    ['1', 0, 6, 32, 'l', ['NetSuite: the forms', 'an order is typed into'], `${c.records} source records`],
    ['2', 1, 124, 30, 'r', ['Ingestion: pipes that', 'land the rows'], 'Oracle runs it', true],
    ['3', 2, 6, 40, 'l', ['The warehouse: tables,', 'facts and dimensions'], `${c.tables} tables`],
    ['4', 3, 122, 26, 'r', ['The model: subject areas', 'with business names'], `${c.subjectAreas} subject areas`],
  ];
  for (const [n, pl, x, z, side, lines, sub, pen] of cs) { const a = S(pl, x, z); sk.callout({ n, ax: a[0], ay: a[1], side, lines, sub, pencil: pen }); }
  const sp = P(30, top(4) + 6, 34), ch = P(112, top(4) + 5, 35);
  sk.callout({ n: '5a', ax: sp[0], ay: sp[1], side: 'l', lines: ['Port one: SQL on the', 'tables. Rows come out'], pencil: true });
  sk.callout({ n: '5b', ax: ch[0], ay: ch[1], side: 'r', lines: ['Port two: through the', 'model. One number'], pencil: true });
  const gk = P(70, top(4) + 5, 47);
  sk.callout({ n: 'S', ax: gk[0], ay: gk[1], side: 'r', lines: ['Security: a keyed gate', 'on each port'], pencil: true, by: gk[1] + 30 });
  const f0 = S(0, 33, 25);
  sk.callout({ n: '', ax: f0[0], ay: f0[1], side: 'l', lines: ['one order line,', 'followed all the way up'], accent: true, by: f0[1] + 46 });
  void narrow; void gate;
  return sk;
}

/** Two differently shaped ports: a round spout (rows out) and a square chute (one number out). */
function outlets(sk: Sketch, top: number): void {
  const m = sk.plane([0, top, 0], [1, 0, 0], [0, 0, 1]);
  // round spout at x 30, z 28
  const cx = 30, cz = 31, r = 9, h = 12;
  const ring = (y: number): Pt[] => Array.from({ length: 20 }, (_, k) => { const t = (k / 20) * Math.PI * 2; return sk.P(cx + r * Math.cos(t), y, cz + r * Math.sin(t)); });
  const bot = ring(top), up = ring(top + h);
  const l = bot.reduce((a, b) => (b[0] < a[0] ? b : a)), rr = bot.reduce((a, b) => (b[0] > a[0] ? b : a));
  const lu = up.reduce((a, b) => (b[0] < a[0] ? b : a)), ru = up.reduce((a, b) => (b[0] > a[0] ? b : a));
  sk.poly([l, lu, ru, rr, ...bot.filter((p) => p[1] >= l[1] - 0.01).sort((a, b) => b[0] - a[0])], { w: 1.2, pencil: true });
  sk.poly(up, { w: 1.2, pencil: true });
  // rows leaving the spout: a small table sheet standing above it
  const ms = sk.plane([cx - 10, top + h + 3, cz], [1, 0, 0], [0, 1, 0]);
  sk.localPoly(ms, [[0, 0], [20, 0], [20, 15], [0, 15]], { pencil: true, w: 1 });
  for (let k = 1; k < 4; k++) sk.localLine(ms, [[0, k * 3.75], [20, k * 3.75]], { pencil: true, w: 0.7 });
  sk.localLine(ms, [[7, 0], [7, 15]], { pencil: true, w: 0.7 }); sk.localLine(ms, [[14, 0], [14, 15]], { pencil: true, w: 0.7 });
  // square chute at x 104..120, z 24..38
  sk.box({ x: 104, y: top, z: 27, w: 16, h: 10, d: 14 }, { hatch: 1.8, pencil: true });
  const mr = sk.plane([104, top + 13, 34], [1, 0, 0], [0, 1, 0]);
  sk.localPoly(mr, [[0, 0], [16, 0], [16, 17], [0, 17]], { pencil: true, w: 1 });
  sk.localLine(mr, [[2, 14], [14, 14]], { pencil: true, w: 1.5 });
  sk.localPoly(mr, [[2, 2], [5, 2], [5, 8], [2, 8]], { pencil: true, w: 0.8, fill: false });
  sk.localPoly(mr, [[7, 2], [10, 2], [10, 6], [7, 6]], { pencil: true, w: 0.8, fill: false });
  sk.localPoly(mr, [[12, 2], [14, 2], [14, 10], [12, 10]], { pencil: true, w: 0.8, fill: false });
  // keyed gates across each port
  gate(sk, sk.plane([cx - 8, top + 0.6, 47], [1, 0, 0], [0, 1, 0]), 0, 0, 16, 9);
  gate(sk, sk.plane([104, top + 0.6, 47], [1, 0, 0], [0, 1, 0]), 0, 0, 16, 9);
  const [lx1, ly1] = sk.at(m, cx, 50), [lx2, ly2] = sk.at(m, 112, 50);
  sk.text(lx1, ly1 + 12, 'SQL tools', 'tx mono', 'middle');
  sk.text(lx2, ly2 + 12, 'analytics tools', 'tx mono', 'middle');
}
