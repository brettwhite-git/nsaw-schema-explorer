// Lab views for the grand plates: exterior, cutaway, the layers, 2x detail crops, before/after, and a bench.
import { LOOKS } from './looks';
import { LAYERS, buildGrand } from './grand';
import { buildCutaway, CUT_FLOORS } from './rooms';
import { Plate, fnv, layerOnPaper, paintPlate } from './plate';
import { grandOverlay } from './overlay';
import { CUT_BASE, CUT_Z } from './grand';

type Stats = Record<string, unknown>;
const raf = (): Promise<void> => new Promise((r) => { const t = setTimeout(r, 120); requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(t); r(); })); });
const fmt = (p: Record<string, number>): string => Object.entries(p).map(([k, v]) => k + ' ' + v.toFixed(0)).join(', ');
function figure(label: string, art: HTMLElement, cls = ''): HTMLElement {
  const f = document.createElement('figure'); f.className = 'fig ' + cls; f.appendChild(art);
  const c = document.createElement('figcaption'); c.textContent = label; f.appendChild(c); return f;
}
function art(canvas: HTMLCanvasElement, over: string | null, night: boolean): HTMLElement {
  const d = document.createElement('div'); d.className = 'art' + (night ? ' night' : ''); canvas.style.cssText = 'display:block;width:100%;height:auto'; d.appendChild(canvas);
  if (over) { const o = document.createElement('div'); o.innerHTML = over; d.appendChild(o.firstElementChild!); }
  return d;
}

export function plateFor(kind: 'ext' | 'cut', look: string, seed: number, S: number, withSprites = true): { plate: Plate; over: string; counts: Record<string, number> } {
  const lk = LOOKS[look], night = look === 'e';
  const g = kind === 'ext' ? buildGrand({ seed, night }) : buildCutaway({ seed, night });
  const sprites = withSprites && kind === 'ext' ? { hill: [{ items: g.sprites.car }], house: g.sprites.smoke.map((items) => ({ items, knock: false })) } : withSprites ? { house: g.sprites.smoke.map((items) => ({ items, knock: false })) } : {};
  const plate = paintPlate(g.layers, LAYERS, { seed, scale: S, look: lk, sprites });
  const over = kind === 'ext' ? grandOverlay({ night }) : grandOverlay({ z: CUT_Z, ox: 600, oy: CUT_BASE, floors: CUT_FLOORS, night, door: false });
  return { plate, over, counts: g.counts };
}

export async function grandView(app: HTMLElement, stats: Stats, kind: 'ext' | 'cut', look: string, seed: number, S: number, width: number): Promise<void> {
  const { plate, over, counts } = plateFor(kind, look, seed, S);
  stats[`grand-${kind}-${look}`] = { ms: plate.ms, parts: plate.parts, scale: S, px: [plate.canvas.width, plate.canvas.height], counts };
  const f = figure(`${kind === 'ext' ? 'Exterior' : 'Cutaway'} · look ${look.toUpperCase()} ${LOOKS[look].name} · ${plate.ms.toFixed(0)} ms at ${plate.canvas.width}x${plate.canvas.height} (${fmt(plate.parts)}) · items ${Object.values(counts).join('/')}`, art(plate.canvas, over, look === 'e'), 'full');
  f.style.width = width + 'px'; app.appendChild(f);
}

export async function layersView(app: HTMLElement, stats: Stats, look: string, seed: number, kind: 'ext' | 'cut'): Promise<void> {
  const S = 1, { plate, over } = plateFor(kind, look, seed, S);
  const g = document.createElement('div'); g.className = 'grid3'; app.appendChild(g);
  for (const L of plate.layers) { const c = layerOnPaper(L, plate.paper, LOOKS[look]); g.appendChild(figure(`layer: ${L.name} · ${L.items} items · ${L.ms.toFixed(0)} ms`, art(c, null, false))); await raf(); }
  g.appendChild(figure(`composite with sprites (car, smoke) · ${plate.ms.toFixed(0)} ms`, art(plate.canvas, over, look === 'e')));
  stats.layers = Object.fromEntries(plate.layers.map((L) => [L.name, { items: L.items, ms: L.ms }]));
}

/** 2x crops of the 1920x1200 paint: does the detail hold up? */
export async function detailsView(app: HTMLElement, stats: Stats, look: string, seed: number): Promise<void> {
  const S = 1.6, ext = plateFor('ext', look, seed, S), cut = plateFor('cut', look, seed, S);
  const crops: [string, HTMLCanvasElement, number, number, number, number][] = [
    ['a mountain face: facets, gullies, snow, strata', ext.plate.canvas, 890, 190, 300, 190],
    ['the crag: bedded blocks, ledges of snow', ext.plate.canvas, 0, 110, 300, 190],
    ['forest and viaduct with the car', ext.plate.canvas, 640, 540, 300, 190],
    ['facade: windows, balconies, the entrance', ext.plate.canvas, 380, 290, 300, 190],
    ['roofline: dome, pavilion, dormers, chimneys', ext.plate.canvas, 250, 150, 300, 190],
    ['story rooms in the cutaway (2, 3 and 1)', cut.plate.canvas, 450, 380, 300, 190],
  ];
  const g = document.createElement('div'); g.className = 'grid2'; app.appendChild(g);
  for (const [label, src, x, y, w, h] of crops) {
    const c = document.createElement('canvas'); c.width = w * S * 2; c.height = h * S * 2; const cx = c.getContext('2d')!;
    cx.imageSmoothingQuality = 'high'; cx.drawImage(src, x * S, y * S, w * S, h * S, 0, 0, c.width, c.height);
    g.appendChild(figure(`${label} (x${S} paint, shown 2x)`, art(c, null, false))); await raf();
  }
  stats.details = { ext: ext.plate.ms, cut: cut.plate.ms };
}

export async function beforeAfter(app: HTMLElement, stats: Stats, seed: number): Promise<void> {
  const img = new Image(); img.src = './shots/looks/look-a-1920.png'; await img.decode();
  const old = document.createElement('canvas'); old.width = 1600; old.height = 1000; old.getContext('2d')!.drawImage(img, 160, 85, 1600, 1000, 0, 0, 1600, 1000);
  const { plate, over } = plateFor('ext', 'a', seed, 1.34);
  const g = document.createElement('div'); g.className = 'grid2'; app.appendChild(g);
  g.appendChild(figure('before: look A (previous plate, from shots/looks/look-a-1920.png)', art(old, null, false)));
  g.appendChild(figure(`after: look A, the grand plate · ${plate.ms.toFixed(0)} ms`, art(plate.canvas, over, false)));
  stats.beforeAfter = { ms: plate.ms };
}

/** honest timings at 1200x750 and 1920x1200 for both plates in looks A and E, plus the determinism hash */
export async function bench(app: HTMLElement, stats: Stats, seed: number): Promise<void> {
  const out: Record<string, unknown> = {};
  const pre = document.createElement('pre'); pre.style.cssText = 'color:#F6EBDD;font:13px/1.5 monospace;white-space:pre-wrap;width:min(1400px,96vw)'; app.appendChild(pre);
  for (const [kind, look, S] of [['ext', 'a', 1], ['ext', 'a', 1.6], ['cut', 'a', 1], ['cut', 'a', 1.6], ['ext', 'e', 1.6], ['cut', 'e', 1.6]] as ['ext' | 'cut', string, number][]) {
    const t = performance.now(), { plate, counts } = plateFor(kind, look, seed, S), total = performance.now() - t;
    const key = `${kind}-${look}-${plate.canvas.width}x${plate.canvas.height}`;
    out[key] = { totalMsInclBuild: +total.toFixed(0), paintMs: +plate.ms.toFixed(0), parts: Object.fromEntries(Object.entries(plate.parts).map(([k, v]) => [k, +v.toFixed(0)])), items: counts };
    if (S === 1.6 && look === 'a') { const again = plateFor(kind, look, seed, S).plate; const h1 = fnv(plate.canvas), h2 = fnv(again.canvas); (out[key] as Record<string, unknown>).hash = h1; (out[key] as Record<string, unknown>).identicalOnRepaint = h1 === h2; }
    pre.textContent = JSON.stringify(out, null, 1); await raf();
  }
  stats.bench = out;
}
