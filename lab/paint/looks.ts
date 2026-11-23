// The five handlings (plus helpers). Each is a parameter set over the same painter; geometry never changes.
import { HOUSE, Look } from './paintB';
import { Mat } from './kit';
import { hex, mix } from './rng';

const GOUACHE = ['#F3E3CA', '#E8A2B2', '#9189B6', '#56668C', '#5A2D4B', '#E0AE48'].map((c) => ({ c, v: hex(c) }));
function nearest(c: string): string {
  const v = hex(c); let best = GOUACHE[0], bd = 1e9;
  for (const g of GOUACHE) { const d = 2 * (g.v[0] - v[0]) ** 2 + 4 * (g.v[1] - v[1]) ** 2 + 3 * (g.v[2] - v[2]) ** 2; if (d < bd) { bd = d; best = g; } }
  return best.c;
}
const gouachePal = (c: string, mat: Mat): string => {
  if (mat === 'glow') return '#E0AE48';
  if (mat === 'sky') return nearest(c);
  if (mat === 'pine') return '#56668C';
  if (mat === 'snow') return '#F3E3CA';
  if (mat === 'plum') return '#5A2D4B';
  return nearest(c);
};
const nightPal = (c: string, mat: Mat): string => {
  if (mat === 'glow' || mat === 'gold') return mix(c, '#FFD890', 0.15);
  if (mat === 'sky') return c;
  if (mat === 'snow') return mix(c, '#4F63B0', 0.42);
  if (mat === 'cloth' && c.toLowerCase() === '#ee3a5e') return mix(c, '#2A2F63', 0.15);
  if (mat === 'far') return mix(c, '#252B66', 0.6);
  if (mat === 'glaze') return mix(c, '#1A1F55', 0.25);
  if (mat === 'wall' || mat === 'trim' || mat === 'stone') return mix(c, '#2E2E6A', 0.42);
  return mix(c, '#252B66', 0.5);
};

export const LOOKS: Record<string, Look> = {
  a: { ...HOUSE, fade: 22 },
  b: { ...HOUSE, id: 'b', name: 'Loose and wet', layers: 0.7, dev: 2.1, hue: 0.42, blots: 1.7, bleed: 4, edge: 1.5, dry: 0.5, inkA: 0.6, inkW: 0.9, inkKeep: 0.3, inkBreak: 3, inkOff: [2.4, 1.8], grain: 1.2, snowLoad: 0.35, load: 1.0, fade: 48 },
  c: { ...HOUSE, id: 'c', name: 'Tight and inked', layers: 0.55, dev: 0.3, blots: 0.25, edge: 0.4, dry: 0.4, inkA: 1.35, inkW: 1.3, inkKeep: 1, inkBreak: 0, hatch: true, coursing: true, grain: 0.55, load: 0.85, fade: 26 },
  d: { ...HOUSE, id: 'd', name: 'Gouache poster', layers: 0.4, dev: 0.5, opaque: true, flatSky: true, inkA: 0.45, inkW: 0.8, inkKeep: 0.4, inkBreak: 1.5, hatch: false, grain: 0.5, chalk: 0.16, minGlaze: 0.3, skipMist: true, dry: 0.5, blots: 0, edge: 0, pal: gouachePal, fade: 24 },
  e: { ...HOUSE, id: 'e', name: 'Winter night', pal: nightPal, inkA: 1.1, grain: 0.9, fade: 30 },
};
export const MOOD: Record<string, 'dusk' | 'night'> = { a: 'dusk', b: 'dusk', c: 'dusk', d: 'dusk', e: 'night' };
