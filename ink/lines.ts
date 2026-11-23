// One API for the three provenances (rulebook 1.7):
//   explicit     solid ink line, 1.1 px            (it is in the data)
//   inferred     stitched thread, sewn a stitch at a time (a rule or co-occurrence says so)
//   illustrative pencil: lighter, greyer, grain    (a sketch to explain, not data)
import tokens from '../tokens.json';
import type { Provenance } from '../content/types';
import { stitchCount } from './easing';
import { roughPath, PENCIL } from './rough';
import type { Scene } from './scene';
import { el, uid } from './svg';

export type { Provenance };

export interface LineOpts {
  provenance: Provenance;
  seed: number;
  /** start time on the scene timeline (ms) */
  t0?: number;
  /** override the stroke duration (ms) */
  dur?: number;
  /** the two ends, where knots sit (inferred threads) */
  ends?: [[number, number], [number, number]];
  /** group id for focus: the one lit thing in a figure state */
  focusId?: string;
}

export interface LineHandle {
  g: SVGGElement;
  path: SVGPathElement;
  knots: SVGCircleElement[];
  /** time the line is complete */
  end: number;
}

export const LINE_CLASS: Record<Provenance, string> = {
  explicit: 'line-explicit',
  inferred: 'line-inferred',
  illustrative: 'line-illustrative',
};

/** Rough length of a path string without touching layout. */
function pathLength(d: string): number {
  const p = el('path', { d });
  // Detached paths can still report length in browsers; fall back to a coarse estimate in tests.
  const len = typeof p.getTotalLength === 'function' ? p.getTotalLength() : 0;
  return Number.isFinite(len) && len > 0 ? len : 100;
}

export function drawLine(scene: Scene, parent: Element, d: string, o: LineOpts): LineHandle {
  const t0 = o.t0 ?? 0;
  const g = el('g', { class: `line ${LINE_CLASS[o.provenance]}`, 'data-prov': o.provenance }, parent);
  if (o.focusId) g.setAttribute('data-id', o.focusId);
  const knots: SVGCircleElement[] = [];

  if (o.provenance === 'inferred') {
    const mid = uid('stitch-m');
    const mk = el('mask', { id: mid, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: scene.w, height: scene.h }, scene.defs);
    const reveal = el('path', { d, pathLength: 1, class: 'reveal' }, mk);
    const path = el('path', { d, class: 'thread', mask: `url(#${mid})` }, g);
    const len = pathLength(d);
    const dur = o.dur ?? Math.min(tokens.motion.dur.strokeMax, Math.max(tokens.motion.dur.strokeMin, len * 2.2));
    let end = scene.tl.stitch(reveal, stitchCount(len), t0, dur, o.focusId);
    if (o.ends) {
      const [a, b] = o.ends;
      const k1 = el('circle', { cx: a[0], cy: a[1], r: tokens.line.thread.knotR, class: 'knot' }, g);
      const k2 = el('circle', { cx: b[0], cy: b[1], r: tokens.line.thread.knotR, class: 'knot' }, g);
      scene.tl.fade(k1, t0, 80);
      scene.tl.fade(k2, t0 + dur, 80);
      knots.push(k1, k2);
      end = Math.max(end, t0 + dur + 80);
    }
    return { g, path, knots, end };
  }

  const pencil = o.provenance === 'illustrative';
  const rd = roughPath(d, o.seed, pencil ? PENCIL : undefined);
  const w = pencil ? tokens.line.pencil.stroke[1] : tokens.line.weights.standard;
  const path = el('path', { d: rd, pathLength: 1, class: pencil ? 'ink pencil' : 'ink', 'stroke-width': w }, g);
  if (pencil) path.setAttribute('filter', `url(#${scene.pencilFilter()})`);
  const len = pathLength(rd);
  const dur = o.dur ?? Math.min(tokens.motion.dur.strokeMax, Math.max(tokens.motion.dur.strokeMin, len * 2));
  const end = scene.tl.stroke(path, t0, dur, o.focusId);
  return { g, path, knots, end };
}
