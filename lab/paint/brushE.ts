// Technique E (library variant of B): p5.brush 3.0.0 standalone paints the same polygon list; composited on the same parchment.
import * as brush from 'p5.brush/standalone';
import { Scene } from './kit';
import { Paper, makePaper } from './paper';
import { composite } from './paintB';

export function renderE(scene: Scene, o: { seed: number; scale: number; paper?: Paper }): { canvas: HTMLCanvasElement; ms: number; parts: Record<string, number>; n: number } {
  const t0 = performance.now(), S = o.scale, W = Math.round(scene.w * S), H = Math.round(scene.h * S), parts: Record<string, number> = {};
  const paper = o.paper ?? makePaper(scene.w, scene.h, S, o.seed); parts.paper = o.paper ? 0 : paper.ms;
  const t = performance.now();
  const gl = document.createElement('canvas'); gl.width = W; gl.height = H;
  const b = brush as unknown as Record<string, (...a: unknown[]) => unknown>;
  b.load(gl); b.seed(o.seed); b.noiseSeed(o.seed);
  b.noStroke(); b.noHatch();
  let n = 0;
  for (const it of scene.items) {
    if (it.k !== 'poly' || it.pts.length < 6) continue;
    const pts: [number, number][] = [];
    for (let i = 0; i < it.pts.length; i += 2) pts.push([(it.pts[i] - scene.w / 2) * S, (it.pts[i + 1] - scene.h / 2) * S]);
    b.fill(it.mat === 'sky' && it.grad ? '#C9A3B8' : it.fill, Math.round(((it.alpha ?? 1) * 100) * (it.mat === 'glaze' ? 0.8 : 1.1)));
    b.fillBleed(0.25, 'out'); b.fillTexture(0.35, 0.5);
    b.polygon(pts); n++;
  }
  b.render();
  parts.brush = performance.now() - t;
  const plate = document.createElement('canvas'); plate.width = W; plate.height = H; plate.getContext('2d')!.drawImage(gl, 0, 0);
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  composite(out.getContext('2d')!, plate, paper, W, H);
  return { canvas: out, ms: performance.now() - t0, parts, n };
}
