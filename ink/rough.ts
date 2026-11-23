// rough.js wrapper with fixed seeds and the rulebook's low roughness.
// rough.js is used only to turn a clean path into a slightly hand-run one; colour is applied by CSS.
import rough from 'roughjs';
import tokens from '../tokens.json';

const gen = rough.generator();
const R = tokens.line.rough;

export interface RoughOpts { roughness?: number; bowing?: number }

function opts(seed: number, o: RoughOpts = {}) {
  const roughness = Math.min(o.roughness ?? R.roughness, 1.2);
  return {
    roughness,
    bowing: o.bowing ?? R.bowing,
    seed,
    disableMultiStroke: R.disableMultiStroke,
    stroke: '#000',
    strokeWidth: 1,
  };
}

function toD(drawable: ReturnType<typeof gen.path>): string {
  return gen.toPaths(drawable).map((p) => p.d).join(' ');
}

/** A clean SVG path, run by hand. Same seed, same drawing. */
export function roughPath(d: string, seed: number, o?: RoughOpts): string {
  return toD(gen.path(d, opts(seed, o)));
}

export function roughRect(x: number, y: number, w: number, h: number, seed: number, o?: RoughOpts): string {
  return toD(gen.rectangle(x, y, w, h, opts(seed, o)));
}

/** Pencil: rougher and bowed, used for illustrative lines only. */
export const PENCIL: RoughOpts = { roughness: R.pencilRoughness, bowing: R.pencilBowing };
