// Lab: staffed cross-section mock-up. Stills only.
//   keys 1-4 (or ?view=1..4): 1 figure sheet, 2 establishing shot, 3 front office close-up, 4 opening bookend   A all   T theme
//   ?labels=0 hides all text   ?chrome=0 stage only
import '../../styles/tokens.generated.css';
import '../../styles/drawn.css';
import { currentTheme, setTheme } from '../../site/theme';
import { el } from '../../ink/svg';
import { Pen } from '../../figures/scenes/objects';
import { figureSheet } from './sheet';
import { establishing, closeup, bookend, HOUSE } from './house';
import { FIG, type FigMode } from './silhouette';

const q = new URLSearchParams(location.search);
let view = Math.min(4, Math.max(1, Number(q.get('view') ?? 1)));
let all = q.get('mode') === 'all';
const MODES: FigMode[] = ['solid', 'contour', 'jointed'];
FIG.mode = (MODES.find((m) => m === q.get('fig')) ?? 'solid') as FigMode;
const root = document.getElementById('dh')!;
const mk = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
const btn = (label: string, on: () => void, pressed?: boolean): HTMLButtonElement => { const b = mk('button', 'btn', label); b.type = 'button'; if (pressed !== undefined) b.setAttribute('aria-pressed', String(pressed)); b.addEventListener('click', on); return b; };

const VIEWS = [
  { name: 'figures', cap: 'The figure system as solid silhouettes, the contour alternative, 48 px, and the earlier jointed figures.', w: 1200, h: 1500 },
  { name: 'building', cap: 'The establishing shot: five rooms, five workers, the shaft, the customer outside the counter window.', w: 1200, h: 750 },
  { name: 'front office', cap: 'Close-up: someone files every order as separate cards.', w: 1200, h: 750 },
  { name: 'opening', cap: 'Opening bookend: a customer at the counter with the first question; the building is quiet behind.', w: 1200, h: 750 },
];

function stage(v: number): HTMLElement {
  const V = VIEWS[v - 1];
  const st = mk('div', 'stage');
  const svg = el('svg', { viewBox: `0 0 ${V.w} ${V.h}`, role: 'img', 'aria-label': V.name }, st);
  const g = el('g', {}, svg);
  const p = new Pen(svg, 400 + v * 1000);
  if (v === 1) figureSheet(p, g);
  else if (v === 2) establishing(p, g);
  else if (v === 3) closeup(p, g);
  else bookend(p, g, st);
  if (q.get('labels') === '0') { svg.querySelectorAll('text').forEach((t) => ((t as SVGElement).style.display = 'none')); st.querySelectorAll('.hand').forEach((t) => ((t as HTMLElement).style.display = 'none')); }
  return st;
}

function render(): void {
  root.textContent = '';
  if (q.get('chrome') !== '0') {
    const top = mk('div', 'dh-top'); top.append(mk('h1', '', 'Staffed cross-section: a style mock-up'), btn('theme (T)', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark')));
    const ctl = mk('div', 'dh-ctl'); const seg = mk('span', 'seg');
    VIEWS.forEach((V, i) => seg.append(btn(`${i + 1} ${V.name}`, () => { view = i + 1; all = false; render(); }, !all && view === i + 1)));
    const fseg = mk('span', 'seg');
    MODES.forEach((m) => fseg.append(btn(m, () => { FIG.mode = m; render(); }, FIG.mode === m)));
    ctl.append(seg, btn('all (A)', () => { all = !all; render(); }, all), mk('span', '', 'figures (F):'), fseg);
    root.append(top, ctl);
  }
  if (q.get('mode') === 'compare') {
    const grid = mk('div', 'dh-all'); const keep = FIG.mode;
    (['jointed', 'solid'] as FigMode[]).forEach((m) => { FIG.mode = m; grid.append(stage(view)); });
    FIG.mode = keep; root.append(grid);
  } else if (all) {
    const grid = mk('div', 'dh-all');
    [1, 2, 3, 4].forEach((v) => { const s = stage(v); s.addEventListener('click', () => { view = v; all = false; render(); }); grid.append(s); });
    root.append(grid);
  } else {
    root.append(stage(view));
    if (q.get('chrome') !== '0') root.append(mk('div', 'dh-cap', `${view} ${VIEWS[view - 1].name}: ${VIEWS[view - 1].cap}`));
  }
  const u = new URL(location.href); u.searchParams.set('view', String(view)); u.searchParams.set('fig', FIG.mode); if (all) u.searchParams.set('mode', 'all'); else u.searchParams.delete('mode'); history.replaceState(null, '', u);
}

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (['1', '2', '3', '4'].includes(k)) { view = Number(k); all = false; render(); }
  else if (k === 'a') { all = !all; render(); }
  else if (k === 't') setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  else if (k === 'f') { FIG.mode = MODES[(MODES.indexOf(FIG.mode) + 1) % 3]; render(); }
});
void HOUSE;
(document.fonts?.ready ?? Promise.resolve()).then(render, render);
