// Item builders: one function per item kind. Each builds its DOM inside a group (`g.el`) on the right layer
// and schedules its draw-in on env.tl (strokes by dashoffset, labels by clip, paper/values by opacity).
// Nothing here knows about steps or hover: index.ts does.
import tokens from '../../tokens.json';
import { dashOffset, easeDraw, stitchCount, stitchSteps } from '../../ink/easing';
import { hatchSegments, stipplePoints } from '../../ink/hatch';
import { PENCIL, roughPath, roughRect } from '../../ink/rough';
import type { Scene } from '../../ink/scene';
import { el, f1, uid } from '../../ink/svg';
import { shapeD } from '../../ink/tags';
import type { Timeline } from '../../ink/timeline';
import { formGeom, HEAD_H, ROW_H, type R } from './layout';
import { monoW } from './geom';
import {
  layerOf, type BoxItem, type CalloutItem, type FocusId, type FormItem, type GhostItem, type HexItem, type Item, type LegendItem,
  type LineItem, type PillItem, type RecItem, type RuleItem, type TableItem, type TagItem, type TextItem, type UnderlineItem, type Layer,
} from './model';

const HATCH = tokens.line.hatch;
const W_ = tokens.line.weights;

export interface Env {
  scene: Scene;
  svg: SVGSVGElement;
  defs: SVGDefsElement;
  layers: Record<Layer, SVGGElement>;
  W: number; H: number;
  tl: Timeline;
  /** duration scale so a whole transition fits its budget */
  k: number;
}

export interface NodeAcc { node: Element; f: FocusId[]; main: boolean; hl?: string }
export interface ElRec { id: string; item: Item; g: SVGGElement; nodes: NodeAcc[]; end: number }

class B {
  readonly g: SVGGElement;
  readonly rec: ElRec;
  constructor(readonly env: Env, readonly it: Item) {
    this.g = el('g', { class: `el k-${it.k}`, 'data-id': it.id }, env.layers[layerOf(it)]);
    this.rec = { id: it.id, item: it, g: this.g, nodes: [], end: 0 };
  }
  d(ms: number): number { return ms * this.env.k; }
  /** register a node: f = focus groups in which it takes the accent; main = lit by hover when its element is lit */
  reg<T extends Element>(node: T, f: FocusId[] | undefined, main = false, hl?: string): T {
    this.rec.nodes.push({ node, f: f ?? [], main, hl });
    return node;
  }
  path(d: string, o: { w: number; pencil?: boolean; seed: number; cls?: string; raw?: boolean; parent?: Element }): SVGPathElement {
    const dd = o.raw ? d : roughPath(d, o.seed, o.pencil ? PENCIL : undefined);
    const p = el('path', { d: dd, pathLength: 1, class: `ink${o.pencil ? ' pencil' : ''}${o.cls ? ' ' + o.cls : ''}`, 'stroke-width': o.w }, o.parent ?? this.g);
    if (o.pencil) p.setAttribute('filter', `url(#${this.env.scene.pencilFilter()})`);
    return p;
  }
  rect(x: number, y: number, w: number, h: number, o: { w: number; pencil?: boolean; seed: number; cls?: string; parent?: Element }): SVGPathElement {
    const p = el('path', { d: roughRect(x, y, w, h, o.seed, o.pencil ? PENCIL : undefined), pathLength: 1, class: `ink${o.pencil ? ' pencil' : ''}${o.cls ? ' ' + o.cls : ''}`, 'stroke-width': o.w }, o.parent ?? this.g);
    if (o.pencil) p.setAttribute('filter', `url(#${this.env.scene.pencilFilter()})`);
    return p;
  }
  text(x: number, y: number, s: string, face: 'mono' | 'serif' | 'serifi', px: number, o: { anchor?: string; muted?: boolean; cls?: string } = {}): SVGTextElement {
    const t = el('text', { x: f1(x), y: f1(y), 'font-size': px, class: `ot ${face}${o.muted ? ' muted' : ''}${o.cls ? ' ' + o.cls : ''}`, 'text-anchor': o.anchor ?? 'start' }, this.g);
    t.textContent = s;
    return t;
  }
  stroke(p: SVGElement, t0: number, ms: number): number { return this.env.tl.stroke(p, t0, this.d(ms)); }
  write(t: SVGElement, t0: number, ms = tokens.motion.dur.labelWrite): number { return this.env.tl.label(t, t0, this.d(ms)); }
  fade(n: SVGElement, t0: number, ms = tokens.motion.dur.textFade): number { return this.env.tl.fade(n, t0, this.d(ms)); }
  hit(x: number, y: number, w: number, h: number, hk: string, pad = 0): SVGRectElement {
    return el('rect', { x: f1(x - pad), y: f1(y - pad), width: f1(w + 2 * pad), height: f1(h + 2 * pad), class: 'hit', 'data-hk': hk }, this.g);
  }
  ring(x: number, y: number, w: number, h: number): void {
    el('rect', { x: f1(x - 4), y: f1(y - 4), width: f1(w + 8), height: f1(h + 8), class: 'focus-ring' }, this.g);
  }
  done(end: number): ElRec { this.rec.end = end; return this.rec; }
}

export function build(env: Env, it: Item, t0: number): ElRec {
  const b = new B(env, it);
  switch (it.k) {
    case 'form': return form(b, it, t0);
    case 'rec': return rec(b, it, t0);
    case 'tag': return tag(b, it, t0);
    case 'hex': return hex(b, it, t0);
    case 'pill': return pill(b, it, t0);
    case 'ghost': return ghost(b, it, t0);
    case 'table': return table(b, it, t0);
    case 'line': return line(b, it, t0);
    case 'box': return box(b, it, t0);
    case 'text': return textItem(b, it, t0);
    case 'under': return under(b, it, t0);
    case 'rule': return rule(b, it, t0);
    case 'callout': return callout(b, it, t0);
    case 'legend': return legend(b, it, t0);
  }
}

// ---------------------------------------------------------------- form
function form(b: B, it: FormItem, t0: number): ElRec {
  const { x, y, w, h } = it;
  const g = formGeom(it);
  const paper = el('path', { d: `M${x} ${y}H${x + w}V${y + h}H${x}Z`, class: 'paper' }, b.g);
  b.fade(paper, t0, 240);
  const outline = b.rect(x, y, w, h, { w: 1.3, pencil: true, seed: 5, cls: 'outline' });
  b.reg(outline, undefined, false);
  let e = b.stroke(outline, t0, 560);
  for (const [i, ry] of [g.rule1, g.rule2].entries()) {
    const r = b.path(`M${x + 6} ${ry}H${x + w - 6}`, { w: 0.9, pencil: true, seed: 6 + i });
    e = Math.max(e, b.stroke(r, t0 + 280 + i * 120, 260));
  }
  const rows: { y: number; parts: { x: number; s: string; face: 'mono' | 'serif' | 'serifi'; px: number; anchor?: string; muted?: boolean; wt?: boolean }[] }[] = [
    { y: g.title, parts: [{ x: x + 8, s: 'SALES ORDER', face: 'mono', px: 10.5, wt: true }, { x: x + w - 8, s: 'SO1041', face: 'mono', px: 10.5, anchor: 'end', wt: true }] },
    { y: g.cust, parts: [{ x: x + 8, s: 'Customer', face: 'serifi', px: 10, muted: true }, { x: x + 54, s: 'Harbor Supply Co.', face: 'serif', px: 10.5 }] },
    { y: g.date, parts: [{ x: x + 8, s: 'Date', face: 'serifi', px: 10, muted: true }, { x: x + 54, s: '4 Mar 2026', face: 'serif', px: 10.5 }] },
    { y: g.l1, parts: [{ x: x + 8, s: '1', face: 'mono', px: 10.5 }, { x: x + 22, s: 'Pallet jack', face: 'serif', px: 11 }, { x: x + w - 8, s: '1,240.00', face: 'mono', px: 10.5, anchor: 'end' }] },
    { y: g.l2, parts: [{ x: x + 8, s: '2', face: 'mono', px: 10.5 }, { x: x + 22, s: 'Shrink wrap', face: 'serif', px: 11 }, { x: x + w - 8, s: '310.50', face: 'mono', px: 10.5, anchor: 'end' }] },
  ];
  rows.forEach((r, i) => {
    const hl = el('rect', { x: x + 3, y: r.y - 11, width: w - 6, height: 15, class: 'rowhl' }, b.g);
    b.reg(hl, undefined, false, `form-r${i}`);
    for (const p of r.parts) {
      const t = b.text(p.x, r.y, p.s, p.face, p.px, { anchor: p.anchor, muted: p.muted });
      e = Math.max(e, b.write(t, t0 + 520 + i * 110, 300));
    }
    b.hit(x, r.y - 12, w, 17, `form-r${i}`);
  });
  return b.done(e);
}

// ---------------------------------------------------------------- source record
function rec(b: B, it: RecItem, t0: number): ElRec {
  const { x, y, w, h } = it;
  const paper = el('path', { d: `M${x} ${y}H${x + w}V${y + h}H${x}Z`, class: 'paper' }, b.g);
  b.fade(paper, t0, 240);
  const cid = uid('recclip');
  const clip = el('clipPath', { id: cid }, b.g);
  el('path', { d: `M${x} ${y}H${x + w}V${y + h}H${x}Z` }, clip);
  const hg = el('g', { 'clip-path': `url(#${cid})`, class: 'hatch' }, b.g);
  let e = t0;
  const segs = hatchSegments({ x0: x + 1, x1: x + w - 1, y0: y + h - HATCH.bandPx - 1, y1: y + h - 1 }, tokens.layers.source.hatchDeg, HATCH.gapInTagPx);
  segs.forEach((s, i) => {
    const p = el('path', { d: `M${f1(s[0])} ${f1(s[1])}L${f1(s[2])} ${f1(s[3])}`, pathLength: 1, class: `ink h${it.pencil ? ' pencil' : ''}`, 'stroke-width': HATCH.weight }, hg);
    e = Math.max(e, b.stroke(p, t0 + 300 + i * 30, 200));
  });
  const outline = b.rect(x, y, w, h, { w: it.pencil ? 1.1 : tokens.layers.source.outline, pencil: it.pencil, seed: 140 + (y | 0) % 97, cls: 'outline' });
  b.reg(outline, it.acc, true);
  e = Math.max(e, b.stroke(outline, t0, 520));
  const name = b.text(x + 8, y + 16, it.name, 'mono', 10, { muted: it.pencil });
  b.reg(name, it.acc, true);
  e = Math.max(e, b.write(name, t0 + 200));
  const cap = b.text(x + 8, y + 29, it.cap, 'serifi', 10.5, { muted: true });
  e = Math.max(e, b.fade(cap, t0 + 520));
  b.hit(x, y, w, h, it.hk ?? it.id, 3);
  b.ring(x, y, w, h);
  return b.done(e);
}

// ---------------------------------------------------------------- warehouse tag
function tagShape(b: B, kind: 'punch' | 'pill', x: number, y: number, w: number, h: number, o: { weight: number; angle: number; seed: number; acc?: FocusId[]; hatchCls?: string }) {
  const d = shapeD(kind, x, y, w, h);
  const cid = uid('tagclip');
  const clip = el('clipPath', { id: cid }, b.g);
  el('path', { d }, clip);
  const paper = el('path', { d, class: 'paper' }, b.g);
  const hg = el('g', { 'clip-path': `url(#${cid})`, class: 'hatch' }, b.g);
  const hatch: SVGPathElement[] = [];
  const segs = hatchSegments({ x0: x + 1, x1: x + w - 1, y0: y + h - HATCH.bandPx - 1, y1: y + h - 1 }, o.angle, HATCH.gapInTagPx);
  for (const s of segs) hatch.push(el('path', { d: `M${f1(s[0])} ${f1(s[1])}L${f1(s[2])} ${f1(s[3])}`, pathLength: 1, class: 'ink h', 'stroke-width': HATCH.weight }, hg));
  const outline = b.path(d, { w: o.weight, seed: o.seed, cls: 'outline' });
  b.reg(outline, o.acc, true);
  return { paper, hatch, outline };
}

function tag(b: B, it: TagItem, t0: number): ElRec {
  const { x, y, w, h, fs } = it;
  const s = tagShape(b, 'punch', x, y, w, h, { weight: tokens.layers.warehouse.outline, angle: tokens.layers.warehouse.hatchDeg, seed: 150 + (y | 0) % 89, acc: it.acc });
  const hole = el('circle', { cx: x + 12, cy: f1(y + h / 2 - 1), r: 2.4, class: 'hole' }, b.g);
  b.reg(hole, it.acc, true);
  const lines = it.lines;
  const labels: SVGTextElement[] = lines.map((l, i) => {
    const base = lines.length === 1 ? y + h / 2 + 2.5 : y + h / 2 - 3 + i * (fs + 3);
    const t = b.text(x + 24, base - (lines.length === 1 ? 0 : 0), l, 'mono', fs, { cls: 'tg' });
    b.reg(t, it.acc, true);
    return t;
  });
  b.fade(s.paper, t0, 240);
  let e = b.stroke(s.outline, t0, 520);
  s.hatch.forEach((p, i) => { e = Math.max(e, b.stroke(p, t0 + 420 + i * 26, 200)); });
  labels.forEach((t, i) => { e = Math.max(e, b.write(t, t0 + 180 + i * 140)); });
  e = Math.max(e, b.fade(hole, t0 + 380, 120));
  b.hit(x, y, w, h, it.hk ?? it.id, tokens.hit.tagHitMarginPx);
  b.ring(x, y, w, h);
  b.rec.g.classList.add('tag', 'layer-warehouse');
  return b.done(e);
}

function ghost(b: B, it: GhostItem, t0: number): ElRec {
  const d = shapeD('punch', it.x, it.y, it.w, it.h);
  const paper = el('path', { d, class: 'paper' }, b.g);
  const outline = b.path(d, { w: W_.standard, seed: 160 + (it.x | 0) % 13, cls: 'outline' });
  b.fade(paper, t0, 200);
  const e = b.stroke(outline, t0, 480);
  b.reg(outline, it.acc, true);
  b.hit(it.x, it.y, it.w, it.h, it.hk ?? it.id, 2);
  return b.done(e);
}

function hex(b: B, it: HexItem, t0: number): ElRec {
  const { x, y, w, h } = it;
  const d = shapeD('hex', x, y, w, h);
  const cid = uid('hexclip');
  const clip = el('clipPath', { id: cid }, b.g);
  el('path', { d }, clip);
  const paper = el('path', { d, class: 'paper' }, b.g);
  b.fade(paper, t0, 240);
  const hg = el('g', { 'clip-path': `url(#${cid})`, class: 'hatch' }, b.g);
  const dots: SVGCircleElement[] = [];
  for (const [px, py] of stipplePoints({ x0: x + 1, x1: x + w - 1, y0: y + h - HATCH.bandPx - 1, y1: y + h - 1 }, HATCH.stipple.gapPx[0], 171)) {
    dots.push(el('circle', { cx: f1(px), cy: f1(py), r: HATCH.stipple.dotR, class: 'dot' }, hg));
  }
  const o1 = b.path(d, { w: tokens.layers.derived.outline[0], seed: 172, cls: 'outline' });
  const ins = 3;
  const o2 = b.path(shapeD('hex', x + ins, y + ins, w - 2 * ins, h - 2 * ins), { w: tokens.layers.derived.outline[1], seed: 179, cls: 'outline2' });
  b.reg(o1, it.acc, true); b.reg(o2, it.acc, true);
  const t1 = b.text(x + w / 2, y + 14, 'calendar day', 'serifi', 11, { anchor: 'middle' });
  const t2 = b.text(x + w / 2, y + 24.5, '4 Mar 2026', 'mono', 10, { anchor: 'middle', muted: true });
  b.reg(t1, it.acc, true);
  let e = b.stroke(o1, t0, 520);
  e = Math.max(e, b.stroke(o2, t0 + 120, 520));
  dots.forEach((p, i) => { e = Math.max(e, b.fade(p, t0 + 420 + i * 14, 90)); });
  e = Math.max(e, b.write(t1, t0 + 220), b.write(t2, t0 + 400));
  b.hit(x, y, w, h, it.hk ?? it.id, 6);
  b.ring(x, y, w, h);
  return b.done(e);
}

function pill(b: B, it: PillItem, t0: number): ElRec {
  const { x, y, w, h } = it;
  const s = tagShape(b, 'pill', x, y, w, h, { weight: tokens.layers.semantic.outline, angle: tokens.layers.semantic.hatchDeg, seed: 180 + (y | 0) % 83, acc: it.acc });
  const n = it.lines.length;
  const labels = it.lines.map((l, i) => {
    const t = b.text(x + w / 2, y + h / 2 + (n === 1 ? 4 : i === 0 ? -1.5 : 10), l, 'serif', 12, { anchor: 'middle' });
    b.reg(t, it.acc, true);
    return t;
  });
  b.fade(s.paper, t0, 240);
  let e = b.stroke(s.outline, t0, 520);
  s.hatch.forEach((p, i) => { e = Math.max(e, b.stroke(p, t0 + 420 + i * 26, 200)); });
  labels.forEach((t, i) => { e = Math.max(e, b.write(t, t0 + 180 + i * 140)); });
  b.hit(x, y, w, h, it.hk ?? it.id, 4);
  b.ring(x, y, w, h);
  b.rec.g.classList.add('pill');
  return b.done(e);
}

// ---------------------------------------------------------------- tables (strips, drawers)
function table(b: B, it: TableItem, t0: number): ElRec {
  const { x, y, cols, rows, rowH, headH } = it;
  const pencilAll = cols.every((c) => c.pencil) || rows.every((r) => r.pencil);
  const w = cols.reduce((a, c) => a + c.w, 0);
  const h = headH + rows.length * rowH;
  const paper = el('path', { d: `M${x} ${y}H${x + w}V${y + h}H${x}Z`, class: 'paper' }, b.g);
  b.fade(paper, t0, 200);
  const frame = b.rect(x, y, w, h, { w: pencilAll ? 1 : 0.7, pencil: pencilAll, seed: 190 + (y | 0) % 71, cls: 'outline' });
  b.reg(frame, it.acc, false);
  let e = b.stroke(frame, t0, 420);
  const line = (d: string, seed: number, at: number) => {
    const p = b.path(d, { w: 0.6, pencil: pencilAll, seed });
    e = Math.max(e, b.stroke(p, t0 + at, 260));
  };
  if (headH > 0) line(`M${x} ${y + headH}H${x + w}`, 201, 120);
  for (let r = 1; r < rows.length; r++) line(`M${x} ${y + headH + r * rowH}H${x + w}`, 202 + r, 160);
  let cx = x;
  cols.forEach((c, i) => {
    if (i > 0) line(`M${cx} ${y}V${y + h}`, 210 + i, 140);
    if (headH > 0 && c.head) {
      const t = b.text(cx + 4, y + headH / 2 + 3.4, c.head, 'mono', it.headFs, { muted: true });
      b.reg(t, c.headAcc ?? it.acc, false);
      e = Math.max(e, b.write(t, t0 + 300 + i * 70, 320));
    }
    if (c.hk) b.hit(cx, y, c.w, headH || rowH, c.hk);
    cx += c.w;
  });
  rows.forEach((r, ri) => {
    let rx = x;
    r.cells.forEach((cell, ci) => {
      const t = b.text(rx + 4, y + headH + ri * rowH + rowH / 2 + 3.7, cell.text, 'mono', it.fs, { muted: cell.pencil || r.pencil });
      b.reg(t, cell.acc ?? r.acc ?? it.acc, false);
      e = Math.max(e, b.fade(t, t0 + 480 + ri * 60 + ci * 40, 320));
      if (cell.hk) b.hit(rx, y + headH + ri * rowH, cols[ci].w, rowH, cell.hk);
      rx += cols[ci].w;
    });
  });
  if (it.hk) b.hit(x, y, w, h, it.hk);
  return b.done(e);
}

// ---------------------------------------------------------------- lines
function line(b: B, it: LineItem, t0: number): ElRec {
  const env = b.env;
  const g = b.g;
  g.classList.add('line', `line-${it.prov}`);
  const nodes: SVGElement[] = [];
  let end = t0;
  const pencil = it.prov === 'illustrative';
  const knotEls: SVGCircleElement[] = [];
  const mkKnots = (cls: string) => {
    const ks = it.knots ?? [];
    ks.forEach((p) => knotEls.push(el('circle', { cx: f1(p[0]), cy: f1(p[1]), r: tokens.line.thread.knotR, class: `knot ${cls}` }, g)));
  };
  if (it.prov === 'inferred') {
    const mid = uid('stitch-m');
    const mk = el('mask', { id: mid, maskUnits: 'userSpaceOnUse', x: 0, y: -4, width: env.W, height: env.H + 8 }, g);
    const reveal = el('path', { d: it.d, pathLength: 1, class: 'reveal' }, mk);
    const path = el('path', { d: it.d, class: 'thread', mask: `url(#${mid})` }, g);
    const len = path.getTotalLength() || 60;
    const dur = b.d(it.dur ?? Math.min(tokens.motion.dur.strokeMax, Math.max(tokens.motion.dur.strokeMin, len * 2.2)));
    const n = stitchCount(len);
    if (it.rev) end = env.tl.custom(t0, dur, (p) => { reveal.style.strokeDashoffset = String(-dashOffset(stitchSteps(p, n))); });
    else end = env.tl.stitch(reveal, n, t0, dur);
    mkKnots('');
    knotEls.forEach((k, i) => { end = Math.max(end, env.tl.fade(k, (i === 0) !== !!it.rev ? t0 : t0 + dur, b.d(80))); });
    nodes.push(path, ...knotEls);
    b.reg(path, it.acc, true);
    knotEls.forEach((k) => b.reg(k, it.acc, true));
    if (it.hk) hitPath(b, it.d, it.hk);
    return b.done(end);
  }
  const path = b.path(it.d, { w: pencil ? 1.3 : W_.standard, pencil, seed: it.seed });
  const len = path.getTotalLength() || 60;
  const dur = b.d(it.dur ?? Math.min(900, Math.max(450, len * 2)));
  if (it.rev) end = env.tl.custom(t0, dur, (p) => { path.style.strokeDashoffset = String(-dashOffset(easeDraw(p))); });
  else end = env.tl.stroke(path, t0, dur);
  mkKnots('solid');
  knotEls.forEach((k, i) => { end = Math.max(end, env.tl.fade(k, (it.knots!.length === 1 || i === 1) !== !!it.rev ? t0 + dur - b.d(40) : t0, b.d(80))); });
  b.reg(path, it.acc, true);
  knotEls.forEach((k) => b.reg(k, it.acc, true));
  if (it.hk) hitPath(b, it.d, it.hk);
  return b.done(end);
}

function hitPath(b: B, d: string, hk: string): void {
  el('path', { d, class: 'hit', 'data-hk': hk, style: 'stroke:transparent;stroke-width:11;pointer-events:stroke;fill:none' }, b.g);
}

// ---------------------------------------------------------------- boxes, text, underline, rule
function box(b: B, it: BoxItem, t0: number): ElRec {
  const { x, y, w, h } = it;
  if (it.paper) {
    const paper = el('path', { d: `M${x} ${y}H${x + w}V${y + h}H${x}Z`, class: 'paper' }, b.g);
    b.fade(paper, t0, 240);
  }
  const outline = b.rect(x, y, w, h, { w: it.pencil ? 1.3 : 0.8, pencil: it.pencil, seed: it.seed, cls: 'outline' });
  b.reg(outline, it.acc, true);
  let e = b.stroke(outline, t0, 520);
  (it.rules ?? []).forEach((r, i) => {
    const p = b.path(`M${r[0]} ${r[1]}L${r[2]} ${r[3]}`, { w: 0.9, pencil: it.pencil, seed: it.seed + 1 + i });
    e = Math.max(e, b.stroke(p, t0 + 300 + i * 100, 260));
  });
  (it.texts ?? []).forEach((t, i) => {
    const n = b.text(t.x, t.y, t.t, t.face, t.px, { anchor: t.anchor, muted: t.muted });
    b.reg(n, t.acc, false);
    e = Math.max(e, b.write(n, t0 + 380 + i * 110, 340));
  });
  if (it.hk) { b.hit(x, y, w, h, it.hk, 2); if (it.ref) b.ring(x, y, w, h); }
  return b.done(e);
}

function textItem(b: B, it: TextItem, t0: number): ElRec {
  const t = b.text(it.x, it.y, it.t, it.face, it.px, { anchor: it.anchor, muted: it.muted });
  if (it.rot) t.setAttribute('transform', `rotate(${it.rot} ${it.x} ${it.y})`);
  b.reg(t, it.acc, true);
  const e = b.write(t, t0);
  if (it.hk) {
    const wEst = monoW(it.t, it.px, it.face === 'mono' ? 0 : -0.08);
    const x0 = it.anchor === 'middle' ? it.x - wEst / 2 : it.anchor === 'end' ? it.x - wEst : it.x;
    b.hit(x0, it.y - it.px, wEst, it.px + 4, it.hk, 3);
    if (it.ref) b.ring(x0, it.y - it.px, wEst, it.px + 4);
  }
  return b.done(e);
}

function under(b: B, it: UnderlineItem, t0: number): ElRec {
  const p = b.path(`M${f1(it.x0)} ${f1(it.y)}L${f1(it.x1)} ${f1(it.y)}`, { w: W_.standard, seed: it.seed });
  b.reg(p, it.acc, true);
  return b.done(b.stroke(p, t0, 300));
}

function rule(b: B, it: RuleItem, t0: number): ElRec {
  const p = b.path(`M${f1(it.x0)} ${f1(it.y)}L${f1(it.x1)} ${f1(it.y)}`, { w: W_.hairline, seed: it.seed });
  b.reg(p, undefined, true);
  return b.done(b.stroke(p, t0, 400));
}

function callout(b: B, it: CalloutItem, t0: number): ElRec {
  const t = b.text(it.x, it.y, `(${it.letter})`, 'serifi', 13, { cls: 'co', muted: true });
  const right = it.tx > it.x + 18;
  const sx = right ? it.x + 20 : it.x - 3;
  const lead = el('path', { d: `M${f1(sx)} ${f1(it.y - 4)}L${f1(it.tx)} ${f1(it.ty)}`, pathLength: 1, class: 'ink lead', 'stroke-width': W_.hairline }, b.g);
  const dot = el('circle', { cx: f1(it.tx), cy: f1(it.ty), r: 1.5, class: 'knot lead' }, b.g);
  let e = b.stroke(lead, t0, 260);
  e = Math.max(e, b.fade(dot, t0 + 200, 100), b.fade(t, t0 + 240, 200));
  return b.done(e);
}

// ---------------------------------------------------------------- legend (three provenance samples, drawn for real)
function legend(b: B, it: LegendItem, t0: number): ElRec {
  const rows: { prov: 'explicit' | 'inferred' | 'illustrative'; label: string; meaning: string }[] = [
    { prov: 'explicit', label: 'EXPLICIT', meaning: 'in the data' },
    { prov: 'inferred', label: 'INFERRED', meaning: 'by a rule' },
    { prov: 'illustrative', label: 'ILLUSTRATIVE', meaning: 'a sketch' },
  ];
  let e = t0;
  rows.forEach((r, i) => {
    const y = it.y + 9 + i * 17;
    const at = t0 + i * 300;
    const d = `M${it.x} ${y}L${it.x + 26} ${y}`;
    if (r.prov === 'inferred') {
      const mid = uid('stitch-m');
      const mk = el('mask', { id: mid, maskUnits: 'userSpaceOnUse', x: it.x - 2, y: y - 6, width: 32, height: 12 }, b.g);
      const reveal = el('path', { d, pathLength: 1, class: 'reveal' }, mk);
      el('path', { d, class: 'thread', mask: `url(#${mid})` }, b.g);
      e = Math.max(e, b.env.tl.stitch(reveal, 3, at, b.d(400)));
    } else {
      const p = b.path(d, { w: r.prov === 'illustrative' ? 1.3 : W_.standard, pencil: r.prov === 'illustrative', seed: 230 + i });
      e = Math.max(e, b.stroke(p, at, 400));
    }
    const l = b.text(it.x + 32, y + 3.5, r.label, 'mono', 10, { muted: true });
    l.setAttribute('letter-spacing', '0.06em');
    const m = b.text(it.x + 32 + monoW(r.label, 10, 0.06) + 6, y + 3.5, r.meaning, 'serifi', 10, { muted: true });
    e = Math.max(e, b.write(l, at + 160, 300), b.fade(m, at + 300, 280));
  });
  return b.done(e);
}

export type { R };
