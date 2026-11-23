// The object vocabulary of style C (DESIGN.md section 8): everyday things that are recognisable without their label.
// Every object is a parametric drawing function with fixed seeds. It draws into local coordinates (origin top-left of its
// box) at scale 1; the scene moves, scales and dims it. Three weight levels are drawn in (subject 2.0, support 1.1,
// ghost 0.6); a receded object is the same drawing scaled down and dimmed. Solid paper-2 fill, hatched edge, no arrows.
//
// Pieces of an object that change over a scene carry data-k="name" (opacity follows props[name]; data-k="!name" is the
// inverse). data-r marks what a draw-in reveals: s = stroke (dashed in), f = fill/shade (fades), t = text (fades).
import { Pen, WEIGHT, bbox, circD, fmt, ptsD, rectPts, roundPts, tornPts, type Pt, type Tone } from './kit';

export * from './kit';
export const INK2 = 'var(--ink-2)';
export const ACC = 'var(--accent)';

/** type sizes for a room (design px on the 1200-wide stage) */
export const TYPE = { headline: 46, primary: 26, label: 26, secondary: 16, body: 18, big: 28 } as const;

export type Kind = 'form' | 'orderCard' | 'lineCard' | 'customerCard' | 'itemCard' | 'slip' | 'cabinet' | 'drawer' | 'calendar' | 'tape' | 'barSlip' | 'parcel';
export type Spec = Record<string, unknown>;
export interface KindDef {
  size(s: Spec): { w: number; h: number };
  draw(p: Pen, g: SVGGElement, s: Spec): void;
  anchors(s: Spec): Record<string, Pt>;
}

export const FORM = { w: 340, headH: 300, lineH: 112 } as const;
export const CAB = { w: 270, h: 484, dx: 52, dy: -34, pw: 242, ph: 84, pitch: 124, px: 14, py: 14, pull: [-34, 24] as Pt };
export const TAPE = { K: 0.45, caseW: 118, caseH: 76 };
export const NAMES = { old: 'Harbor Supply Co.', now: 'Harbor Supply Inc.' };
const str = (s: Spec, k: string, d = ''): string => (typeof s[k] === 'string' ? (s[k] as string) : d);
const num = (s: Spec, k: string, d = 0): number => (typeof s[k] === 'number' ? (s[k] as number) : d);

/** a labelled "plain word, system name beneath" pair, centred at cx */
function label(p: Pen, g: Element, cx: number, y: number, plain: string, sys: string, key = 'label'): void {
  const k = p.g(g, { 'data-k': key });
  p.text(k, cx, y, plain, { size: TYPE.primary, weight: 600, anchor: 'middle' });
  p.text(k, cx, y + 24, sys, { size: TYPE.secondary, face: 'mono', anchor: 'middle', fill: INK2 });
}

function headerContent(p: Pen, g: Element, o: { slip?: boolean }): void {
  p.text(g, 28, 40, 'SALES ORDER', { size: TYPE.secondary, face: 'mono', weight: 500, fill: INK2, track: 0.12 });
  p.text(g, 28, 92, 'SO1041', { size: 38, face: 'mono', weight: 600 });
  p.text(g, 28, 124, '2026-03-04', { size: 16, face: 'mono', fill: INK2 });
  p.hair(g, 'M28 142H300', { op: 0.5 });
  p.text(g, 28, 176, 'Customer', { size: 20, fill: INK2 });
  p.stroke(g, ptsD(rectPts(28, 188, 284, 52)), 'ghost', 'ink');
  const old = p.g(g, { 'data-k': '!oldGone' }); const now = p.g(g, { 'data-k': 'nameNow' });
  const keep = p.g(old, { 'data-k': '!slipC' });
  p.text(keep, 42, 222, NAMES.old, { size: 24, weight: 600 });
  p.hair(p.g(keep, { 'data-k': 'strike' }), 'M38 215H236', { w: 2.4, op: 1 });
  p.stroke(p.g(g, { 'data-k': 'hl' }), ptsD(rectPts(24, 184, 292, 60)), 'subject', 'ink');
  const keep2 = p.g(now, { 'data-k': '!slipC' });
  p.text(keep2, 42, 222, NAMES.now, { size: 24, weight: 600 });
  if (o.slip) {
    const sl = p.g(g, { 'data-k': 'slipC' });
    p.solid(sl, rectPts(36, 192, 252, 44), 'support', 'ink', { shade: [3, 3] });
    p.text(sl, 52, 223, 'see card 88', { size: TYPE.label, weight: 600 });
    p.stroke(sl, 'M262 188v26a6 6 0 0 0 12 0v-24a3.5 3.5 0 0 0 -7 0v22', 'support', 'ink', { rough: 0.2 });
    const rd = p.g(g, { 'data-k': 'slipC' });
    const r1 = p.g(rd, { 'data-k': '!oldGone' }); const r2 = p.g(rd, { 'data-k': 'nameNow' });
    p.text(r1, 28, 268, `reads: ${NAMES.old}`, { size: 16, face: 'mono', fill: INK2 });
    p.text(r2, 28, 268, `reads: ${NAMES.now}`, { size: 16, face: 'mono', fill: INK2 });
  }
}

function rowContent(p: Pen, g: Element, y: number, n: 1 | 2, o: { amber?: boolean; key?: boolean }): void {
  const item = n === 1 ? 'Pallet jack · 4 × 310.00' : 'Shrink wrap · 3 × 103.50';
  const amt = n === 1 ? '1,240.00' : '310.50';
  const put = (parent: Element, col: string | undefined): void => {
    p.text(parent, 28, y + 34, `line ${n}`, { size: TYPE.label, weight: 700, fill: col });
    p.text(parent, 288, y + 36, amt, { size: TYPE.big, face: 'mono', weight: 600, anchor: 'end', fill: col });
  };
  if (o.key && n === 1) {
    put(p.g(g, { 'data-k': '!amber1' }), undefined);
    const a = p.g(g, { 'data-k': 'amber1' });
    put(a, ACC);
    p.hair(a, `M28 ${y + 48}H288`, { w: 2, colour: ACC, op: 1 });
  } else put(g, o.amber ? ACC : undefined);
  p.text(g, 28, y + 70, item, { size: TYPE.body, fill: INK2 });
  p.text(p.g(g, { 'data-k': 'sys' }), 28, y + 98, 'TransactionLine', { size: TYPE.secondary, face: 'mono', fill: INK2 });
}

/* ------------------------------------------------------------------ form and cards */
const form: KindDef = {
  size: () => ({ w: FORM.w, h: FORM.headH + 2 * FORM.lineH }),
  draw(p, g) {
    p.solid(g, rectPts(0, 0, FORM.w, FORM.headH + 2 * FORM.lineH), 'support', 'ink');
    headerContent(p, g, {});
    rowContent(p, g, FORM.headH, 1, { key: true });
    rowContent(p, g, FORM.headH + FORM.lineH, 2, {});
    // the perforations the pieces will tear along
    for (const y of [FORM.headH, FORM.headH + FORM.lineH]) p.hair(g, `M10 ${y}H${FORM.w - 10}`, { dash: '3 4', op: 0.85 });
  },
  anchors: () => ({}),
};

const orderCard: KindDef = {
  size: () => ({ w: FORM.w, h: FORM.headH + 70 }),
  draw(p, g) {
    const pts: Pt[] = [[0, 0], [FORM.w, 0], [FORM.w, FORM.headH], ...tornPts([FORM.w, FORM.headH], [0, FORM.headH], 10, 6, 41, -1).slice(1)];
    p.solid(g, pts, 'support', 'ink');
    headerContent(p, g, { slip: true });
    p.eyelet(p.g(g, { 'data-k': 'eyeNum' }), 14, 76, 'support', 'ink', 6);
    label(p, g, FORM.w / 2, FORM.headH + 38, 'the order', 'Transactions');
  },
  anchors: () => ({ num: [14, 76], slipC: [268, 214] }),
};

const lineCard: KindDef = {
  size: () => ({ w: FORM.w, h: FORM.lineH }),
  draw(p, g, s) {
    const n = (num(s, 'n', 1) === 2 ? 2 : 1) as 1 | 2;
    const tone: Tone = n === 1 ? 'accent' : 'ink';
    const pts: Pt[] = [...tornPts([0, 0], [FORM.w, 0], 10, 5, 70 + n, 1), [FORM.w, FORM.lineH], [0, FORM.lineH]];
    p.solid(g, pts, n === 1 ? 'subject' : 'support', tone);
    rowContent(p, g, 0, n, { amber: n === 1 });
    if (n === 1) p.eyelet(g, 14, 50, 'support', 'accent', 6);
  },
  anchors: () => ({ item: [14, 50] }),
};

function personCard(p: Pen, g: Element, kind: 'customer' | 'item'): void {
  p.solid(g, roundPts(0, 0, 270, 150, 14), 'support', 'ink');
  p.stroke(g, ptsD(roundPts(124, 12, 44, 12, 6)), 'ghost', 'ink');
  p.hair(g, 'M126 38V122', { op: 0.35 });
  if (kind === 'customer') {
    p.person(g, 76, 84, 40, 'support');
    p.text(g, 142, 76, 'Harbor', { size: 21, weight: 600 });
    const og = p.g(g, { 'data-k': '!oldGone' });
    p.text(og, 142, 104, 'Supply Co.', { size: 21, weight: 600 });
    p.hair(p.g(og, { 'data-k': 'strike' }), 'M142 98H236', { w: 2.2, op: 1 });
    p.stroke(p.g(g, { 'data-k': 'hl' }), ptsD(rectPts(134, 52, 126, 86)), 'subject', 'ink');
    p.text(p.g(g, { 'data-k': 'nameNow' }), 142, 104, 'Supply Inc.', { size: 21, weight: 600 });
    p.text(g, 142, 130, 'id 88', { size: 16, face: 'mono', fill: INK2 });
    label(p, g, 135, 190, 'the customer', 'customer');
  } else {
    // a little parcel glyph
    const x = 40, y = 70, w = 54, h = 42, dx = 18, dy = -12;
    const top = ptsD([[x, y], [x + dx, y + dy], [x + w + dx, y + dy], [x + w, y]]);
    const side = ptsD([[x + w, y], [x + w + dx, y + dy], [x + w + dx, y + dy + h], [x + w, y + h]]);
    p.fill(g, top); p.stroke(g, top, 'support');
    p.fill(g, side); p.hatch(g, side, bbox([[x + w, y], [x + w + dx, y + dy], [x + w + dx, y + dy + h], [x + w, y + h]]), 45, 3.2, 0.7); p.stroke(g, side, 'support');
    p.fill(g, ptsD(rectPts(x, y, w, h))); p.stroke(g, ptsD(rectPts(x, y, w, h)), 'support');
    p.hair(g, `M${x + 24} ${y}V${y + h}`, { w: 1.1, op: 0.8 });
    p.text(g, 142, 76, 'Pallet', { size: 21, weight: 600 });
    p.text(g, 142, 104, 'jack', { size: 21, weight: 600 });
    p.text(g, 142, 130, 'item 12', { size: 16, face: 'mono', fill: INK2 });
    label(p, g, 135, 190, 'the item', 'item');
  }
  p.eyelet(g, 24, 120, 'support', 'ink', 6);
}
const customerCard: KindDef = { size: () => ({ w: 270, h: 212 }), draw: (p, g) => personCard(p, g, 'customer'), anchors: () => ({ eye: [24, 120] }) };
const itemCard: KindDef = { size: () => ({ w: 270, h: 212 }), draw: (p, g) => personCard(p, g, 'item'), anchors: () => ({ eye: [24, 120] }) };

const slip: KindDef = {
  size: () => ({ w: 320, h: 96 }),
  draw(p, g, s) {
    p.solid(g, rectPts(0, 8, 304, 86), 'support', 'ink', { shade: [4, 4] });
    p.text(g, 24, 44, str(s, 'a', 'see'), { size: 24, fill: INK2 });
    p.text(g, 24, 80, str(s, 'b', 'see card'), { size: TYPE.label, weight: 700 });
    p.stroke(g, 'M230 2v34a7 7 0 0 0 14 0v-30a4.5 4.5 0 0 0 -9 0v28', 'support', 'ink', { rough: 0.2 });
    p.eyelet(g, 280, 58, 'support', 'ink', 6);
  },
  anchors: () => ({ eye: [280, 58] }),
};

/* --------------------------------------------------------------------- the cabinet */
const cabinet: KindDef = {
  size: () => ({ w: CAB.w + CAB.dx, h: CAB.h - CAB.dy }),
  draw(p, g) {
    const x = 0, y = -CAB.dy, w = CAB.w, h = CAB.h, d: Pt = [CAB.dx, CAB.dy];
    const side: Pt[] = [[x + w, y], [x + w + d[0], y + d[1]], [x + w + d[0], y + d[1] + h], [x + w, y + h]];
    const top: Pt[] = [[x, y], [x + d[0], y + d[1]], [x + w + d[0], y + d[1]], [x + w, y]];
    const sd = ptsD(side), td = ptsD(top);
    p.fill(g, sd); p.hatch(g, sd, bbox(side), 45, 3.6, 0.7); p.stroke(g, sd, 'support');
    p.fill(g, td); p.stroke(g, td, 'support');
    const fd = ptsD(rectPts(x, y, w, h));
    p.fill(g, fd); p.stroke(g, fd, 'support');
    p.hair(g, `M${x + 6} ${y + h - 8}H${x + w - 6}`, { op: 0.5 });
  },
  anchors: () => ({}),
};

/** where drawer i sits inside the cabinet body's local box (its closed panel top-left) */
export const drawerAt = (i: number): Pt => [CAB.px, -CAB.dy + CAB.py + i * CAB.pitch];

const drawer: KindDef = {
  size: () => ({ w: CAB.pw, h: CAB.ph }),
  draw(p, g, s) {
    const PW = CAB.pw, PH = CAB.ph, dep: Pt = [34, -22];
    const cards = (Array.isArray(s.cards) ? s.cards : []) as string[];
    const raised = num(s, 'raised', -1), lift = num(s, 'lift', 0);
    // the inside of an open drawer: opening, outer wall, cards standing in it
    const inner = p.g(g, { 'data-k': 'inner' });
    const op: Pt[] = [[0, 0], [dep[0], dep[1]], [PW + dep[0], dep[1]], [PW, 0]];
    const od = ptsD(op);
    p.fill(inner, od); p.hatch(inner, od, bbox(op), 135, 3.6, 0.55); p.stroke(inner, od, 'support');
    const rw: Pt[] = [[PW, 0], [PW + dep[0], dep[1]], [PW + dep[0], dep[1] + PH - 4], [PW, PH]];
    const rd = ptsD(rw);
    p.fill(inner, rd); p.hatch(inner, rd, bbox(rw), 45, 3.6, 0.7); p.stroke(inner, rd, 'support');
    for (let k = cards.length - 1; k >= 0; k--) {
      const up = k === raised ? lift : 0;
      const cx = 12 + k * 7, cy = -22 - k * 7 - up, cw = PW - 36, ch = 60;
      const amber = k === raised && s.amberRaised === true;
      const cd = ptsD(rectPts(cx, cy, cw, ch));
      p.fill(inner, cd);
      p.stroke(inner, cd, k === raised ? 'support' : 'ghost', amber ? 'accent' : 'ink');
      if (k > 0) {
        const tab = rectPts(cx + 16 + (k % 3) * 70, cy - 12, 78, 12);
        p.fill(inner, ptsD(tab)); p.stroke(inner, ptsD(tab), k === raised ? 'support' : 'ghost', amber ? 'accent' : 'ink');
      }
      if (cards[k]) p.text(inner, cx + 14, cy + 26, cards[k], { size: 19, weight: 600, fill: amber ? ACC : undefined });
    }
    // front panel with its label holder and pull
    const pd = ptsD(roundPts(0, 0, PW, PH, 4, 2));
    p.fill(g, pd); p.stroke(g, pd, 'support');
    const plate = rectPts(PW / 2 - 100, 8, 200, 48);
    p.fill(g, ptsD(plate), 'var(--paper)'); p.stroke(g, ptsD(plate), 'support');
    p.stroke(g, ptsD(rectPts(PW / 2 - 95, 12, 190, 40)), 'ghost');
    const w = p.g(g, { 'data-k': 'words' });
    p.text(w, PW / 2, 31, str(s, 'word'), { size: 23, weight: 600, anchor: 'middle' });
    p.text(w, PW / 2, 47, str(s, 'sys'), { size: TYPE.secondary, face: 'mono', anchor: 'middle', fill: INK2 });
    p.stroke(g, ptsD(roundPts(PW / 2 - 34, 64, 68, 11, 5, 2)), 'support');
  },
  anchors: () => ({ eye: [30, -50] }),
};

/* ---------------------------------------------------------------------- calendar */
const calendar: KindDef = {
  size: () => ({ w: 400, h: 530 }),
  draw(p, g) {
    const X = 40, Y = 44, W = 340, H = 400;
    // the pages that are not there: dashed ghosts stepping up and away, and the ragged stubs where they were torn off
    const miss = p.g(g, { 'data-k': 'missing' });
    [3, 2, 1].forEach((i) => p.stroke(miss, ptsD(rectPts(X - 13 * i, Y - 15 * i, W, H)), 'ghost', 'ink', { dash: '4 5', op: 0.55 }));
    const board = rectPts(X, Y, W, H);
    p.solid(g, board, 'subject', 'ink');
    const band: Pt[] = rectPts(X, Y, W, 78);
    p.hatch(g, ptsD(band), bbox(band), 135, 4.2, 0.35);
    p.stroke(g, `M${X} ${Y + 78}H${X + W}`, 'support');
    const stubs = tornPts([X + 4, Y - 1], [X + W - 4, Y - 1], 13, 8, 305, 1).map((q): Pt => [q[0], q[1] - 0]);
    const sp = ptsD([...stubs.map((q): Pt => [q[0], q[1] - (q[1] === Y - 1 ? 0 : 0)]), [X + W - 4, Y - 14], [X + 4, Y - 14]]);
    p.fill(g, sp); p.hatch(g, sp, { x0: X, y0: Y - 14, x1: X + W, y1: Y }, 45, 3.6, 0.55); p.stroke(g, sp, 'support');
    for (const cx of [X + 70, X + W - 70]) p.eyelet(g, cx, Y + 14, 'support', 'ink', 6);
    p.text(g, X + W / 2, Y + 58, 'January 2024', { size: 30, weight: 600, anchor: 'middle' });
    const cell = 46, gx = X + 12;
    'MTWTFSS'.split('').forEach((c, i) => p.text(g, gx + i * cell + cell / 2, Y + 108, c, { size: TYPE.secondary, face: 'mono', fill: INK2, anchor: 'middle' }));
    for (let d = 1; d <= 31; d++) {
      const idx = d - 1, col = idx % 7, row = Math.floor(idx / 7);
      p.text(g, gx + col * cell + cell / 2, Y + 148 + row * 46, String(d), { size: 17, face: 'mono', anchor: 'middle', weight: d === 1 ? 600 : 400 });
    }
    p.stroke(g, circD(gx + cell / 2, Y + 142, 19), 'subject', 'ink', { rough: 0.5 });
    p.text(g, X + W / 2, Y + H + 40, 'cabinet installed', { size: TYPE.primary, weight: 600, anchor: 'middle' });
    p.text(g, X + W / 2, Y + H + 68, 'January 2024', { size: 19, italic: true, fill: INK2, anchor: 'middle' });
  },
  anchors: () => ({}),
};

/* ------------------------------------------------------------------------- tapes */
const tape: KindDef = {
  size: (s) => ({ w: TAPE.caseW + num(s, 'stop') * TAPE.K + 230, h: 88 }),
  draw(p, g, s) {
    const stop = num(s, 'stop'), K = TAPE.K, x0 = TAPE.caseW, x1 = x0 + stop * K, TH = 58, ty = 14;
    const body = p.g(g, { 'data-k': 'len', 'data-ox': x0 });
    const bd = ptsD(rectPts(x0, ty, x1 - x0, TH));
    p.fill(body, bd);
    p.hatch(body, ptsD(rectPts(x0, ty + TH - 7, x1 - x0, 7)), { x0, y0: ty + TH - 7, x1, y1: ty + TH }, 45, 3.6, 0.6);
    p.stroke(body, bd, 'support');
    for (let v = 0; v <= stop + 0.1; v += 50) {
      const x = x0 + v * K, major = v % 500 === 0, mid = v % 100 === 0;
      p.hair(body, `M${fmt(x)} ${ty}V${fmt(ty + (major ? 20 : mid ? 12 : 7))}`, { w: major ? 1.1 : 0.8, op: 0.85 });
      if (major && x1 - x > 50) p.text(body, x + 4, ty + 38, v === 0 ? '0' : v.toLocaleString('en-US'), { size: TYPE.secondary, face: 'mono', fill: INK2 });
    }
    const hk = ptsD(rectPts(x1 - 2, ty - 12, 9, TH + 24));
    p.fill(body, hk); p.stroke(body, hk, 'support');
    const cd = ptsD(roundPts(0, 5, TAPE.caseW, TAPE.caseH, 10, 3));
    p.fill(g, cd);
    p.hatch(g, cd, { x0: TAPE.caseW - 12, y0: 5, x1: TAPE.caseW, y1: 5 + TAPE.caseH }, 45, 3.6, 0.6);
    p.stroke(g, cd, 'support');
    p.text(g, TAPE.caseW / 2 - 5, 52, str(s, 'word'), { size: 24, weight: 700, anchor: 'middle' });
    const r = p.g(g, { 'data-k': 'reading' });
    p.text(r, x1 + 22, ty + 32, str(s, 'reading'), { size: 32, face: 'mono', weight: 600 });
    p.text(r, x1 + 22, ty + 58, str(s, 'why'), { size: 19, fill: INK2 });
  },
  anchors: (s) => ({ end: [TAPE.caseW + num(s, 'stop') * TAPE.K + 2, 14] }),
};

const barSlip: KindDef = {
  size: (s) => ({ w: (num(s, 'n', 1) === 1 ? 1240 : 310.5) * TAPE.K, h: 96 }),
  draw(p, g, s) {
    const n = num(s, 'n', 1), w = (n === 1 ? 1240 : 310.5) * TAPE.K;
    if (n === 1) {
      p.solid(p.g(g), [...tornPts([0, 96], [0, 0], 9, 6, 733, 1).slice(0, -1), [6, 0], [w, 0], [w, 96]], 'subject', 'accent');
      p.text(g, 26, 42, 'line 1', { size: 26, weight: 700, fill: ACC });
      p.text(g, 26, 76, 'Pallet jack', { size: 18, fill: INK2 });
      p.text(g, w - 22, 50, '1,240.00', { size: 34, face: 'mono', weight: 600, anchor: 'end', fill: ACC });
      p.text(g, w - 22, 78, 'TransactionLine', { size: TYPE.secondary, face: 'mono', anchor: 'end', fill: INK2 });
      p.hair(g, `M${fmt(620 * TAPE.K)} 6V90`, { dash: '3 5', w: 1.1, op: 0.9, colour: ACC });
    } else {
      p.solid(p.g(g), [...tornPts([0, 96], [0, 0], 9, 6, 741, 1).slice(0, -1), [4, 0], [w, 0], [w, 96]], 'support', 'ink');
      p.text(g, 22, 42, 'line 2', { size: TYPE.label, weight: 600 });
      p.text(g, 22, 78, '310.50', { size: 26, face: 'mono', weight: 600 });
    }
  },
  anchors: () => ({}),
};

/* ------------------------------------------------------------------------ parcel */
const parcel: KindDef = {
  size: () => ({ w: 250, h: 270 }),
  draw(p, g, s) {
    const x = 50, y = 70, w = 150, h = 118, dx = 50, dy = -32;
    const front = rectPts(x, y, w, h);
    const top: Pt[] = [[x, y], [x + dx, y + dy], [x + w + dx, y + dy], [x + w, y]];
    const side: Pt[] = [[x + w, y], [x + w + dx, y + dy], [x + w + dx, y + dy + h], [x + w, y + h]];
    const sd = ptsD(side);
    p.fill(g, sd); p.hatch(g, sd, bbox(side), 45, 3.6, 0.7); p.stroke(g, sd, 'support');
    p.fill(g, ptsD(top)); p.stroke(g, ptsD(top), 'support');
    p.fill(g, ptsD(front)); p.stroke(g, ptsD(front), 'support');
    p.hair(g, `M${x + 63} ${y + h}V${y}L${x + 63 + dx} ${y + dy}`, { w: 1.1, op: 0.9 });
    p.hair(g, `M${x + 87} ${y + h}V${y}L${x + 87 + dx} ${y + dy}`, { w: 1.1, op: 0.9 });
    const tg = p.g(g, { transform: `rotate(-14 ${x + 4} ${y + 40})` });
    const tag: Pt[] = [[x - 30, y + 34], [x + 22, y + 34], [x + 34, y + 52], [x + 22, y + 70], [x - 30, y + 70]];
    p.solid(tg, tag, 'support', 'ink', { shade: [3, 3] });
    p.eyelet(tg, x - 14, y + 52, 'support', 'ink', 4.5);
    p.text(g, x + 75 + 12, 238, str(s, 'word'), { size: TYPE.primary, weight: 600, anchor: 'middle' });
    p.text(g, x + 75 + 12, 262, str(s, 'sub', 'not in NetSuite'), { size: TYPE.secondary, face: 'mono', anchor: 'middle', fill: INK2 });
  },
  anchors: () => ({}),
};

export const KINDS: Record<Kind, KindDef> = { form, orderCard, lineCard, customerCard, itemCard, slip, cabinet, drawer, calendar, tape, barSlip, parcel };

/** a hand-run string between two points: the path the scene draws (clean; the view roughens it) */
export function stringD(a: Pt, b: Pt, sag: number): string {
  return `M${fmt(a[0])} ${fmt(a[1])}Q${fmt((a[0] + b[0]) / 2)} ${fmt((a[1] + b[1]) / 2 + sag)} ${fmt(b[0])} ${fmt(b[1])}`;
}
export { WEIGHT };
