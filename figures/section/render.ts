// The Entry section: rendering. One SVG with a WORLD group (the section, drawn once in world units and moved by the
// camera) and a HUD group (screen space: lettered call-outs, numbered band labels). Per scroll update this writes one
// transform, a handful of timeline progress values and the call-out positions. Nothing here decides anything: every
// number comes from model.ts.
//
// Strokes keep their pixel weight at any camera scale (the world group sets --k = 1/scale and CSS multiplies it in),
// so the line weights stay the rulebook's. Text is set in world units, so it grows with the camera; labels that
// would fall under 10 px are hidden by the level-of-detail rule instead of shrinking.
import { hatchSegments } from '../../ink/hatch';
import { Timeline } from '../../ink/timeline';
import { PENCIL, roughPath } from '../../ink/rough';
import { el, uid } from '../../ink/svg';
import { stitchCount } from '../../ink/easing';
import {
  BH, FONT_NAME, FONT_WORLD, INTRO_FRACTION, MARKS_PER_PIPE, PIPE_W, PIPE_X, PIPE_Y0, PIPE_Y1, RISER, X0, X1, accentFor, bandBottom, bandMid, bandTop,
  beatAt, beatCentre, camForKey, cameraAt, clamp01, closeAt, dwellOf, entryMargin, lodAt, reveal, riserAt, rowMarkY, shiftAt, timelineFor, toScreen, toWorld,
  type Cam, type EntryCounts, type KeyName, type Stage, moreRecords, moreSubjectAreas, moreTables, BEAT_KEY, isNarrow,
} from './model';
import { f1, fieldPaths, pillPoly, polyD, segD, tagPoly, type Field } from './fields';
import { CALLOUTS, FORM, HEADLINE, INGEST_LANES, SUBLINE, WAREHOUSE_ROW, PARTS } from '../../content/entry';

export interface NamedRef { id: string; x: number; y: number; w: number; h: number; ref: { type: string; key: string }; label: string; kind: string; band: number; /** the band whose shift this thing moves with (doors) */ moves?: number }

export interface ViewOpts {
  stage: Stage;
  counts: EntryCounts;
  fields: { warehouse: Field; model: Field };
  /** chapter href for a band (0..3) or the doors (4), or null */
  chapterHref: (band: number) => string | null;
  onOpen?: (ref: { type: string; key: string }) => void;
  onChapter?: (href: string) => void;
  /** a still: the finished drawing at the camera of this beat, all call-outs of that beat, no travel */
  still?: number | null;
  /** which door a phone still frames (the doors beat is two framings there) */
  stillKey?: KeyName | null;
  reduced: boolean;
}

class Grp {
  readonly g: SVGGElement;
  readonly tl = new Timeline();
  constructor(parent: Element, cls: string) { this.g = el('g', { class: cls }, parent); }
  seal(): void { this.tl.custom(1000, 0, () => undefined); }
}

interface IO { t0: number; dur?: number; w?: number; pencil?: boolean; amber?: boolean; cls?: string; rough?: boolean }

const AMBER_W = 1.7;

export class SectionView {
  readonly svg: SVGSVGElement;
  readonly named: NamedRef[] = [];
  readonly host: HTMLElement;
  private world: SVGGElement;
  private hud: SVGGElement;
  private defs: SVGDefsElement;
  private seed = 11;
  private groups: Record<string, Grp> = {};
  private bandG: SVGGElement[] = [];
  private riserG: SVGGElement[] = [];
  private doorG: { g: SVGGElement; band: number }[] = [];
  lastC = 0;
  private marks: { g: SVGGElement; j: number; k: number }[] = [];
  private opts: ViewOpts;
  private coG: Record<number, { g: SVGGElement; items: { leader: SVGPathElement; bal: SVGGElement; text: SVGGElement; ax: number; ay: number; side: 'l' | 'r'; band: number }[] }> = {};
  private numG: SVGGElement;
  private nums: { g: SVGGElement; text: SVGGElement; n: string; band: number; side: 'l' | 'r'; ax: number; door?: number; leader: SVGPathElement; h: number }[] = [];
  private fieldG: SVGGElement[] = [];
  private smallText: SVGTextElement[] = [];
  private mainText: SVGTextElement[] = [];
  readonly tip: HTMLDivElement;
  intro = 0;
  hoverBand: number | null = null;
  lastCam: Cam;
  lastP = 0;

  constructor(host: HTMLElement, opts: ViewOpts) {
    this.host = host; this.opts = opts;
    const { w, h } = opts.stage;
    this.svg = el('svg', { class: 'sec', width: w, height: h, viewBox: `0 0 ${w} ${h}` }, host);
    this.defs = el('defs', {}, this.svg);
    this.world = el('g', { class: 'world' }, this.svg);
    this.hud = el('g', { class: 'hud' }, this.svg);
    this.numG = el('g', { class: 'nums' }, this.hud);
    this.lastCam = cameraAt(0, opts.stage);
    this.buildWorld();
    this.buildHud();
    this.tip = document.createElement('div');
    this.tip.className = 'sec-tip';
    this.tip.setAttribute('aria-hidden', 'true');
    host.appendChild(this.tip);
  }

  // ------------------------------------------------------------------------------------------------ drawing helpers

  private grp(name: string, parent: Element = this.world, cls = ''): Grp {
    const g = new Grp(parent, `${name} ${cls}`.trim());
    this.groups[name] = g;
    return g;
  }

  private ink(g: Grp, d: string, o: IO): SVGPathElement {
    const rd = o.rough === false ? d : roughPath(d, this.seed++, o.pencil ? PENCIL : undefined);
    const cls = `ink${o.pencil ? ' pencil' : ''}${o.amber ? ' amber' : ''}${o.cls ? ' ' + o.cls : ''}`;
    const p = el('path', { class: cls, d: rd, pathLength: 1 }, g.g);
    p.style.setProperty('--w', String(o.w ?? (o.pencil ? 1.2 : 1.1)));
    g.tl.stroke(p, o.t0, o.dur ?? 260);
    return p;
  }
  private fillP(g: Grp, d: string, t0: number, cls = 'pf'): SVGPathElement {
    const p = el('path', { class: cls, d }, g.g);
    g.tl.fade(p, t0, 160);
    return p;
  }
  /** a closed shape: paper first (hides what is behind), then the outline */
  private shape(g: Grp, pts: number[], o: IO): void {
    const d = polyD(pts);
    this.fillP(g, d, o.t0);
    this.ink(g, d, o);
  }
  private hair(g: Grp, d: string, t0: number, pencil = false, dur = 220): void {
    if (!d) return;
    const p = el('path', { class: `ink hairline${pencil ? ' pencil' : ''}`, d, pathLength: 1 }, g.g);
    p.style.setProperty('--w', '0.6');
    g.tl.stroke(p, t0, dur);
  }
  private txt(g: Grp, x: number, y: number, s: string, o: { cls?: string; anchor?: 'start' | 'middle' | 'end'; t0: number; small?: boolean }): SVGTextElement {
    const t = el('text', { class: `wt ${o.cls ?? ''}`, x: f1(x), y: f1(y), 'text-anchor': o.anchor ?? 'middle' }, g.g);
    t.textContent = s;
    g.tl.fade(t, o.t0, 160);
    (o.small ? this.smallText : this.mainText).push(t);
    return t;
  }
  /** a stitched thread (inferred): sewn a stitch at a time */
  private sew(g: Grp, d: string, t0: number, dur: number, len: number): void {
    const id = uid('sw');
    const mk = el('mask', { id, maskUnits: 'userSpaceOnUse', x: 0, y: -1400, width: 1000, height: 1600 }, this.defs);
    const rev = el('path', { d, pathLength: 1, class: 'reveal' }, mk);
    const p = el('path', { d, class: 'thread', mask: `url(#${id})` }, g.g);
    void p;
    g.tl.stitch(rev, stitchCount(len), t0, dur);
  }
  private knot(g: Grp, x: number, y: number, t0: number, amber = false): void {
    const c = el('circle', { class: `knot${amber ? ' amber-k' : ''}`, cx: f1(x), cy: f1(y) }, g.g);
    g.tl.fade(c, t0, 120);
  }
  private named_(id: string, x: number, y: number, w: number, h: number, ref: { type: string; key: string }, label: string, kind: string, band: number, moves?: number): void {
    this.named.push({ id, x, y, w, h, ref, label, kind, band, moves });
  }
  /** a paper-coloured clearing: the field behind it reads as texture, the things on it read as things */
  private clear(g: Grp, x: number, y: number, w: number, h: number, t0 = 40): void {
    this.fillP(g, polyD([x, y, x + w, y, x + w, y + h, x, y + h]), t0, 'pf clearing');
  }
  /** the large band name, drawn inside the assembled section (readable only when pulled back) */
  private bandName(g: Grp, i: number, name: string): void {
    const t = el('text', { class: 'wn', x: f1(X0 + 12), y: f1(bandTop(i) + 26), 'text-anchor': 'start' }, g.g);
    t.textContent = name;
  }

  private frame(g: Grp, i: number, pencil: boolean): void {
    const top = bandTop(i), bot = bandBottom(i);
    const rect = [X0, top, X1, top, X1, bot, X0, bot];
    this.shape(g, rect, { t0: 0, dur: 420, w: pencil ? 1.3 : 1.7, pencil, cls: 'frame', rough: true });
    if (!pencil) {
      const deg = [0, 0, 45, 135][i];
      this.hair(g, segD(hatchSegments({ x0: X0 + 1, y0: bot - 8, x1: X1 - 1, y1: bot - 1 }, deg, 3.4)), 60, false, 360);
    }
  }

  // ------------------------------------------------------------------------------------------------ the world

  private buildWorld(): void {
    const c = this.opts.counts;
    const w = this.world;
    // ground, headline (below the ground)
    const b0 = this.grp('band0', w, 'band b0');
    this.bandG[0] = b0.g;
    this.ground(b0);
    this.bandNetSuite(b0, c);
    b0.seal();
    const r1 = this.grp('riser1', w, 'riser'); this.riserG[0] = r1.g; this.riser(r1, 0); this.thread1(r1); r1.seal();
    const b1 = this.grp('band1', w, 'band b1'); this.bandG[1] = b1.g; this.bandIngestion(b1); b1.seal();
    const r2 = this.grp('riser2', w, 'riser'); this.riserG[1] = r2.g; this.riser(r2, 1); this.thread2(r2); r2.seal();
    const b2 = this.grp('band2', w, 'band b2'); this.bandG[2] = b2.g; this.bandWarehouse(b2, c); b2.seal();
    const r3 = this.grp('riser3', w, 'riser'); this.riserG[2] = r3.g; this.riser(r3, 2); this.thread3(r3); r3.seal();
    const b3 = this.grp('band3', w, 'band b3'); this.bandG[3] = b3.g; this.bandModel(b3, c); b3.seal();
    this.doors();
  }

  private ground(g: Grp): void {
    this.ink(g, `M80 0L820 0`, { t0: 0, dur: 260, w: 1.7, rough: true, cls: 'frame' });
    this.hair(g, segD(hatchSegments({ x0: 82, y0: 2, x1: 818, y1: 10 }, 45, 4)), 40, false, 300);
    const t1 = this.txt(g, 450, 32, HEADLINE[0], { cls: 'wh', anchor: 'middle', t0: 60 });
    const t2 = this.txt(g, 450, 62, HEADLINE[1], { cls: 'wh', anchor: 'middle', t0: 120 });
    const t3 = this.txt(g, 450, 88, SUBLINE, { cls: 'wi', anchor: 'middle', t0: 190 });
    const t4 = this.txt(g, 450, 114, 'Start at the bottom. Scroll.', { cls: 'wm', anchor: 'middle', t0: 240 });
    this.ink(g, 'M439 128L450 139L461 128', { t0: 300, dur: 200, w: 1.5, rough: false });
    void [t1, t2, t3, t4];
  }

  private bandNetSuite(g: Grp, c: EntryCounts): void {
    this.frame(g, 0, false);
    // desk and monitor
    this.shape(g, [262, -30, 452, -30, 452, -22, 262, -22], { t0: 120, dur: 220, w: 1.3 });
    this.ink(g, 'M272 -22L272 0M442 -22L442 0', { t0: 160, dur: 200, w: 1.3 });
    this.shape(g, [348, -60, 366, -60, 366, -30, 348, -30], { t0: 200, dur: 180, w: 1.1 });
    this.shape(g, [262, -192, 452, -192, 452, -60, 262, -60], { t0: 240, dur: 380, w: 1.7, rough: true });
    // the order form on the screen (illustrative: the values are chapter 1's)
    this.hair(g, `M268 -136L446 -136`, 480, false, 160);
    this.txt(g, 274, -168, FORM.title, { cls: 'wt', anchor: 'start', t0: 480 });
    this.txt(g, 274, -146, FORM.customer, { cls: 'wm', anchor: 'start', t0: 520 });
    this.txt(g, 274, -112, FORM.line1[0], { cls: 'wt', anchor: 'start', t0: 560 });
    this.txt(g, 440, -112, FORM.line1[1], { cls: 'wt', anchor: 'end', t0: 560 });
    this.txt(g, 274, -84, FORM.line2[0], { cls: 'wt', anchor: 'start', t0: 600 });
    this.txt(g, 440, -84, FORM.line2[1], { cls: 'wt', anchor: 'end', t0: 600 });
    // line 1 turns amber
    this.ink(g, polyD([270, -128, 444, -128, 444, -102, 270, -102]), { t0: 660, dur: 200, w: AMBER_W, amber: true, pencil: true, rough: false });
    this.txt(g, 274, -112, FORM.line1[0], { cls: 'wt wa', anchor: 'start', t0: 700 });
    this.txt(g, 440, -112, FORM.line1[1], { cls: 'wt wa', anchor: 'end', t0: 700 });
    this.knot(g, 444, -115, 760, true);
    // the records behind the form step out as source tags
    const recs: [string, string][] = [['transactions', 'transactions'], ['transactionline', 'transactionline'], ['customer', 'customer'], ['item', 'item']];
    recs.forEach(([key, label], k) => {
      const y = -184 + k * 38;
      this.shape(g, [486, y, 628, y, 628, y + 30, 486, y + 30], { t0: 780 + k * 40, dur: 200, w: 0.9 });
      this.hair(g, `M490 ${y + 9}L624 ${y + 9}`, 800 + k * 40, false, 120);
      this.txt(g, 557, y + 24, label, { cls: 'wt', t0: 860 + k * 40 });
      this.named_(`rec-${key}`, 486, y, 142, 30, { type: 'netsuiteRecord', key }, label, 'netsuite record', 0);
    });
    this.txt(g, 557, -22, `and ${moreRecords(c)} more`, { cls: 'wm', t0: 960 });
    this.bandName(g, 0, 'NetSuite');
  }

  /** a riser: the section's two edges continue as hairlines, so the space between bands reads as part of the section */
  private riser(g: Grp, below: number): void {
    const y0 = bandTop(below), y1 = bandBottom(below + 1);
    this.ink(g, `M${X0} ${y0}L${X0} ${y1}M${X1} ${y0}L${X1} ${y1}`, { t0: 0, dur: 900, w: 0.6, rough: false, cls: 'hairline edge' });
  }

  private thread1(g: Grp): void {
    // leaves the form at (470,-200), crosses the riser, ends at pipe one's side mouth
    const y0 = bandTop(0), y1 = bandBottom(1);
    const d = `M470 ${y0}C470 ${y0 - 55} 300 ${y1 + 55} 300 ${y1}`;
    this.ink(g, d, { t0: 0, dur: 1000, w: AMBER_W, amber: true, pencil: true, rough: false });
  }

  private bandIngestion(g: Grp): void {
    this.frame(g, 1, true);
    const nLanes = INGEST_LANES.length;
    for (let j = 0; j < nLanes; j++) {
      const x = PIPE_X[j];
      this.shape(g, [x - PIPE_W / 2, PIPE_Y1, x + PIPE_W / 2, PIPE_Y1, x + PIPE_W / 2, PIPE_Y0, x - PIPE_W / 2, PIPE_Y0], { t0: 120 + j * 120, dur: 420, w: 1.2, pencil: true });
      for (let q = 0; q < 4; q++) {
        const yy = PIPE_Y0 - 22 - q * 28;
        this.ink(g, `M${x - 8} ${yy + 5}L${x} ${yy - 3}L${x + 8} ${yy + 5}`, { t0: 400 + j * 120 + q * 30, dur: 120, w: 0.9, pencil: true });
      }
      this.txt(g, x, PIPE_Y0 + 17, INGEST_LANES[j][0], { cls: 'wt', t0: 600 + j * 100 });
      this.txt(g, x, PIPE_Y0 + 32, INGEST_LANES[j][1], { cls: 'wt', t0: 620 + j * 100 });
      // row marks that travel up the pipe as the reader scrolls (a pure function of progress)
      for (let k = 0; k < MARKS_PER_PIPE; k++) {
        const m = el('g', { class: 'rowmark' }, g.g);
        el('rect', { x: -8, y: -4, width: 16, height: 8, class: 'rm-r' }, m);
        el('path', { d: 'M-5 0L5 0', class: 'rm-l' }, m);
        this.marks.push({ g: m, j, k });
      }
    }
    // the order line enters pipe one by its side mouth and rises inside it
    this.ink(g, `M300 ${bandBottom(1)}L300 -420L316 -420`, { t0: 500, dur: 300, w: AMBER_W, amber: true, pencil: true, rough: false });
    this.ink(g, `M${PIPE_X[0]} -420L${PIPE_X[0]} ${PIPE_Y1}`, { t0: 760, dur: 240, w: AMBER_W, amber: true, pencil: true, rough: false });
    this.knot(g, 316, -420, 800, true);
    this.bandName(g, 1, 'Ingestion');
  }

  private thread2(g: Grp): void {
    const y0 = bandTop(1), y1 = bandBottom(2);
    // the order line's row: from pipe one's top to the warehouse band
    this.ink(g, `M${PIPE_X[0]} ${y0}C${PIPE_X[0]} ${y0 - 50} 266 ${y1 + 50} 266 ${y1}`, { t0: 0, dur: 800, w: AMBER_W, amber: true, pencil: true, rough: false });
    // the other rows drop toward their tables
    for (const [x, x2] of [[PIPE_X[1], 440], [PIPE_X[2], 560]] as [number, number][]) {
      this.ink(g, `M${x} ${y0}C${x} ${y0 - 50} ${x2} ${y1 + 50} ${x2} ${y1}`, { t0: 100, dur: 800, w: 1.1, pencil: true, rough: false });
      this.ink(g, `M${x2 - 5} ${y1 + 9}L${x2} ${y1}L${x2 + 5} ${y1 + 9}`, { t0: 880, dur: 100, w: 1.1, pencil: true, rough: false });
    }
  }

  private bandWarehouse(g: Grp, c: EntryCounts): void {
    this.frame(g, 2, false);
    // the field of every table in the lineage file, drawn small and light behind the named tags
    const fg = this.grp('field2', g.g, 'field');
    this.fieldG.push(fg.g);
    const paths = fieldPaths(this.opts.fields.warehouse);
    const order = ['twin', 'other', 'dim', 'uni', 'fact'];
    order.forEach((st, k) => {
      const p = paths[st]; if (!p) return;
      const o = el('path', { class: `ink fld f-${st}`, d: p.outline, pathLength: 1 }, fg.g); o.style.setProperty('--w', st === 'fact' ? '0.6' : '0.42');
      fg.tl.stroke(o, k * 120, 520);
      if (p.marks) { const m = el('path', { class: 'ink fld fm', d: p.marks, pathLength: 1 }, fg.g); m.style.setProperty('--w', '0.35'); fg.tl.stroke(m, 200 + k * 100, 500); }
      if (p.dots) { const d = el('path', { class: 'fld-dots', d: p.dots }, fg.g); fg.tl.fade(d, 400, 300); }
    });
    fg.seal();
    // clearings: paper round the named things, so the field is background texture and the things read as things
    this.clear(g, 262, -840, 9, 200);                    // the gutter the order line climbs in
    this.clear(g, 267, -841, 209, 38);                   // the _SEC twin
    this.clear(g, 271, -803, 200, 56);                   // the fact
    this.clear(g, 267, -733, 278, 36);                   // the landing row
    this.clear(g, 516, -840, 114, 116);                  // the dimensions
    this.clear(g, 538, -664, 98, 22);                    // "and N more"
    // the secured twin (it must be shown to stay truthful: BASE_AMOUNT lives in the _SEC table) and the fact
    this.shape(g, tagPoly(272, -834, 198, 26, 6), { t0: 100, dur: 300, w: 1.1 });
    this.txt(g, 371, -817, 'SALES_ORDER_LINES_F_SEC', { cls: 'wt', t0: 360 });
    this.shape(g, tagPoly(276, -798, 190, 46, 8), { t0: 160, dur: 360, w: 1.7 });
    this.hair(g, segD(hatchSegments({ x0: 410, y0: -796, x1: 464, y1: -754 }, 45, 3.4)), 420, false, 320);
    this.txt(g, 361, -771, 'SALES_ORDER_LINES_F', { cls: 'wt', t0: 400 });
    this.sew(g, 'M371 -808L371 -798', 520, 160, 10);
    // the order line lands as a row: ID 1 | CUSTOMER 88 | TRANSACTION 5120 (illustrative values)
    const cells = [272, 314, 408, 540];
    for (let k = 0; k < 3; k++) {
      this.shape(g, [cells[k], -728, cells[k + 1], -728, cells[k + 1], -702, cells[k], -702], { t0: 560 + k * 40, dur: 200, w: 0.9 });
      this.txt(g, (cells[k] + cells[k + 1]) / 2, -710, WAREHOUSE_ROW[k], { cls: 'wt', t0: 700 + k * 30 });
    }
    // dimensions: a column of tags joined to the fact by stitched threads (inferred)
    const dims: [string, number, boolean][] = [['CUSTOMER_D', -834, false], ['ITEM_D', -796, false], ['DAY_D', -758, true]];
    dims.forEach(([name, y, derived], k) => {
      if (derived) {
        // the derived shape: a double hexagon (DAY_D is NSAW-generated)
        const hx = (x: number, yy: number, w: number, h: number, i: number): number[] => [x + i + h * 0.3, yy + i, x + w - h * 0.3 - i, yy + i, x + w - i, yy + h / 2, x + w - h * 0.3 - i, yy + h - i, x + h * 0.3 + i, yy + h - i, x + i, yy + h / 2];
        this.shape(g, hx(522, y, 100, 28, 0), { t0: 300 + k * 60, dur: 260, w: 0.7 });
        this.ink(g, polyD(hx(522, y, 100, 28, 3)), { t0: 380 + k * 60, dur: 200, w: 0.7 });
      } else this.shape(g, tagPoly(522, y, 100, 28, 6), { t0: 300 + k * 60, dur: 260, w: 1.1 });
      this.txt(g, 574, y + 19, name, { cls: 'wt', t0: 560 + k * 40 });
      this.sew(g, `M466 -775C490 -775 496 ${y + 14} 522 ${y + 14}`, 600 + k * 50, 240, 62);
      this.named_(`wh-${name}`, 522, y, 100, 28, { type: 'physicalTable', key: `DW_NS_${name}` }, `DW_NS_${name}`, 'warehouse table', 2);
    });
    this.named_('wh-fact', 276, -798, 190, 46, { type: 'physicalTable', key: 'DW_NS_SALES_ORDER_LINES_F' }, 'DW_NS_SALES_ORDER_LINES_F', 'fact table', 2);
    this.named_('wh-sec', 272, -834, 198, 26, { type: 'physicalTable', key: 'DW_NS_SALES_ORDER_LINES_F_SEC' }, 'DW_NS_SALES_ORDER_LINES_F_SEC', 'secured twin', 2);
    this.txt(g, 632, -649, `and ${moreTables(c)} more`, { cls: 'wm', anchor: 'end', t0: 820 });
    // the order line climbs in the gutter beside the tags (never over their text) and lands on the row from its left edge
    this.ink(g, `M266 ${bandBottom(2)}L266 ${bandTop(2)}`, { t0: 560, dur: 420, w: AMBER_W, amber: true, rough: false });
    this.ink(g, 'M266 -715L272 -715', { t0: 760, dur: 120, w: AMBER_W, amber: true, rough: false });
    this.knot(g, 272, -715, 800, true);
    this.bandName(g, 2, 'The warehouse');
  }

  private thread3(g: Grp): void {
    const y0 = bandTop(2), y1 = bandBottom(3);
    // the order line leaves the gutter and climbs to the Sales Order pill
    this.ink(g, `M266 ${y0}C266 ${y0 - 45} 380 ${y1 + 45} 380 ${y1 - 6}`, { t0: 0, dur: 800, w: AMBER_W, amber: true, rough: false });
    // real columns climb to business names: explicit, solid ink; the column name rides the line
    this.ink(g, `M304 ${y0}L304 ${y1}`, { t0: 100, dur: 800, w: 1.1, rough: false });
    this.ink(g, `M574 ${y0}L574 ${y1}`, { t0: 200, dur: 800, w: 1.1, rough: false });
    this.txt(g, 310, y0 - 34, 'BASE_AMOUNT', { cls: 'wt halo chip', anchor: 'start', t0: 700 });
    this.txt(g, 568, y0 - 34, 'COMPANYNAME', { cls: 'wt halo chip', anchor: 'end', t0: 760 });
  }

  private bandModel(g: Grp, c: EntryCounts): void {
    this.frame(g, 3, false);
    const fg = this.grp('field3', g.g, 'field');
    this.fieldG.push(fg.g);
    const paths = fieldPaths(this.opts.fields.model);
    const p = paths.sa;
    if (p) {
      const o = el('path', { class: 'ink fld f-sa', d: p.outline, pathLength: 1 }, fg.g); o.style.setProperty('--w', '0.45'); fg.tl.stroke(o, 0, 600);
      const m = el('path', { class: 'ink fld fm', d: p.marks, pathLength: 1 }, fg.g); m.style.setProperty('--w', '0.35'); fg.tl.stroke(m, 200, 500);
    }
    // the nine functional-area groups, named quietly in their gutters (only where the label can reach the minimum size)
    for (const d of this.opts.fields.model.districts) this.txt(fg, d.x + 1, d.y + 7, d.name, { cls: 'wsm', anchor: 'start', t0: 300, small: true });
    fg.seal();
    this.clear(g, 262, -1062, 378, 102);
    // the Sales Order pill, and the two named fields served from real columns
    this.shape(g, pillPoly(330, -996, 150, 30), { t0: 80, dur: 300, w: 1.4 });
    this.hair(g, segD(hatchSegments({ x0: 420, y0: -994, x1: 470, y1: -968 }, 135, 3.2)), 300, false, 240);
    this.txt(g, 395, -976, 'Sales Order', { cls: 'ws', t0: 360 });
    this.shape(g, pillPoly(266, -1048, 190, 28), { t0: 400, dur: 260, w: 1.1 });
    this.txt(g, 361, -1029, 'Line Amount in Base Currency', { cls: 'ws', t0: 640 });
    this.shape(g, pillPoly(494, -1048, 140, 28), { t0: 460, dur: 260, w: 1.1 });
    this.txt(g, 564, -1029, 'Customer Company Name', { cls: 'ws', t0: 700 });
    this.ink(g, 'M304 -960L304 -1020M574 -960L574 -1020', { t0: 40, dur: 300, w: 1.1, rough: false });
    this.ink(g, 'M380 -996L380 -1020M460 -996L460 -1008L530 -1008L530 -1020', { t0: 300, dur: 400, w: 0.9, rough: false });
    this.txt(g, 632, -967, `and ${moreSubjectAreas(c)} more`, { cls: 'wm', anchor: 'end', t0: 820 });
    this.named_('sa-sales-order', 330, -996, 150, 30, { type: 'subjectArea', key: 'NetSuite - Sales Order' }, 'NetSuite - Sales Order', 'subject area', 3);
    this.named_('pc-amount', 266, -1048, 190, 28, { type: 'presentationColumn', key: 'NetSuite - Sales Order::Transaction Lines - Base Currency Amounts::Line Amount in Base Currency' }, 'Line Amount in Base Currency', 'business name', 3);
    this.named_('pc-company', 494, -1048, 140, 28, { type: 'presentationColumn', key: 'NetSuite - Sales Order::Customer::Customer Company Name' }, 'Customer Company Name', 'business name', 3);
    // the order line ends in the pill, then leaves by door two
    this.knot(g, 380, -966, 560, true);
    this.bandName(g, 3, 'The model');
  }

  private doors(): void {
    const person = (g: Grp, x: number, y: number, t0: number): void => {
      const pts: string[] = [];
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; pts.push(`${i ? 'L' : 'M'}${f1(x + 5 * Math.cos(a))} ${f1(y - 36 + 5 * Math.sin(a))}`); }
      this.ink(g, pts.join('') + 'Z', { t0, dur: 160, w: 1.1, pencil: true });
      this.ink(g, `M${x} ${y - 31}L${x} ${y - 14}M${x - 9} ${y - 26}L${x} ${y - 28}L${x + 9} ${y - 26}M${x} ${y - 14}L${x - 5} ${y}M${x} ${y - 14}L${x + 5} ${y}`, { t0: t0 + 60, dur: 200, w: 1.1, pencil: true });
    };
    const gate = (g: Grp, x: number, y: number, t0: number): void => {
      this.ink(g, `M${x} ${y}L${x} ${y - 42}M${x + 30} ${y}L${x + 30} ${y - 42}M${x} ${y - 22}L${x + 30} ${y - 22}`, { t0, dur: 260, w: 1.3, pencil: true });
      const k: string[] = [];
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; k.push(`${i ? 'L' : 'M'}${f1(x + 15 + 3.4 * Math.cos(a))} ${f1(y - 22 + 3.4 * Math.sin(a))}`); }
      this.ink(g, k.join('') + `ZM${x + 15} ${y - 18.6}L${x + 15} ${y - 13}`, { t0: t0 + 120, dur: 140, w: 1, pencil: true });
    };
    // door one: SQL on the tables, on the warehouse band; rows come out
    const ya = -654, yb = -962;
    const A = this.grp('doorA', this.world, 'doors');
    this.doorG.push({ g: A.g, band: 2 });
    this.ink(A, `M640 ${ya - 48}L650 ${ya - 48}L650 ${ya}L640 ${ya}`, { t0: 0, dur: 240, w: 1.5, pencil: true });
    gate(A, 660, ya, 120); person(A, 716, ya, 200);
    this.shape(A, [746, ya - 38, 794, ya - 38, 794, ya, 746, ya], { t0: 280, dur: 220, w: 1, pencil: true });
    for (let k = 1; k < 4; k++) this.ink(A, `M746 ${ya - 38 + k * 9.5}L794 ${ya - 38 + k * 9.5}`, { t0: 420 + k * 30, dur: 120, w: 0.7, pencil: true });
    this.ink(A, `M762 ${ya - 38}L762 ${ya}M778 ${ya - 38}L778 ${ya}`, { t0: 520, dur: 140, w: 0.7, pencil: true });
    // door two: through the model, on the model band; a report with one number
    const B = this.grp('doorB', this.world, 'doors');
    this.doorG.push({ g: B.g, band: 3 });
    this.ink(B, `M640 ${yb - 48}L650 ${yb - 48}L650 ${yb}L640 ${yb}`, { t0: 0, dur: 240, w: 1.5, pencil: true });
    gate(B, 660, yb, 120); person(B, 712, yb, 200);
    this.shape(B, [736, yb - 56, 800, yb - 56, 800, yb, 736, yb], { t0: 280, dur: 240, w: 1, pencil: true });
    this.ink(B, `M742 ${yb - 40}L794 ${yb - 40}`, { t0: 440, dur: 140, w: 1.4, pencil: true });
    this.txt(B, 768, yb - 44, '1,550.50', { cls: 'wt', t0: 520 });
    for (const [x, hgt] of [[744, 16], [756, 26], [768, 11], [780, 20]] as [number, number][]) this.ink(B, `M${x} ${yb - 4}L${x} ${yb - 4 - hgt}`, { t0: 560, dur: 100, w: 2.4, pencil: true, rough: false });
    // the order line leaves through door two and ends at the number (the way out is documented, not in the lineage file)
    const ex = this.grp('exit', this.world, 'exit');
    this.doorG.push({ g: ex.g, band: 3 });
    this.ink(ex, `M480 -983L736 -983`, { t0: 0, dur: 900, w: AMBER_W, amber: true, pencil: true, rough: false });
    this.ink(ex, `M727 -988L736 -983L727 -978`, { t0: 880, dur: 120, w: AMBER_W, amber: true, rough: false });
    this.knot(ex, 736, -983, 960, true);
    A.seal(); B.seal(); ex.seal();
    this.named_('door-a', 640, ya - 48, 80, 48, { type: 'door', key: 'a' }, 'Door one: SQL on the tables', 'door', 4, 2);
    this.named_('door-b', 640, yb - 48, 80, 48, { type: 'door', key: 'b' }, 'Door two: through the model', 'door', 4, 3);
  }

  // ------------------------------------------------------------------------------------------------ the HUD

  private buildHud(): void {
    // lettered call-outs per beat (close up, in the stage margins)
    for (const k of Object.keys(CALLOUTS)) {
      const beat = Number(k);
      const g = el('g', { class: 'co', 'data-beat': beat }, this.hud);
      const items = CALLOUTS[beat].map((c, i) => {
        const a = ANCHORS[beat][i];
        const leader = el('path', { class: 'co-l' }, g);
        const bal = el('g', { class: 'co-b' }, g);
        el('circle', { r: 11 }, bal);
        const lt = el('text', { class: 'co-n', 'text-anchor': 'middle', y: 4 }, bal); lt.textContent = c.letter;
        const text = el('g', { class: 'co-t' }, g);
        c.text.forEach((ln, li) => { const t = el('text', { x: 0, y: li * 17, 'text-anchor': a.side === 'l' ? 'end' : 'start' }, text); t.textContent = ln; });
        return { leader, bal, text, ax: a.x, ay: a.y, side: a.side, band: a.band };
      });
      this.coG[beat] = { g, items };
    }
    // the numbered entries (the assembled section): number, name, the one-line claim and the count beside the band they name
    const ENTRIES: { n: string; band: number; side: 'l' | 'r'; ax: number; door?: number }[] = [
      { n: '1', band: 0, side: 'l', ax: X0 }, { n: '2', band: 1, side: 'l', ax: X0 }, { n: '3', band: 2, side: 'l', ax: X0 }, { n: '4', band: 3, side: 'l', ax: X0 },
      { n: '5a', band: 2, side: 'r', ax: 794, door: -678 }, { n: '5b', band: 3, side: 'r', ax: 800, door: -986 },
    ];
    for (const m of ENTRIES) {
      const g = el('g', { class: 'num', 'data-band': m.band }, this.numG);
      const leader = el('path', { class: 'co-l' }, g);
      const bal = el('g', { class: 'co-b' }, g);
      el('circle', { r: 12 }, bal);
      const nt = el('text', { class: 'co-n', 'text-anchor': 'middle', y: 4 }, bal); nt.textContent = m.n;
      const text = el('g', { class: 'co-t' }, g);
      this.nums.push({ g, text, n: m.n, band: m.band, side: m.side, ax: m.ax, door: m.door, leader, h: 0 });
    }
  }

  /** The entries' text, filled once the copy and counts are known. Wrapped to the margin (about 6.3 px per character at 13 px serif). */
  setNumberedText(lines: { n: string; name: string; claim: string; count: string; short: string }[]): void {
    const st = this.opts.stage;
    const narrow = isNarrow(st);
    const width = entryMargin(st) - 64;
    const maxChars = Math.max(14, Math.floor(width / 6.2));
    this.nums.forEach((nm) => {
      const l = lines.find((x) => x.n === nm.n);
      if (!l) return;
      nm.text.textContent = '';
      if (narrow) return;      // phones: balloons only; the numbered list under the drawing names them
      const anchor = nm.side === 'l' ? 'end' : 'start';
      let y = 0;
      const a = el('text', { class: 'nm-a', x: 0, y, 'text-anchor': anchor }, nm.text); a.textContent = l.name;
      y += 18;
      for (const ln of wrapText(l.claim, maxChars)) { const t = el('text', { class: 'nm-c', x: 0, y, 'text-anchor': anchor }, nm.text); t.textContent = ln; y += 16; }
      if (l.count) { const b = el('text', { class: 'nm-b', x: 0, y: y + 2, 'text-anchor': anchor }, nm.text); b.textContent = l.count; y += 16; }
      nm.h = y;
    });
  }

  // ------------------------------------------------------------------------------------------------ per frame

  update(p: number, hoverBand: number | null = this.hoverBand): void {
    const st = this.opts.stage;
    const still = this.opts.still;
    const tl = timelineFor(st);
    const narrow = isNarrow(st);
    const stillKey: KeyName | null = still != null ? (this.opts.stillKey ?? (BEAT_KEY[still] === 'doors' && narrow ? 'doorA' : BEAT_KEY[still])) : null;
    const pp = still != null ? beatCentre(still, st) : p;
    const cam = stillKey ? camForKey(stillKey, st) : cameraAt(pp, st);
    const c = still != null ? (still === 6 ? 1 : 0) : closeAt(pp, st);
    this.lastCam = cam; this.lastP = p; this.hoverBand = hoverBand; this.lastC = c;
    const k = 1 / cam.s;
    this.world.setAttribute('transform', `translate(${f1(st.w / 2 - cam.cx * cam.s)} ${f1(st.h / 2 - cam.cy * cam.s)}) scale(${cam.s.toFixed(4)})`);
    this.svg.style.setProperty('--k', k.toFixed(4));
    const lod = lodAt(cam, st);
    this.svg.classList.toggle('lod-text', lod.text);
    this.svg.classList.toggle('lod-small', lod.textSmall);
    this.svg.classList.toggle('lod-names', lod.names && c > 0.5);
    this.svg.classList.toggle('closing', c > 0.02);
    // the risers close: bands and doors slide down to meet, risers squeeze to a seam
    this.bandG.forEach((b, i) => b.setAttribute('transform', `translate(0 ${f1(shiftAt(i, c))})`));
    this.doorG.forEach((d) => d.g.setAttribute('transform', `translate(0 ${f1(shiftAt(d.band, c))})`));
    const sy = riserAt(c) / RISER;
    this.riserG.forEach((r, i) => {
      const topOpen = bandTop(i), topClosed = bandTop(i, c);
      r.setAttribute('transform', `translate(0 ${f1(topClosed - sy * topOpen)}) scale(1 ${sy.toFixed(4)})`);
    });
    const full = still != null;
    const r = (w: [number, number]): number => (full ? 1 : reveal(w, pp));
    const g = this.groups, W = tl.win;
    g.band0.tl.setProgress(full ? 1 : Math.max(Math.min(INTRO_FRACTION, this.intro * INTRO_FRACTION), r(W.band0)));
    g.riser1.tl.setProgress(r(W.riser1)); g.band1.tl.setProgress(r(W.band1));
    g.riser2.tl.setProgress(r(W.riser2)); g.band2.tl.setProgress(r(W.band2)); g.field2.tl.setProgress(r(W.field2));
    g.riser3.tl.setProgress(r(W.riser3)); g.band3.tl.setProgress(r(W.band3)); g.field3.tl.setProgress(r(W.field3));
    g.doorA.tl.setProgress(r(W.doorA)); g.doorB.tl.setProgress(r(W.doorB)); g.exit.tl.setProgress(r(W.exit));
    // row marks: pure function of p
    const shown = r(W.band1) > 0.55;
    for (const m of this.marks) {
      m.g.style.display = shown ? '' : 'none';
      if (shown) m.g.setAttribute('transform', `translate(${PIPE_X[m.j]} ${f1(rowMarkY(m.j, m.k, pp, st))})`);
    }
    // accent: the order line at rest, the hovered band under hover
    const acc = accentFor(hoverBand);
    this.svg.classList.toggle('hov', !acc.threadAccent);
    this.bandG.forEach((b, i) => b.classList.toggle('lit', acc.band === i));
    // HUD
    const beat = still != null ? still : beatAt(pp, st);
    for (const [kk, co] of Object.entries(this.coG)) {
      const on = Number(kk) === beat && lod.callouts && !narrow && (still != null || this.inHold(pp, Number(kk)));
      co.g.classList.toggle('on', on);
      if (on) this.placeCallouts(co.items, cam, c);
    }
    const nums = !lod.callouts && c > 0.9;
    this.numG.classList.toggle('on', nums);
    if (nums) this.placeNums(cam, c);
  }

  /** A beat's lettered call-outs show while the camera rests on its band (a little either side), not while it is crossing a riser. */
  private inHold(p: number, beat: number): boolean {
    const [a, b] = dwellOf(beat, this.opts.stage);
    return p >= a - 0.01 && p <= b + 0.01;
  }

  private placeCallouts(items: { leader: SVGPathElement; bal: SVGGElement; text: SVGGElement; ax: number; ay: number; side: 'l' | 'r'; band: number }[], cam: Cam, c: number): void {
    const st = this.opts.stage;
    for (const it of items) {
      const [sx, sy] = toScreen(cam, st, it.ax, it.ay + shiftAt(it.band, c));
      const edgeX = toScreen(cam, st, it.side === 'l' ? X0 : (it.ax > X1 ? 802 : X1), 0)[0];
      const bx = it.side === 'l' ? Math.max(24, edgeX - 34) : Math.min(st.w - 24, edgeX + 34);
      it.leader.setAttribute('d', `M${f1(sx)} ${f1(sy)}L${f1(bx + (it.side === 'l' ? 11 : -11))} ${f1(sy)}`);
      it.bal.setAttribute('transform', `translate(${f1(bx)} ${f1(sy)})`);
      it.text.setAttribute('transform', `translate(${f1(bx + (it.side === 'l' ? -18 : 18))} ${f1(sy - 2)})`);
    }
  }

  private placeNums(cam: Cam, c: number): void {
    const st = this.opts.stage;
    const narrow = isNarrow(st);
    const leftEdge = toScreen(cam, st, X0, 0)[0], rightEdge = toScreen(cam, st, 800, 0)[0];
    for (const n of this.nums) {
      const yWorld = n.door !== undefined ? n.door + shiftAt(n.band, c) : bandMid(n.band, c);
      const sy = toScreen(cam, st, 0, yWorld)[1];
      const ax = toScreen(cam, st, n.ax, 0)[0];
      const bx = n.side === 'l' ? (narrow ? Math.max(18, leftEdge - 24) : leftEdge - 40) : (narrow ? Math.min(st.w - 18, rightEdge + 24) : rightEdge + 40);
      n.leader.setAttribute('d', `M${f1(ax)} ${f1(sy)}L${f1(bx + (n.side === 'l' ? 12 : -12))} ${f1(sy)}`);
      const bal = n.g.querySelector('.co-b') as SVGGElement;
      bal.setAttribute('transform', `translate(${f1(bx)} ${f1(sy)})`);
      n.text.setAttribute('transform', `translate(${f1(bx + (n.side === 'l' ? -22 : 22))} ${f1(sy - n.h / 2 + 8)})`);
    }
  }

  /** the named thing (or band) under a screen point, at the current camera (the bands may be part way through closing) */
  pick(sx: number, sy: number): { named: NamedRef | null; band: number | null } {
    const [x, y] = toWorld(this.lastCam, this.opts.stage, sx, sy);
    const c = this.lastC;
    const named = this.named.find((n) => { const dy = shiftAt(n.moves ?? n.band, c); return x >= n.x && x <= n.x + n.w && y - dy >= n.y && y - dy <= n.y + n.h; }) ?? null;
    let band: number | null = null;
    if (x >= X0 && x <= X1) for (let i = 0; i < 4; i++) if (y >= bandTop(i, c) && y <= bandBottom(i, c)) band = i;
    if (named && named.band === 4) band = null;
    return { named, band };
  }

  setTip(lines: { cls: string; text: string }[] | null, sx = 0, sy = 0): void {
    if (lines === null) { this.tip.classList.remove('show'); return; }
    this.tip.textContent = '';
    for (const l of lines) { const d = document.createElement('div'); d.className = l.cls; d.textContent = l.text; this.tip.appendChild(d); }
    this.tip.classList.add('show');
    const w = this.tip.offsetWidth, h = this.tip.offsetHeight;
    const x = Math.max(4, Math.min(this.opts.stage.w - w - 4, sx - w / 2));
    const y = sy - h - 14 < 4 ? sy + 18 : sy - h - 14;
    this.tip.style.transform = `translate(${f1(x)}px, ${f1(y)}px)`;
  }

  destroy(): void {
    for (const g of Object.values(this.groups)) g.tl.destroy();
    this.svg.remove(); this.tip.remove();
  }
}

/** World anchors of the lettered call-outs: what each one points at, and which margin it sits in. */
export const ANCHORS: Record<number, { x: number; y: number; side: 'l' | 'r'; band: number }[]> = {
  1: [{ x: 262, y: -126, side: 'l', band: 0 }, { x: 628, y: -131, side: 'r', band: 0 }],
  2: [{ x: PIPE_X[0] - PIPE_W / 2, y: -470, side: 'l', band: 1 }, { x: PIPE_X[2] + PIPE_W / 2, y: -440, side: 'r', band: 1 }],
  3: [{ x: 276, y: -775, side: 'l', band: 2 }, { x: 622, y: -792, side: 'r', band: 2 }],
  4: [{ x: 330, y: -981, side: 'l', band: 3 }, { x: 634, y: -1034, side: 'r', band: 3 }],
  5: [{ x: 650, y: -678, side: 'r', band: 2 }, { x: 650, y: -986, side: 'r', band: 3 }],
};

/** Greedy word wrap by character count. */
export function wrapText(text: string, maxChars: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of text.split(/\s+/)) {
    if (cur && (cur + ' ' + w).length > maxChars) { out.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) out.push(cur);
  return out;
}
void BH; void FONT_WORLD; void PARTS; void clamp01; void FONT_NAME;
