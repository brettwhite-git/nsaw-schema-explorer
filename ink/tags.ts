// The four layer tags, exactly as in the lab (rulebook 1.6, DESIGN.md section 4):
// shape, outline weight, hatch angle and label face carry the layer; colour never does.
import tokens from '../tokens.json';
import { hatchSegments, stipplePoints } from './hatch';
import { roughPath, roughRect } from './rough';
import type { Scene } from './scene';
import { el, f1, uid } from './svg';

export type Layer = 'source' | 'warehouse' | 'semantic' | 'derived';
export type LabelFace = 'mono' | 'serif' | 'serifi';
export type TagShape = 'rect' | 'punch' | 'pill' | 'hex';

export interface LayerSpec {
  name: string;
  shape: TagShape;
  weight: number;
  /** degrees, or -1 for stipple */
  hatch: number;
  rank: number;
  word: string;
  face: LabelFace;
}

const L = tokens.layers;
export const LAYERS: Record<Layer, LayerSpec> = {
  source: { name: 'NetSuite source', shape: 'rect', weight: L.source.outline, hatch: L.source.hatchDeg, rank: 1, word: 'rectangle', face: 'mono' },
  warehouse: { name: 'Warehouse', shape: 'punch', weight: L.warehouse.outline, hatch: L.warehouse.hatchDeg, rank: 2, word: 'punched tag', face: 'mono' },
  semantic: { name: 'Semantic model', shape: 'pill', weight: L.semantic.outline, hatch: L.semantic.hatchDeg, rank: 3, word: 'pill', face: 'serif' },
  derived: { name: 'Derived', shape: 'hex', weight: L.derived.outline[0], hatch: -1, rank: 4, word: 'double hexagon', face: 'serifi' },
};

/** 11 px mono advance (0.6 em) plus 0.12 em tracking. */
export const MONO_ADV = 7.9;

/** Width of a tag for a label: label length x 7.9 + 36 (mono) or label width + 24 (serif, estimated). */
export function tagWidth(layer: Layer, label: string, face: LabelFace = LAYERS[layer].face): number {
  if (face === 'mono') return Math.round(label.length * MONO_ADV + 36);
  return Math.round(label.length * 6.4 + 24);
}

/** Clean outline path for a tag shape. */
export function shapeD(shape: TagShape, x: number, y: number, w: number, h: number): string {
  if (shape === 'rect') return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
  if (shape === 'punch') {
    const c = 8;
    return `M${x + c} ${y}H${x + w}V${y + h}H${x + c}L${x} ${y + h - c}V${y + c}Z`;
  }
  if (shape === 'pill') {
    const r = h / 2;
    return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
  }
  const c = h * 0.42;
  return `M${x + c} ${y}H${x + w - c}L${x + w} ${y + h / 2}L${x + w - c} ${y + h}H${x + c}L${x} ${y + h / 2}Z`;
}

export interface TagOpts {
  layer: Layer;
  label: string;
  seed: number;
  face?: LabelFace;
  id?: string;
  cls?: string;
}

export interface TagHandle {
  g: SVGGElement;
  x: number; y: number; w: number; h: number;
  label: SVGTextElement;
  /** schedule this tag's draw-in on the scene timeline; returns the time it is finished */
  schedule(t0: number): number;
}

const HATCH = tokens.line.hatch;

export function drawTag(scene: Scene, parent: Element, x: number, y: number, w: number, h: number, o: TagOpts): TagHandle {
  const spec = LAYERS[o.layer];
  const face = o.face ?? spec.face;
  const id = uid('tagclip');
  const g = el('g', { class: `tag layer-${o.layer}${o.cls ? ' ' + o.cls : ''}`, 'data-id': o.id ?? '' }, parent);
  const d = shapeD(spec.shape, x, y, w, h);
  const clip = el('clipPath', { id }, g);
  el('path', { d }, clip);
  const paper = el('path', { d, class: 'paper' }, g);
  const band = { x0: x + 1, x1: x + w - 1, y0: y + h - HATCH.bandPx - 1, y1: y + h - 1 };
  const hg = el('g', { 'clip-path': `url(#${id})`, class: 'hatch' }, g);
  const hatchEls: SVGPathElement[] = [];
  const dots: SVGCircleElement[] = [];
  if (spec.hatch >= 0) {
    for (const s of hatchSegments(band, spec.hatch, HATCH.gapInTagPx)) {
      hatchEls.push(el('path', { d: `M${f1(s[0])} ${f1(s[1])}L${f1(s[2])} ${f1(s[3])}`, pathLength: 1, class: 'ink h', 'stroke-width': HATCH.weight }, hg));
    }
  } else {
    for (const [px, py] of stipplePoints(band, HATCH.stipple.gapPx[0], o.seed)) {
      dots.push(el('circle', { cx: f1(px), cy: f1(py), r: HATCH.stipple.dotR, class: 'dot' }, hg));
    }
  }
  const outlines: SVGPathElement[] = [];
  const od = spec.shape === 'rect' ? roughRect(x, y, w, h, o.seed) : roughPath(d, o.seed);
  outlines.push(el('path', { d: od, pathLength: 1, class: 'ink outline', 'stroke-width': spec.weight }, g));
  if (spec.shape === 'hex') {
    const ins = 3;
    const d2 = shapeD('hex', x + ins, y + ins, w - 2 * ins, h - 2 * ins);
    outlines.push(el('path', { d: roughPath(d2, o.seed + 7), pathLength: 1, class: 'ink outline2', 'stroke-width': L.derived.outline[1] }, g));
  }
  let hole: SVGCircleElement | undefined;
  if (spec.shape === 'punch') hole = el('circle', { cx: x + 12, cy: y + h / 2 - 1, r: 2.4, class: 'hole' }, g);
  const tx = spec.shape === 'punch' ? x + 24 : spec.shape === 'rect' ? x + 10 : x + w / 2;
  const anchor = spec.shape === 'pill' || spec.shape === 'hex' ? 'middle' : 'start';
  const label = el('text', { x: tx, y: y + h / 2 - 1.5 + 4, 'text-anchor': anchor, class: `lbl ${face}` }, g);
  label.textContent = o.label;
  // transparent hit margin (6 px): no fill, pointer events only
  el('rect', { x: x - tokens.hit.tagHitMarginPx, y: y - tokens.hit.tagHitMarginPx, width: w + 2 * tokens.hit.tagHitMarginPx, height: h + 2 * tokens.hit.tagHitMarginPx, class: 'hit' }, g);

  return {
    g, x, y, w, h, label,
    schedule(t0: number): number {
      const tl = scene.tl;
      outlines.forEach((p, i) => tl.stroke(p, t0 + i * 120, 520));
      hatchEls.forEach((p, i) => tl.stroke(p, t0 + 420 + i * 26, 200));
      dots.forEach((p, i) => tl.fade(p, t0 + 420 + i * 14, 90));
      tl.fade(paper, t0, 240);
      tl.label(label, t0 + 180, tokens.motion.dur.labelWrite);
      if (hole) tl.fade(hole, t0 + 380, 120);
      return t0 + 720;
    },
  };
}
