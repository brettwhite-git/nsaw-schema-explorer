// The drawn vocabulary for version B (and the pieces C borrows): each object is recognisable without its label.
//   the order      a paper form with a ragged edge where its lines were torn off
//   a line         a strip torn from that form
//   the customer   a name card with a person on it and a punched slot
//   the item       a taped parcel with a tag
//   a report       a printed sheet with a big number and a folded corner
// Every function draws at the coordinates given and returns the anchors (eyelets) a string can be tied to.
import { el } from '../../ink/svg';
import { Pen, bbox, circD, monoW, ptsD, rectPts, roundPts, tornPts, type Pt, type Tier, type Tone } from './kit';

const INK2 = 'var(--ink-2)';
const ACC = 'var(--accent)';

/** text with differently coloured runs: [text, 'accent'?] */
export function rich(p: Pen, parent: Element, x: number, y: number, parts: [string, ('accent' | 'ink2')?][], size: number, o: { anchor?: 'start' | 'middle' | 'end'; face?: 'serif' | 'mono'; weight?: number; fill?: string } = {}): void {
  const fam = (o.face ?? 'serif') === 'mono' ? 'var(--mono)' : 'var(--serif)';
  const t = el('text', { x, y, 'text-anchor': o.anchor ?? 'start' }, parent);
  t.setAttribute('style', `font-family:${fam};font-size:${size}px;font-weight:${o.weight ?? 400};fill:${o.fill ?? INK2};`);
  for (const [s, k] of parts) {
    const ts = el('tspan', {}, t);
    ts.textContent = s;
    if (k === 'accent') ts.setAttribute('style', `fill:${ACC};`);
  }
  void p;
}

/* ---------------------------------------------------------------- the order */

export interface OrderOpts { tier: Tier; rows: { y: number; h: number }[]; text?: boolean; bite?: number }
export interface OrderAnchors { rowEyelets: Pt[]; customer: Pt; box: { x: number; y: number; w: number; h: number } }

export function orderSheet(p: Pen, parent: Element, x: number, y: number, w: number, h: number, o: OrderOpts): OrderAnchors {
  const bite = o.bite ?? 14;
  const pts: Pt[] = [[x, y], [x + w, y]];
  o.rows.forEach((r, i) => {
    pts.push([x + w, r.y]);
    const z = tornPts([x + w - bite, r.y + 2], [x + w - bite, r.y + r.h - 2], 9, 6, 500 + i * 31, -1);
    pts.push(...z);
    pts.push([x + w, r.y + r.h]);
  });
  pts.push([x + w, y + h], [x, y + h]);
  const g = p.g(parent);
  p.solid(g, pts, o.tier, 'ink');
  // the perforation: dashes across the sheet above and below each torn row
  for (const r of o.rows) {
    p.hair(g, `M${x + 12} ${r.y - 1}H${x + w - bite - 2}`, { dash: '3 4', op: 0.8 });
    p.hair(g, `M${x + 12} ${r.y + r.h + 1}H${x + w - bite - 2}`, { dash: '3 4', op: 0.8 });
  }
  const rowEyelets: Pt[] = o.rows.map((r) => p.eyelet(g, x + w - bite - 28, r.y + r.h / 2, 'support'));
  let customer: Pt = [x + w - 34, y + 189];
  if (o.text !== false) {
    p.text(g, x + 26, y + 40, 'SALES ORDER', { size: 14, face: 'mono', weight: 500, fill: INK2, track: 0.12 });
    p.text(g, x + 26, y + 90, 'SO1041', { size: 34, face: 'mono', weight: 600 });
    p.text(g, x + 26, y + 120, '2026-03-04', { size: 16, face: 'mono', fill: INK2 });
    p.hair(g, `M${x + 26} ${y + 138}H${x + w - 36}`, { op: 0.5 });
    p.text(g, x + 26, y + 168, 'Customer', { size: 18, fill: INK2 });
    p.stroke(g, ptsD(rectPts(x + 26, y + 176, 208, 28)), 'ghost', 'ink');
    customer = p.eyelet(g, x + w - 38, y + 190, 'support');
  }
  return { rowEyelets, customer, box: { x, y, w, h } };
}

/* ------------------------------------------------------------------ a line */

export interface StripOpts { tier: Tier; tone?: Tone; label: string; item: string; amount: string; sys?: boolean; eyeL?: boolean; eyeR?: boolean; text?: boolean }
export function strip(p: Pen, parent: Element, x: number, y: number, w: number, h: number, o: StripOpts): { left: Pt; right: Pt } {
  const tone = o.tone ?? 'ink';
  const torn = tornPts([x, y + h], [x, y], 9, 6, 700 + Math.round(y), 1);
  const pts: Pt[] = [[x + 6, y], [x + w, y], [x + w, y + h], ...torn.slice(0, -1)];
  const g = p.g(parent);
  p.solid(g, pts, o.tier, tone);
  const left = o.eyeL === false ? ([x + 18, y + h / 2] as Pt) : p.eyelet(g, x + 24, y + h / 2, o.tier, tone, 6);
  const right = o.eyeR ? p.eyelet(g, x + w - 22, y + h / 2, o.tier, tone, 6) : ([x + w - 22, y + h / 2] as Pt);
  if (o.text !== false) {
    const rEdge = x + w - (o.eyeR ? 48 : 22);
    const col = tone === 'accent' ? ACC : 'var(--ink)';
    p.text(g, x + 50, y + 42, o.label, { size: 26, weight: 700, fill: col });
    p.text(g, rEdge, y + 42, o.amount, { size: 28, face: 'mono', weight: 600, anchor: 'end', fill: col });
    p.hair(g, `M${x + 50} ${y + 56}H${rEdge}`, { op: 0.4, colour: tone === 'accent' ? ACC : 'var(--ink)' });
    p.text(g, x + 50, y + 80, o.item, { size: 18, fill: INK2 });
    if (o.sys) p.text(g, rEdge, y + 80, 'TransactionLine', { size: 14, face: 'mono', anchor: 'end', fill: INK2 });
  }
  return { left, right };
}

/* ------------------------------------------------------------ the customer */

export function customerCard(p: Pen, parent: Element, x: number, y: number, w: number, h: number, tier: Tier, text = true): { eyelet: Pt } {
  const g = p.g(parent);
  p.solid(g, roundPts(x, y, w, h, 14), tier, 'ink');
  // the slot a lanyard would pass through
  const sx = x + w / 2;
  p.stroke(g, ptsD(roundPts(sx - 22, y + 12, 44, 12, 6)), 'ghost', 'ink');
  p.person(g, x + 76, y + 84, 40, tier);
  p.hair(g, `M${x + 126} ${y + 38}V${y + h - 26}`, { op: 0.35 });
  if (text) {
    p.text(g, x + 142, y + 76, 'Harbor', { size: 21, weight: 600 });
    p.text(g, x + 142, y + 104, 'Supply Co.', { size: 21, weight: 600 });
    p.text(g, x + 142, y + 130, 'id 88', { size: 15, face: 'mono', fill: INK2 });
  }
  const eyelet = p.eyelet(g, x + 24, y + h - 30, 'support', 'ink', 6);
  return { eyelet };
}

/* ------------------------------------------------------------------ the item */

export function parcel(p: Pen, parent: Element, x: number, y: number, w: number, h: number, tier: Tier): { tag: Pt; box: { x0: number; y0: number; x1: number; y1: number } } {
  const dx = 50, dy = -32;
  const g = p.g(parent);
  const front: Pt[] = rectPts(x, y, w, h);
  const top: Pt[] = [[x, y], [x + dx, y + dy], [x + w + dx, y + dy], [x + w, y]];
  const side: Pt[] = [[x + w, y], [x + w + dx, y + dy], [x + w + dx, y + dy + h], [x + w, y + h]];
  // side face: shade
  const sd = ptsD(side);
  p.fill(g, sd);
  p.hatch(g, sd, bbox(side), 45, 3.6, 0.7);
  p.stroke(g, sd, tier);
  // top face
  const td = ptsD(top);
  p.fill(g, td);
  p.stroke(g, td, tier);
  // front face
  const fd = ptsD(front);
  p.fill(g, fd);
  p.stroke(g, fd, tier);
  // packing tape: two parallel lines over the top, down the front
  const t0 = w * 0.42, t1 = w * 0.58;
  p.hair(g, `M${x + t0} ${y + h}V${y}L${x + t0 + dx} ${y + dy}`, { w: 1.1, op: 0.9 });
  p.hair(g, `M${x + t1} ${y + h}V${y}L${x + t1 + dx} ${y + dy}`, { w: 1.1, op: 0.9 });
  p.hair(g, `M${x + t0 + 7} ${y + 8}V${y + h - 6}`, { op: 0.4, dash: '2 5' });
  // a hang tag at the left edge, tilted, with a punched hole
  const tg = p.g(g, { transform: `rotate(-14 ${x + 4} ${y + 40})` });
  const tag: Pt[] = [[x - 30, y + 34], [x + 22, y + 34], [x + 34, y + 52], [x + 22, y + 70], [x - 30, y + 70]];
  p.solid(tg, tag, tier === 'ghost' ? 'ghost' : 'support', 'ink', { shade: [3, 3] });
  const hole = p.eyelet(tg, x - 14, y + 52, 'support', 'ink', 4.5);
  // map the tilted hole back to page space
  const a = (-14 * Math.PI) / 180, cx = x + 4, cy = y + 40;
  const rx = cx + (hole[0] - cx) * Math.cos(a) - (hole[1] - cy) * Math.sin(a);
  const ry = cy + (hole[0] - cx) * Math.sin(a) + (hole[1] - cy) * Math.cos(a);
  return { tag: [rx, ry], box: { x0: x - 40, y0: y + dy, x1: x + w + dx, y1: y + h } };
}

/* ------------------------------------------------------------------ a report */

export interface ReportOpts { tier: Tier; title: string; number: string; reason: [string, ('accent' | 'ink2')?][]; counted: [number, number]; text?: boolean }
export function report(p: Pen, parent: Element, x: number, y: number, w: number, h: number, o: ReportOpts): { tie: Pt } {
  const ear = 34;
  const pts: Pt[] = [[x, y], [x + w - ear, y], [x + w, y + ear], [x + w, y + h], [x, y + h]];
  const g = p.g(parent);
  p.solid(g, pts, o.tier, 'ink');
  const fold: Pt[] = [[x + w - ear, y], [x + w - ear, y + ear], [x + w, y + ear]];
  p.fill(g, ptsD(fold));
  p.hatch(g, ptsD(fold), bbox(fold), 135, 3.6, 0.6);
  p.stroke(g, ptsD(fold), 'support', 'ink');
  // a pictogram of what is counted: the order's two lines as little slips in proportion to their amounts;
  // counted ones are shaded, the rest are drawn dashed. It says the same thing as the words, without them.
  const bx = x + 22, by = y + 62, bw = w - 44, w1 = Math.round(bw * 0.8) - 3, w2 = bw - w1 - 6;
  const slips: [number, number, number, 'accent' | 'ink'][] = [[bx, w1, o.counted[0], 'accent'], [bx + w1 + 6, w2, o.counted[1], 'ink']];
  for (const [sx, sw, frac, tone] of slips) {
    const r = rectPts(sx, by, sw, 22), rd = ptsD(r);
    if (frac > 0) {
      p.hatch(g, rd, { x0: sx, y0: by, x1: sx + sw * frac, y1: by + 22 }, 45, 3.6, 0.75);
      p.stroke(g, rd, 'support', tone);
    } else {
      p.stroke(g, rd, 'ghost', tone, { dash: '3 3' });
    }
  }
  if (o.text !== false) {
    p.text(g, x + 22, y + 42, o.title, { size: 21, weight: 700 });
    p.text(g, x + w / 2, y + 150, o.number, { size: 52, face: 'mono', weight: 600, anchor: 'middle' });
    p.hair(g, `M${x + 22} ${y + 176}H${x + w - 22}`, { op: 0.5 });
    rich(p, g, x + w / 2, y + 210, o.reason, 20, { anchor: 'middle' });
  }
  const tie = p.eyelet(g, x + w / 2, y + h - 15, 'support', 'ink', 5);
  return { tie };
}

/** a whole-object demo for the object sheet: draws one object at the origin and says how big it is */
export interface Demo { name: string; sys: string; draw(p: Pen, g: SVGGElement, small: boolean): { x0: number; y0: number; x1: number; y1: number } }
export const DEMOS: Demo[] = [
  { name: 'the order', sys: 'Transactions', draw: (p, g, s) => { orderSheet(p, g, 0, 0, 300, 430, { tier: 'support', rows: [{ y: 250, h: 80 }, { y: 342, h: 80 }], text: !s }); return { x0: -4, y0: -4, x1: 310, y1: 440 }; } },
  { name: 'a line', sys: 'TransactionLine', draw: (p, g, s) => { strip(p, g, 0, 0, 360, 96, { tier: 'subject', tone: 'accent', label: 'line 1', item: 'Pallet jack', amount: '1,240.00', sys: true, eyeR: true, text: !s }); return { x0: -4, y0: -4, x1: 368, y1: 104 }; } },
  { name: 'the customer', sys: 'customer', draw: (p, g, s) => { customerCard(p, g, 0, 0, 270, 150, 'support', !s); return { x0: -4, y0: -4, x1: 280, y1: 160 }; } },
  { name: 'the item', sys: 'item', draw: (p, g) => { parcel(p, g, 40, 40, 150, 130, 'support'); return { x0: 0, y0: 4, x1: 246, y1: 178 }; } },
  { name: 'a report', sys: 'report', draw: (p, g, s) => { report(p, g, 0, 0, 300, 250, { tier: 'support', title: 'Counted when shipped', number: '1,240.00', reason: [['only ', 'ink2'], ['line 1', 'accent'], [' has shipped', 'ink2']], counted: [1, 0], text: !s }); return { x0: -4, y0: -4, x1: 310, y1: 260 }; } },
  { name: 'a tie', sys: 'pointer', draw: (p, g) => {
    const a = p.eyelet(g, 20, 40, 'support'), b = p.eyelet(g, 180, 40, 'support');
    p.string(g, a, b, 'support', 'ink', 36);
    return { x0: 0, y0: 14, x1: 200, y1: 80 };
  } },
];
export { circD, monoW };
