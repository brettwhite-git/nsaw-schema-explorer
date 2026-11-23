// Lab: three concept sketches for the entry piece (static, no scroll wiring, no hover system, no tiles-as-data).
import '../../styles/tokens.generated.css';
import '../../styles/drawn.css';
import { loadOntology } from '../../ontology/load';
import { Timeline } from '../../ink/timeline';
import { toggleTheme } from '../../site/theme';
import { flags, layoutCallouts, type Sketch } from './kit';
import type { Counts } from './common';
import { drawA } from './sketchA';
import { drawB } from './sketchB';
import { drawC } from './sketchC';

type Draw = (svg: SVGSVGElement, W: number, H: number, g: number, c: Counts, narrow: boolean) => Sketch;
interface SheetDef { id: string; name: string; idea: string; draw: Draw; demand: string; scroll: string }

const SHEETS: SheetDef[] = [
  {
    id: 'a', name: 'A. The building', idea: 'a literal warehouse building, cut away',
    draw: drawA,
    demand: 'Click the ledger racks or the card-drawer cabinets and the floor opens into a close-up: the real tables as ledgers on shelves, grouped facts then dimensions. Click the catalogue and the real subject areas appear as drawers, grouped by functional area. One floor at a time, never all at once.',
    scroll: 'The roof lifts off, then each floor rises in turn from the top. The lift shaft and the amber line stay connected across every gap, and each floor’s name and claim fade in as it separates.',
  },
  {
    id: 'b', name: 'B. The machine', idea: 'an exploded patent drawing of one appliance',
    draw: drawB,
    demand: 'Click a plate and it swings to plan view and fills with its real tiles; the "and N more" stack unfolds into the grid, with the named items kept in place so you can find them.',
    scroll: 'The parts slide apart along the dashed axis, top part first, each balloon and its label appearing as its part separates. The amber line is drawn up through the parts as they open.',
  },
  {
    id: 'c', name: 'C. The section', idea: 'a plain side-on cross-section (the control)',
    draw: drawC,
    demand: 'Click a band and it widens to the full width while the other bands shrink to labelled strips; the real tables or subject areas fill the open band as a tile field, sorted by district.',
    scroll: 'The section opens band by band from the bottom, and the amber thread is sewn upward as each band opens. The two doors open last.',
  },
];

const W = 900, H = 620;
let counts: Counts = { records: 0, tables: 0, subjectAreas: 0, twins: 0, shownTables: 4 };
const reduced = /[?&]reduced=1\b/.test(location.search) || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

interface State { def: SheetDef; svg: SVGSVGElement; g: number; target: number; tl: Timeline | null; raf: number; parts: HTMLOListElement; wrap: HTMLElement; sec: HTMLElement; tog: HTMLButtonElement[] }
const states: State[] = [];

function render(s: State, g: number, rough: boolean): void {
  const narrow = s.wrap.clientWidth < 640;
  s.svg.textContent = '';
  flags.rough = rough;
  s.tl?.destroy(); s.tl = null;
  const sk = s.def.draw(s.svg, W, H, g, counts, narrow);
  layoutCallouts(sk, s.svg, W, H);
  const b = sk.bounds;
  if (narrow) { const x0 = Math.max(0, b.x0 - 52), x1 = Math.min(W, b.x1 + 52); s.svg.setAttribute('viewBox', `${x0} 0 ${x1 - x0} ${H}`); }
  else s.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  s.svg.classList.toggle('narrow', narrow);
  s.sec.classList.toggle('narrow-on', narrow);
  s.parts.textContent = '';
  for (const c of sk.callouts) {
    const li = document.createElement('li');
    const n = document.createElement('span'); n.className = 'pn' + (c.accent ? ' pa' : ''); n.textContent = c.n || '•';
    const t = document.createElement('span'); t.className = c.accent ? 'pa' : '';
    t.textContent = c.lines.join(' ');
    if (c.sub) { const sub = document.createElement('span'); sub.className = 'ps'; sub.textContent = c.sub; t.appendChild(sub); }
    li.append(n, t); s.parts.appendChild(li);
  }
  (s as State & { sk?: Sketch }).sk = sk;
  s.g = g;
}

function drawIn(s: State): void {
  const sk = (s as State & { sk?: Sketch }).sk!;
  const tl = new Timeline();
  const n = sk.paths.length;
  sk.paths.forEach((p, i) => tl.stroke(p, (i / n) * 1300, 420));
  s.tl = tl;
  tl.replay();
}

function go(s: State, to: number): void {
  s.target = to;
  s.tog.forEach((b, i) => b.setAttribute('aria-pressed', String((i === 0) === (to === 0))));
  if (reduced) { render(s, to, true); return; }
  cancelAnimationFrame(s.raf);
  const from = s.g, t0 = performance.now(), dur = 700;
  const step = (now: number): void => {
    const t = Math.min(1, (now - t0) / dur), e = t * t * (3 - 2 * t);
    const last = t >= 1;
    render(s, from + (to - from) * e, last);
    if (!last) s.raf = requestAnimationFrame(step);
  };
  s.raf = requestAnimationFrame(step);
}

function build(): void {
  const lab = document.getElementById('lab')!;
  const top = document.createElement('div'); top.className = 'lab-top';
  top.innerHTML = '<h1>Entry piece: three concept sketches</h1>';
  const theme = document.createElement('button'); theme.className = 'btn'; theme.textContent = 'toggle theme'; theme.onclick = () => toggleTheme();
  top.appendChild(theme); lab.appendChild(top);
  const note = document.createElement('p'); note.className = 'lab-note';
  note.textContent = 'Static sketches. Same five parts, same amber order line, three ideas. Counts are read from the ontology. The mass of real tiles is not shown at rest; each caption says how it would appear on demand.';
  lab.appendChild(note);
  for (const def of SHEETS) {
    const sec = document.createElement('section'); sec.className = 'sheet-s'; sec.id = `sheet-${def.id}`;
    const tag = document.createElement('div'); tag.className = 'tag'; tag.textContent = `${def.name}: ${def.idea}`;
    const h2 = document.createElement('h2'); h2.textContent = 'How NetSuite Data Intelligence is put together';
    const sub = document.createElement('p'); sub.className = 'sub'; sub.textContent = 'One order line, followed all the way up.';
    const ctl = document.createElement('div'); ctl.className = 'ctl';
    const b1 = document.createElement('button'); b1.className = 'btn'; b1.textContent = 'together';
    const b2 = document.createElement('button'); b2.className = 'btn'; b2.textContent = 'apart';
    const rp = document.createElement('button'); rp.className = 'btn'; rp.textContent = 'replay drawing'; rp.style.marginLeft = 'auto';
    ctl.append(b1, b2, rp);
    const wrap = document.createElement('div'); wrap.className = 'sk-wrap';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'fig'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${def.name}: five parts, bottom to top: NetSuite, ingestion, warehouse, semantic model, and two doors out. One amber line follows an order line up through them.`);
    wrap.appendChild(svg);
    const legend = document.createElement('div'); legend.className = 'legend-s';
    legend.innerHTML = '<span><i></i>one order line, followed all the way up</span><span><i class="pc"></i>pencil: from Oracle’s documentation, not the lineage file</span>';
    const parts = document.createElement('ol'); parts.className = 'parts'; parts.setAttribute('aria-label', 'Parts');
    const cap = document.createElement('div'); cap.className = 'cap-s';
    cap.innerHTML = '';
    const p1 = document.createElement('p'); const x1 = document.createElement('b'); x1.textContent = 'On demand'; p1.append(x1, def.demand);
    const p2 = document.createElement('p'); const x2 = document.createElement('b'); x2.textContent = 'On scroll'; p2.append(x2, def.scroll);
    cap.append(p1, p2);
    sec.append(tag, h2, sub, ctl, wrap, legend, parts, cap);
    lab.appendChild(sec);
    const st: State = { def, svg, g: 0, target: 0, tl: null, raf: 0, parts, wrap, sec, tog: [b1, b2] };
    states.push(st);
    b1.onclick = () => go(st, 0); b2.onclick = () => go(st, 1);
    rp.onclick = () => { render(st, st.g, true); if (!reduced) drawIn(st); };
    const q = new URLSearchParams(location.search);
    const startG = q.get('g') === '1' ? 1 : 0;
    render(st, startG, true);
    st.tog.forEach((b, i) => b.setAttribute('aria-pressed', String((i === 0) === (startG === 0))));
    if (!reduced && q.get('draw') !== '0') drawIn(st);
  }
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = window.setTimeout(() => states.forEach((s) => render(s, s.g, true)), 150); });
}

loadOntology({ baseUrl: '/ontology/' }).then((o) => {
  const m = o.core.meta.counts;
  counts = { records: m.explicitNetsuiteRecords, tables: m.physicalTablesInLineage, subjectAreas: m.subjectAreas, twins: m.securedTables, shownTables: 4 };
  build();
}, (e) => { document.getElementById('lab')!.textContent = `ontology failed to load: ${String(e)}`; });
