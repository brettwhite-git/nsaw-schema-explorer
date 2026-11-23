// Painted cut-outs: a sprite is painted once, transparent, with the same painter, then composited over a finished plate.
import { Rng } from './rng';
import { Item, Kit, PAL, Pt, arc, smooth } from './kit';
import { Look, HOUSE, granulate, paintItems } from './paintB';
import { box } from './interior';
import { PAPER_RGB } from './paper';

export interface Sprite { canvas: HTMLCanvasElement; sil: HTMLCanvasElement; x: number; y: number; ms: number; S: number }

function bounds(items: Item[]): [number, number, number, number] {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const it of items) for (let i = 0; i < it.pts.length; i += 2) { x0 = Math.min(x0, it.pts[i]); x1 = Math.max(x1, it.pts[i]); y0 = Math.min(y0, it.pts[i + 1]); y1 = Math.max(y1, it.pts[i + 1]); }
  return [x0, y0, x1, y1];
}
export function paintSprite(items: Item[], S: number, seed: number, look: Look = HOUSE, pad = 6): Sprite {
  const t0 = performance.now(), [x0, y0, x1, y1] = bounds(items), ox = x0 - pad, oy = y0 - pad;
  const c = document.createElement('canvas'); c.width = Math.ceil((x1 - x0 + pad * 2) * S); c.height = Math.ceil((y1 - y0 + pad * 2) * S);
  const ctx = c.getContext('2d', { willReadFrequently: true })!; ctx.translate(-ox * S, -oy * S);
  paintItems(ctx, items, S, seed, 470, [], look); ctx.setTransform(1, 0, 0, 1, 0, 0); granulate(c, S, seed, look);
  // paper-coloured silhouette (grown by a pixel) for the cut-out mode
  const sil = document.createElement('canvas'); sil.width = c.width; sil.height = c.height; const sc = sil.getContext('2d')!;
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) sc.drawImage(c, dx, dy);
  sc.globalCompositeOperation = 'source-in'; sc.fillStyle = `rgb(${PAPER_RGB.join(',')})`; sc.fillRect(0, 0, sil.width, sil.height);
  return { canvas: c, sil, x: ox, y: oy, ms: performance.now() - t0, S };
}

/** the worker, carrying the ribboned box; pose 0 and 1 swap the legs and bob the box */
export function workerItems(pose: 0 | 1, f = 0.55): Item[] {
  const k = new Kit(new Rng(5)), cx = 55, skin = '#EBB99C', uni = '#6D4C7E', apron = '#F6EAD6', trou = '#4A2D55';
  const sg = pose ? 1 : -1;
  for (const s of [1, -1]) {
    const fwd = s === sg, hx = cx + s * 9, ax = hx + (fwd ? s * 2 : -s * 3), ay = fwd ? 163 : 158;
    k.poly(smooth([[hx - 9, 100], [hx + 9, 100], [ax + 7, ay - 6], [ax - 7, ay - 6]], true, 4), trou, 'cloth', { ink: 1, knock: 1 });
    k.glaze([[hx + 2, 100], [hx + 9, 100], [ax + 7, ay - 6], [ax + 1, ay - 6]], '#1F0F26', 0.35);
    k.poly([[ax - 7, ay - 6], [ax + 7, ay - 6], [ax + 12, ay + 4], [ax - 9, ay + 4]], '#3B2A2E', 'wood', { ink: 1, knock: 1 });
  }
  k.poly(smooth([[cx - 25, 52], [cx - 12, 44], [cx + 12, 44], [cx + 25, 52], [cx + 22, 106], [cx - 22, 106]], true, 4), uni, 'cloth', { ink: 1, knock: 1 });
  k.glaze(smooth([[cx + 10, 44], [cx + 25, 52], [cx + 22, 106], [cx + 12, 106]], true, 3), '#2D1B4A', 0.4);
  k.poly([[cx - 16, 58], [cx + 16, 58], [cx + 22, 132], [cx - 22, 132]], apron, 'cloth', { ink: 1, knock: 1 });
  k.glaze([[cx + 6, 58], [cx + 16, 58], [cx + 22, 132], [cx + 10, 132]], '#9C86A6', 0.35);
  k.line([[cx - 16, 58], [cx + 16, 58]], PAL.rasp, 1.5, 0.9);
  k.poly(smooth([[cx - 6, 36], [cx + 6, 36], [cx + 7, 46], [cx - 7, 46]], true, 3), skin, 'skin', { ink: 1, knock: 1 });
  k.poly(smooth([[cx - 12, 22], [cx - 10, 10], [cx, 6], [cx + 10, 10], [cx + 12, 22], [cx + 9, 34], [cx, 40], [cx - 9, 34]], true, 5), skin, 'skin', { ink: 1, knock: 1 });
  k.glaze(smooth([[cx + 4, 10], [cx + 12, 22], [cx + 9, 34], [cx + 3, 39]], true, 3), '#B0705C', 0.4);
  k.poly(smooth([[cx - 14, 14], [cx - 11, 2], [cx, -4], [cx + 11, 2], [cx + 14, 14], [cx, 9]], true, 4), apron, 'cloth', { ink: 1, knock: 1 });
  k.line([[cx - 13, 12], [cx, 8], [cx + 13, 12]], PAL.rasp, 1.6, 0.9);
  const bob = pose ? -2 : 0;
  box(k, cx, 112 + bob, 46, 34, 0, PAL.rasp, true, true);
  for (const s of [-1, 1]) {
    k.poly(smooth([[cx + s * 22, 50], [cx + s * 30, 60], [cx + s * 33, 84], [cx + s * 28, 100 + bob], [cx + s * 22, 98 + bob], [cx + s * 22, 80]], true, 4), uni, 'cloth', { ink: 1, knock: 1 });
    k.poly(smooth([[cx + s * 18, 98 + bob], [cx + s * 28, 96 + bob], [cx + s * 29, 106 + bob], [cx + s * 20, 108 + bob]], true, 3), skin, 'skin', { ink: 1, knock: 1 });
  }
  return k.items.map((it): Item => ({ ...it, pts: it.pts.map((v) => v * f), w: it.k === 'line' ? it.w * Math.max(0.6, f * 1.3) : undefined } as Item));
}
export { arc };
export type { Pt };
