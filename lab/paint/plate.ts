// A plate painted as separate layers: each layer is its own transparent canvas of pigment plus a knock mask
// (where the layer covers what lies behind it). Compositing knocks each layer's mask out of the stack below, then lays
// the layer on top, then multiplies the stack onto the paper once. Sprites go on the same way, so anything can move later.
import { Item, Scene } from './kit';
import { Look, HOUSE, composite, granulate, paintItems } from './paintB';
import { Paper, makePaper } from './paper';
import { Sprite, paintSprite } from './sprites';

export interface PaintedLayer { name: string; canvas: HTMLCanvasElement; knock: HTMLCanvasElement; ms: number; items: number; }
export interface Plate { layers: PaintedLayer[]; paper: Paper; stack: HTMLCanvasElement; canvas: HTMLCanvasElement; ms: number; parts: Record<string, number>; S: number; }

function cv(w: number, h: number): HTMLCanvasElement { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

export function paintLayer(name: string, sc: Scene, S: number, seed: number, look: Look): PaintedLayer {
  const t = performance.now(), W = Math.round(sc.w * S), H = Math.round(sc.h * S);
  const c = cv(W, H), k = cv(W, H), ctx = c.getContext('2d', { willReadFrequently: true })!;
  paintItems(ctx, sc.items, S, seed + name.length * 17, 470, sc.skyStops, look, k.getContext('2d')!);
  granulate(c, S, seed, look);
  return { name, canvas: c, knock: k, ms: performance.now() - t, items: sc.items.length };
}

export interface PlaceSprite { sprite: Sprite; dx?: number; dy?: number; knock?: boolean; }
/** stack layers (and optional sprites, inserted after the named layer) and lay the stack on the paper */
export function compositePlate(layers: PaintedLayer[], paper: Paper, look: Look, sprites: Record<string, PlaceSprite[]> = {}): { stack: HTMLCanvasElement; canvas: HTMLCanvasElement } {
  const W = layers[0].canvas.width, H = layers[0].canvas.height, stack = cv(W, H), sx = stack.getContext('2d')!;
  for (const L of layers) {
    sx.globalCompositeOperation = 'destination-out'; sx.drawImage(L.knock, 0, 0);
    sx.globalCompositeOperation = 'source-over'; sx.drawImage(L.canvas, 0, 0);
    for (const p of sprites[L.name] ?? []) {
      const s = p.sprite, x = (s.x + (p.dx ?? 0)) * s.S, y = (s.y + (p.dy ?? 0)) * s.S;
      if (p.knock !== false) { sx.globalCompositeOperation = 'destination-out'; sx.drawImage(s.sil, x, y); }
      sx.globalCompositeOperation = 'source-over'; sx.drawImage(s.canvas, x, y);
    }
  }
  const out = cv(W, H); composite(out.getContext('2d')!, stack, paper, W, H, look.opaque);
  return { stack, canvas: out };
}

export function paintPlate(layers: Record<string, Scene>, order: string[], o: { seed: number; scale: number; look?: Look; paper?: Paper; sprites?: Record<string, { items: Item[]; knock?: boolean; dx?: number; dy?: number }[]> }): Plate {
  const t0 = performance.now(), S = o.scale, look = o.look ?? HOUSE, parts: Record<string, number> = {};
  const first = layers[order[0]];
  const paper = o.paper ?? makePaper(first.w, first.h, S, o.seed, { fade: look.fade }); parts.paper = o.paper ? 0 : paper.ms;
  const painted = order.map((n) => { const L = paintLayer(n, layers[n], S, o.seed, look); parts[n] = L.ms; return L; });
  let t = performance.now();
  const sp: Record<string, PlaceSprite[]> = {};
  for (const [after, list] of Object.entries(o.sprites ?? {})) sp[after] = list.map((s) => ({ sprite: paintSprite(s.items, S, o.seed, look), knock: s.knock, dx: s.dx, dy: s.dy }));
  parts.sprites = performance.now() - t; t = performance.now();
  const { stack, canvas } = compositePlate(painted, paper, look, sp);
  canvas.getContext('2d')!.getImageData(0, 0, 1, 1); parts.composite = performance.now() - t;
  return { layers: painted, paper, stack, canvas, ms: performance.now() - t0, parts, S };
}

/** one layer on its own sheet, for inspection */
export function layerOnPaper(L: PaintedLayer, paper: Paper, look: Look): HTMLCanvasElement {
  const c = cv(L.canvas.width, L.canvas.height); composite(c.getContext('2d')!, L.canvas, paper, c.width, c.height, look.opaque); return c;
}
export const fnv = (c: HTMLCanvasElement): string => { const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data; let h = 2166136261; for (let i = 0; i < d.length; i += 5) h = Math.imul(h ^ d[i], 16777619); return (h >>> 0).toString(16); };
