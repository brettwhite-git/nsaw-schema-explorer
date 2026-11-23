// Lab: style comparison. Two frames, each drawn three ways, as stills.
//   keys: 1 / 2 choose the frame   A / B / C choose the version   O all three side by side   T theme
//   ?frame=1&v=b opens an exact view   ?mode=all the overview   ?theme=light   ?chrome=0 stage only   ?labels=0 hides all text
import '../../styles/tokens.generated.css';
import '../../styles/drawn.css';
import { loadOntology, type Ontology } from '../../ontology/load';
import { currentTheme, setTheme } from '../../site/theme';
import { SCENES, Sequence } from '../../figures/scenes';
import { el } from '../../ink/svg';
import { Pen, STAGE } from './kit';
import { DEMOS } from './objects';
import { f1b, f1c } from './f1';
import { f2b, f2c } from './f2';

type Ver = 'a' | 'b' | 'c';
const q = new URLSearchParams(location.search);
let frame: 1 | 2 = q.get('frame') === '2' ? 2 : 1;
let ver: Ver = (['a', 'b', 'c'] as const).find((v) => v === q.get('v')) ?? 'b';
let all = q.get('mode') === 'all';
let ontology: Ontology | undefined;
const root = document.getElementById('sty')!;
const mk = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };

/** the finished frame of the real scene that matches (scene 1: 2 = pointers, 4 = whose number; beats are 0-based) */
const A_BEAT: Record<1 | 2, number> = { 1: 2, 2: 4 };

const CAPTION: Record<Ver, Record<1 | 2, [string, string]>> = {
  a: { 1: ['A  as it is now', 'The real scene 1, frozen at its finished "pointers" frame (scene=1, beat=2).'], 2: ['A  as it is now', 'The real scene 1, frozen at its finished "whose number" frame (scene=1, beat=4).'] },
  b: { 1: ['B  recognisable objects', 'One focus, plain words first, the system name small beneath; three line weights; one amber thing.'], 2: ['B  recognisable objects', 'Three printed reports tied to one order: the same records, three moments.'] },
  c: { 1: ['C  card-index analogy', 'The form is torn into cards and filed in labelled drawers; a slip says where to look instead of holding a copy.'], 2: ['C  measuring-tape analogy', 'Three tapes laid against the same order, each stopping at a different mark.'] },
};

let seqs: Sequence[] = [];
const cleanups: (() => void)[] = [];

function drawFrame(f: 1 | 2, v: 'b' | 'c', nss = false): SVGSVGElement {
  const svg = el('svg', { viewBox: `0 0 ${STAGE.w} ${STAGE.h}`, role: 'img', 'aria-label': `Frame ${f}, version ${v}` });
  const g = el('g', {}, svg);
  const p = new Pen(svg, f * 1000 + (v === 'b' ? 100 : 500));
  p.nss = nss;
  (f === 1 ? (v === 'b' ? f1b : f1c) : (v === 'b' ? f2b : f2c))(p, g);
  if (q.get('labels') === '0') svg.querySelectorAll('text').forEach((t) => ((t as SVGElement).style.display = 'none'));
  return svg;
}

function mountA(stage: HTMLElement, f: 1 | 2): void {
  const inner = mk('div', 'a-inner');
  stage.append(inner);
  const fit = (): void => {
    const w = stage.clientWidth || 1200, h = stage.clientHeight || 750;
    const s = Math.min(w / 1200, h / 780);
    inner.style.transform = `translate(${(w - 1200 * s) / 2}px, ${(h - 780 * s) / 2}px) scale(${s})`;
  };
  const ro = new ResizeObserver(fit); ro.observe(stage); cleanups.push(() => ro.disconnect());
  fit();
  const seq = new Sequence(inner, SCENES, { ontology, reducedMotion: true });
  seq.goto(1, A_BEAT[f], 1);
  seqs.push(seq);
  if (q.get('labels') === '0') requestAnimationFrame(() => stage.querySelectorAll('text, .scn-q, .scn-note').forEach((t) => ((t as HTMLElement).style.visibility = 'hidden')));
}

function stageFor(f: 1 | 2, v: Ver): HTMLElement {
  const st = mk('div', 'stage');
  if (v === 'a') mountA(st, f); else st.append(drawFrame(f, v));
  return st;
}

function btn(label: string, on: () => void, pressed?: boolean, title = ''): HTMLButtonElement {
  const b = mk('button', 'btn', label); b.type = 'button';
  if (pressed !== undefined) b.setAttribute('aria-pressed', String(pressed));
  if (title) b.title = title;
  b.addEventListener('click', on);
  return b;
}

function sync(): void {
  const u = new URL(location.href);
  u.searchParams.set('frame', String(frame)); u.searchParams.set('v', ver);
  if (all) u.searchParams.set('mode', 'all'); else u.searchParams.delete('mode');
  history.replaceState(null, '', u);
}

function render(): void {
  seqs.forEach((s) => s.destroy()); seqs = [];
  cleanups.splice(0).forEach((f) => f());
  root.textContent = '';
  const chrome = q.get('chrome') !== '0';
  if (chrome) {
    const top = mk('div', 'sty-top');
    top.append(mk('h1', '', 'Style comparison: diagrams versus illustrations'), btn('theme (T)', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark')));
    root.append(top);
    const ctl = mk('div', 'sty-ctl');
    const f = mk('span', 'seg'); const fl = mk('span', 'sty-lbl', 'frame');
    f.append(btn('1 one order, several records', () => { frame = 1; render(); }, frame === 1), btn('2 different numbers', () => { frame = 2; render(); }, frame === 2));
    const v = mk('span', 'seg'); const vl = mk('span', 'sty-lbl', 'version');
    v.append(btn('A as is', () => { ver = 'a'; all = false; render(); }, !all && ver === 'a'), btn('B objects', () => { ver = 'b'; all = false; render(); }, !all && ver === 'b'), btn('C analogy', () => { ver = 'c'; all = false; render(); }, !all && ver === 'c'));
    const o = btn('all three (O)', () => { all = !all; render(); }, all);
    ctl.append(fl, f, vl, v, o);
    root.append(ctl);
  }
  if (all) {
    const grid = mk('div', 'sty-all');
    (['a', 'b', 'c'] as const).forEach((v) => {
      const cell = mk('div', 'cell');
      const st = stageFor(frame, v);
      st.addEventListener('click', () => { ver = v; all = false; render(); });
      cell.append(st);
      const c = mk('div', 'sty-cap'); const cp = CAPTION[v][frame];
      const b = mk('b', '', cp[0]); c.append(b);
      cell.append(c);
      grid.append(cell);
    });
    root.append(grid);
  } else {
    root.append(stageFor(frame, ver));
    const c = mk('div', 'sty-cap'); const cp = CAPTION[ver][frame];
    const b = mk('b', '', cp[0]); c.append(b, document.createTextNode(`: ${cp[1]}`));
    root.append(c);
  }
  if (chrome) root.append(objectSheet());
  sync();
}

function objectSheet(): HTMLElement {
  const sec = mk('section', 'sty-sheet');
  sec.append(mk('h2', '', 'Object sheet, version B'), mk('p', '', 'Each object alone at about 120 px and about 40 px, without its label. Judge whether it is recognisable at a glance. Stroke weights are held at their real pixel size so the small one is honest about line weight.'));
  const grid = mk('div', 'obj-grid');
  DEMOS.forEach((d, i) => {
    const cell = mk('div', 'obj'); const row = mk('div', 'row');
    for (const big of [true, false]) {
      const size = big ? 120 : 40;
      const svg = el('svg', {});
      const p = new Pen(svg, 9000 + i * 100 + (big ? 0 : 50)); p.nss = true; p.hatchOn = big;
      const g = el('g', {}, svg);
      const bb = d.draw(p, g, true);
      const bw = bb.x1 - bb.x0, bh = bb.y1 - bb.y0, k = size / Math.max(bw, bh);
      svg.setAttribute('viewBox', `${bb.x0} ${bb.y0} ${bw} ${bh}`);
      svg.setAttribute('width', String(Math.round(bw * k))); svg.setAttribute('height', String(Math.round(bh * k)));
      row.append(svg);
    }
    cell.append(row, mk('div', 'nm', d.name), mk('div', 'sy', d.sys));
    grid.append(cell);
  });
  sec.append(grid);
  return sec;
}

// the real scene installs its own key handlers; this lab owns the keyboard, so they never see a key
window.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === '1' || k === '2') { frame = k === '1' ? 1 : 2; render(); }
  else if (k === 'a' || k === 'b' || k === 'c') { ver = k; all = false; render(); }
  else if (k === 'o') { all = !all; render(); }
  else if (k === 't') setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}, true);

async function main(): Promise<void> {
  try { ontology = await loadOntology({ baseUrl: '/ontology/' }); } catch (e) { console.warn('ontology did not load', e); }
  if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
  render();
}
void main();
