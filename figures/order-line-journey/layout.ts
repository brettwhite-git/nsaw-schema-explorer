// buildSpec(width): the whole figure as data. Pure: same width, same Spec.
//   wide layout  (>= 540 px): three columns, as the storyboard
//   phone layout (<  540 px): one column, threads as elbows in side channels (storyboard section 2)
// Both layouts produce the SAME items (same ids, steps, accents, provenance); only geometry differs.
import type { AtlasRef } from '../../content/types';
import { bridged, lineTo, mid, monoW, r1, rounded, roundedBridged, sCurve, segsOf, serifW, wrap } from './geom';
import {
  STEPS, STEP_COUNT, breakLabel, shortName,
  type BoxItem, type CalloutItem, type FocusId, type HoverDef, type Item, type Pt, type Spec, type TableItem, type Tip,
} from './model';

export interface R { x: number; y: number; w: number; h: number }
export const WIDE_MIN = 540;
export const HEAD_H = 12, ROW_H = 13, CELL_FS = 10.5, HEAD_FS = 10;

/** A path with the two points knots sit on. */
export interface P { d: string; a: Pt; b: Pt }

export interface Anchors {
  layout: 'wide' | 'phone';
  W: number; H: number; ox: number;
  fs: number;                       // warehouse tag font px
  form: R; spineX: number;
  recs: R[];
  tags: { F: R; L: R; SEC: R; C: R; I: R; BK: R }; hex: R;
  pills: R[];
  report: R; cell: R;
  head: { x: number; y: number; w: number };
  x87: Pt; x65: Pt;
  srcid: R;
  legend: { x: number; y: number; w: number };
  invented: Pt;
  ghostDx: number; ghostDy: number;
  // lines
  thrF: P; thrL: P; thrC: P; thrI: P;
  fan: P[];
  lnkC: P; lnkI: P; lnkD: P; lnkB: P; lnkSec: P;
  thrP: P[];
  repP2: P; repP3: P;
  leadSrc: P;
  spine: P; ticks: P[]; stub: P; t1: P; bkT1: P; bkT1r2: P; row2Tick: P;
  co: Record<string, { x: number; y: number; tx: number; ty: number }>;
  tipAnchors: Record<string, Pt>;
  /** phone camera: the span each step brings into view (default: what the step adds) */
  view?: [number, number][];
}

// ---------------------------------------------------------------- shared content
const REF = {
  rec: (k: string): AtlasRef => ({ type: 'netsuiteRecord', key: k }),
  tab: (n: string): AtlasRef => ({ type: 'physicalTable', key: n }),
  ent: { type: 'entity', key: 'Sales Order Transaction Accounting Line' } as AtlasRef,
  sa: { type: 'subjectArea', key: 'NetSuite - Sales Order' } as AtlasRef,
  pc: (k: string): AtlasRef => ({ type: 'presentationColumn', key: `NetSuite - Sales Order::${k}` }),
};
export const REFS = {
  transactions: REF.rec('transactions'), transactionline: REF.rec('transactionline'), customer: REF.rec('customer'), item: REF.rec('item'),
  entity: REF.ent, subjectArea: REF.sa,
  p1: REF.pc('Transaction Line Attributes::Sales Order Line Number'),
  p2: REF.pc('Customer::Customer Company Name'),
  p3: REF.pc('Transaction Lines - Base Currency Amounts::Line Amount in Base Currency'),
};
const T = (n: string): AtlasRef => REF.tab(n);

const col3 = (tw: number): number[] => { const s = (tw - 4) / 168; return [16, 54, 70, 28].map((w) => Math.round(w * s)); };

function cellsW(cols: { w: number }[]): number { return cols.reduce((a, c) => a + c.w, 0); }

// ---------------------------------------------------------------- assemble
export function assemble(A: Anchors): { items: Item[]; hovers: Record<string, HoverDef> } {
  const items: Item[] = [];
  const hovers: Record<string, HoverDef> = {};
  const tw = A.tags.L.w;
  const [cID, cCU, cTX, cBK] = col3(tw);
  const F = A.tags, wx = F.L.x;
  const dTop = F.L.y + F.L.h;               // drawer top
  const rowY = (i: number): number => dTop + HEAD_H + i * ROW_H;

  // ---- step 0: the form
  const fm = A.form;
  const fr = formGeom(fm);
  items.push({ k: 'form', id: 'form', step: 0, ord: 0, x: fm.x, y: fm.y, w: fm.w, h: fm.h, hk: 'form' });
  items.push({ k: 'under', id: 'ul-form-1', step: 0, ord: 1, acc: ['form-l1', 'number'], x0: fm.x + 8, x1: fm.x + fm.w - 8, y: fr.l1 + 5, seed: 11 });
  items.push({ k: 'line', id: 'stub', step: 0, ord: 2, acc: ['form-l1', 'number'], prov: 'illustrative', d: A.stub.d, seed: 12, knots: [A.stub.b], dur: 380 });
  callout(items, A, '0a', 0, 0); callout(items, A, '0b', 0, 1);
  hovers.form = { lit: [] };

  // ---- step 1: spine, five records, legend
  items.push({ k: 'line', id: 'spine', step: 1, ord: 0, prov: 'illustrative', d: A.spine.d, seed: 21 });
  const recs: { name: string; cap: string; pencil?: boolean; ref: AtlasRef; tip: string }[] = [
    { name: 'Transactions', cap: 'header', ref: REFS.transactions, tip: 'The order header record.' },
    { name: 'TransactionLine', cap: 'line', ref: REFS.transactionline, tip: 'The line record.' },
    { name: 'transactionaccountingline', cap: 'accounting line', pencil: true, ref: REFS.entity, tip: 'Not in the lineage file.' },
    { name: 'customer', cap: 'pointed at', ref: REFS.customer, tip: 'Pointed at, not copied.' },
    { name: 'item', cap: 'pointed at', ref: REFS.item, tip: 'Pointed at, not copied.' },
  ];
  recs.forEach((r, i) => {
    const R_ = A.recs[i];
    items.push({ k: 'line', id: `tick-${i}`, step: 1, ord: 1 + i, prov: 'illustrative', d: A.ticks[i].d, seed: 30 + i, dur: 300 });
    items.push({ k: 'rec', id: `rec-${i}`, step: 1, ord: 1 + i, x: R_.x, y: R_.y, w: R_.w, h: R_.h, name: r.name, cap: r.cap, pencil: r.pencil,
      acc: i === 1 ? ['rec-line'] : i === 0 ? ['rec-trans'] : undefined, hk: `rec-${i}`, ref: r.ref });
    const lit = [`rec-${i}`, `tick-${i}`];
    if (i === 1) lit.push('t1');
    hovers[`rec-${i}`] = { lit, dim: true, tips: [{ fromStep: 1, tip: { lines: [r.tip], x: R_.x + R_.w / 2, y: R_.y + R_.h, place: 'below' } }] };
  });
  items.push({ k: 'line', id: 't1', step: 1, ord: 3, acc: ['rec-line'], prov: 'illustrative', d: A.t1.d, seed: 22, dur: 520 });
  items.push({ k: 'legend', id: 'legend', step: 1, ord: 5, x: A.legend.x, y: A.legend.y, w: A.legend.w });
  (['1a', '1b', '1c', '1d'] as const).forEach((k) => callout(items, A, k, 1, 6));

  // ---- step 2: rows land
  const thr = (id: string, p: P, ord: number, seed: number, acc?: FocusId[]) =>
    items.push({ k: 'line', id, step: 2, ord, prov: 'explicit', d: p.d, seed, knots: [p.a, p.b], acc });
  const tag = (id: string, r: R, full: string, step: number, ord: number, acc?: FocusId[]) => {
    const lines = id === 'tag-sec' ? breakLabel(shortName(full)) : [shortName(full)];
    items.push({ k: 'tag', id, step, ord, x: r.x, y: r.y, w: r.w, h: r.h, lines, full, fs: A.fs, acc, hk: id, ref: T(full) });
  };
  thr('thr-F', A.thrF, 0, 41, ['rec-trans']); tag('tag-F', F.F, 'DW_NS_SALES_ORDER_F', 2, 0);
  thr('thr-L', A.thrL, 1, 42, ['wh-lines']); tag('tag-L', F.L, 'DW_NS_SALES_ORDER_LINES_F', 2, 1, ['wh-lines', 'fact-row']);
  thr('thr-C', A.thrC, 2, 43); tag('tag-C', F.C, 'DW_NS_CUSTOMER_D', 2, 2);

  const stripF: TableItem = { k: 'table', id: 'strip-F', step: 2, ord: 3, x: wx, y: F.F.y + F.F.h, cols: [{ w: 76, head: 'TRANID', hk: 'cell-tranid' }], rows: [{ cells: [{ text: 'SO1041' }] }], rowH: ROW_H, headH: HEAD_H, fs: CELL_FS, headFs: HEAD_FS };
  const stripL: TableItem = { k: 'table', id: 'strip-L', step: 2, ord: 3, x: wx + cID + cCU, y: dTop, cols: [{ w: cTX, head: 'TRANSACTION', hk: 'cell-tx', headAcc: [] }], rows: [{ cells: [{ text: '5120', acc: ['fact-row'] }] }], rowH: ROW_H, headH: HEAD_H, fs: CELL_FS, headFs: HEAD_FS };
  const stripC: TableItem = { k: 'table', id: 'strip-C', step: 2, ord: 3, x: wx, y: F.C.y + F.C.h, cols: [{ w: 26, head: 'ID' }, { w: 112, head: 'COMPANYNAME' }], rows: [{ cells: [{ text: '88' }, { text: 'Harbor Supply Co.', hk: 'val-cust' }] }], rowH: ROW_H, headH: HEAD_H, fs: CELL_FS, headFs: HEAD_FS };
  items.push(stripF, stripL, stripC);
  callout(items, A, '2a', 2, 4); callout(items, A, '2b', 2, 4);

  // ---- step 3: fact and dimensions
  const drawerA: TableItem = {
    k: 'table', id: 'drawer-L', step: 3, ord: 0, x: wx, y: dTop,
    cols: [{ w: cID, head: 'ID', hk: 'cell-id' }, { w: cCU, head: 'CUSTOMER', hk: 'cell-cust' }],
    rows: [{ cells: [{ text: '1', acc: ['fact-row'] }, { text: '88', acc: ['fact-row'] }] }],
    rowH: ROW_H, headH: HEAD_H, fs: CELL_FS, headFs: HEAD_FS,
  };
  items.push(drawerA);
  items.push({ k: 'box', id: 'rowbox', step: 3, ord: 0, acc: ['fact-row'], x: wx, y: rowY(0), w: cID + cCU + cTX, h: ROW_H, seed: 51, hk: 'row-1' });
  const link = (id: string, p: P, ord: number, seed: number, step: number, acc?: FocusId[]) =>
    items.push({ k: 'line', id, step, ord, prov: 'inferred', d: p.d, seed, knots: [p.a, p.b], hk: id, acc });
  link('lnk-C', A.lnkC, 1, 61, 3); link('lnk-I', A.lnkI, 2, 62, 3); link('lnk-D', A.lnkD, 3, 63, 3);
  items.push({ k: 'line', id: 'thr-I', step: 3, ord: 4, prov: 'explicit', d: A.thrI.d, seed: 44, knots: [A.thrI.a, A.thrI.b] });
  tag('tag-I', F.I, 'DW_NS_ITEM_D', 3, 4);
  items.push({ k: 'table', id: 'strip-I', step: 3, ord: 5, x: wx, y: F.I.y + F.I.h, cols: [{ w: 82, head: 'FULLNAME' }], rows: [{ cells: [{ text: 'Pallet jack' }] }], rowH: ROW_H, headH: HEAD_H, fs: CELL_FS, headFs: HEAD_FS });
  items.push({ k: 'hex', id: 'hex-D', step: 3, ord: 5, x: A.hex.x, y: A.hex.y, w: A.hex.w, h: A.hex.h, full: 'DW_NS_DAY_D', hk: 'hex-D', ref: T('DW_NS_DAY_D') });
  (['3a', '3b', '3c', '3d'] as const).forEach((k) => callout(items, A, k, 3, 6));

  // ---- step 4: grain
  items.push({ k: 'under', id: 'ul-id', step: 4, ord: 0, acc: ['grain'], x0: wx + 3, x1: wx + 3 + monoW('ID', HEAD_FS), y: dTop + HEAD_H - 1, seed: 71 });
  items.push({ k: 'under', id: 'ul-tx', step: 4, ord: 0, acc: ['grain'], x0: wx + cID + cCU + 3, x1: wx + cID + cCU + 3 + monoW('TRANSACTION', HEAD_FS), y: dTop + HEAD_H - 1, seed: 72 });
  items.push({
    k: 'table', id: 'book-col', step: 4, ord: 1, x: wx + cID + cCU + cTX, y: dTop,
    cols: [{ w: cBK, head: 'BOOK', hk: 'cell-book', pencil: true }], rows: [{ cells: [{ text: '1', pencil: true }], pencil: true }],
    rowH: ROW_H, headH: HEAD_H, fs: CELL_FS, headFs: HEAD_FS, acc: ['grain'],
  });
  items.push({
    k: 'table', id: 'ghost-row', step: 4, ord: 2, x: wx, y: rowY(1),
    cols: [{ w: cID, head: '' }, { w: cCU, head: '' }, { w: cTX, head: '' }, { w: cBK, head: '' }],
    rows: [{ cells: [{ text: '1', pencil: true }, { text: '88', pencil: true }, { text: '5120', pencil: true }, { text: '2', pencil: true }], pencil: true }],
    rowH: ROW_H, headH: 0, fs: CELL_FS, headFs: HEAD_FS, hk: 'ghost-row',
  });
  items.push({ k: 'text', id: 'invented', step: 4, ord: 2, x: A.invented[0], y: A.invented[1], t: 'invented', face: 'mono', px: 10, anchor: 'middle', muted: true });
  link('lnk-B', A.lnkB, 3, 64, 4); tag('tag-B', F.BK, 'DW_NS_ACCOUNTINGBOOK_D', 4, 3);
  const sr = A.srcid;
  items.push({
    k: 'box', id: 'srcid', step: 4, ord: 4, x: sr.x, y: sr.y, w: sr.w, h: sr.h, pencil: true, seed: 81, acc: ['grain'], hk: 'srcid', ref: REFS.entity,
    texts: [
      { x: sr.x + 6, y: sr.y + 11.5, t: 'SOURCE_RECORD_ID', face: 'mono', px: 10.5, acc: ['grain'] },
      { x: sr.x + 6, y: sr.y + 23, t: '5120 | 1 | 1', face: 'mono', px: 10.5, muted: true },
    ],
  });
  const noteW = (A.layout === 'phone' ? A.tags.L.x + A.tags.L.w : A.W) - 4 - sr.x;
  const note = wrap('joined keys. Real format not in the data', noteW, (s) => serifW(s, 10.5), 3);
  [0, 1, 2].forEach((i) => items.push({ k: 'text', id: `srcid-note-${i}`, step: 4, ord: 4, x: sr.x + 1, y: sr.y + sr.h + 11 + i * 11, t: note[i] ?? '', face: 'serifi', px: 10.5, muted: true }));
  items.push({ k: 'line', id: 'lead-src', step: 4, ord: 4, prov: 'illustrative', d: A.leadSrc.d, seed: 82, acc: ['grain'], knots: [A.leadSrc.a, A.leadSrc.b] });
  (['4a', '4b', '4c'] as const).forEach((k) => callout(items, A, k, 4, 5));

  // ---- step 5: one record, many tables
  const ghosts = [3, 2, 1];
  ghosts.forEach((g, i) => items.push({ k: 'ghost', id: `gh-${g}`, step: 5, ord: i, x: F.F.x + A.ghostDx * g, y: F.F.y + A.ghostDy * g, w: F.F.w, h: F.F.h, hk: 'ghosts', ref: REFS.transactions }));
  A.fan.forEach((p, i) => items.push({ k: 'line', id: `fan-${i + 1}`, step: 5, ord: 3 + i, prov: 'explicit', d: p.d, seed: 91 + i, knots: [p.a, p.b], acc: ['rec-trans'], hk: 'ghosts' }));
  items.push({ k: 'text', id: 'x87', step: 5, ord: 6, x: A.x87[0], y: A.x87[1], t: 'x 87', face: 'mono', px: 12, acc: ['rec-trans'], hk: 'ghosts', ref: REFS.transactions });
  const x87w = monoW('x 87', 12) + 4;
  ['fact tables load', 'from Transactions'].forEach((t, i) => items.push({ k: 'text', id: `x87-cap-${i}`, step: 5, ord: 6, x: A.x87[0] + x87w, y: A.x87[1] - 1 + i * 11.5, t, face: 'serif', px: 10.5, muted: true }));
  items.push({ k: 'text', id: 'x65', step: 5, ord: 7, x: A.x65[0], y: A.x65[1], t: 'x 65', face: 'mono', px: 10.5, anchor: 'end', hk: 'x65', ref: REFS.transactionline });
  items.push({ k: 'text', id: 'x65-cap', step: 5, ord: 7, x: A.x65[0], y: A.x65[1] + 12.5, t: 'tables', face: 'serifi', px: 10.5, anchor: 'end', muted: true });
  callout(items, A, '5a', 5, 8); callout(items, A, '5b', 5, 8);

  // ---- step 6: business names
  link('lnk-sec', A.lnkSec, 0, 65, 6); tag('tag-sec', F.SEC, 'DW_NS_SALES_ORDER_LINES_F_SEC', 6, 0);
  items.push({
    k: 'table', id: 'drawer-sec', step: 6, ord: 1, x: wx, y: F.SEC.y + F.SEC.h,
    cols: [{ w: 80, head: 'BASE_AMOUNT', hk: 'cell-base' }],
    rows: [{ cells: [{ text: '1,240.00' }] }, { cells: [{ text: '310.50' }] }],
    rowH: ROW_H, headH: HEAD_H, fs: CELL_FS, headFs: HEAD_FS,
  });
  items.push({ k: 'text', id: 'head', step: 6, ord: 2, x: A.head.x, y: A.head.y, t: 'NetSuite - Sales Order', face: 'serif', px: 12, hk: 'head', ref: REFS.subjectArea });
  items.push({ k: 'rule', id: 'head-rule', step: 6, ord: 2, x0: A.head.x, x1: A.head.x + A.head.w, y: A.head.y + 6, seed: 101 });
  items.push({ k: 'text', id: 'head-cap', step: 6, ord: 2, x: A.head.x, y: A.head.y + 18, t: 'Order to Cash', face: 'serifi', px: 10.5, muted: true });
  const pills: { id: string; lines: string[]; ref: AtlasRef; acc?: FocusId[] }[] = [
    { id: 'p1', lines: ['Sales Order', 'Line Number'], ref: REFS.p1, acc: ['pill-p1'] },
    { id: 'p2', lines: ['Customer', 'Company Name'], ref: REFS.p2 },
    { id: 'p3', lines: ['Line Amount in', 'Base Currency'], ref: REFS.p3 },
  ];
  pills.forEach((p, i) => {
    items.push({ k: 'line', id: `thr-${p.id}`, step: 6, ord: 3 + i, prov: 'explicit', d: A.thrP[i].d, seed: 111 + i, knots: [A.thrP[i].a, A.thrP[i].b], acc: p.acc });
    const R_ = A.pills[i];
    items.push({ k: 'pill', id: `pill-${i + 1}`, step: 6, ord: 3 + i, x: R_.x, y: R_.y, w: R_.w, h: R_.h, lines: p.lines, acc: p.acc, hk: `pill-${i + 1}`, ref: p.ref });
  });
  (['6a', '6b', '6c'] as const).forEach((k) => callout(items, A, k, 6, 7));

  // ---- step 7: the number
  const rp = A.report;
  items.push({
    k: 'box', id: 'report', step: 7, ord: 0, x: rp.x, y: rp.y, w: rp.w, h: rp.h, pencil: true, seed: 121, paper: true,
    texts: reportLayout(rp).texts.filter((t) => !t.acc),
    rules: [[rp.x + 6, reportLayout(rp).ruleY, rp.x + rp.w - 6, reportLayout(rp).ruleY]],
  });
  items.push({ k: 'line', id: 'rep-p2', step: 7, ord: 0, dur: 300, prov: 'illustrative', d: A.repP2.d, seed: 122, knots: [A.repP2.a, A.repP2.b] });
  { const n = reportLayout(rp).texts.find((t) => t.acc)!; items.push({ k: 'text', id: 'rep-num', step: 7, ord: 1, x: n.x, y: n.y, t: n.t, face: 'mono', px: 12, anchor: 'middle', acc: ['number'] }); }
  items.push({ k: 'box', id: 'rep-cell', step: 7, ord: 1, x: A.cell.x, y: A.cell.y, w: A.cell.w, h: A.cell.h, pencil: true, seed: 123, acc: ['number'], hk: 'num' });
  items.push({ k: 'text', id: 'rep-note', step: 7, ord: 1, x: A.cell.x + A.cell.w / 2, y: A.cell.y + A.cell.h + 12, t: '1,240.00 + 310.50', face: 'mono', px: 10, anchor: 'middle', muted: true });
  items.push({
    k: 'table', id: 'row-3', step: 7, ord: 1, x: wx, y: rowY(2),
    cols: [{ w: cID, head: '' }, { w: cCU, head: '' }, { w: cTX, head: '' }], rows: [{ cells: [{ text: '2' }, { text: '88' }, { text: '5120' }] }],
    rowH: ROW_H, headH: 0, fs: CELL_FS, headFs: HEAD_FS, hk: 'row-3',
  });
  items.push({ k: 'line', id: 'rep-p3', step: 7, ord: 2, seq: true, rev: true, dur: 300, prov: 'illustrative', d: A.repP3.d, seed: 124, knots: [A.repP3.b], acc: ['number'] });
  items.push({ k: 'line', id: 'bk-p3', step: 7, ord: 3, prov: 'explicit', d: A.thrP[2].d, seed: 113, overlayOf: 'thr-p3', acc: ['number'], seq: true, rev: true, dur: 280 });
  items.push({ k: 'line', id: 'bk-twin', step: 7, ord: 4, prov: 'inferred', d: A.lnkSec.d, seed: 65, overlayOf: 'lnk-sec', knots: [A.lnkSec.a, A.lnkSec.b], acc: ['number'], seq: true, rev: true, dur: 240 });
  items.push({ k: 'line', id: 'bk-t2', step: 7, ord: 5, prov: 'explicit', d: A.thrL.d, seed: 42, overlayOf: 'thr-L', knots: [A.thrL.a, A.thrL.b], acc: ['number'], seq: true, rev: true, dur: 360 });
  items.push({ k: 'line', id: 'bk-t1', step: 7, ord: 6, prov: 'illustrative', d: A.bkT1.d, seed: 22, overlayOf: 't1', acc: ['number'], seq: true, rev: true, dur: 400 });
  items.push({ k: 'line', id: 'bk-t1r2', step: 7, ord: 7, prov: 'illustrative', d: A.bkT1r2.d, seed: 23, dur: 300 });
  const rowC = (i: number): number => rowY(i) + ROW_H - 3;
  items.push({ k: 'under', id: 'ul-form-2', step: 7, ord: 8, x0: fm.x + 8, x1: fm.x + fm.w - 8, y: fr.l2 + 5, seed: 13 });
  const sx0 = wx + 4, sx1 = wx + 4 + monoW('1,240.00', CELL_FS);
  const secRow = (i: number): number => F.SEC.y + F.SEC.h + HEAD_H + (i + 1) * ROW_H - 2;
  items.push({ k: 'under', id: 'ul-base-1', step: 7, ord: 8, x0: sx0, x1: sx1, y: secRow(0), seed: 131 });
  items.push({ k: 'under', id: 'ul-base-2', step: 7, ord: 8, x0: sx0, x1: wx + 4 + monoW('310.50', CELL_FS), y: secRow(1), seed: 132 });
  void rowC;
  callout(items, A, '7a', 7, 9); callout(items, A, '7b', 7, 9);

  // ---- hovers
  const tagHover = (id: string, lit: string[], full: string, r: R, extra?: Partial<HoverDef>) => {
    hovers[id] = { lit: [id, ...lit], dim: true, tips: [{ fromStep: 0, tip: { lines: [full], x: r.x + r.w / 2, y: r.y + r.h, place: 'below' } }], ...extra };
  };
  tagHover('tag-F', ['thr-F'], 'DW_NS_SALES_ORDER_F', F.F);
  tagHover('tag-L', ['thr-L'], 'DW_NS_SALES_ORDER_LINES_F', F.L);
  tagHover('tag-C', ['thr-C', 'lnk-C'], 'DW_NS_CUSTOMER_D', F.C);
  tagHover('tag-I', ['thr-I', 'lnk-I'], 'DW_NS_ITEM_D', F.I);
  tagHover('hex-D', ['lnk-D'], 'DW_NS_DAY_D', A.hex);
  tagHover('tag-B', ['lnk-B'], 'DW_NS_ACCOUNTINGBOOK_D', F.BK);
  tagHover('tag-sec', ['lnk-sec'], 'DW_NS_SALES_ORDER_LINES_F_SEC', F.SEC);
  const INFER: Tip = { lines: ['Inferred: appears in the same subject areas.', 'No join key in the data.'], x: 0, y: 0, place: 'right' };
  for (const [id, dim, tgt] of [['lnk-C', 'tag-C', A.tipAnchors.lnkC], ['lnk-I', 'tag-I', A.tipAnchors.lnkI], ['lnk-D', 'hex-D', A.tipAnchors.lnkD], ['lnk-B', 'tag-B', A.tipAnchors.lnkB]] as const) {
    hovers[id] = { lit: [id, dim, 'tag-L'], dim: true, tips: [{ fromStep: 3, tip: { ...INFER, x: tgt[0], y: tgt[1], place: 'left' } }] };
  }
  hovers['lnk-sec'] = { lit: ['lnk-sec', 'tag-sec', 'tag-L'], dim: true, tips: [{ fromStep: 6, tip: { lines: ['Inferred by name: _SEC marks a secured', 'variant of the table above.'], x: A.lnkSec.a[0], y: (A.lnkSec.a[1] + A.lnkSec.b[1]) / 2, place: 'right' } }] };
  hovers['cell-tranid'] = { lit: ['thr-F', 'tag-F', 'rec-0'], dim: true, tips: [{ fromStep: 2, tip: { lines: ['Transactions.tranid'], x: A.tipAnchors.thrF[0], y: A.tipAnchors.thrF[1], place: 'left' } }] };
  hovers['cell-tx'] = { lit: ['thr-L', 'rec-1'], dim: true, tips: [
    { fromStep: 2, tip: { lines: ['TransactionLine.transaction'], x: A.tipAnchors.thrL[0], y: A.tipAnchors.thrL[1], place: 'left' } },
    { fromStep: 4, tip: { lines: ["In Oracle's entity key list"], x: wx + cID + cCU + cTX / 2, y: dTop, place: 'above' } },
  ] };
  hovers['cell-id'] = { lit: [], tips: [{ fromStep: 4, tip: { lines: ["In Oracle's entity key list"], x: wx + cID / 2, y: dTop, place: 'above' } }] };
  hovers['cell-cust'] = { lit: ['lnk-C', 'tag-C'], dim: true, tips: [{ fromStep: 3, tip: { lines: ['Transactions.entity lands here.', 'In the data.'], x: wx + cID + cCU / 2, y: dTop, place: 'above' } }] };
  hovers['val-cust'] = { lit: [], tips: [{ fromStep: 3, tip: { lines: ['Overwritten when the name', 'changes in NetSuite (type 1).'], x: wx + 26 + 56, y: F.C.y + F.C.h + HEAD_H + ROW_H, place: 'below' } }] };
  hovers['cell-book'] = { lit: [], tips: [{ fromStep: 4, tip: { lines: ['Not in the lineage file'], x: wx + cID + cCU + cTX + cBK / 2, y: dTop, place: 'above' } }] };
  hovers['ghost-row'] = { lit: [], tips: [{ fromStep: 4, tip: { lines: ['Invented: one line, a second book.'], x: wx + 60, y: rowY(1) + ROW_H, place: 'below' } }] };
  hovers['srcid'] = { lit: ['srcid', 'lead-src', 'srcid-note-0', 'srcid-note-1', 'srcid-note-2', 'book-col'], dim: true };
  hovers['ghosts'] = { lit: ['gh-1', 'gh-2', 'gh-3', 'fan-1', 'fan-2', 'fan-3', 'thr-F', 'x87', 'rec-0'], dim: true, tips: [{ fromStep: 5, tip: {
    lines: ['SALES_ORDER_F', 'CUSTOMER_INVOICE_F', 'CASH_SALE_F', 'JOURNAL_F', '83 more'], x: F.F.x + F.F.w / 2, y: F.F.y + F.F.h + HEAD_H + ROW_H, place: 'below' } }] };
  hovers['x65'] = { lit: ['x65', 'x65-cap', 'thr-L', 'rec-1'], dim: true };
  hovers['head'] = { lit: ['head', 'head-rule', 'head-cap'], tips: [{ fromStep: 6, tip: { lines: ['67 warehouse tables, 11 fact, 50 dimension.', '623 columns.'], x: A.head.x, y: A.head.y + 22, place: 'below' } }] };
  hovers['pill-1'] = { lit: ['pill-1', 'thr-p1', 'tag-L', 'thr-L', 'rec-1'], dim: true };
  hovers['pill-2'] = { lit: ['pill-2', 'thr-p2', 'tag-C', 'thr-C', 'rec-3', 'strip-C'], dim: true };
  hovers['pill-3'] = { lit: ['pill-3', 'thr-p3', 'tag-sec', 'lnk-sec', 'tag-L', 'thr-L', 'rec-1', 'drawer-sec'], dim: true };
  hovers['num'] = { lit: ['rep-cell', 'rep-num', 'rep-p3', 'bk-p3', 'bk-twin', 'bk-t2', 'bk-t1', 'bk-t1r2'], tips: [{ fromStep: 7, tip: { lines: ['Click to draw the thread back.'], x: A.cell.x + A.cell.w / 2, y: A.cell.y, place: 'above' } }] };
  hovers['row-1'] = { lit: ['bk-p3', 'bk-twin', 'bk-t2', 'bk-t1', 'ul-form-1', 'ul-base-1', 'rowbox', 'rep-p3', 'rep-cell'], dim: false };
  hovers['row-3'] = { lit: ['bk-p3', 'bk-twin', 'bk-t2', 'bk-t1', 'bk-t1r2', 'ul-form-2', 'ul-base-2', 'row-3', 'rep-p3', 'rep-cell'], dim: false };
  hovers['cell-base'] = { lit: [], tips: [{ fromStep: 6, tip: { lines: ['Secured twin of the line table.'], x: wx + 40, y: F.SEC.y + F.SEC.h, place: 'above' } }] };
  for (let i = 0; i < 5; i++) hovers[`form-r${i}`] = { lit: [], solo: true };

  return { items, hovers };
}

/** The report (storyboard step 7): header, one row as label-over-value, the number in a pencil cell. */
export function reportLayout(rp: { x: number; y: number; w: number }): { texts: NonNullable<BoxItem['texts']>; ruleY: number; cell: R; h: number } {
  const x = rp.x + 7, iw = rp.w - 14;
  const texts: NonNullable<BoxItem['texts']> = [];
  let y = rp.y + 14;
  for (const t of wrap('Sales by customer, March 2026', iw, (s) => serifW(s, 11), 2)) { texts.push({ x, y, t, face: 'serifi', px: 11 }); y += 12; }
  texts.push({ x, y, t: '(illustration)', face: 'serifi', px: 11, muted: true });
  const ruleY = y + 7;
  y = ruleY + 14;
  for (const t of wrap('Customer Company Name', iw, (s) => serifW(s, 10.5), 2)) { texts.push({ x, y, t, face: 'serif', px: 10.5, muted: true }); y += 11.5; }
  texts.push({ x, y: y + 1, t: 'Harbor Supply Co.', face: 'serif', px: 11.5 });
  y += 17;
  for (const t of wrap('Line Amount in Base Currency', iw, (s) => serifW(s, 10.5), 2)) { texts.push({ x, y, t, face: 'serif', px: 10.5, muted: true }); y += 11.5; }
  const cell: R = { x: rp.x + 6, y: y - 4, w: rp.w - 12, h: 20 };
  texts.push({ x: cell.x + cell.w / 2, y: cell.y + cell.h / 2 + 4.2, t: '1,550.50', face: 'mono', px: 12, anchor: 'middle', acc: ['number'] });
  return { texts, ruleY, cell, h: cell.y + cell.h + 22 - rp.y };
}

/** Rows of the form: baselines and centres. */
export function formGeom(f: R) {
  return { title: f.y + 17, cust: f.y + 41, date: f.y + 58, l1: f.y + 82, l2: f.y + 104, rule1: f.y + 24, rule2: f.y + 66 };
}

function callout(items: Item[], A: Anchors, key: string, step: number, ord: number): void {
  const c = A.co[key];
  if (!c) return;
  const letter = key[1];
  const it: CalloutItem = { k: 'callout', id: `co-${key}`, step, ord, letter, x: c.x, y: c.y, tx: c.tx, ty: c.ty, scoped: true };
  items.push(it);
}

// ---------------------------------------------------------------- the spec
export function buildSpec(W: number): Spec {
  const A = W >= WIDE_MIN ? wideAnchors(W) : phoneAnchors(W);
  const { items, hovers } = assemble(A);
  const view: [number, number][] = [];
  for (let s = 0; s < STEP_COUNT; s++) {
    let y0 = Infinity, y1 = -Infinity;
    if (A.view) { view.push(A.view[s]); continue; }
    for (const it of items) {
      if (it.step !== s || it.scoped) continue;
      const b = bboxOf(it);
      if (!b) continue;
      y0 = Math.min(y0, b[1]); y1 = Math.max(y1, b[3]);
    }
    view.push(y0 === Infinity ? [0, 0] : [y0, y1]);
  }
  return { W, H: A.H, layout: A.layout, items, hovers, view, ox: A.ox, captions: STEPS.map((s) => [s.caption]) };
}

export function bboxOf(it: Item): [number, number, number, number] | null {
  switch (it.k) {
    case 'form': case 'rec': case 'tag': case 'hex': case 'pill': case 'box': case 'ghost': return [it.x, it.y, it.x + it.w, it.y + it.h];
    case 'table': return [it.x, it.y, it.x + cellsW(it.cols), it.y + it.headH + it.rows.length * it.rowH];
    case 'text': {
      const w = it.face === 'mono' ? monoW(it.t, it.px) : serifW(it.t, it.px);
      const x0 = it.anchor === 'middle' ? it.x - w / 2 : it.anchor === 'end' ? it.x - w : it.x;
      return [x0, it.y - it.px, x0 + w, it.y + 3];
    }
    case 'under': case 'rule': return [it.x0, it.y - 1, it.x1, it.y + 1];
    case 'legend': return [it.x, it.y, it.x + it.w, it.y + 51];
    case 'callout': return [it.x, it.y - 12, it.x + 18, it.y + 3];
    case 'line': {
      const n = it.d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      if (n.length < 4) return null;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i + 1 < n.length; i += 2) { x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]); y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]); }
      return [x0, y0, x1, y1];
    }
  }
}

// ---------------------------------------------------------------- wide anchors
function wideAnchors(W: number): Anchors {
  const full = W >= 600;
  // chapter pages give the figure 700 to 760 px at 1440: the drawing grows with it (rulebook: tag text 11 px or more)
  const LW = Math.min(W, 760);
  const big = LW >= 690;
  const ox = Math.max(0, Math.round((W - LW) / 2));
  const x = big ? Math.min(1, (LW - 620) / 140) : 0;
  const P = full ? 24 : 22, srcW = full ? 160 : 158, AW = full ? Math.round(52 + 36 * x) : 40, tw = big ? 200 : full ? 190 : 172, gap = full ? Math.round(40 + 26 * x) : 26, rm = full ? 16 : 4;
  const srcX = ox + P, srcR = srcX + srcW, wx = srcR + AW, twr = wx + tw, sx = twr + gap, sRight = ox + LW - rm, sw = sRight - sx, pw = sw - 8;
  const spineX = srcX - 13;
  const fs = big ? 12 : full ? 11 : 10;
  const e = big ? 8 : 0;                    // extra air between slots in the dense states
  const form: R = { x: srcX, y: 26, w: srcW, h: 128 };
  const fg = formGeom(form);
  const recY = [0, 1, 2, 3, 4].map((i) => 166 + i * (48 + e));
  const recs: R[] = recY.map((y) => ({ x: srcX, y, w: srcW, h: 40 }));
  const rc = (i: number): number => recs[i].y + 20;
  const tg = (y: number, h: number): R => ({ x: wx, y, w: tw, h });
  const tags = { F: tg(26, 30), L: tg(87 + e, 32), SEC: tg(186 + 2 * e, 44), C: tg(276 + 3 * e, 30), I: tg(339 + 4 * e, 30), BK: tg(442 + 6 * e, 30) };
  const hex: R = { x: wx, y: 402 + 5 * e, w: tw, h: 32 };
  const cy = (r: R): number => r.y + r.h / 2;

  // channel A threads (staircase: later threads sit further right where their spans overlap)
  const thrF: P = { a: [srcR, rc(0)], b: [wx, cy(tags.F)], d: sCurve([srcR, rc(0)], [wx, cy(tags.F)], srcR + AW * 0.42) };
  const thrL: P = { a: [srcR, rc(1)], b: [wx, cy(tags.L)], d: sCurve([srcR, rc(1)], [wx, cy(tags.L)], srcR + AW * 0.66) };
  const thrC: P = { a: [srcR, rc(3)], b: [wx, cy(tags.C)], d: sCurve([srcR, rc(3)], [wx, cy(tags.C)]) };
  const thrI: P = { a: [srcR, rc(4)], b: [wx, cy(tags.I)], d: sCurve([srcR, rc(4)], [wx, cy(tags.I)]) };

  const ghostDx = 5, ghostDy = -4;
  const fan: P[] = [1, 2, 3].map((g) => {
    const b: Pt = [wx + ghostDx * g + 8, tags.F.y + ghostDy * g];
    return { a: [srcR, rc(0)], b, d: sCurve([srcR, rc(0)], b, srcR + AW * (0.42 - 0.07 * g)) };
  });

  // pills sit level with the tag that feeds them; threads are straight and cross channel B
  const L = tags.L;
  const pillH = 34;
  const pill = (t: R): R => ({ x: sx, y: cy(t) - pillH / 2, w: pw, h: pillH });
  const pills: R[] = [pill(L), pill(tags.C), pill(tags.SEC)];          // P1, P2, P3
  const pillEdge = (p: R, y: number): number => { const r = p.h / 2, dy = y - (p.y + r); return p.x + r - Math.sqrt(Math.max(0, r * r - dy * dy)); };
  const thrPd = (t: R, p: R): P => { const y = cy(t); return { a: [twr, y], b: [pillEdge(p, y), y], d: lineTo([twr, y], [pillEdge(p, y), y]) }; };
  const thrP = [thrPd(L, pills[0]), thrPd(tags.C, pills[1]), thrPd(tags.SEC, pills[2])];

  const sr: R = { x: twr + 24, y: pills[0].y + pillH + 6, w: sRight - (twr + 24), h: 28 };
  const bookRight = wx + col3(tw).reduce((a, b) => a + b, 0);
  const leadY = L.y + L.h + HEAD_H + ROW_H / 2;
  const leadSrc: P = { a: [bookRight, leadY], b: [sr.x, leadY], d: lineTo([bookRight, leadY], [sr.x, leadY]) };

  // channel B: stitched brackets from the line tag's right edge down to each dimension's right edge.
  // The dashed brackets hop over the solid threads that cross them (gap 6 px).
  const crossers = [...thrP.map((p) => ({ a: p.a, b: p.b })), { a: leadSrc.a, b: leadSrc.b }];
  const bx = (i: number): number => twr + 4 * i;
  const lnk = (n: number, ys: number, target: Pt): P => ({ a: [twr, ys], b: target, d: roundedBridged([[twr, ys], [bx(n), ys], [bx(n), target[1]], target], 4, crossers) });
  const lnkC = lnk(1, L.y + 27, [twr, tags.C.y + 24]);
  const lnkI = lnk(2, L.y + 22, [twr, cy(tags.I)]);
  const lnkD = lnk(3, L.y + 10, [twr, cy(hex)]);
  const lnkB = lnk(4, L.y + 5, [twr, cy(tags.BK)]);

  const twinX = wx + 30;
  const dBottom = L.y + L.h + HEAD_H + 3 * ROW_H;
  const lnkSec: P = { a: [twinX, dBottom], b: [twinX, tags.SEC.y], d: lineTo([twinX, dBottom], [twinX, tags.SEC.y]) };

  // report: right of channel B, under the pills
  const repX = twr + 22, repW = pw + sx - repX;
  const rl = reportLayout({ x: repX, y: pills[1].y + pills[1].h + 12, w: repW });
  const report: R = { x: repX, y: pills[1].y + pills[1].h + 12, w: repW, h: rl.h };
  const cell = rl.cell;
  const gx = sx + sw - 3;
  const repP2: P = { a: [pills[1].x + 22, pills[1].y + pills[1].h], b: [pills[1].x + 22, report.y], d: lineTo([pills[1].x + 22, pills[1].y + pills[1].h], [pills[1].x + 22, report.y]) };
  const pr = pills[2];
  const repP3pts: Pt[] = [[pr.x + pr.w, cy(pr)], [gx, cy(pr)], [gx, cy(cell)], [cell.x + cell.w, cy(cell)]];
  const repP3: P = { a: repP3pts[0], b: repP3pts[3], d: rounded(repP3pts, 3) };

  // pencil spine and ticks
  const spineTop = fg.l1;
  const spine: P = { a: [spineX, spineTop], b: [spineX, rc(4)], d: lineTo([spineX, spineTop], [spineX, rc(4)]) };
  const ticks: P[] = recs.map((r, i) => ({ a: [spineX, rc(i)], b: [r.x, rc(i)], d: lineTo([spineX, rc(i)], [r.x, rc(i)]) }));
  const stub: P = { a: [form.x, fg.l1], b: [spineX, fg.l1], d: lineTo([form.x, fg.l1], [spineX, fg.l1]) };
  const t1: P = { a: [spineX, fg.l1], b: [recs[1].x, rc(1)], d: lineTo([spineX, fg.l1], [spineX, rc(1)], [recs[1].x, rc(1)]) };
  const bkT1: P = { a: [form.x, fg.l1], b: [recs[1].x, rc(1)], d: lineTo([form.x, fg.l1], [spineX, fg.l1], [spineX, rc(1)], [recs[1].x, rc(1)]) };
  const row2Tick: P = { a: [spineX, fg.l2], b: [form.x, fg.l2], d: lineTo([spineX, fg.l2], [form.x, fg.l2]) };

  const H = Math.max(tags.BK.y + tags.BK.h, report.y + report.h) + 14;

  const co: Anchors['co'] = {};
  const cx = srcR + 9;
  co['0a'] = { x: cx, y: fg.title, tx: srcR - 10, ty: fg.title - 4 };
  co['0b'] = { x: cx, y: fg.l1 + 4, tx: srcR - 10, ty: fg.l1 };
  (['1a', '1b', '1c'] as const).forEach((k, i) => { co[k] = { x: cx, y: rc(i) + 4, tx: srcR - 8, ty: rc(i) }; });
  co['1d'] = { x: cx, y: (recs[3].y + recs[3].h + recs[4].y) / 2 + 4, tx: srcR - 6, ty: (recs[3].y + recs[3].h + recs[4].y) / 2 };
  co['2a'] = { x: wx - 30, y: tags.F.y + 36, tx: wx + 6, ty: tags.F.y + 36 - 5 };
  co['2b'] = { x: wx - 30, y: L.y + L.h + 10, tx: wx + col3(tw)[0] + col3(tw)[1] + 4, ty: L.y + L.h + 7 };
  co['3a'] = { x: wx - 30, y: rowY0(L) + 9, tx: wx - 2, ty: rowY0(L) + 6 };
  co['3b'] = { x: twr + 22, y: lnkC.b[1] + 4, tx: bx(1) + 1, ty: (lnkC.a[1] + lnkC.b[1]) / 2 + 30 };
  co['3c'] = { x: twr + 22, y: lnkI.b[1] + 4, tx: bx(2) + 1, ty: lnkI.b[1] - 22 };
  co['3d'] = { x: twr + 22, y: lnkD.b[1] + 4, tx: twr + 1, ty: cy(hex) };
  co['4a'] = { x: wx - 30, y: dTopOf(L) + 8, tx: wx + 11, ty: dTopOf(L) + 11 };
  co['4b'] = { x: sr.x + sr.w - 14, y: sr.y - 6, tx: sr.x + sr.w - 22, ty: sr.y };
  co['4c'] = { x: wx - 30, y: dTopOf(L) + 37, tx: wx, ty: dTopOf(L) + 32 };
  co['5a'] = { x: srcR - 14, y: recs[0].y - 6, tx: srcR - 30, ty: recs[0].y };
  co['5b'] = { x: twr + 22, y: tags.F.y - 14, tx: twr + 14, ty: tags.F.y - 8 };
  co['6a'] = { x: sx + pw - 22, y: pills[0].y - 4, tx: sx + pw - 30, ty: pills[0].y + 1 };
  co['6b'] = { x: sx + pw - 22, y: pills[1].y - 4, tx: sx + pw - 30, ty: pills[1].y + 1 };
  co['6c'] = { x: twr + 10 + 86, y: 79, tx: twr + 10 + 94, ty: 67 };
  co['7a'] = { x: report.x + report.w - 26, y: report.y + 27, tx: cell.x + cell.w - 14, ty: cell.y };
  co['7b'] = { x: wx + 90, y: tags.SEC.y + tags.SEC.h + 22, tx: wx + 60, ty: tags.SEC.y + tags.SEC.h + 18 };

  return {
    layout: 'wide', W, H, ox, fs,
    form, spineX, recs, tags, hex, pills, report, cell,
    head: { x: twr + 10, y: 60, w: sRight - twr - 10 },
    x87: [twr + 17, 28], x65: [recs[1].x + recs[1].w - 8, recs[1].y + 16],
    srcid: sr, legend: { x: srcX, y: recs[4].y + 52, w: srcW },
    invented: [wx + col3(tw)[0] + col3(tw)[1] + col3(tw)[2] + col3(tw)[3] / 2, dBottom + 9],
    ghostDx, ghostDy,
    thrF, thrL, thrC, thrI, fan, lnkC, lnkI, lnkD, lnkB, lnkSec, thrP, repP2, repP3, leadSrc,
    spine, ticks, stub, t1, bkT1, bkT1r2: row2Tick, row2Tick, co,
    tipAnchors: {
      thrF: mid(thrF.a, thrF.b), thrL: mid(thrL.a, thrL.b),
      lnkC: [bx(1), (lnkC.a[1] + lnkC.b[1]) / 2], lnkI: [bx(2), (lnkI.a[1] + lnkI.b[1]) / 2], lnkD: [bx(3), (lnkD.a[1] + lnkD.b[1]) / 2], lnkB: [bx(4), (lnkB.a[1] + lnkB.b[1]) / 2],
    },
  };
}

const dTopOf = (L: R): number => L.y + L.h;
const rowY0 = (L: R): number => L.y + L.h + HEAD_H;

// ---------------------------------------------------------------- phone anchors
// One column (storyboard section 2). Source-to-warehouse threads are elbows in lanes on the left; the pencil
// spine, the stitched fact-to-dimension brackets and the pill threads run on the right. Same items as wide.
function phoneAnchors(W: number): Anchors {
  const x0 = 46;
  const tw = Math.min(190, W - x0 - 62);
  const srcR = x0 + tw, wx = x0, twr = x0 + tw;
  const fs = tw >= 186 ? 11 : 10;
  const spineX = srcR + 9;
  const form: R = { x: x0, y: 10, w: tw, h: 128 };
  const fg = formGeom(form);
  const recs: R[] = [0, 1, 2, 3, 4].map((i) => ({ x: x0, y: 150 + i * 42, w: tw, h: 36 }));
  const rc = (i: number): number => recs[i].y + recs[i].h / 2;
  const cols = col3(tw);
  const tg = (y: number, h: number): R => ({ x: wx, y, w: tw, h });
  const F_Y = 446;
  const tags = { F: tg(F_Y, 30), L: tg(F_Y + 67, 32), SEC: tg(F_Y + 240, 44), C: tg(F_Y + 334, 30), I: tg(F_Y + 401, 30), BK: tg(F_Y + 512, 30) };
  const hex: R = { x: wx, y: F_Y + 468, w: tw, h: 32 };
  const cy = (r: R): number => r.y + r.h / 2;
  const L = tags.L;
  const dBottom = L.y + L.h + HEAD_H + 3 * ROW_H;

  // left lanes: later threads sit further out; horizontals hop over the lanes they cross
  const lane = { F: 40, f1: 36, f2: 32, f3: 28, L: 24, C: 20, I: 16 };
  type LaneThread = { lane: number; from: number; to: number };
  const mk = (ln: number, fromY: number, toY: number, toX: number): Pt[] => [[x0, fromY], [ln, fromY], [ln, toY], [toX, toY]];
  const spans: { x: number; y0: number; y1: number }[] = [];
  const thr = (ln: number, fromY: number, toY: number, toX = x0, rev = false): P => {
    const pts = mk(ln, fromY, toY, toX);
    const others = spans.map((s) => ({ a: [s.x, s.y0] as Pt, b: [s.x, s.y1] as Pt }));
    spans.push({ x: ln, y0: Math.min(fromY, toY), y1: Math.max(fromY, toY) });
    void rev;
    return { a: pts[0], b: pts[3], d: bridged(pts, others) };
  };
  const thrF = thr(lane.F, rc(0), cy(tags.F));
  const ghostDx = 5, ghostDy = -4;
  const fan: P[] = [1, 2, 3].map((g) => thr(lane['f' + g as 'f1'], rc(0), tags.F.y + ghostDy * g, wx + ghostDx * g + 8));
  const thrL = thr(lane.L, rc(1), cy(tags.L));
  const thrC = thr(lane.C, rc(3), cy(tags.C));
  const thrI = thr(lane.I, rc(4), cy(tags.I));
  void ({} as LaneThread);

  // right side: pill threads in lanes beyond the stitched brackets
  const pw = Math.min(150, tw);
  const secY = dBottom;     // unused anchor kept for readability
  void secY;
  const HEADING_Y = F_Y + 572;
  const pillH = 34;
  const pillTop = HEADING_Y + 30;
  const pillRect = (i: number): R => ({ x: x0, y: pillTop + i * 42, w: pw, h: pillH });
  const pills: R[] = [pillRect(0), pillRect(2), pillRect(1)];    // P1, P2 (bottom), P3 (middle)
  const pLane = [twr + 28, twr + 40, twr + 34];                  // P1, P2, P3 lanes
  const pillThr = (t: R, p: R, ln: number, others: { a: Pt; b: Pt }[]): P => {
    const y = cy(t), py = cy(p);
    const pts: Pt[] = [[twr, y], [ln, y], [ln, py], [p.x + p.w, py]];
    return { a: pts[0], b: pts[3], d: bridged(pts, others) };
  };
  const vP = (ln: number, y0: number, y1: number) => ({ a: [ln, y0] as Pt, b: [ln, y1] as Pt });
  const thrP1 = pillThr(L, pills[0], pLane[0], []);
  const thrP3 = pillThr(tags.SEC, pills[2], pLane[2], [vP(pLane[0], cy(L), cy(pills[0]))]);
  const thrP2 = pillThr(tags.C, pills[1], pLane[1], [vP(pLane[0], cy(L), cy(pills[0])), vP(pLane[2], cy(tags.SEC), cy(pills[2]))]);
  const thrP = [thrP1, thrP2, thrP3];
  const crossers = [
    { a: [twr, cy(L)] as Pt, b: [pLane[0], cy(L)] as Pt },
    { a: [twr, cy(tags.SEC)] as Pt, b: [pLane[2], cy(tags.SEC)] as Pt },
    { a: [twr, cy(tags.C)] as Pt, b: [pLane[1], cy(tags.C)] as Pt },
  ];
  const bx = (i: number): number => twr + 4 * i;
  const lnk = (n: number, ys: number, target: Pt): P => ({ a: [twr, ys], b: target, d: roundedBridged([[twr, ys], [bx(n), ys], [bx(n), target[1]], target], 4, crossers) });
  const lnkC = lnk(1, L.y + 27, [twr, tags.C.y + 24]);
  const lnkI = lnk(2, L.y + 22, [twr, cy(tags.I)]);
  const lnkD = lnk(3, L.y + 10, [twr, cy(hex)]);
  const lnkB = lnk(4, L.y + 5, [twr, cy(tags.BK)]);

  const twinX = wx + 30;
  const lnkSec: P = { a: [twinX, dBottom], b: [twinX, tags.SEC.y], d: lineTo([twinX, dBottom], [twinX, tags.SEC.y]) };
  const sr: R = { x: x0 + 56, y: dBottom + 14, w: tw - 56, h: 28 };
  const bookRight = wx + cols.reduce((a, b2) => a + b2, 0);
  const leadSrc: P = { a: [bookRight, dBottom - ROW_H], b: [bookRight, sr.y], d: lineTo([bookRight, dBottom - ROW_H], [bookRight, sr.y]) };

  const rl0 = pills[1].y + pills[1].h + 12;
  const rl = reportLayout({ x: x0, y: rl0, w: tw });
  const report: R = { x: x0, y: rl0, w: tw, h: rl.h };
  const cell = rl.cell;
  const gx = x0 + tw + 8;
  const repP2: P = { a: [pills[1].x + 22, pills[1].y + pills[1].h], b: [pills[1].x + 22, report.y], d: lineTo([pills[1].x + 22, pills[1].y + pills[1].h], [pills[1].x + 22, report.y]) };
  const pr = pills[2];
  const repP3pts: Pt[] = [[pr.x + pr.w, cy(pr)], [gx, cy(pr)], [gx, cy(cell)], [cell.x + cell.w, cy(cell)]];
  const repP3: P = { a: repP3pts[0], b: repP3pts[3], d: rounded(repP3pts, 3) };

  const spine: P = { a: [spineX, fg.l1], b: [spineX, rc(4)], d: lineTo([spineX, fg.l1], [spineX, rc(4)]) };
  const ticks: P[] = recs.map((r, i) => ({ a: [spineX, rc(i)], b: [r.x + r.w, rc(i)], d: lineTo([spineX, rc(i)], [r.x + r.w, rc(i)]) }));
  const stub: P = { a: [srcR, fg.l1], b: [spineX, fg.l1], d: lineTo([srcR, fg.l1], [spineX, fg.l1]) };
  const t1: P = { a: [spineX, fg.l1], b: [srcR, rc(1)], d: lineTo([spineX, fg.l1], [spineX, rc(1)], [srcR, rc(1)]) };
  const bkT1: P = { a: [srcR, fg.l1], b: [srcR, rc(1)], d: lineTo([srcR, fg.l1], [spineX, fg.l1], [spineX, rc(1)], [srcR, rc(1)]) };
  const row2Tick: P = { a: [spineX, fg.l2], b: [srcR, fg.l2], d: lineTo([spineX, fg.l2], [srcR, fg.l2]) };
  const H = report.y + report.h + 14;

  const co: Anchors['co'] = {};
  const cx = srcR + 18;
  const rt = twr + 46;
  co['0a'] = { x: cx, y: fg.title, tx: srcR - 10, ty: fg.title - 4 };
  co['0b'] = { x: cx, y: fg.l1 + 4, tx: srcR - 10, ty: fg.l1 };
  (['1a', '1b', '1c'] as const).forEach((k, i) => { co[k] = { x: cx, y: rc(i) + 4, tx: srcR - 8, ty: rc(i) }; });
  co['1d'] = { x: cx, y: (recs[3].y + recs[3].h + recs[4].y) / 2 + 4, tx: srcR - 6, ty: (recs[3].y + recs[3].h + recs[4].y) / 2 };
  co['2a'] = { x: rt, y: tags.F.y + 36, tx: wx + 70, ty: tags.F.y + 36 - 5 };
  co['2b'] = { x: wx + cols[0] + cols[1] + cols[2] + 10, y: dBottom - 33, tx: wx + cols[0] + cols[1] + cols[2] - 4, ty: dBottom - 36 };
  co['3a'] = { x: rt, y: rowY0(L) + 9, tx: wx + 60, ty: rowY0(L) + 6 };
  co['3b'] = { x: rt, y: lnkC.b[1] + 4, tx: bx(1) + 1, ty: lnkC.b[1] - 40 };
  co['3c'] = { x: rt, y: lnkI.b[1] + 4, tx: bx(2) + 1, ty: lnkI.b[1] - 30 };
  co['3d'] = { x: rt, y: lnkD.b[1] + 4, tx: twr + 1, ty: cy(hex) };
  co['4a'] = { x: rt, y: dTopOf(L) + 9, tx: wx + 12, ty: dTopOf(L) + 12 };
  co['4b'] = { x: sr.x + sr.w + 10, y: sr.y + 12, tx: sr.x + sr.w - 6, ty: sr.y + 10 };
  co['4c'] = { x: rt, y: dTopOf(L) + 24, tx: wx + 100, ty: dTopOf(L) + 25 };
  co['5a'] = { x: cx, y: recs[0].y + 14, tx: srcR - 40, ty: recs[0].y + 10 };
  co['5b'] = { x: twr + 24, y: tags.F.y - 8, tx: twr + 12, ty: tags.F.y - 8 };
  co['6a'] = { x: pills[0].x + pills[0].w + 10, y: pills[0].y - 3, tx: pills[0].x + pills[0].w - 14, ty: pills[0].y + 3 };
  co['6b'] = { x: pills[1].x + pills[1].w + 10, y: pills[1].y - 3, tx: pills[1].x + pills[1].w - 14, ty: pills[1].y + 3 };
  co['6c'] = { x: x0 + tw - 14, y: HEADING_Y - 8, tx: x0 + tw - 30, ty: HEADING_Y + 6 };
  co['7a'] = { x: report.x + report.w + 22, y: report.y + 14, tx: report.x + report.w - 2, ty: report.y + 10 };
  co['7b'] = { x: rt, y: tags.SEC.y + tags.SEC.h + 22, tx: wx + 60, ty: tags.SEC.y + tags.SEC.h + 18 };

  return {
    layout: 'phone', W, H, ox: 0, fs,
    form, spineX, recs, tags, hex, pills, report, cell,
    head: { x: x0, y: HEADING_Y, w: tw },
    x87: [wx + 90, tags.F.y + tags.F.h + 13], x65: [recs[1].x + recs[1].w - 8, recs[1].y + 14],
    srcid: sr, legend: { x: x0, y: 366, w: tw },
    invented: [bookRight - 44, dBottom + 9],
    ghostDx, ghostDy,
    thrF, thrL, thrC, thrI, fan, lnkC, lnkI, lnkD, lnkB, lnkSec, thrP, repP2, repP3, leadSrc,
    spine, ticks, stub, t1, bkT1, bkT1r2: row2Tick, row2Tick, co,
    view: [
      [form.y - 4, form.y + form.h + 8],
      [recs[0].y - 12, 417],
      [tags.F.y - 14, tags.C.y + 56],
      [L.y - 6, tags.I.y + tags.I.h + 30],
      [L.y - 6, sr.y + sr.h + 34],
      [recs[0].y - 12, tags.F.y + 44],
      [HEADING_Y - 24, pills[1].y + pills[1].h + 10],
      [report.y - 30, report.y + report.h + 8],
    ],
    tipAnchors: {
      thrF: [lane.F, (rc(0) + cy(tags.F)) / 2], thrL: [lane.L, (rc(1) + cy(tags.L)) / 2],
      lnkC: [bx(1), (lnkC.a[1] + lnkC.b[1]) / 2], lnkI: [bx(2), (lnkI.a[1] + lnkI.b[1]) / 2], lnkD: [bx(3), (lnkD.a[1] + lnkD.b[1]) / 2], lnkB: [bx(4), (lnkB.a[1] + lnkB.b[1]) / 2],
    },
  };
}
export { r1 as _r1, segsOf as _segsOf };
