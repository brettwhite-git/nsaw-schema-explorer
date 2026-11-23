// What does it cost to move a painted object across a painted set? Measured, not guessed.
import { buildScene, carSprite } from './scene';
import { paintItems, granulate, renderB } from './paintB';
import { renderC, renderD } from './glC';
import { buildA } from './svgA';
import { Scene } from './kit';

const flush = (c: HTMLCanvasElement): void => { c.getContext('2d')!.getImageData(0, 0, 1, 1); };
const frames = (n: number): Promise<number[]> => new Promise((res) => { const d: number[] = []; let last = performance.now(), i = 0; const f = (): void => { const t = performance.now(); d.push(t - last); last = t; if (++i < n) requestAnimationFrame(f); else res(d); }; requestAnimationFrame(f); });
const avg = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;
const p95 = (a: number[]): number => [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)];

export async function animBench(seed: number, S: number, host: HTMLElement): Promise<Record<string, number>> {
  const out: Record<string, number> = { scale: S };
  const scene = buildScene(seed);
  const b = renderB(scene, { seed, scale: S });
  // 1. sprite painted once (transparent, pigment only), composited per frame over the finished plate
  const car = carSprite(seed);
  let t = performance.now();
  const sp = document.createElement('canvas'); sp.width = car.w * S; sp.height = car.h * S;
  paintItems(sp.getContext('2d', { willReadFrequently: true })!, car.items, S, seed); granulate(sp, S, seed);
  out.spritePaintMs = performance.now() - t;
  const view = document.createElement('canvas'); view.width = b.canvas.width; view.height = b.canvas.height; view.style.cssText = 'position:fixed;left:-9999px';
  host.appendChild(view); const vc = view.getContext('2d')!;
  const N = 240; t = performance.now();
  for (let i = 0; i < N; i++) { vc.globalCompositeOperation = 'source-over'; vc.drawImage(b.canvas, 0, 0); vc.globalCompositeOperation = 'multiply'; vc.drawImage(sp, (900 + i * 0.5) * S, (500 - i * 0.4) * S); }
  flush(view); out.B_spriteFrameMs = (performance.now() - t) / N;
  t = performance.now(); for (let i = 0; i < N; i++) { vc.drawImage(sp, (900 + i) * S, 400 * S); } flush(view); out.B_spriteOnlyMs = (performance.now() - t) / N;
  // dirty-rect version: restore only the patch under the sprite, then redraw the sprite
  t = performance.now(); for (let i = 0; i < N; i++) { const x = (900 + i * 0.5) * S, y = (500 - i * 0.4) * S; vc.globalCompositeOperation = 'source-over'; vc.drawImage(b.canvas, x - 4, y - 4, sp.width + 8, sp.height + 8, x - 4, y - 4, sp.width + 8, sp.height + 8); vc.globalCompositeOperation = 'multiply'; vc.drawImage(sp, x, y); } flush(view); out.B_dirtyRectFrameMs = (performance.now() - t) / N;
  // 2. re-painting the sprite every frame ("boiling"), the worst case for B
  t = performance.now(); for (let i = 0; i < 10; i++) { const c = document.createElement('canvas'); c.width = sp.width; c.height = sp.height; paintItems(c.getContext('2d', { willReadFrequently: true })!, car.items, S, seed + i); granulate(c, S, seed + i); } out.B_repaintSpriteMs = (performance.now() - t) / 10;
  view.remove();
  // 3. C: the three shader passes re-run on the whole picture (what a moving object costs if it is inside the filter)
  const c = renderC(scene, { seed, scale: S, cfg: { warp: 1, kuw: 1, dens: 1, bench: 10 } }); out.C_fullPassesMs = c.parts.passes;
  const d = renderD(scene, { seed, scale: S }); out.D_totalMs = d.ms;
  // 4. A: move the car as a live filtered SVG group (filters re-run) versus the same SVG on its own composited layer
  const carScene: Scene = { ...carSprite(seed), w: 160, h: 120 };
  const holder = document.createElement('div'); holder.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:562px;opacity:0.01;pointer-events:none'; host.appendChild(holder);
  holder.innerHTML = buildA(scene, seed).replace('<svg class="a"', '<svg class="a" id="whole"');
  const whole = holder.querySelector('#whole') as SVGElement; whole.style.width = '900px';
  const probe = document.createElementNS('http://www.w3.org/2000/svg', 'g'); probe.setAttribute('filter', 'url(#wcC)');
  probe.innerHTML = carScene.items.filter((i) => i.k === 'poly').map((i) => `<polygon points="${(i as { pts: number[] }).pts.join(' ')}" fill="#e8d0c0"/>`).join('');
  whole.appendChild(probe); await frames(5);
  let i = 0; const mv = (): void => { probe.setAttribute('transform', `translate(${900 + i * 0.5},${400 - i * 0.4})`); i++; };
  const run = async (n: number): Promise<number[]> => new Promise((res) => { const d: number[] = []; let last = performance.now(), k = 0; const f = (): void => { mv(); const t2 = performance.now(); d.push(t2 - last); last = t2; if (++k < n) requestAnimationFrame(f); else res(d); }; requestAnimationFrame(f); });
  const live = await run(90); out.A_movingFilteredGroup_frameMs = avg(live.slice(5)); out.A_movingFilteredGroup_p95 = p95(live.slice(5));
  // same group lifted to its own layer
  holder.remove();
  const s2 = document.createElement('div'); s2.style.cssText = 'position:fixed;left:0;top:0;width:900px;opacity:0.01;pointer-events:none'; host.appendChild(s2);
  s2.innerHTML = `<svg viewBox="0 0 160 120" width="${160 * S}" height="${120 * S}" style="will-change:transform;position:absolute;left:0;top:0">${buildA(carScene, seed).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg>`;
  const lay = s2.firstElementChild as HTMLElement; await frames(5);
  const f2: number[] = []; await new Promise<void>((res) => { let last = performance.now(), k = 0; const f = (): void => { lay.style.transform = `translate(${900 + k * 0.5}px,${400 - k * 0.4}px)`; const t2 = performance.now(); f2.push(t2 - last); last = t2; if (++k < 90) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  out.A_layerPromoted_frameMs = avg(f2.slice(5)); s2.remove();
  return out;
}
