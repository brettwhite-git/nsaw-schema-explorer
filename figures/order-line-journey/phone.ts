// Below 540 px the drawing is taller than the pinned window. The window pans to what each step adds (index.ts); this adds
//   a locator: a hairline outline of the whole drawing with the current window marked, in a corner of the window
//   a sheet:   the whole drawing full screen, pannable and zoomable, opened by tapping the figure (or Enter on the locator)
// Sheet rules: focus trapped while open and restored on close, Escape closes, body scroll locked, no animation.
import { el } from '../../ink/svg';
import type { Figure, FigureOpts } from '../contract';

const NS = 'http://www.w3.org/2000/svg';
const LOC_H = 92;

export interface Locator { update(): void; destroy(): void }

/** The corner locator. It is also the button that opens the sheet. */
export function addLocator(host: HTMLElement, drawH: number, drawW: number, marks: () => { y0: number; y1: number }[], step: () => number, open: () => void): Locator {
  const lw = Math.max(18, Math.round((LOC_H * drawW) / drawH));
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:sticky;top:0;height:0;z-index:4;pointer-events:none';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Where you are in the drawing. Open the whole drawing full screen');
  btn.style.cssText = `position:absolute;right:2px;top:4px;width:${lw + 16}px;height:${LOC_H + 12}px;padding:0;border:0;background:none;cursor:pointer;pointer-events:auto;color:var(--ink)`;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', String(lw + 16)); svg.setAttribute('height', String(LOC_H + 12));
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'display:block;overflow:visible';
  const outline = el('rect', { x: 8, y: 6, width: lw, height: LOC_H, fill: 'var(--paper)', stroke: 'var(--ink-2)', 'stroke-width': 0.6 }, svg);
  void outline;
  const ticks = el('g', {}, svg);
  const win = el('rect', { x: 6.5, y: 6, width: lw + 3, height: 10, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.6 }, svg);
  btn.appendChild(svg);
  wrap.appendChild(btn);
  host.insertBefore(wrap, host.firstChild);
  btn.addEventListener('click', (e) => { e.stopPropagation(); open(); });
  const update = (): void => {
    const k = LOC_H / drawH;
    const top = Math.min(LOC_H - 6, host.scrollTop * k);
    const h = Math.max(6, Math.min(LOC_H - top, (host.clientHeight - 1) * k));
    win.setAttribute('y', String(6 + top)); win.setAttribute('height', String(h));
    ticks.textContent = '';
    marks().forEach((m, i) => {
      const y = 6 + ((m.y0 + m.y1) / 2) * k;
      const on = i === step();
      el('line', { x1: 8, x2: 8 + (on ? 7 : 3.5), y1: y, y2: y, stroke: 'var(--ink-2)', 'stroke-width': on ? 1.2 : 0.6 }, ticks);
    });
  };
  host.addEventListener('scroll', update, { passive: true });
  update();
  return { update, destroy: () => { host.removeEventListener('scroll', update); wrap.remove(); } };
}

let openSheet: HTMLElement | null = null;

/** Full-screen sheet with the whole drawing at `step`. figure is the same module, mounted finished with props.sheet. */
export function showSheet(figure: Figure, opts: FigureOpts, step: number): void {
  if (openSheet) return;
  const prevFocus = document.activeElement as HTMLElement | null;
  const root = document.getElementById('root');
  const bodyOverflow = document.body.style.overflow;
  const sheet = document.createElement('div');
  sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', 'The whole drawing');
  sheet.style.cssText = 'position:fixed;inset:0;z-index:1000;background:var(--paper);display:flex;flex-direction:column;color:var(--ink)';
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 12px;border-bottom:1px solid var(--hair);flex:none';
  const mkBtn = (label: string, text: string): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn'; b.textContent = text; b.setAttribute('aria-label', label);
    b.style.minWidth = '44px'; b.style.minHeight = '44px';
    return b;
  };
  const title = document.createElement('span');
  title.className = 'mono-cap'; title.textContent = 'The whole drawing'; title.style.marginRight = 'auto';
  const minus = mkBtn('Zoom out', '-'), plus = mkBtn('Zoom in', '+'), fit = mkBtn('Fit to width', 'fit'), close = mkBtn('Close the drawing', 'close');
  bar.append(title, minus, plus, fit, close);
  const scroller = document.createElement('div');
  scroller.style.cssText = 'flex:1;overflow:auto;touch-action:pan-x pan-y;overscroll-behavior:contain;padding:12px';
  scroller.tabIndex = -1;
  const sizer = document.createElement('div');
  const inner = document.createElement('div');
  const base = Math.min(520, Math.max(280, window.innerWidth - 24));
  inner.style.cssText = `width:${base}px;transform-origin:0 0`;
  sizer.appendChild(inner); scroller.appendChild(sizer);
  sheet.append(bar, scroller);
  document.body.appendChild(sheet);
  openSheet = sheet;
  document.body.style.overflow = 'hidden';
  root?.setAttribute('inert', '');
  const handle = figure.mount(inner, { ...opts, step, reducedMotion: true, finished: true, props: { ...(opts.props ?? {}), sheet: true }, onOpen: (r) => { done(); opts.onOpen?.(r); } });

  let z = 1;
  const apply = (nz: number): void => {
    z = Math.max(0.6, Math.min(3, nz));
    inner.style.transform = `scale(${z})`;
    const h = inner.scrollHeight;
    sizer.style.width = `${base * z}px`; sizer.style.height = `${h * z}px`;
  };
  apply(1);
  minus.onclick = () => apply(z / 1.25); plus.onclick = () => apply(z * 1.25); fit.onclick = () => apply(1);
  scroller.addEventListener('wheel', (e) => { if (e.ctrlKey) { e.preventDefault(); apply(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); } }, { passive: false });
  // two-finger pinch
  const pts = new Map<number, { x: number; y: number }>();
  let d0 = 0, z0 = 1;
  scroller.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { const [a, b] = [...pts.values()]; d0 = Math.hypot(a.x - b.x, a.y - b.y); z0 = z; } });
  scroller.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2 && d0 > 0) { const [a, b] = [...pts.values()]; apply(z0 * (Math.hypot(a.x - b.x, a.y - b.y) / d0)); }
  });
  const up = (e: PointerEvent): void => { pts.delete(e.pointerId); };
  scroller.addEventListener('pointerup', up); scroller.addEventListener('pointercancel', up);

  const focusables = (): HTMLElement[] => [...sheet.querySelectorAll<HTMLElement>('button, [tabindex="0"]')].filter((n) => !n.hasAttribute('disabled'));
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.preventDefault(); done(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables();
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || !sheet.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !sheet.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', onKey, true);
  function done(): void {
    if (openSheet !== sheet) return;
    document.removeEventListener('keydown', onKey, true);
    handle.destroy();
    sheet.remove();
    openSheet = null;
    document.body.style.overflow = bodyOverflow;
    root?.removeAttribute('inert');
    prevFocus?.focus?.();
  }
  close.onclick = done;
  close.focus();
}
