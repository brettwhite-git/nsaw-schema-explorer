// Frame 2: "Why do we each have a different number?" Versions B (three reports) and C (three measuring tapes).
// Illustrative numbers, consistent with the order SO1041 (line 1 Pallet jack 1,240.00; line 2 Shrink wrap 310.50):
//   ordered   1,550.50  both lines are in
//   shipped   1,240.00  only line 1 has shipped
//   invoiced    620.00  half of line 1 is billed so far (a deposit invoice)
import { Pen, circD, fmt, ptsD, rectPts, roundPts, tornPts, bbox, type Pt } from './kit';
import { caption, headline, pins } from './f1';
import { orderSheet, report, rich, strip } from './objects';

const INK2 = 'var(--ink-2)';
const ACC = 'var(--accent)';
export const NUMBERS = { ordered: '1,550.50', shipped: '1,240.00', invoiced: '620.00' } as const;

/* ================================================================== B */
export function f2b(p: Pen, root: SVGGElement): void {
  headline(p, root, 'Three people can each be right.', 92);
  const g = p.g(root);
  const RW = 300, RH = 250, RY = 140;
  const xs = [80, 450, 820];
  // the one order they all read, below
  const OX = 420, OY = 490, OW = 360, OH = 160;
  const ord = p.g(g);
  const tops: Pt[] = [[OX + 70, OY - 8], [OX + OW / 2, OY - 8], [OX + OW - 70, OY - 8]];

  const reps = [
    report(p, g, xs[0], RY, RW, RH, { tier: 'subject', title: 'Counted when ordered', number: '1,550.50', reason: [['line 1', 'accent'], [' and line 2 are in', 'ink2']], counted: [1, 1] }),
    report(p, g, xs[1], RY, RW, RH, { tier: 'subject', title: 'Counted when shipped', number: '1,240.00', reason: [['only ', 'ink2'], ['line 1', 'accent'], [' has shipped', 'ink2']], counted: [1, 0] }),
    report(p, g, xs[2], RY, RW, RH, { tier: 'subject', title: 'Counted when invoiced', number: '620.00', reason: [['half of ', 'ink2'], ['line 1', 'accent'], [' is billed', 'ink2']], counted: [0.5, 0] }),
  ];

  // the order: a smaller form with its two lines on it
  const pts: Pt[] = rectPts(OX, OY, OW, OH);
  p.solid(ord, pts, 'support', 'ink');
  p.text(ord, OX + 26, OY + 66, 'SO1041', { size: 28, face: 'mono', weight: 600 });
  p.hair(ord, `M${OX + 26} ${OY + 78}H${OX + OW - 26}`, { op: 0.5 });
  p.text(ord, OX + 26, OY + 108, 'line 1', { size: 24, weight: 700, fill: ACC });
  p.text(ord, OX + OW - 26, OY + 108, '1,240.00', { size: 26, face: 'mono', weight: 600, anchor: 'end', fill: ACC });
  p.hair(ord, `M${OX + 26} ${OY + 118}H${OX + OW - 26}`, { op: 0.4, colour: ACC });
  p.text(ord, OX + 26, OY + 144, 'line 2', { size: 22, fill: INK2 });
  p.text(ord, OX + OW - 26, OY + 144, '310.50', { size: 24, face: 'mono', anchor: 'end', fill: INK2 });
  const eyes = tops.map((t) => p.eyelet(ord, t[0], t[1] + 22, 'support', 'ink', 5));

  // the strings: the same records, read three ways
  reps.forEach((r, i) => p.string(g, eyes[i], r.tie, 'support', 'ink', i === 1 ? 0 : (i === 0 ? -20 : 20), 1.2));

  p.text(g, OX + OW / 2, 692, 'the same order', { size: 26, weight: 600, anchor: 'middle' });
  p.text(g, OX + OW / 2, 716, 'Transactions + TransactionLine', { size: 15, face: 'mono', anchor: 'middle', fill: INK2 });
  pins(p, root, 1);
}

/* ================================================================== C */

/** a measuring tape: case at the left, tape out to its stop mark, an end hook, ticks every 50 currency units */
function tape(p: Pen, g: Element, y: number, x0: number, k: number, stop: number, word: string): void {
  const x1 = x0 + stop * k;
  const TH = 58;
  // the tape body
  const body = rectPts(x0, y, x1 - x0, TH);
  const bd = ptsD(body);
  p.fill(g, bd);
  p.hatch(g, ptsD(rectPts(x0, y + TH - 7, x1 - x0, 7)), { x0, y0: y + TH - 7, x1, y1: y + TH }, 45, 3.6, 0.6);
  p.stroke(g, bd, 'support');
  // ticks
  for (let v = 0; v <= stop + 0.1; v += 50) {
    const x = x0 + v * k;
    const major = v % 500 === 0, mid = v % 100 === 0;
    const len = major ? 20 : mid ? 12 : 7;
    p.hair(g, `M${fmt(x)} ${y}V${fmt(y + len)}`, { w: major ? 1.1 : 0.8, op: 0.85 });
    if (major && x1 - x > 50) p.text(g, x + 4, y + 38, v === 0 ? '0' : v.toLocaleString('en-US'), { size: 14, face: 'mono', fill: INK2 });
  }
  // the end hook
  const hk = ptsD(rectPts(x1 - 2, y - 12, 9, TH + 24));
  p.fill(g, hk); p.stroke(g, hk, 'support');
  // the case
  const cx = x0 - 118, cw = 118, chh = TH + 18, cy = y - 9;
  const cd = ptsD(roundPts(cx, cy, cw, chh, 10, 3));
  p.fill(g, cd);
  p.hatch(g, cd, { x0: cx + cw - 12, y0: cy, x1: cx + cw, y1: cy + chh }, 45, 3.6, 0.6);
  p.stroke(g, cd, 'support');
  p.text(g, cx + cw / 2 - 5, y + 35, word, { size: 23, weight: 700, anchor: 'middle' });
}

export function f2c(p: Pen, root: SVGGElement): void {
  headline(p, root, 'Same order. Three ways to measure it.', 92);
  const g = p.g(root);
  const X0 = 190, K = 0.5;
  const sx = (v: number): number => X0 + v * K;
  const BY = 190, BH = 96;
  const stops = [
    { y: 366, v: 1550.5, word: 'ordered', num: NUMBERS.ordered, why: 'both lines placed' },
    { y: 486, v: 1240, word: 'shipped', num: NUMBERS.shipped, why: 'only line 1 has shipped' },
    { y: 606, v: 620, word: 'invoiced', num: NUMBERS.invoiced, why: 'half of line 1 billed' },
  ];
  // the plumb lines first: where each tape stops, behind everything
  for (const s of stops) p.hair(g, `M${fmt(sx(s.v))} ${BY + BH}V${s.y}`, { dash: '3 5', w: 0.8, op: 0.7 });
  // the order, laid flat: two slips end to end, in proportion to their amounts
  p.text(g, X0, BY - 18, 'the order', { size: 26, weight: 600 });
  p.text(g, sx(1550.5), BY - 18, 'Transactions', { size: 15, face: 'mono', anchor: 'end', fill: INK2 });
  const w1 = 1240 * K;
  const s1 = strip(p, g, X0, BY, w1, BH, { tier: 'subject', tone: 'accent', label: 'line 1', item: 'Pallet jack', amount: '1,240.00', sys: true, eyeL: false, text: false });
  void s1;
  // line 1 slip, drawn with its own contents so the half mark can sit inside it
  p.text(g, X0 + 26, BY + 42, 'line 1', { size: 26, weight: 700, fill: ACC });
  p.text(g, X0 + 26, BY + 76, 'Pallet jack', { size: 18, fill: INK2 });
  p.text(g, X0 + w1 - 22, BY + 50, '1,240.00', { size: 34, face: 'mono', weight: 600, anchor: 'end', fill: ACC });
  p.text(g, X0 + w1 - 22, BY + 78, 'TransactionLine', { size: 14, face: 'mono', anchor: 'end', fill: INK2 });
  p.hair(g, `M${fmt(sx(620))} ${BY + 6}V${BY + BH - 6}`, { dash: '3 5', w: 1.1, op: 0.9, colour: ACC });
  // line 2 slip
  const w2 = 310.5 * K;
  strip(p, g, X0 + w1 + 6, BY, w2 - 6, BH, { tier: 'support', label: '', item: '', amount: '', eyeL: false, text: false });
  p.text(g, X0 + w1 + 24, BY + 42, 'line 2', { size: 22, weight: 600 });
  p.text(g, X0 + w1 + 24, BY + 78, '310.50', { size: 26, face: 'mono', weight: 600 });

  for (const s of stops) {
    tape(p, g, s.y, X0, K, s.v, s.word);
    const nx = sx(s.v) + 22;
    p.text(g, nx, s.y + 32, s.num, { size: 32, face: 'mono', weight: 600 });
    p.text(g, nx, s.y + 58, s.why, { size: 19, fill: INK2 });
  }
  caption(p, g, 'Each one is right. They stop at different marks.', 722);
  pins(p, root, 1);
  void rich; void tornPts; void circD; void orderSheet; void bbox;
}
