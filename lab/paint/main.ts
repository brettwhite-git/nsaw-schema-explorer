import { buildScene, TRACK } from './scene';
import { renderB, composite } from './paintB';
import { LOOKS, MOOD } from './looks';
import { signOverlay, shopOverlay, titleOverlay } from './overlay';
import { buildInterior } from './interior';
import { buildTitle } from './title';
import { makePaper } from './paper';
import { paintSprite, workerItems } from './sprites';
import { Kit } from './kit';
import { carItems } from './scene';
import { Rng } from './rng';
import { grandView, layersView, detailsView, beforeAfter, bench } from './grandViews';

const app = document.getElementById('app')!, bar = document.getElementById('bar')!;
const q = new URLSearchParams(location.search);
let view = q.get('view') ?? (q.get('look') ? 'look' : 'looks');
let look = q.get('look') ?? 'a', which = q.get('scene') ?? 'ext', seed = Number(q.get('seed') ?? 7), x2 = q.get('x2') === '1';
const stats: Record<string, unknown> = ((window as unknown) as { __stats: Record<string, unknown> }).__stats = {};
const raf = (): Promise<void> => new Promise((r) => { const t = setTimeout(r, 120); requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(t); r(); })); });
const fmt = (p: Record<string, number>): string => Object.entries(p).map(([k, v]) => k + ' ' + v.toFixed(0)).join(', ');
const autoScale = (cssW: number): number => (x2 ? 2 : Math.min(2, Math.max(1, Math.ceil(((cssW * devicePixelRatio) / 1200) * 2) / 2)));
const fullW = (): number => Math.min(innerWidth - 16, (innerHeight - 110) * 1.6);

function overlay(kind: 'ext' | 'shop' | 'title'): string { return kind === 'ext' ? signOverlay() : kind === 'shop' ? shopOverlay() : titleOverlay(); }
function figure(label: string, art: HTMLElement, cls = ''): HTMLElement {
  const f = document.createElement('figure'); f.className = 'fig ' + cls; f.appendChild(art);
  const c = document.createElement('figcaption'); c.textContent = label; f.appendChild(c); return f;
}
function wrap(canvas: HTMLElement, kind: 'ext' | 'shop' | 'title' | 'none', night = false): HTMLElement {
  const d = document.createElement('div'); d.className = 'art' + (night ? ' night' : ''); d.appendChild(canvas);
  if (kind !== 'none') { const o = document.createElement('div'); o.innerHTML = overlay(kind); d.appendChild(o.firstElementChild!); }
  return d;
}
export function sceneFor(id: string, kind: 'ext' | 'shop' | 'title', face = true) {
  return kind === 'ext' ? buildScene(seed, 0.5, MOOD[id]) : kind === 'shop' ? buildInterior(seed, face) : buildTitle(seed);
}
async function paintLook(id: string, kind: 'ext' | 'shop' | 'title', S: number, label: string, cls = '', face = true): Promise<HTMLElement> {
  const lk = LOOKS[id], sc = sceneFor(id, kind, face);
  const r = renderB(sc, { seed, scale: S, look: kind === 'title' ? { ...lk, fade: 0 } : lk });
  (stats[`${id}-${kind}${face ? '' : '-faceless'}`] = { ms: r.ms, parts: r.parts, scale: S });
  return figure(`${label} · ${r.ms.toFixed(0)} ms (x${S}; ${fmt(r.parts)})`, wrap(r.canvas, kind, MOOD[id] === 'night' && kind === 'ext'), cls);
}

async function contact(): Promise<void> {
  const g = document.createElement('div'); g.className = 'grid3'; app.appendChild(g);
  for (const id of Object.keys(LOOKS)) { const f = await paintLook(id, 'ext', 1, `${id.toUpperCase()}  ${LOOKS[id].name}`); f.dataset.look = id; g.appendChild(f); await raf(); }
}
async function full(): Promise<void> {
  const w = fullW(), S = autoScale(w), kind = (which === 'shop' ? 'shop' : which === 'title' ? 'title' : 'ext') as 'ext' | 'shop' | 'title';
  const f = await paintLook(look, kind, S, `${look.toUpperCase()}  ${LOOKS[look].name} (${kind})`, 'full'); f.style.width = w + 'px'; app.appendChild(f);
}
async function set(): Promise<void> {
  const g = document.createElement('div'); g.className = 'grid3'; app.appendChild(g);
  for (const kind of ['ext', 'shop', 'title'] as const) { const f = await paintLook(look, kind, 1, `${look.toUpperCase()} ${LOOKS[look].name}: ${kind}`); f.dataset.scene = kind; g.appendChild(f); await raf(); }
}
async function faces(): Promise<void> {
  const g = document.createElement('div'); g.className = 'grid2'; app.appendChild(g);
  for (const face of [true, false]) {
    const lk = LOOKS[look], r = renderB(buildInterior(seed, face), { seed, scale: 2, look: lk });
    const c = document.createElement('canvas'); c.width = 760; c.height = 1000; c.getContext('2d')!.drawImage(r.canvas, 380 * 2 - 0, 150 * 2 - 40, 760, 1000, 0, 0, 760, 1000);
    c.style.cssText = 'width:100%;height:auto;display:block'; g.appendChild(figure(`${LOOKS[look].name}: worker ${face ? 'with minimal face' : 'faceless'} (crop of the interior at 2x)`, wrap(c, 'none')));
    await raf();
  }
}

// ---- the cut-out test: sprites painted once, composited at three positions over the finished plate
async function cutout(): Promise<void> {
  const S = 2, lk = LOOKS.a, sc = buildScene(seed, null, 'dusk');
  const plate = renderB(sc, { seed, scale: S, look: lk });
  const out = document.createElement('canvas'); out.width = plate.canvas.width; out.height = plate.canvas.height;
  const ctx = out.getContext('2d')!; ctx.drawImage(plate.canvas, 0, 0);
  const k = new Kit(new Rng(1)); carItems(k, TRACK[0], TRACK[1], 0.5, 1.3, false);
  const car = paintSprite(k.items, S, seed, lk), w0 = paintSprite(workerItems(0), S, seed, lk), w1 = paintSprite(workerItems(1), S, seed, lk);
  const shadow = (x: number, y: number, rx: number, ry: number): void => { ctx.save(); ctx.filter = `blur(${3 * S}px)`; ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(90,70,150,0.45)'; ctx.beginPath(); ctx.ellipse(x * S, y * S, rx * S, ry * S, 0, 0, 7); ctx.fill(); ctx.restore(); };
  const put = (sp: typeof car, x: number, y: number, cutout: boolean): void => {
    if (cutout) ctx.drawImage(sp.sil, x * S, y * S);
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(sp.canvas, x * S, y * S); ctx.restore();
  };
  const [A, B] = TRACK, dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy);
  // car at three positions along the track (sprite painted at t=0.5; others are translations)
  for (const [t, cut] of [[0.1, true], [0.5, true], [0.9, true]] as [number, boolean][]) {
    const ds = len * 0.75 * (t - 0.5), ox = (dx / len) * ds, oy = (dy / len) * ds;
    shadow(car.x + car.canvas.width / S / 2 + ox, car.y + car.canvas.height / S - 8 + oy, 26, 4); put(car, car.x + ox, car.y + oy, cut);
  }
  // workers on the path: multiply only, then two cut-outs
  const feetY = 742, items: [typeof w0, number, boolean][] = [[w0, 330, false], [w1, 520, true], [w0, 720, true]];
  items.forEach(([sp, x, cut]) => { const h = sp.canvas.height / S; shadow(x, feetY - 1, 22, 4); put(sp, x - sp.canvas.width / S / 2, feetY - h + 6, cut); });
  // per-frame cost: the composite alone, and a dirty-rect restore + redraw
  const view2 = document.createElement('canvas'); view2.width = out.width; view2.height = out.height; const vc = view2.getContext('2d')!;
  const N = 300; let t = performance.now();
  for (let i = 0; i < N; i++) { vc.globalCompositeOperation = 'source-over'; vc.drawImage(plate.canvas, 0, 0); vc.drawImage(car.sil, (1000 + i) * S, 500 * S); vc.globalCompositeOperation = 'multiply'; vc.drawImage(car.canvas, (1000 + i) * S, 500 * S); }
  vc.getImageData(0, 0, 1, 1); const fullFrame = (performance.now() - t) / N;
  t = performance.now();
  for (let i = 0; i < N; i++) { const x = (1000 + i * 0.4) * S, y = 500 * S, w = car.canvas.width, h = car.canvas.height; vc.globalCompositeOperation = 'source-over'; vc.drawImage(plate.canvas, x - 6, y - 6, w + 12, h + 12, x - 6, y - 6, w + 12, h + 12); vc.drawImage(car.sil, x, y); vc.globalCompositeOperation = 'multiply'; vc.drawImage(car.canvas, x, y); }
  vc.getImageData(0, 0, 1, 1); const dirty = (performance.now() - t) / N;
  stats.cutout = { plateMs: plate.ms, carPaintMs: car.ms, worker0PaintMs: w0.ms, worker1PaintMs: w1.ms, carPx: [car.canvas.width, car.canvas.height], workerPx: [w0.canvas.width, w0.canvas.height], fullFrameMs: fullFrame, dirtyRectFrameMs: dirty, scale: S };
  const art = wrap(out, 'ext'); out.style.cssText = 'width:100%;height:auto;display:block';
  const st = stats.cutout as Record<string, number>;
  const f = figure(`Cut-out test (look A). Car at t=.1/.5/.9 (all cut-out mode). Workers left to right: multiply only, cut-out (pose 2), cut-out (pose 1). Sprite paint: car ${car.ms.toFixed(0)} ms, worker ${w0.ms.toFixed(0)}+${w1.ms.toFixed(0)} ms. Per frame at ${out.width}px: ${fullFrame.toFixed(2)} ms full blit+sprite, ${dirty.toFixed(2)} ms dirty-rect. Plate ${plate.ms.toFixed(0)} ms.`, art, 'full');
  f.style.width = fullW() + 'px'; app.appendChild(f);
  void st; void composite; void makePaper;
}

// ---- earlier technique bake-off, kept but out of the way (loaded on demand)
async function tech(n: string): Promise<void> {
  const { renderC, renderD } = await import('./glC'); const { buildA } = await import('./svgA');
  const S = n === '1' ? 1 : autoScale(fullW()), sc = buildScene(seed, 0.5);
  const mk = (label: string, el: HTMLElement, ms: number): HTMLElement => figure(`${label} · ${ms.toFixed(0)} ms`, wrap(el, 'ext'), n === '1' ? '' : 'full');
  const A = (): HTMLElement => { const h = document.createElement('div'); h.innerHTML = buildA(sc, seed); return mk('A svg filters', h.firstElementChild as HTMLElement, 0); };
  const B = (): HTMLElement => { const r = renderB(sc, { seed, scale: S }); return mk('B canvas', r.canvas, r.ms); };
  const C = (): HTMLElement => { const r = renderC(sc, { seed, scale: S }); return mk('C webgl', r.canvas, r.ms); };
  const D = (): HTMLElement => { const r = renderD(sc, { seed, scale: S }); return mk('D hybrid', r.canvas, r.ms); };
  if (n === '1') { const g = document.createElement('div'); g.className = 'grid2'; app.appendChild(g); for (const f of [A, B, C, D]) { g.appendChild(f()); await raf(); } }
  else { const f = { '2': A, '3': B, '4': C, '7': D }[n]; if (f) { const e = f(); e.style.width = fullW() + 'px'; app.appendChild(e); } else if (n === '8') { const { renderE } = await import('./brushE'); const r = renderE(sc, { seed, scale: S }); const e = mk('E p5.brush', r.canvas, r.ms); e.style.width = fullW() + 'px'; app.appendChild(e); } }
}

const fnv = (c: HTMLCanvasElement): string => { const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data; let h = 2166136261; for (let i = 0; i < d.length; i += 5) h = Math.imul(h ^ d[i], 16777619); return (h >>> 0).toString(16); };
async function determinism(): Promise<Record<string, unknown>> {
  const res: Record<string, unknown> = {};
  for (const S of [1, 1.6]) {
    const a = renderB(buildScene(seed), { seed, scale: S }), b = renderB(buildScene(seed), { seed, scale: S });
    const ha = fnv(a.canvas), hb = fnv(b.canvas); res[`x${S}`] = { hash: ha, again: hb, identical: ha === hb, ms: a.ms, parts: a.parts, px: [a.canvas.width, a.canvas.height] };
  }
  return res;
}
((window as unknown) as { __det: unknown }).__det = determinism;

const LOOK_BTNS = Object.entries(LOOKS).map(([id, l]) => `<button data-look="${id}" class="${view === 'look' && look === id ? 'on' : ''}"><b>${id}</b>${l.name}</button>`).join('');
async function render(): Promise<void> {
  const setBtns = Object.keys(LOOKS).map((id) => `<button data-set="${id}" class="${view === 'set' && look === id ? 'on' : ''}">${id}</button>`).join('');
  const techs = ['1 all', '2 A svg', '3 B', '4 C gl', '7 D hybrid', '8 E p5.brush'].map((l) => `<button data-v="${l[0]}" class="${view === l[0] ? 'on' : ''}">${l}</button>`).join('');
  bar.innerHTML = `<button data-v="looks" class="${view === 'looks' ? 'on' : ''}"><b>0</b>Looks</button>${LOOK_BTNS}<button data-v="cut" class="${view === 'cut' ? 'on' : ''}"><b>k</b>Cut-out</button><button data-v="faces" class="${view === 'faces' ? 'on' : ''}"><b>f</b>Faces</button><span class="sep">grand</span>${['grand x exterior', 'gcut u cutaway', 'glayers l layers', 'details d details', 'ba v before/after', 'gbench j bench'].map((l) => { const [v, key, ...n] = l.split(' '); return `<button data-v="${v}" class="${view === v ? 'on' : ''}"><b>${key}</b>${n.join(' ')}</button>`; }).join('')}<span class="sep">sets</span>${setBtns}<span class="sep">scene</span>` +
    ['ext', 'shop', 'title'].map((s) => `<button data-scene="${s}" class="${which === s ? 'on' : ''}">${s}</button>`).join('') + `<span class="sep">techniques</span>${techs}<input id="seed" value="${seed}" title="seed"><button id="roll">re-roll</button><button id="x2" class="${x2 ? 'on' : ''}">2x</button><span id="stat">rendering</span>`;
  app.innerHTML = ''; document.title = 'busy'; await raf();
  try {
    const gS = Number(q.get('S') ?? 1.6);
    if (view === 'grand') await grandView(app, stats, 'ext', look, seed, gS, fullW()); else if (view === 'gcut') await grandView(app, stats, 'cut', look, seed, gS, fullW());
    else if (view === 'glayers') await layersView(app, stats, look, seed, which === 'cut' ? 'cut' : 'ext'); else if (view === 'details') await detailsView(app, stats, look, seed);
    else if (view === 'ba') await beforeAfter(app, stats, seed); else if (view === 'gbench') await bench(app, stats, seed);
    else if (view === 'looks') await contact(); else if (view === 'look') await full(); else if (view === 'set') await set(); else if (view === 'cut') await cutout(); else if (view === 'faces') await faces(); else await tech(view);
  } catch (e) { app.textContent = 'error: ' + String(e); console.error(e); }
  (document.getElementById('stat') as HTMLElement).textContent = 'done'; document.title = 'ready';
}
function go(): void { history.replaceState(null, '', `?view=${view}&look=${look}&scene=${which}&seed=${seed}${x2 ? '&x2=1' : ''}${q.get('S') ? '&S=' + q.get('S') : ''}`); void render(); }
bar.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button'); if (!b) return;
  if (b.id === 'roll') seed = Math.floor(Math.random() * 9999); else if (b.id === 'x2') x2 = !x2;
  else if (b.dataset.look) { if (!['grand', 'gcut', 'glayers', 'details'].includes(view)) view = 'look'; look = b.dataset.look; } else if (b.dataset.set) { view = 'set'; look = b.dataset.set; } else if (b.dataset.scene) { which = b.dataset.scene; if (view !== 'look') view = 'look'; } else if (b.dataset.v) view = b.dataset.v;
  go();
});
bar.addEventListener('change', (e) => { const t = e.target as HTMLInputElement; if (t.id === 'seed') { seed = Number(t.value) || 1; go(); } });
app.addEventListener('click', (e) => { const f = (e.target as HTMLElement).closest('figure') as HTMLElement | null; if (!f) return; if (f.dataset.look) { view = 'look'; look = f.dataset.look; which = 'ext'; go(); } else if (f.dataset.scene) { view = 'look'; which = f.dataset.scene; go(); } });
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  const gk: Record<string, string> = { x: 'grand', u: 'gcut', l: 'glayers', v: 'ba', j: 'gbench' };
  if (gk[e.key]) view = gk[e.key]; else if (e.key === 'D') view = 'details'; else if (e.key === 'n' && view.startsWith('g')) look = look === 'e' ? 'a' : 'e'; else
  if (e.key === '0') view = 'looks'; else if ('abcde'.includes(e.key) && e.key.length === 1) { if (!['grand', 'gcut', 'glayers', 'details'].includes(view)) view = 'look'; look = e.key; } else if (e.key === 'k') view = 'cut'; else if (e.key === 'f') view = 'faces'; else if (e.key === 'g') view = 'set'; else if (/^[1-8]$/.test(e.key)) view = e.key; else return;
  go();
});
void render();
