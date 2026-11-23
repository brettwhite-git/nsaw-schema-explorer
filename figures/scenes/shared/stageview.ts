// The stage: one SVG in DESIGN units (1200 x 780, scaled to the stage), an HTML layer for handwriting, and the shared
// furniture drawn from a FurnitureState. Furniture is quiet: three small numbered paper notes in the top-right corner,
// a ledger slip that appears only when a line is written (then tucks away to a thin tab), a tiny locator, one legend line.
import '../../../styles/drawn.css';
import '../scene.css';
import { el } from '../../../ink/svg';
import { writeText, type WrittenHandle } from '../../../ink/written';
import { Pen, ptsD, rectPts, tornPts } from '../objects';
import { LAYERS, QUESTIONS, currentGeom, ledgerText, pinSlot, pinnedness, PIN, type FurnitureState } from './furniture';
import { metrics, zonesFor, type Metrics, type Stage, type Zones } from './stage';
import type { Names } from '../order/data';

export const QUESTION_WINDOW = 2800;   // ms one written question takes (the state's write 0..1 maps onto it)
export const LEDGER_WINDOW = 1800;

export interface StageOpts { names: Names; reduced: boolean; onQuestion?: (i: number) => void }
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

export class StageView {
  readonly m: Metrics; readonly zones: Zones;
  readonly stageEl: HTMLDivElement; readonly svg: SVGSVGElement; readonly defs: SVGDefsElement;
  /** the design-space group every drawing goes into */
  readonly root: SVGGElement; readonly backG: SVGGElement; readonly sceneG: SVGGElement; readonly frontG: SVGGElement;
  readonly sceneHtml: HTMLDivElement; private furnHtml: HTMLDivElement; private alt: HTMLDivElement;
  private qs: { div: HTMLDivElement; note: WrittenHandle; paper: SVGGElement; btn: HTMLButtonElement; tick: SVGPathElement }[] = [];
  private ledgerG!: SVGGElement; private ledgerText!: SVGGElement; private ledgerClip!: SVGRectElement; private tabG!: SVGGElement;
  private locBars: SVGGElement[] = []; private locLabel!: SVGTextElement; private locG!: SVGGElement;
  private legendG!: SVGGElement;
  private lastAlt = '';

  constructor(readonly host: HTMLElement, readonly stage: Stage, private readonly o: StageOpts) {
    this.m = metrics(stage); this.zones = zonesFor(this.m);
    host.textContent = '';
    host.classList.add('scn');
    this.stageEl = document.createElement('div');
    this.stageEl.className = 'scn-stage';
    this.stageEl.style.width = `${stage.w}px`; this.stageEl.style.height = `${stage.h}px`;
    this.stageEl.dataset.kind = this.m.kind;
    host.appendChild(this.stageEl);
    this.svg = el('svg', { class: 'fig scn-svg', width: stage.w, height: stage.h, viewBox: `0 0 ${stage.w} ${stage.h}`, 'aria-hidden': 'true', focusable: 'false' }, this.stageEl);
    this.defs = el('defs', {}, this.svg);
    this.root = el('g', { class: 'scn-root', transform: `translate(${this.m.ox.toFixed(2)} ${this.m.oy.toFixed(2)}) scale(${this.m.k.toFixed(5)})` }, this.svg);
    this.backG = el('g', { class: 'scn-furniture-back' }, this.root);
    this.sceneG = el('g', { class: 'scn-scene' }, this.root);
    this.frontG = el('g', { class: 'scn-furniture-front' }, this.root);
    this.sceneHtml = document.createElement('div'); this.sceneHtml.className = 'scn-html';
    this.furnHtml = document.createElement('div'); this.furnHtml.className = 'scn-html scn-furn';
    this.stageEl.append(this.sceneHtml, this.furnHtml);
    this.alt = document.createElement('div'); this.alt.className = 'scn-alt'; this.alt.setAttribute('role', 'status');
    host.appendChild(this.alt);
    this.buildLegend(); this.buildLocator(); this.buildLedger(); this.buildQuestions();
  }

  // ------------------------------------------------------------------------------------------------ build
  private buildQuestions(): void {
    const { m } = this;
    QUESTIONS.forEach((q, i) => {
      const div = document.createElement('div');
      div.className = 'scn-q';
      div.dataset.q = String(i);
      const inner = document.createElement('div'); inner.className = 'scn-qin'; div.appendChild(inner);
      const note = writeText(inner, [...q.lines], { seed: 31 + i, window: QUESTION_WINDOW, reduced: false, tilt: 0.6 });
      this.furnHtml.appendChild(div);
      // the pinned paper note: number and short form, a little tilt, a pin
      const sl = pinSlot(i);
      const paper = el('g', { class: 'scn-pin', transform: `rotate(${[-1.2, 0.8, -0.6][i]} ${sl.x + sl.w / 2} ${sl.y + sl.h / 2})` }, this.frontG);
      const pen = new Pen(this.svg, 5100 + i * 37);
      pen.solid(paper, rectPts(sl.x, sl.y, sl.w, sl.h), 'support', 'ink', { shade: [3, 3] });
      pen.text(paper, sl.x + 18, sl.y + 27, String(i + 1), { size: 18, face: 'mono', weight: 600, fill: 'var(--ink-2)' });
      pen.text(paper, sl.x + 44, sl.y + 27, q.short, { size: 19, weight: 500 });
      el('circle', { cx: sl.x + sl.w - 12, cy: sl.y + 9, r: 2.6, fill: 'var(--ink-2)', stroke: 'none' }, paper);
      paper.style.visibility = 'hidden';
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'scn-badge';
      btn.setAttribute('aria-label', `Question ${i + 1}: ${q.lines.join(' ')} Jump to the scene that answers it.`);
      btn.addEventListener('click', (e) => { e.stopPropagation(); this.o.onQuestion?.(i); });
      Object.assign(btn.style, { left: `${m.X(sl.x)}px`, top: `${m.Y(sl.y)}px`, width: `${m.S(sl.w)}px`, height: `${m.S(sl.h)}px` });
      this.furnHtml.appendChild(btn);
      const tick = el('path', { d: 'M0 9L6 16L19 0', fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, this.frontG);
      tick.style.visibility = 'hidden';
      this.qs.push({ div, note, paper, btn, tick });
    });
  }

  private buildLedger(): void {
    const z = this.zones, m = this.m;
    const x = (z.ledger.x - m.ox) / m.k, y = (z.ledger.y - m.oy) / m.k;
    this.ledgerG = el('g', { class: 'scn-ledger' }, this.frontG);
    const pen = new Pen(this.svg, 7700);
    const body = el('g', {}, this.ledgerG);
    const w = 316, h = 92;
    pen.solid(body, [...tornPts([x + 4, y], [x + w, y], 12, 5, 77, 1), [x + w, y + h], [x + 4, y + h]], 'support', 'ink', { shade: [4, 4] });
    pen.text(body, x + 24, y + 30, 'LEDGER', { size: 14, face: 'mono', weight: 500, fill: 'var(--ink-2)', track: 0.14 });
    const id = 'ledger-clip';
    const cp = el('clipPath', { id, clipPathUnits: 'userSpaceOnUse' }, this.defs);
    this.ledgerClip = el('rect', { x: x + 10, y: y + 36, width: 0, height: 52 }, cp);
    this.ledgerText = el('g', { 'clip-path': `url(#${id})` }, body);
    const t = ledgerText(1, this.o.names.count);
    const c = t.indexOf(', ');
    const lines = c > 0 ? [t.slice(0, c + 1), t.slice(c + 2)] : [t];
    lines.forEach((ln, i) => pen.text(this.ledgerText, x + 24, y + 58 + i * 26, ln, { size: 22, weight: 600 }));
    (this.ledgerG as unknown as { _o: [number, number] })._o = [x, y];
    this.ledgerG.style.visibility = 'hidden';
    // the thin tab the slip becomes
    this.tabG = el('g', { class: 'scn-ledger-tab' }, this.frontG);
    const tx = x + w - 124, ty = y + h + 10;
    pen.solid(this.tabG, rectPts(tx, ty, 124, 26), 'support', 'ink', { shade: [2, 2] });
    pen.text(this.tabG, tx + 14, ty + 19, 'LEDGER · 1', { size: 14, face: 'mono', weight: 500, fill: 'var(--ink-2)', track: 0.08 });
    this.tabG.style.visibility = 'hidden';
  }

  /** the locator: a tiny building, the lit floor hatched */
  private buildLocator(): void {
    const z = this.zones, m = this.m;
    const x = (z.locator.x - m.ox) / m.k, y = (z.locator.y - m.oy) / m.k;
    const pen = new Pen(this.svg, 8300);
    this.locG = el('g', { class: 'scn-locator' }, this.frontG);
    el('rect', { x: x + 3, y: y - 1, width: 38, height: 52, fill: 'var(--paper)', 'fill-opacity': 0.9, stroke: 'none' }, this.locG);
    this.locLabel = el('text', { x, y: y - 6, 'text-anchor': 'start' }, this.locG) as SVGTextElement;
    this.locLabel.style.display = 'none';
    for (let i = 0; i < 5; i++) {
      const g = el('g', {}, this.locG);
      const by = y + 4 + (4 - i) * 9, r = rectPts(x + 8, by, 26, 7);
      pen.hatch(g, ptsD(r), { x0: x + 8, y0: by, x1: x + 34, y1: by + 7 }, 45, 2.2, 0.9);
      pen.stroke(g, ptsD(r), 'ghost', 'ink', { op: 0.9 });
      this.locBars.push(g);
    }
    this.locG.style.visibility = 'hidden';
  }

  private buildLegend(): void {
    const z = this.zones, m = this.m;
    const x0 = (z.legend.x - m.ox) / m.k, y = (z.legend.y - m.oy) / m.k + 18;
    const pen = new Pen(this.svg, 9100);
    this.legendG = el('g', { class: 'scn-legend' }, this.frontG);
    el('rect', { x: x0 - 6, y: y - 22, width: 880, height: 32, fill: 'var(--paper)', 'fill-opacity': 0.9, stroke: 'none' }, this.legendG);
    const labels = ['in the lineage data', 'in Oracle’s documentation', 'invented for the example'];
    let x = x0 + 24;
    labels.forEach((lab, i) => {
      if (i === 2) pen.stroke(this.legendG, `M${x} ${y - 4}L${x + 34} ${y - 4}`, 'support', 'ink', { rough: 0.9, colour: 'var(--pencil)', dash: '5 4' });
      else pen.stroke(this.legendG, `M${x} ${y - 4}L${x + 34} ${y - 4}`, 'support', 'ink');
      if (i === 1) el('circle', { cx: x + 17, cy: y - 4, r: 3.2, fill: 'var(--paper)', stroke: 'var(--ink-2)', 'stroke-width': 1 }, this.legendG);
      pen.text(this.legendG, x + 42, y, lab, { size: 12, face: 'mono', fill: 'var(--ink-2)' });
      x += 42 + lab.length * 7.4 + 26;
    });
    pen.text(this.legendG, x + 6, y, 'The order is an illustration.', { size: 13, italic: true, fill: 'var(--ink-2)' });
    this.legendG.style.visibility = 'hidden';
  }

  // ------------------------------------------------------------------------------------------------ apply
  applyFurniture(f: FurnitureState): void {
    const { m } = this;
    f.questions.forEach((q, i) => {
      const v = this.qs[i], g = currentGeom(m, i, q);
      const pin = pinnedness(q);
      const onStage = pin < 0.999;
      Object.assign(v.div.style, { left: `${g.x}px`, top: `${g.y}px`, fontSize: `${g.size}px`, opacity: String(clamp01(1 - pin * 1.4)), display: onStage ? '' : 'none' });
      v.note.seek(q.write <= 0 ? -1 : q.write * QUESTION_WINDOW);
      v.paper.style.visibility = q.write > 0 && pin > 0.01 ? '' : 'hidden';
      v.paper.style.opacity = String(clamp01(pin * 1.2));
      const pinned = pin >= 0.999 && q.write > 0;
      v.btn.style.pointerEvents = pinned ? 'auto' : 'none'; v.btn.tabIndex = pinned ? 0 : -1;
      const sl = pinSlot(i);
      v.tick.setAttribute('transform', `translate(${(sl.x - 28).toFixed(1)} ${(sl.y + 10).toFixed(1)})`);
      v.tick.setAttribute('pathLength', '1'); v.tick.style.strokeDasharray = '1 1';
      v.tick.style.strokeDashoffset = String(1 - clamp01(q.tick));
      v.tick.style.visibility = q.tick > 0 && pin > 0.5 ? '' : 'hidden';
    });
    const e = f.ledger[f.ledger.length - 1];
    const w = e ? clamp01(e.write) : 0, tuck = e ? clamp01(e.tuck) : 0;
    this.ledgerG.style.visibility = w > 0 && tuck < 1 ? '' : 'hidden';
    this.ledgerG.style.opacity = String(1 - tuck);
    this.ledgerClip.setAttribute('width', String(w >= 1 ? 330 : 330 * w));
    const o = (this.ledgerG as unknown as { _o: [number, number] })._o;
    this.ledgerG.setAttribute('transform', `translate(${(tuck * 40).toFixed(1)} ${(tuck * 40).toFixed(1)})`);
    void o;
    this.tabG.style.visibility = e && tuck > 0 ? '' : 'hidden';
    this.tabG.style.opacity = String(tuck);
    const L = f.locator;
    this.locG.style.visibility = L.draw > 0 ? '' : 'hidden';
    this.locG.style.opacity = String(clamp01(L.draw));
    this.locLabel.textContent = LAYERS[L.layer];
    this.locBars.forEach((b, i) => { b.style.opacity = String(i === L.layer ? 1 : 0.3); });
    this.legendG.style.visibility = f.legend > 0 ? '' : 'hidden';
    this.legendG.style.opacity = String(clamp01(f.legend));
  }

  /** clear everything a scene drew (the furniture stays) */
  resetScene(): void { this.sceneG.textContent = ''; this.sceneHtml.textContent = ''; }

  setAlt(text: string): void { if (text !== this.lastAlt) { this.lastAlt = text; this.alt.textContent = text; } }

  destroy(): void {
    this.qs.forEach((q) => q.note.destroy());
    this.host.textContent = ''; this.host.classList.remove('scn');
  }
}
void PIN;
