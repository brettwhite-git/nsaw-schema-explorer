// Frame 1: "One order is really several records." Versions B (recognisable objects) and C (card-index cabinet).
import { Pen, ptsD, rectPts, roundPts, tornPts, bbox, type Pt } from './kit';
import { customerCard, orderSheet, parcel, strip } from './objects';

const INK2 = 'var(--ink-2)';

export function headline(p: Pen, g: Element, s: string, y = 104): void { p.text(g, 80, y, s, { size: 46, weight: 700 }); }
export function caption(p: Pen, g: Element, s: string, y = 712): void { p.text(g, 80, y, s, { size: 24, italic: true, fill: INK2 }); }

/** three tiny numbered pins in a corner (the only furniture allowed in these stills) */
export function pins(p: Pen, g: Element, active: number): void {
  [0, 1, 2].forEach((i) => {
    const cx = 1120 - (2 - i) * 24, cy = 62;
    p.stroke(g, `M${cx - 8} ${cy}A8 8 0 1 0 ${cx + 8} ${cy}A8 8 0 1 0 ${cx - 8} ${cy}Z`, i === active ? 'support' : 'ghost');
    p.text(g, cx, cy + 4, String(i + 1), { size: 11, face: 'mono', anchor: 'middle', fill: INK2 });
  });
}

/* ================================================================== B */
export function f1b(p: Pen, root: SVGGElement): void {
  headline(p, root, 'One order is really several records.');
  const g = p.g(root);

  // back to front: ties first so objects sit over them
  const SX = 90, SY = 150, SW = 300, SH = 430;
  const rows = [{ y: 372, h: 92 }, { y: 482, h: 92 }];

  // customer card (support) and its tie to the order
  const cust = customerCard(p, g, 850, 150, 270, 150, 'support');
  // the order
  const ord = orderSheet(p, g, SX, SY, SW, SH, { tier: 'support', rows });
  // line 2: ghost
  const gl = p.ghost(g);
  const l2 = strip(p, gl, 440, 482, 360, 92, { tier: 'ghost', label: 'line 2', item: 'Shrink wrap', amount: '310.50', eyeR: true });
  p.string(gl, ord.rowEyelets[1], l2.left, 'ghost', 'ink', 10);
  // line 1: the subject, amber
  const l1 = strip(p, g, 440, 372, 360, 92, { tier: 'subject', tone: 'accent', label: 'line 1', item: 'Pallet jack', amount: '1,240.00', sys: true, eyeR: true });
  // the item
  const it = parcel(p, g, 890, 450, 150, 130, 'support');

  // ties
  p.string(g, ord.rowEyelets[0], l1.left, 'subject', 'accent', 12, 1.8);
  p.string(g, l1.right, it.tag, 'subject', 'accent', 22, 1.8);
  p.string(g, ord.customer, cust.eyelet, 'support', 'ink', 34, 1.2);

  // plain words first, the system's own name small beneath
  const lab = (x: number, y: number, plain: string, sys: string): void => {
    p.text(g, x, y, plain, { size: 26, weight: 600, anchor: 'middle' });
    p.text(g, x, y + 24, sys, { size: 15, face: 'mono', anchor: 'middle', fill: INK2 });
  };
  lab(SX + SW / 2, 628, 'the order', 'Transactions');
  lab(985, 628, 'the item', 'item');
  lab(985, 344, 'the customer', 'customer');
  p.text(g, 620, 628, 'its lines', { size: 26, weight: 600, anchor: 'middle' });
  p.text(g, 620, 652, 'TransactionLine', { size: 15, face: 'mono', anchor: 'middle', fill: INK2 });
  caption(p, g, 'Tied together with string. Nothing is copied.');
  pins(p, root, 1);
}

/* ================================================================== C */

interface Drawer { y: number; word: string; sys: string; open?: boolean }

/** the cabinet: front elevation with an oblique top and side, four labelled drawers, some pulled out */
function cabinet(p: Pen, g: Element, x: number, y: number, w: number, h: number): { custEye: Pt; box: { x0: number; y0: number; x1: number; y1: number } } {
  const d: Pt = [52, -34];
  // body: side and top faces, then the front
  const side: Pt[] = [[x + w, y], [x + w + d[0], y + d[1]], [x + w + d[0], y + d[1] + h], [x + w, y + h]];
  const top: Pt[] = [[x, y], [x + d[0], y + d[1]], [x + w + d[0], y + d[1]], [x + w, y]];
  const sd = ptsD(side), td = ptsD(top);
  p.fill(g, sd); p.hatch(g, sd, bbox(side), 45, 3.6, 0.7); p.stroke(g, sd, 'support');
  p.fill(g, td); p.stroke(g, td, 'support');
  const fd = ptsD(rectPts(x, y, w, h));
  p.fill(g, fd); p.stroke(g, fd, 'support');
  // plinth line
  p.hair(g, `M${x + 6} ${y + h - 8}H${x + w - 6}`, { op: 0.5 });
  // a stack of papers on top, for scale
  const drawers: Drawer[] = [
    { y: y + 14, word: 'orders', sys: 'Transactions' },
    { y: y + 138, word: 'lines', sys: 'TransactionLine', open: true },
    { y: y + 262, word: 'customers', sys: 'customer', open: true },
    { y: y + 386, word: 'items', sys: 'item' },
  ];
  const PW = w - 28, PH = 84, PX = x + 14;
  const panel = (dy: number, dx: number, dr: Drawer): void => {
    const px = PX + dx, py = dr.y + dy;
    const rd = ptsD(roundPts(px, py, PW, PH, 4, 2));
    p.fill(g, rd); p.stroke(g, rd, 'support');
    // label holder: a small plate with a frame
    const plate = rectPts(px + PW / 2 - 100, py + 8, 200, 48);
    p.fill(g, ptsD(plate), 'var(--paper)');
    p.stroke(g, ptsD(plate), 'support');
    p.stroke(g, ptsD(rectPts(px + PW / 2 - 95, py + 12, 190, 40)), 'ghost');
    p.text(g, px + PW / 2, py + 31, dr.word, { size: 23, weight: 600, anchor: 'middle' });
    p.text(g, px + PW / 2, py + 47, dr.sys, { size: 14, face: 'mono', anchor: 'middle', fill: INK2 });
    // the pull
    p.stroke(g, ptsD(roundPts(px + PW / 2 - 34, py + 64, 68, 11, 5, 2)), 'support');
  };
  const dd = (i: number): Drawer => drawers[i];
  // closed drawers first, then open ones over them
  panel(0, 0, dd(0));
  panel(0, 0, dd(3));
  let custEye: Pt = [x, y];
  // open drawers: pulled toward the viewer, cards standing in them
  const pull: Pt = [-34, 24];
  const openDrawer = (i: number, raise: number, cardLabels: string[], raisedIdx: number): Pt => {
    const dr = dd(i);
    const px = PX + pull[0], py = dr.y + pull[1];
    const dep: Pt = [34, -22];
    // the opening (inside of the drawer), hatched for shade
    const op: Pt[] = [[px, py], [px + dep[0], py + dep[1]], [px + PW + dep[0], py + dep[1]], [px + PW, py]];
    const od = ptsD(op);
    p.fill(g, od); p.hatch(g, od, bbox(op), 135, 3.6, 0.55); p.stroke(g, od, 'support');
    // outer right wall
    const rw: Pt[] = [[px + PW, py], [px + PW + dep[0], py + dep[1]], [px + PW + dep[0], py + dep[1] + PH - 4], [px + PW, py + PH]];
    const rd = ptsD(rw);
    p.fill(g, rd); p.hatch(g, rd, bbox(rw), 45, 3.6, 0.7); p.stroke(g, rd, 'support');
    // cards, back to front
    let eye: Pt = [px, py];
    for (let k = cardLabels.length - 1; k >= 0; k--) {
      const lift = k === raisedIdx ? raise : 0;
      const cx = px + 12 + k * 7, cy = py - 22 - k * 7 - lift, cw = PW - 36, ch = 60;
      const cd = ptsD(rectPts(cx, cy, cw, ch));
      p.fill(g, cd);
      p.stroke(g, cd, k === raisedIdx ? 'support' : 'ghost', 'ink');
      // tab
      const tw = 78, tx = cx + 16 + (k % 3) * 70;
      if (k > 0) {
        const tab = rectPts(tx, cy - 12, tw, 12);
        p.fill(g, ptsD(tab));
        p.stroke(g, ptsD(tab), k === raisedIdx ? 'support' : 'ghost', 'ink');
      }
      if (cardLabels[k]) p.text(g, cx + 14, cy + 26, cardLabels[k], { size: 19, weight: 600 });
      if (k === raisedIdx) eye = [cx, cy + 24];
    }
    // front panel, last
    panel(pull[1], pull[0], dr);
    return eye;
  };
  openDrawer(1, 0, ['', '', ''], -1);
  custEye = openDrawer(2, 30, ['', 'Harbor Supply Co.  88', ''], 1);
  return { custEye, box: { x0: x - 40, y0: y + d[1], x1: x + w + d[0], y1: y + h } };
}

export function f1c(p: Pen, root: SVGGElement): void {
  headline(p, root, 'One order, filed as separate cards.');
  const g = p.g(root);
  const cab = cabinet(p, g, 700, 200, 270, 484);

  // the line card: torn from the form at its top edge, held at the left
  const cx = 90, cy = 236, cw = 350, ch = 236;
  const lg = p.g(g, { transform: `rotate(-2.5 ${cx + cw / 2} ${cy + ch / 2})` });
  const torn = tornPts([cx, cy], [cx + cw, cy], 10, 6, 91, -1);
  const card: Pt[] = [...torn, [cx + cw, cy + ch], [cx, cy + ch]];
  p.solid(lg, card, 'subject', 'accent');
  // ruled lines
  for (let i = 0; i < 3; i++) p.hair(lg, `M${cx + 22} ${cy + 66 + i * 42}H${cx + cw - 22}`, { op: 0.28, colour: 'var(--accent)' });
  p.text(lg, cx + 28, cy + 56, 'line 1', { size: 36, weight: 700, fill: 'var(--accent)' });
  p.text(lg, cx + 28, cy + 100, 'Pallet jack', { size: 24, fill: INK2 });
  p.text(lg, cx + cw - 26, cy + 140, '1,240.00', { size: 38, face: 'mono', weight: 600, anchor: 'end', fill: 'var(--accent)' });
  p.text(lg, cx + 28, cy + ch - 26, 'TransactionLine', { size: 14, face: 'mono', fill: INK2 });
  p.stroke(lg, `M${cx + cw / 2 + 4} ${cy + ch - 20}m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0`, 'support', 'accent');

  // the slip clipped under it: where to look, not a copy
  const sx = 120, sy = cy + ch + 4, sw = 300, sh = 96;
  const sg = p.g(g, { transform: `rotate(1.5 ${sx + sw / 2} ${sy + sh / 2})` });
  p.solid(sg, rectPts(sx, sy, sw, sh), 'support', 'ink', { shade: [4, 4] });
  p.text(sg, sx + 22, sy + 38, 'Customer: see card 88', { size: 22, weight: 600 });
  p.text(sg, sx + 22, sy + 70, 'in the customers drawer', { size: 19, fill: INK2 });
  // paper clip
  p.stroke(sg, `M${sx + 250} ${sy - 18}v34a7 7 0 0 0 14 0v-30a4.5 4.5 0 0 0 -9 0v28`, 'support', 'ink', { rough: 0.2 });
  const se = p.eyelet(sg, sx + sw - 22, sy + sh - 24, 'support', 'ink', 6);
  // the tie from the slip to the customer's card
  const a: Pt = [se[0] + 4, se[1] + 2];
  p.string(g, a, cab.custEye, 'subject', 'accent', 46, 1.8);

  caption(p, g, 'The card holds a slip, not a copy of the customer.');
  pins(p, root, 1);
}
