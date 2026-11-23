// Small DOM helpers every scene view uses: ink paths drawn by dash offset, text written by a clip. No state of their own.
import { el } from '../../../ink/svg';
import { clamp01 } from '../../../ink/easing';
import { monoWidth } from './stage';

export type InkClass = '' | 'ink2' | 'pencil' | 'amber';
export function inkPath(parent: Element, cls: InkClass, width: number): SVGPathElement {
  const p = el('path', { class: `ink ${cls}`.trim(), pathLength: 1, 'stroke-width': width }, parent);
  p.style.visibility = 'hidden';
  return p;
}
export function setDraw(p: SVGElement, v: number): void {
  if (v <= 0.001) { p.style.visibility = 'hidden'; return; }
  p.style.visibility = '';
  p.style.strokeDashoffset = String(1 - clamp01(v));
}
export function setVis(e: Element, on: boolean): void { (e as SVGElement | HTMLElement).style.visibility = on ? '' : 'hidden'; }

let uidN = 0;
export const uid = (p = 'scn'): string => `${p}${++uidN}`;

export interface TextOpts { size: number; anchor?: 'start' | 'end' | 'middle'; track?: number; tone?: 'ink' | 'ink2'; weight?: number; cls?: string }
export interface TextNode { node: SVGTextElement; clip: SVGRectElement; text: string; last: number; left: number; w: number }

/** mono text that is written in by a clip opening left to right. x, y: the anchor point in the parent's coordinates. */
export function makeText(defs: Element, parent: Element, text: string, x: number, y: number, o: TextOpts): TextNode {
  const id = uid();
  const clipPath = el('clipPath', { id, clipPathUnits: 'userSpaceOnUse' }, defs);
  const rect = el('rect', { x: 0, y: 0, width: 0, height: 0 }, clipPath);
  const anchor = o.anchor ?? 'start';
  const node = el('text', {
    x, y, 'font-size': o.size, 'text-anchor': anchor, class: `scn-t ${o.tone === 'ink2' ? 't2' : ''} ${o.cls ?? ''}`.trim(),
    'clip-path': `url(#${id})`, 'font-weight': o.weight ?? 400, 'letter-spacing': o.track ? `${o.track}em` : '0',
  }, parent);
  node.textContent = text;
  node.style.visibility = 'hidden';
  const w = monoWidth(text, o.size, o.track ?? 0);
  const left = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  rect.setAttribute('x', String(left - 3)); rect.setAttribute('y', String(y - o.size));
  rect.setAttribute('height', String(o.size * 1.5));
  return { node, clip: rect, text, last: -1, left, w };
}
export function writeTo(t: TextNode, v: number): void {
  const q = Math.round(clamp01(v) * 1000) / 1000;
  if (q === t.last) return;
  t.last = q;
  t.clip.setAttribute('width', String(q >= 1 ? t.w + 12 : (t.w + 6) * q));
  setVis(t.node, q > 0);
}
/** HTML block written in by a clip opening left to right */
export function clipWrite(d: HTMLElement, v: number): void {
  const q = clamp01(v);
  d.style.visibility = q <= 0 ? 'hidden' : '';
  d.style.clipPath = q >= 1 ? 'none' : `inset(-6px ${((1 - q) * 100).toFixed(2)}% -6px -6px)`;
}
