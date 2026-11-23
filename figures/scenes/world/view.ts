// DOM view of a world: one <g> per object (drawn once by its object function), moved, dimmed and revealed each frame.
import { roughPath } from '../../../ink/rough';
import { el } from '../../../ink/svg';
import { writeText, type WrittenHandle } from '../../../ink/written';
import { Pen, type Spec } from '../objects';
import { paintFigure } from '../figures';
import type { Metrics } from '../shared/stage';
import { uid } from '../shared/draw';
import { stringD } from '../objects';
import { kindDef, type EState, type TState, type TextDef, type WorldDef, type WorldState, type Camera } from './index';

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const hash = (s: string): number => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) % 9000 + 1000; };

interface Ent {
  g: SVGGElement; strokes: SVGPathElement[]; fades: SVGElement[]; texts: SVGElement[]; shades: SVGElement[];
  keyed: { el: SVGElement; name: string; inv: boolean }[]; lens: SVGElement[]; fs: number[]; consts: boolean[]; textKey: string; figKey: string;
  last: { draw: number; props: string; sep: number; tf: string; op: number };
}
interface Str { g: SVGGElement; path: SVGPathElement; k1: SVGCircleElement; k2: SVGCircleElement; key: string }
interface Txt { def: TextDef; g?: SVGGElement; clip?: SVGRectElement; est: number; div?: HTMLDivElement; note?: WrittenHandle; last: number }

function prepare(g: SVGGElement): Ent {
  const strokes: SVGPathElement[] = [], fades: SVGElement[] = [], texts: SVGElement[] = [], shades: SVGElement[] = [], keyed: Ent['keyed'] = [], lens: SVGElement[] = [];
  g.querySelectorAll('*').forEach((n) => {
    const e = n as SVGElement;
    const r = e.getAttribute('data-r');
    if (r === 's') { const p = e as SVGPathElement; p.setAttribute('pathLength', '1'); p.style.strokeDasharray = '1 1'; strokes.push(p); }
    else if (r === 'f') fades.push(e);
    else if (r === 't') texts.push(e);
    if (e.classList.contains('shade')) shades.push(e);
    const k = e.getAttribute('data-k');
    if (k === 'len') lens.push(e);
    else if (k) keyed.push({ el: e, name: k.replace(/^!/, ''), inv: k.startsWith('!') });
  });
  const fs = texts.map((t) => parseFloat(t.style.fontSize || '0') || 0); const consts = texts.map((t) => t.hasAttribute('data-c'));
  return { g, strokes, fades, texts, shades, keyed, lens, fs, consts, textKey: '', figKey: '', last: { draw: -1, props: '\u0000', sep: -1, tf: '', op: -1 } };
}

export class WorldView {
  private ents = new Map<string, Ent>();
  private strs = new Map<string, Str>();
  private txts = new Map<string, Txt>();

  private worldG: SVGGElement; private screenG: SVGGElement; private cam: Camera = { cx: 600, cy: 390, s: 1 };
  constructor(private root: SVGGElement, private defs: Element, private html: HTMLElement, private m: Metrics, private def: WorldDef) {
    this.worldG = el('g', { class: 'world' }, root); this.screenG = el('g', { class: 'screen' }, root);
    for (const d of def.entities.slice().sort((a, b) => a.z - b.z)) {
      const host = (d.space ?? 'world') === 'screen' ? this.screenG : this.worldG;
      if (d.kind === 'string') {
        const g = el('g', { 'data-id': d.id }, host); g.style.display = 'none';
        const path = el('path', { fill: 'none', 'stroke-linecap': 'round', 'pathLength': 1 }, g);
        const k1 = el('circle', { r: 2.5 }, g), k2 = el('circle', { r: 2.5 }, g);
        this.strs.set(d.id, { g, path, k1, k2, key: '' });
        continue;
      }
      const g = el('g', { 'data-id': d.id, class: 'obj' }, host); g.style.display = 'none';
      const svg = root.ownerSVGElement as SVGSVGElement;
      if (d.kind !== 'figure') {
        const pen = new Pen(svg, hash(d.id), this.defs as SVGDefsElement);
        pen.nss = (d.space ?? 'world') === 'world';
        kindDef(d.kind)!.draw(pen, g, d.spec as Spec);
      }
      this.ents.set(d.id, prepare(g));
    }
    for (const t of def.texts) this.buildText(t);
  }

  private buildText(def: TextDef): void {
    const est = Math.max(...def.lines.map((l) => l.length)) * def.size * (def.kind === 'hand' ? 0.38 : 0.52);
    if (def.kind === 'hand') {
      const div = document.createElement('div'); div.className = 'scn-note'; div.dataset.id = def.id;
      Object.assign(div.style, { left: `${this.m.X(def.x)}px`, top: `${this.m.Y(def.y)}px`, fontSize: `${this.m.F(def.size, 14)}px`, visibility: 'hidden' });
      this.html.appendChild(div);
      const note = writeText(div, [...def.lines], { seed: def.seed ?? hash(def.id) % 90, window: 1400, reduced: false, tilt: 0.5 });
      this.txts.set(def.id, { def, div, note, est, last: -1 });
      return;
    }
    const g = el('g', { 'data-id': def.id }, this.screenG); g.style.display = 'none';
    const id = uid('wtc');
    const cp = el('clipPath', { id, clipPathUnits: 'userSpaceOnUse' }, this.defs);
    const left = def.anchor === 'middle' ? def.x - est / 2 : def.anchor === 'end' ? def.x - est : def.x;
    const clip = el('rect', { x: left - 8, y: def.y - def.size * 1.1, width: 0, height: def.size * (1.35 * def.lines.length + 0.4) }, cp);
    const back = this.m ? 0 : 0; void back;
    const w0 = est + 28, h0 = def.size * 1.25 * def.lines.length + 10;
    const left0 = def.anchor === 'middle' ? def.x - w0 / 2 : def.anchor === 'end' ? def.x - w0 : def.x - 14;
    const bd = el('rect', { x: left0, y: def.y - def.size * 1.0, width: w0, height: h0, fill: 'var(--paper)', 'fill-opacity': 0.9, stroke: 'none' }, g);
    (bd as SVGElement).setAttribute('rx', '4');
    const inner = el('g', { 'clip-path': `url(#${id})` }, g);
    def.lines.forEach((ln, i) => {
      const t = el('text', { x: def.x, y: def.y + i * def.size * 1.22, 'text-anchor': def.anchor ?? 'start' }, inner);
      t.textContent = ln;
      t.setAttribute('style', `font-family:var(--serif);font-size:${def.size}px;font-weight:${def.weight ?? 400};fill:${def.tone === 'ink2' ? 'var(--ink-2)' : 'var(--ink)'};${def.italic ? 'font-style:italic;' : ''}`);
    });
    this.txts.set(def.id, { def, g, clip, est, last: -1 });
  }

  apply(s: WorldState): void {
    const c = s.camera;
    if (c.cx !== this.cam.cx || c.cy !== this.cam.cy || c.s !== this.cam.s) this.cam = c;
    this.worldG.setAttribute('transform', `translate(600 390) scale(${c.s.toFixed(5)}) translate(${(-c.cx).toFixed(3)} ${(-c.cy).toFixed(3)})`);
    const seen = new Set<string>();
    for (const e of s.entities) { seen.add(e.id); if (e.kind === 'string') this.applyString(e); else this.applyEnt(e); }
    this.ents.forEach((v, id) => { if (!seen.has(id)) v.g.style.display = 'none'; });
    this.strs.forEach((v, id) => { if (!seen.has(id)) v.g.style.display = 'none'; });
    const ts = new Map(s.texts.map((t) => [t.id, t]));
    this.txts.forEach((v, id) => this.applyText(v, ts.get(id)));
  }

  private applyEnt(e: EState): void {
    const v = this.ents.get(e.id); if (!v) return;
    v.g.style.display = '';
    if (e.kind === 'figure' && e.solved) {
      const key = JSON.stringify([e.x, e.y, e.H, e.flip, e.fig]).slice(0, 400);
      if (key !== v.figKey) { v.figKey = key; v.g.textContent = ''; paintFigure(v.g, e.solved, (e.H ?? 76) * 1); }
      const op0 = Math.round(e.op * 1000) / 1000; if (op0 !== v.last.op) { v.g.style.opacity = String(op0); v.last.op = op0; }
      return;
    }
    const cx = (e.w / 2) * e.s, cy = (e.h / 2) * e.s;
    const tf = `translate(${e.x.toFixed(2)} ${e.y.toFixed(2)}) rotate(${e.rot.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)}) scale(${e.s.toFixed(4)})`;
    if (tf !== v.last.tf) { v.g.setAttribute('transform', tf); v.last.tf = tf; }
    const tk = `${e.s.toFixed(3)}|${this.cam.s.toFixed(3)}|${e.space}`;
    if (tk !== v.textKey) {
      v.textKey = tk;
      const cs = e.space === 'world' ? this.cam.s : 1;
      v.texts.forEach((t, i) => {
        const fs0 = v.fs[i]; if (!fs0) return;
        let eff = fs0 * e.s * cs;
        if (v.consts[i]) { t.style.fontSize = `${(fs0 / (e.s * cs)).toFixed(3)}px`; eff = fs0; }
        t.style.display = eff < 10 || (v.consts[i] && cs > 2.2) ? 'none' : '';
      });
    }
    const op = Math.round(e.op * 1000) / 1000;
    if (op !== v.last.op) { v.g.style.opacity = String(op); v.last.op = op; }
    if (Math.abs(e.sep - v.last.sep) > 0.002) { v.shades.forEach((n) => (n.style.opacity = String(e.sep))); v.last.sep = e.sep; }
    const pk = Object.keys(e.props).sort().map((k) => `${k}:${e.props[k].toFixed(3)}`).join('|');
    if (pk !== v.last.props) {
      v.last.props = pk;
      for (const kd of v.keyed) { const val = clamp01(e.props[kd.name] ?? 0); kd.el.style.opacity = String(kd.inv ? 1 - val : val); }
      for (const n of v.lens) { const len = clamp01(e.props.len ?? 1), ox = Number(n.getAttribute('data-ox') ?? 0); n.setAttribute('transform', `translate(${ox} 0) scale(${Math.max(0.001, len)} 1) translate(${-ox} 0)`); }
    }
    const d = Math.round(e.draw * 1000) / 1000;
    if (d !== v.last.draw) {
      v.last.draw = d;
      const n = v.strokes.length;
      v.strokes.forEach((p, i) => { p.style.strokeDashoffset = String(1 - clamp01(d * 1.7 - (0.7 * i) / Math.max(1, n))); });
      const f = clamp01((d - 0.25) * 1.6), t = clamp01((d - 0.55) * 2.2);
      v.fades.forEach((n2) => (n2.style.opacity = String(f)));
      v.texts.forEach((n2) => (n2.style.opacity = String(t)));
    }
  }

  private applyString(e: EState): void {
    const v = this.strs.get(e.id); if (!v || !e.a || !e.b) return;
    v.g.style.display = '';
    const style = e.style ?? 'string';
    const key = `${e.a.map((n) => n.toFixed(0))}|${e.b.map((n) => n.toFixed(0))}|${e.sag}|${style}`;
    const light = style !== 'string';
    if (key !== v.key) {
      v.key = key;
      const d = style === 'plumb' ? `M${e.a[0].toFixed(1)} ${e.a[1].toFixed(1)}L${e.b[0].toFixed(1)} ${e.b[1].toFixed(1)}` : roughPath(stringD(e.a, e.b, e.sag ?? 24), hash(e.id), { roughness: 0.25 });
      v.path.setAttribute('d', d);
      v.k1.setAttribute('cx', e.a[0].toFixed(1)); v.k1.setAttribute('cy', e.a[1].toFixed(1));
      v.k2.setAttribute('cx', e.b[0].toFixed(1)); v.k2.setAttribute('cy', e.b[1].toFixed(1));
      v.path.setAttribute('stroke', style === 'light' ? 'var(--pencil)' : 'var(--ink)');
      v.path.setAttribute('stroke-width', style === 'plumb' ? '0.8' : style === 'light' ? '1.1' : '1.2');
      if (light) v.path.removeAttribute('pathLength'); else v.path.setAttribute('pathLength', '1');
      v.path.style.strokeDasharray = style === 'plumb' ? '3 5' : style === 'light' ? '5 6' : '1 1';
      v.k1.setAttribute('fill', 'var(--ink)'); v.k2.setAttribute('fill', 'var(--ink)');
      v.k1.style.display = v.k2.style.display = light ? 'none' : '';
    }
    const inv = e.space === 'world' ? 1 / this.cam.s : 1;
    v.path.setAttribute('stroke-width', ((style === 'plumb' ? 0.8 : style === 'light' ? 1.1 : 1.3) * inv).toFixed(3));
    v.k1.setAttribute('r', (2.5 * inv).toFixed(3)); v.k2.setAttribute('r', (2.5 * inv).toFixed(3));
    v.g.style.opacity = String(e.op);
    if (style === 'string') v.path.style.strokeDashoffset = String(1 - clamp01(e.draw * 1.1));
    else v.path.style.strokeDashoffset = '0';
    if (style !== 'string') v.g.style.opacity = String(e.op * clamp01(e.draw * 1.5));
    v.k1.style.opacity = String(clamp01((e.draw - 0.9) * 10)); v.k2.style.opacity = String(clamp01((e.draw - 0.9) * 10));
  }

  private applyText(v: Txt, s: TState | undefined): void {
    const q = s ? Math.round(s.draw * 1000) / 1000 : 0, op = s ? s.op : 0;
    const key = q * 10 + op;
    if (key === v.last) return;
    v.last = key;
    if (v.div) {
      v.div.style.visibility = q > 0 && op > 0.01 ? '' : 'hidden';
      v.div.style.opacity = String(op);
      v.note?.seek(q <= 0 ? -1 : q * 1400);
      return;
    }
    if (!v.g || !v.clip) return;
    if (!s || q <= 0 || op <= 0.01) { v.g.style.display = 'none'; return; }
    v.g.style.display = ''; v.g.style.opacity = String(op);
    v.clip.setAttribute('width', String(q >= 1 ? v.est + 80 : (v.est + 16) * q));
  }

  destroy(): void { this.txts.forEach((t) => { t.note?.destroy(); t.div?.remove(); }); }
}
