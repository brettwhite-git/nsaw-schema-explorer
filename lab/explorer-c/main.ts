// Mock C, "Warehouse atlas": a zoomable schematic map of the warehouse over the real ontology.
// Level 1 (Areas): 9 functional areas as regions, 110 subject areas as blocks, the most shared dimensions as hubs.
// Level 2 (Tables): one fact's star. Header partner on a solid line (entity key list), dimensions on dashed lines
// (co-occurrence in one subject area, never a confirmed join).
// URL drives state: ?dim=DW_NS_CURRENCY_D  ?sa=NetSuite - Sales Order  ?fact=DW_NS_SALES_ORDER_LINES_F
import { loadOntology, type Ontology } from '../../ontology/load';
import { selectStar, nameOverlap, UNIVERSAL_SHARE, type StarData, type StarDim } from '../../figures/sewn-star-data';

const SVGNS = 'http://www.w3.org/2000/svg';
type Attrs = Record<string, string | number>;
function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, parent?: Element, text?: string): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}
const h = (html: string) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content; };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// ------------------------------------------------------------------ text measuring
const ctx = document.createElement('canvas').getContext('2d')!;
function textW(s: string, font: string): number { ctx.font = font; return ctx.measureText(s).width; }
function fit(s: string, font: string, max: number): string {
  if (textW(s, font) <= max) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (textW(s.slice(0, m) + '…', font) <= max) lo = m; else hi = m - 1; }
  return s.slice(0, lo).trimEnd() + '…';
}
function wrap(s: string, font: string, max: number): string[] {
  const words = s.split(' '); const lines: string[] = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (textW(t, font) <= max || !cur) cur = t; else { lines.push(cur); cur = w; } }
  if (cur) lines.push(cur);
  return lines;
}
const F_SA = '400 11.5px Inter';
const F_HUB = '500 11px Inter';
const F_ROLE = '400 11px Inter';

// ------------------------------------------------------------------ data model
interface Sa { i: number; name: string; label: string; short: string; tag: string; fa: number; row: number }
interface Dim { i: number; ci: number; name: string; label: string; saCount: number; derived: boolean; sas: Set<number>; facts: Set<number> }
interface Model {
  o: Ontology; nSa: number; fa: string[]; sas: Sa[]; byFa: Sa[][]; dims: Dim[]; dimByTable: Map<number, Dim>;
  rowOfSa: Map<number, number>; roles: Map<number, string[]>;
}

const PREFIX: [RegExp, string][] = [[/^Order to Cash - /, 'O2C'], [/^Procure to Pay - /, 'P2P']];

const VOCAB = new Set<string>();
/** split a run-together word ("locationtype") into vocabulary words from concept names, or return it whole */
function segment(w: string): string[] {
  const best: (string[] | null)[] = [[]];
  for (let i = 1; i <= w.length; i++) {
    best[i] = null;
    for (let j = Math.max(0, i - 16); j < i; j++) {
      const piece = w.slice(j, i); const prev = best[j];
      if (prev && VOCAB.has(piece) && (!best[i] || prev.length + 1 < best[i]!.length)) best[i] = [...prev, piece];
    }
  }
  return best[w.length] ?? [w];
}
function prettyTable(_o: Ontology, name: string, conceptKeys: Map<string, string>): string {
  const core = name.replace(/^DW_NS_/i, '').replace(/_SEC$/, '').replace(/_(D|F|DH|EF|CF|G)$/i, '');
  const hit = conceptKeys.get(core.replace(/_/g, '').toLowerCase());
  if (hit) return hit;
  return core.toLowerCase().split('_').flatMap((w) => segment(w)).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function buildModel(o: Ontology): Model {
  const bm = o.busMatrix;
  const fa = Array.from({ length: o.count('functionalArea') }, (_, i) => o.get('functionalArea', i).name);
  const conceptKeys = new Map<string, string>();
  for (let i = 0; i < o.count('concept'); i++) {
    const n = o.get('concept', i).name; conceptKeys.set(n.replace(/[^a-z0-9]/gi, '').toLowerCase(), n);
    for (const w of n.toLowerCase().split(/[^a-z]+/)) if (w.length > 1) VOCAB.add(w);
  }
  const rowOfSa = new Map<number, number>(); bm.rows.forEach((sa, r) => rowOfSa.set(sa, r));
  const sas: Sa[] = [];
  for (let i = 0; i < o.count('subjectArea'); i++) {
    const s = o.get('subjectArea', i);
    let short = s.label, tag = '';
    for (const [re, t] of PREFIX) if (re.test(short)) { short = short.replace(re, ''); tag = t; }
    const f = o.neighbors({ type: 'subjectArea', i }, 'inFunctionalArea')[0]?.ref.i ?? 0;
    sas.push({ i, name: s.name, label: s.label, short, tag, fa: f, row: rowOfSa.get(i) ?? -1 });
  }
  const byFa = fa.map((_, f) => sas.filter((s) => s.fa === f).sort((a, b) => a.short.localeCompare(b.short) || a.tag.localeCompare(b.tag)));
  const base = (t: number) => { const n = o.get('physicalTable', t); return n.isSecured && n.baseTable >= 0 ? n.baseTable : t; };
  const dims: Dim[] = bm.columns.map((t, ci) => ({
    i: t, ci, name: o.get('physicalTable', t).name, label: prettyTable(o, o.get('physicalTable', t).name, conceptKeys),
    saCount: bm.columnSaCount[ci], derived: bm.columnDerived[ci] === 1, sas: new Set<number>(), facts: new Set<number>(),
  }));
  bm.cells.forEach((cells, r) => {
    const sa = bm.rows[r];
    for (const ci of cells) { dims[ci].sas.add(sa); for (const f of bm.facts[r]) dims[ci].facts.add(base(f)); }
  });
  const dimByTable = new Map(dims.map((d) => [d.i, d]));
  // role-playing: concepts whose main physical table is this dimension (inferred from presentation folders)
  const roles = new Map<number, string[]>();
  for (let c = 0; c < o.count('concept'); c++) {
    const cn = o.get('concept', c); const t = cn.topPhysical[0];
    if (t === undefined) continue;
    (roles.get(t) ?? roles.set(t, []).get(t)!).push(cn.name);
  }
  return { o, nSa: bm.rows.length, fa, sas, byFa, dims, dimByTable, rowOfSa, roles };
}

// ------------------------------------------------------------------ map layout (world units, 1 unit = 1px at zoom 1)
const BW = 152, BH = 20, PX = 160, PY = 24, RPAD = 10, RHEAD = 32, GAP = 12, WORLD_W = 1060, BAND_H = 118;
interface RegionBox { fa: number; x: number; y: number; w: number; h: number; cols: number }
interface Layout { regions: RegionBox[]; band: { x: number; y: number; w: number; h: number }; W: number; H: number }

function layoutMap(m: Model): Layout {
  const idx = (n: string) => m.fa.indexOf(n);
  // rows of [functional area, columns]; the last region in a row stretches to the full width
  const rows: [string, number][][] = [
    [['Order to Cash', 4], ['Procure to Pay', 2]],
    [['Inventory & Warehouse', 3], ['Financial Management', 2], ['Banking', 1]],
    [['Manufacturing', 2], ['HR & Payroll', 1], ['Analytics & Predictions', 1], ['Customer Management', 1]],
  ];
  const regions: RegionBox[] = [];
  let y = 16; let band = { x: 0, y: 0, w: WORLD_W, h: BAND_H };
  rows.forEach((row, ri) => {
    const items = row.map(([n, cols]) => { const fa = idx(n); const k = m.byFa[fa].length; return { fa, cols, rowsN: Math.ceil(k / cols) }; });
    const hRow = Math.max(...items.map((it) => RHEAD + it.rowsN * PY + 6));
    let x = 0;
    const extra = WORLD_W - items.reduce((a, it) => a + it.cols * PX + 12, 0) - GAP * (items.length - 1);
    const ones = items.filter((it) => it.cols === 1).length;
    items.forEach((it, k) => {
      let w = it.cols * PX + 12;
      if (ones) { if (it.cols === 1) w += extra / ones; } else if (k === items.length - 1) w = WORLD_W - x;
      regions.push({ fa: it.fa, x, y, w, h: hRow, cols: it.cols });
      x += w + GAP;
    });
    y += hRow + GAP;
    if (ri === 0) { band = { x: 0, y, w: WORLD_W, h: BAND_H }; y += BAND_H + GAP; }
  });
  return { regions, band, W: WORLD_W, H: y + 4 };
}

// ------------------------------------------------------------------ state + URL
interface State { dim?: string; sa?: string; fact?: string; star?: string }
function readUrl(): State {
  const p = new URLSearchParams(location.search);
  return { dim: p.get('dim') ?? undefined, sa: p.get('sa') ?? undefined, fact: p.get('fact') ?? undefined, star: p.get('pick') ?? undefined };
}
function writeUrl(s: State, push = true) {
  const p = new URLSearchParams();
  if (s.fact) p.set('fact', s.fact);
  if (s.sa) p.set('sa', s.sa);
  if (s.dim) p.set('dim', s.dim);
  if (s.star) p.set('pick', s.star);
  const url = location.pathname + (p.toString() ? '?' + p.toString() : '');
  if (push) history.pushState(null, '', url); else history.replaceState(null, '', url);
}

// ------------------------------------------------------------------ pan / zoom
const svg = document.getElementById('map') as unknown as SVGSVGElement;
const mini = document.getElementById('minisvg') as unknown as SVGSVGElement;
const card = document.getElementById('card')!;
const view = { k: 1, tx: 0, ty: 0 };
let world: SVGGElement; let worldSize = { W: 1000, H: 800 };
let miniView: SVGRectElement | null = null;
const MIN_K = 0.5, MAX_K = 2.6;

function stageSize() { const r = svg.getBoundingClientRect(); return { w: r.width, h: r.height }; }
function applyView() {
  world?.setAttribute('transform', `translate(${view.tx.toFixed(1)},${view.ty.toFixed(1)}) scale(${view.k.toFixed(4)})`);
  svg.classList.toggle('lod-far', view.k < 0.78);
  document.getElementById('zpct')!.textContent = Math.round(view.k * 100) + '%';
  if (miniView) {
    const { w, hh } = { w: stageSize().w, hh: stageSize().h };
    miniView.setAttribute('x', String(-view.tx / view.k)); miniView.setAttribute('y', String(-view.ty / view.k));
    miniView.setAttribute('width', String(w / view.k)); miniView.setAttribute('height', String(hh / view.k));
  }
}
function fitView(padTop = 56, pad = 24) {
  const { w, h } = stageSize();
  const k = Math.min(1, (w - 2 * pad) / worldSize.W, (h - padTop - pad - 8) / worldSize.H);
  view.k = Math.max(MIN_K, k);
  view.tx = (w - worldSize.W * view.k) / 2;
  view.ty = padTop + (h - padTop - pad - worldSize.H * view.k) / 2;
  applyView();
}
function zoomAt(f: number, cx: number, cy: number) {
  const k = Math.min(MAX_K, Math.max(MIN_K, view.k * f));
  view.tx = cx - (cx - view.tx) * (k / view.k); view.ty = cy - (cy - view.ty) * (k / view.k); view.k = k; applyView();
}
svg.addEventListener('wheel', (e) => { e.preventDefault(); const r = svg.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
let drag: { x: number; y: number; tx: number; ty: number; moved: boolean } | null = null;
svg.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false }; });
addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 4) return;
  drag.moved = true; svg.classList.add('dragging');
  view.tx = drag.tx + dx; view.ty = drag.ty + dy; applyView();
});
addEventListener('pointerup', () => { if (drag?.moved) suppressClick = true; drag = null; svg.classList.remove('dragging'); setTimeout(() => (suppressClick = false), 0); });
let suppressClick = false;
document.getElementById('zoom')!.addEventListener('click', (e) => {
  const z = (e.target as HTMLElement).closest('button')?.dataset.z; if (!z) return;
  const { w, h } = stageSize();
  if (z === 'fit') (state.fact ? fitView(60, 20) : fitView(16, 16)); else zoomAt(z === 'in' ? 1.25 : 0.8, w / 2, h / 2);
});
function miniJump(e: PointerEvent) {
  const r = mini.getBoundingClientRect(); const { w, h } = stageSize();
  const wx = ((e.clientX - r.left) / r.width) * worldSize.W, wy = ((e.clientY - r.top) / r.height) * worldSize.H;
  view.tx = w / 2 - wx * view.k; view.ty = h / 2 - wy * view.k; applyView();
}
let miniDrag = false;
mini.addEventListener('pointerdown', (e) => { miniDrag = true; miniJump(e); });
addEventListener('pointermove', (e) => { if (miniDrag) miniJump(e); });
addEventListener('pointerup', () => { miniDrag = false; });

function onClick(node: Element, fn: () => void) { node.addEventListener('click', (e) => { e.stopPropagation(); if (!suppressClick) fn(); }); }

// ------------------------------------------------------------------ levels bar + crumb
function renderLevels(level: 1 | 2, factName?: string) {
  const nav = document.getElementById('levels')!;
  nav.innerHTML = '';
  const items: [number, string, boolean][] = [[1, 'Areas', true], [2, factName ? 'Tables' : 'Tables', !!factName], [3, 'Columns', false]];
  items.forEach(([n, label, enabled], k) => {
    if (k) nav.append(h('<span class="sep">›</span>'));
    const b = document.createElement('button');
    b.className = 'lv' + (n === level ? ' on' : '');
    b.innerHTML = `<span class="n">${n}</span>${label}`;
    if (!enabled) { b.disabled = true; b.title = n === 3 ? 'Columns open from a table. In this mock they are listed in the side card.' : 'Step inside a fact to open this level'; }
    if (n === 1 && level !== 1) b.onclick = () => go({});
    nav.append(b);
  });
}

// ------------------------------------------------------------------ app
let M: Model; let L: Layout;
let state: State = {};

function go(s: State, push = true) { state = s; writeUrl(s, push); render(); }

function render() {
  if (state.fact) renderStar(); else renderMap();
}

// ================================================================== LEVEL 1: map
function hubsShown(): Dim[] { return M.dims.slice(0, 12); }

function renderMap() {
  renderLevels(1);
  svg.innerHTML = '';
  worldSize = { W: L.W, H: L.H };
  const defs = el('defs', {}, svg);
  const pat = el('pattern', { id: 'grid', width: 120, height: 120, patternUnits: 'userSpaceOnUse' }, defs);
  for (let k = 0; k < 120; k += 24) { el('line', { x1: k, y1: 0, x2: k, y2: 120, class: k ? 'grid-minor' : 'grid-major' }, pat); el('line', { x1: 0, y1: k, x2: 120, y2: k, class: k ? 'grid-minor' : 'grid-major' }, pat); }
  world = el('g', {}, svg);
  el('rect', { x: -3000, y: -3000, width: 7000, height: 7000, fill: 'url(#grid)' }, world);

  const selDim = state.dim ? M.dims.find((d) => d.name.toLowerCase() === state.dim!.toLowerCase()) : undefined;
  const selSa = state.sa ? M.sas.find((s) => s.name.toLowerCase() === state.sa!.toLowerCase()) : undefined;
  const saDims = selSa && selSa.row >= 0 ? new Set(M.o.busMatrix.cells[selSa.row].map((ci) => M.dims[ci].i)) : undefined;
  if (selDim || selSa) world.classList.add('lit');

  // regions + subject-area blocks
  const blockOf = new Map<number, SVGGElement>();
  for (const r of L.regions) {
    const g = el('g', { class: 'region' }, world);
    el('rect', { class: 'box', x: r.x, y: r.y, width: r.w, height: r.h, rx: 8 }, g);
    const list = M.byFa[r.fa];
    el('text', { class: 'rname', x: r.x + RPAD + 2, y: r.y + 21 }, g, M.fa[r.fa]);
    const hits = selDim ? list.filter((s) => selDim.sas.has(s.i)).length : 0;
    let cnt = selDim ? `${hits} of ${list.length}` : `${list.length} subject area${list.length === 1 ? '' : 's'}`;
    const room = (t: string) => textW(M.fa[r.fa], '600 12.5px Inter') + textW(t, '400 11.5px Inter') + 30 <= r.w;
    if (!room(cnt)) cnt = selDim ? `${hits}/${list.length}` : `${list.length} areas`;
    if (!room(cnt) && !selDim) cnt = String(list.length);
    el('text', { class: 'rcount' + (selDim ? ' hit' : ''), x: r.x + r.w - RPAD - 2, y: r.y + 21, 'text-anchor': 'end' }, g, cnt);
    list.forEach((s, k) => {
      const col = Math.floor(k / Math.ceil(list.length / r.cols)), row = k % Math.ceil(list.length / r.cols);
      const x = r.x + RPAD + col * PX, y = r.y + RHEAD + row * PY;
      const b = el('g', { class: 'sa', transform: `translate(${x},${y})` }, g);
      el('rect', { width: BW, height: BH, rx: 3 }, b);
      const tagW = s.tag ? 28 : 0;
      el('text', { x: 8, y: 14 }, b, fit(s.short, F_SA, BW - 14 - tagW));
      if (s.tag) el('text', { class: 'tag', x: BW - 7, y: 14, 'text-anchor': 'end' }, b, s.tag);
      el('title', {}, b, s.label + (s.tag ? ` (the ${M.fa[s.fa]} process view)` : ''));
      if (selDim?.sas.has(s.i)) b.classList.add('on');
      if (selSa?.i === s.i) b.classList.add('sel');
      onClick(b, () => go({ sa: s.name }));
      blockOf.set(s.i, b);
    });
  }

  // hub band: the most shared dimensions, sized by how many subject areas use them
  const B = L.band; const hubs = hubsShown();
  const bg = el('g', { class: 'band' }, world);
  el('rect', { class: 'bandbox', x: B.x, y: B.y, width: B.w, height: B.h, rx: 8 }, bg);
  el('text', { class: 'bcap', x: B.x + 12, y: B.y + 19 }, bg, 'Shared dimensions');
  el('text', { class: 'bsub', x: B.x + 12 + textW('SHARED DIMENSIONS', '500 10.5px Inter') * 1.12 + 14, y: B.y + 19 }, bg, `the ${hubs.length} most shared of ${M.dims.length}, sized by how many of the ${M.nSa} subject areas use each`);
  const extra = selDim && !hubs.includes(selDim) ? selDim : undefined;
  const shown = extra ? [...hubs, extra] : hubs;
  const moreW = 96; const pitch = (B.w - 24 - moreW) / shown.length; const cy = B.y + 60;
  shown.forEach((d, k) => {
    const cx = B.x + 12 + pitch * (k + 0.5);
    const r = 31 * Math.sqrt(d.saCount / M.nSa);
    const g = el('g', { class: 'hub' }, world);
    el('circle', { class: 'halo', cx, cy, r: r + 5 }, g);
    el('circle', { class: 'ring', cx, cy, r, 'stroke-dasharray': d === extra ? '0' : '0' }, g);
    el('text', { class: 'num', x: cx, y: cy }, g, String(d.saCount));
    const lines = wrap(d.label, F_HUB, pitch - 6).slice(0, 2);
    lines.forEach((ln, j) => el('text', { class: 'hname', x: cx, y: cy + 31 + 8 + 12 + j * 13.5 }, g, fit(ln, F_HUB, pitch - 4)));
    el('title', {}, g, `${d.label} (${d.name}): used in ${d.saCount} of ${M.nSa} subject areas${d.derived ? '. Generated by NSAW.' : ''}`);
    if (selDim === d) g.classList.add('sel');
    if (saDims?.has(d.i)) g.classList.add('on');
    onClick(g, () => go({ dim: d.name }));
    g.addEventListener('pointerenter', () => preview(d, true));
    g.addEventListener('pointerleave', () => preview(d, false));
  });
  const more = el('g', { class: 'more' }, world);
  const mx = B.x + B.w - 12 - moreW;
  el('rect', { x: mx, y: cy - 22, width: moreW - 4, height: 44, rx: 22 }, more);
  el('text', { x: mx + (moreW - 4) / 2, y: cy - 3 }, more, `and ${M.dims.length - hubs.length} more`);
  el('text', { x: mx + (moreW - 4) / 2, y: cy + 12, style: 'fill:var(--pencil);font-size:11px;font-weight:400' }, more, 'pick from list');
  onClick(more, () => { go({ ...(state.dim ? { dim: state.dim } : {}), star: 'list' }); });

  function preview(d: Dim, on: boolean) {
    if (selDim || selSa) return;
    world.classList.toggle('lit', on);
    for (const [sa, b] of blockOf) b.classList.toggle('on', on && d.sas.has(sa));
  }

  renderMini();
  fitView(16, 16);
  if (selDim) dimCard(selDim); else if (selSa) saCard(selSa); else homeCard();
  setCrumb();
}

function renderMini() {
  mini.innerHTML = '';
  mini.setAttribute('viewBox', `-8 -8 ${worldSize.W + 16} ${worldSize.H + 16}`);
  const cap = mini.parentElement!.querySelector('.cap') ?? mini.parentElement!.insertBefore(document.createElement('div'), mini);
  cap.className = 'cap'; cap.textContent = state.fact ? 'Star overview' : 'Overview';
  if (!state.fact) {
    for (const r of L.regions) el('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 10, fill: 'none', stroke: 'var(--ink-2)', 'stroke-opacity': .5, 'stroke-width': 5 }, mini);
    const B = L.band; const hubs = hubsShown(); const pitch = (B.w - 24 - 96) / hubs.length;
    hubs.forEach((d, k) => el('circle', { cx: B.x + 12 + pitch * (k + 0.5), cy: B.y + 60, r: 20, fill: 'var(--ink-2)', 'fill-opacity': .5 }, mini));
  } else {
    for (const r of starBoxes) el('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 8, fill: r.fact ? 'var(--accent)' : 'none', 'fill-opacity': .4, stroke: 'var(--ink-2)', 'stroke-opacity': .6, 'stroke-width': 5 }, mini);
  }
  miniView = el('rect', { fill: 'none', stroke: 'var(--ink)', 'stroke-width': 7, rx: 6 }, mini);
}

function setCrumb() {
  const c = document.getElementById('crumb')!;
  c.innerHTML = '';
  if (state.fact) {
    const b = document.createElement('button'); b.textContent = '← Back to the map'; b.onclick = () => go({});
    c.append(b);
  }
}

// ------------------------------------------------------------------ cards (level 1)
function factLinks(facts: number[], saLabel: string): string {
  const o = M.o; const groups = new Map<number, number[]>();
  for (const f of facts) {
    const t = o.get('physicalTable', f); const base = t.isSecured && t.baseTable >= 0 ? t.baseTable : f;
    (groups.get(base) ?? groups.set(base, []).get(base)!).push(f);
  }
  // show the member that lineage actually uses most (a _SEC twin can carry the columns while its base is a stub)
  const rows = [...groups.values()].map((g) => {
    const show = [...g].sort((a, b) => o.get('physicalTable', b).saCount - o.get('physicalTable', a).saCount || o.get('physicalTable', a).isSecured - o.get('physicalTable', b).isSecured)[0];
    return { show, n: o.get('physicalTable', show), twin: g.length > 1 };
  });
  rows.sort((a, b) => (nameOverlap(saLabel, b.n.name) >= 0.5 ? 1 : 0) - (nameOverlap(saLabel, a.n.name) >= 0.5 ? 1 : 0)
    || (/_LINES?_/.test(b.n.name) ? 1 : 0) - (/_LINES?_/.test(a.n.name) ? 1 : 0) || b.n.saCount - a.n.saCount || a.n.name.localeCompare(b.n.name));
  return rows.map(({ n, twin }) => `<button class="go" data-fact="${esc(n.name)}"><span class="mono">${esc(n.name)}</span><small>${n.columns} columns${twin ? ' · has a secured twin' : ''} · in ${n.saCount} subject area${n.saCount === 1 ? '' : 's'}</small></button>`).join('');
}
function wireCard() {
  card.querySelectorAll<HTMLElement>('[data-fact]').forEach((b) => (b.onclick = () => go({ fact: b.dataset.fact!, sa: b.dataset.sa })));
  card.querySelectorAll<HTMLElement>('[data-dim]').forEach((b) => (b.onclick = () => go({ dim: b.dataset.dim! })));
  card.querySelectorAll<HTMLElement>('[data-sa]').forEach((b) => { if (!b.dataset.fact) b.onclick = () => go({ sa: b.dataset.sa! }); });
  const sel = card.querySelector<HTMLSelectElement>('select[data-pick]');
  if (sel) sel.onchange = () => sel.value && go({ dim: sel.value });
}
function dimPicker(current?: string): string {
  const opts = M.dims.map((d) => `<option value="${esc(d.name)}"${d.name === current ? ' selected' : ''}>${esc(d.label)} · ${d.saCount}</option>`).join('');
  return `<select data-pick aria-label="Choose a shared dimension"><option value="">Choose one of ${M.dims.length} shared dimensions…</option>${opts}</select>`;
}

function homeCard() {
  const c = M.o.core.meta.counts;
  const listOpen = state.star === 'list';
  card.innerHTML = `
    <div class="kick">Level 1 · Areas</div>
    <h2>The warehouse at a glance</h2>
    <p>Each box is a subject area, grouped into its functional area. The circles in the middle are the dimensions most subject areas share.</p>
    <div class="stat">
      <div><b>${c.subjectAreas}</b><span>subject areas</span></div>
      <div><b>${c.functionalAreas}</b><span>functional areas</span></div>
      <div><b>${c.physicalTablesInLineage}</b><span>warehouse tables in lineage</span></div>
      <div><b>${M.dims.length}</b><span>dimensions shared by 2+ areas</span></div>
    </div>
    <h3>Try this</h3>
    <p>Pick a circle to light up every subject area that uses it. Pick a box to see its fact tables.</p>
    <h3>${listOpen ? 'All shared dimensions' : 'Find a dimension'}</h3>
    ${dimPicker()}
    <h3>Step inside a fact</h3>
    <button class="go" data-fact="DW_NS_SALES_ORDER_LINES_F" data-sa="NetSuite - Sales Order"><span class="mono">DW_NS_SALES_ORDER_LINES_F</span><small>Sales order lines, with their header and dimensions</small></button>
    <p class="note">Wheel or the buttons to zoom, drag to pan. Labels hide when zoomed far out.</p>`;
  wireCard();
  if (listOpen) card.querySelector<HTMLSelectElement>('select')?.focus();
}

function dimCard(d: Dim) {
  const o = M.o; const roles = (M.roles.get(d.i) ?? []).filter((r) => r.toLowerCase() !== d.label.toLowerCase());
  const bars = M.fa.map((name, f) => ({ name, n: M.byFa[f].filter((s) => d.sas.has(s.i)).length, of: M.byFa[f].length }))
    .map((b) => `<div class="bar"><span>${esc(b.name)}</span><em>${b.n} / ${b.of}</em><i><u style="width:${(100 * b.n) / b.of}%"></u></i></div>`).join('');
  const missing = M.sas.filter((s) => !d.sas.has(s.i));
  const usesSo = d.sas.has(o.find('subjectArea', 'NetSuite - Sales Order')!);
  card.innerHTML = `
    <div class="kick">Shared dimension${d.derived ? ' · generated by NSAW' : ''}</div>
    <h2>${esc(d.label)}</h2>
    <div class="tname">${esc(d.name)}</div>
    <div class="big"><b>${d.saCount}</b><span>of ${M.nSa} subject areas use it</span></div>
    <p>It appears alongside <b style="color:var(--ink)">${d.facts.size}</b> fact tables in those subject areas. That pairing comes from appearing together, so it is drawn dashed on a star.</p>
    <h3>By functional area</h3>
    <div class="bars">${bars}</div>
    ${roles.length ? `<h3>Roles it plays (${roles.length}, inferred)</h3><div class="chips">${roles.map((r) => `<span class="chip">${esc(r)}</span>`).join('')}</div>` : ''}
    ${missing.length && missing.length <= 12 ? `<h3>Not used in (${missing.length})</h3><ul class="list">${missing.map((s) => `<li><button class="link" data-sa="${esc(s.name)}">${esc(s.label)}</button><em>${esc(M.fa[s.fa])}</em></li>`).join('')}</ul>` : ''}
    ${usesSo ? `<h3>Step inside a fact that uses it</h3><button class="go" data-fact="DW_NS_SALES_ORDER_LINES_F" data-sa="NetSuite - Sales Order"><span class="mono">DW_NS_SALES_ORDER_LINES_F</span><small>Sales order lines</small></button>` : ''}
    <h3>Another dimension</h3>${dimPicker(d.name)}
    <p class="note">“Used in” means its columns appear in that subject area’s lineage. Roles are presentation folders whose main table is this one.</p>`;
  wireCard();
}

function saCard(s: Sa) {
  const o = M.o; const n = o.get('subjectArea', s.i); const bm = o.busMatrix;
  const facts = s.row >= 0 ? bm.facts[s.row] : [];
  const shared = s.row >= 0 ? bm.cells[s.row].length : 0;
  card.innerHTML = `
    <div class="kick">Subject area · ${esc(M.fa[s.fa])}</div>
    <h2>${esc(s.label)}</h2>
    <div class="tname">${esc(s.name)}</div>
    <div class="stat">
      <div><b>${n.presentationTables}</b><span>presentation folders</span></div>
      <div><b>${n.physicalTables}</b><span>warehouse tables</span></div>
      <div><b>${n.facts}</b><span>fact tables</span></div>
      <div><b>${shared}</b><span>shared dimensions</span></div>
    </div>
    <p style="margin-top:12px">The circles that stay lit are the most shared dimensions this subject area uses.</p>
    <h3>Its fact tables · step inside</h3>
    ${facts.length ? factLinks(facts, s.label).replace(/data-fact=/g, `data-sa="${esc(s.name)}" data-fact=`) : '<p>No fact tables in lineage.</p>'}
    <p class="note">Secured _SEC twins are folded into their base table here.</p>`;
  wireCard();
}

// ================================================================== LEVEL 2: one fact's star
interface Box { x: number; y: number; w: number; h: number; fact?: boolean }
let starBoxes: Box[] = [];
let columnsLoaded = false;

interface KeyInfo { grain?: { entity: string; cols: string[]; sentence: string; unresolved: string[] }; partner?: { name: string; i: number; factCol: string; partnerCol: string; entity: string }; keyCols: Set<string> }
function keysFor(factName: string): KeyInfo {
  const o = M.o; const info: KeyInfo = { keyCols: new Set() };
  let best: { e: string; keys: { k: string; c: string; ci: number }[] } | undefined;
  const fl = factName.toLowerCase();
  for (let i = 0; i < o.count('entity'); i++) {
    const e = o.get('entity', i);
    const mine = e.keys.filter((k) => k.t.toLowerCase() === fl);
    if (!mine.length) continue;
    mine.forEach((k) => info.keyCols.add(k.c.toLowerCase()));
    if (mine.length === e.keys.length && (!best || mine.length > best.keys.length)) best = { e: e.name, keys: mine };
    // header partner: the same entity key stated on another fact table
    for (const k of mine) for (const other of e.keys) {
      if (other.k !== k.k || other.t.toLowerCase() === fl || other.ti < 0) continue;
      const ot = o.get('physicalTable', other.ti);
      if (ot.role !== 'fact' && ot.role !== 'enhanced') continue;
      const lineless = factName.replace(/_LINES?_/, '_');
      const score = ot.name === lineless ? 2 : /SNAPSHOT/.test(ot.name) ? 0 : 1;
      const cur = info.partner ? (info.partner.name === lineless ? 2 : /SNAPSHOT/.test(info.partner.name) ? 0 : 1) : -1;
      if (score > cur) info.partner = { name: ot.name, i: other.ti, factCol: k.c, partnerCol: other.c, entity: e.name };
    }
  }
  if (best) {
    const suf = best.keys.map((k) => k.k.split('_').pop()!.toLowerCase());
    const human: Record<string, string> = { transactionline: 'transaction line', accountingbook: 'accounting book', id: 'record' };
    let parts = suf.map((s) => human[s] ?? s);
    if (parts.includes('transaction line')) parts = parts.filter((p) => p !== 'transaction' && p !== 'record');
    parts.sort((a, b) => (a === 'transaction line' ? -1 : b === 'transaction line' ? 1 : 0));
    const cols = [...new Set(best.keys.map((k) => k.c))].sort();
    info.grain = { entity: best.e, cols, sentence: 'One row per ' + parts.join(', per '), unresolved: best.keys.filter((k) => k.ci < 0).map((k) => k.c) };
  }
  return info;
}

function pickStar(factName: string, saHint?: string): StarData | undefined {
  const o = M.o; let fi = o.find('physicalTable', factName); if (fi === undefined) return undefined;
  const bm = o.busMatrix;
  const ft = o.get('physicalTable', fi);
  if (ft.isSecured && ft.baseTable >= 0 && bm.facts.some((f) => f.includes(ft.baseTable))) fi = ft.baseTable;
  const fname = o.get('physicalTable', fi).name;
  const cands = bm.rows.filter((_, r) => bm.facts[r].includes(fi!));
  const ordered = [...cands].sort((a, b) => {
    const ha = saHint && o.get('subjectArea', a).name === saHint ? 1 : 0, hb = saHint && o.get('subjectArea', b).name === saHint ? 1 : 0;
    return hb - ha || nameOverlap(o.get('subjectArea', b).label, fname) - nameOverlap(o.get('subjectArea', a).label, fname);
  });
  for (const sa of ordered) { const s = selectStar(o, o.get('subjectArea', sa).name); if (s?.fact?.i === fi) return s; }
  if (!ordered.length) return undefined;
  const byName = [...cands].sort((a, b) => nameOverlap(o.get('subjectArea', b).label, fname) - nameOverlap(o.get('subjectArea', a).label, fname));
  const s = selectStar(o, o.get('subjectArea', byName[0]).name)!;
  return { ...s, fact: { i: fi, name: fname }, dims: s.dims.filter((d) => d.i !== fi) };
}

async function renderStar() {
  const o = M.o;
  if (!columnsLoaded) {
    svg.innerHTML = ''; card.innerHTML = '<p>Loading the columns…</p>';
    await o.ensure('columns'); columnsLoaded = true;
  }
  const s = pickStar(state.fact!, state.sa);
  if (!s || !s.fact) { card.innerHTML = `<h2>No star for ${esc(state.fact!)}</h2><p>This table is not a fact in any subject area.</p><button class="go" id="bk">Back to the map</button>`; card.querySelector<HTMLElement>('#bk')!.onclick = () => go({}); return; }
  renderLevels(2, s.fact.name);
  const fact = o.get('physicalTable', s.fact.i);
  let keys = keysFor(s.fact.name);
  if (!keys.grain && fact.isSecured && fact.baseTable >= 0) { const bk = keysFor(o.get('physicalTable', fact.baseTable).name); keys = { ...bk, keyCols: new Set([...keys.keyCols, ...bk.keyCols]) }; }
  const selDim = state.dim ? s.dims.find((d) => d.name.toLowerCase() === state.dim!.toLowerCase()) : undefined;

  svg.innerHTML = '';
  const W = 1060, H = 790; worldSize = { W, H }; starBoxes = [];
  const defs = el('defs', {}, svg);
  const pat = el('pattern', { id: 'grid', width: 120, height: 120, patternUnits: 'userSpaceOnUse' }, defs);
  for (let k = 0; k < 120; k += 24) { el('line', { x1: k, y1: 0, x2: k, y2: 120, class: k ? 'grid-minor' : 'grid-major' }, pat); el('line', { x1: 0, y1: k, x2: 120, y2: k, class: k ? 'grid-minor' : 'grid-major' }, pat); }
  world = el('g', {}, svg);
  el('rect', { x: -3000, y: -3000, width: 7000, height: 7000, fill: 'url(#grid)' }, world);
  const lines = el('g', {}, world); const nodes = el('g', {}, world);

  // fact card in the centre
  const cx = 560, cy = 372;
  const fLines: [string, string, string, number][] = [
    ['kicker', 'Fact table', '500 10px Inter', 14],
    ['t0', s.fact.name, '500 13.5px JetBrains Mono', 21],
    ['t3', `${prettyTable(o, s.fact.name, new Map())} · ${fact.columns} columns · in ${fact.saCount} subject areas`, '400 11px Inter', 19],
  ];
  if (keys.grain) fLines.push(
    ['grain', keys.grain.sentence, '500 13px Inter', 28],
    ['keys', 'key: ' + keys.grain.cols.join(' + '), '400 11.5px JetBrains Mono', 19],
    ['src', 'from the entity key list: ' + keys.grain.entity, '400 10.5px Inter', 18],
  );
  const FW = Math.max(300, ...fLines.map(([, t, f]) => textW(t, f) * (f.includes('10px') ? 1.12 : 1) + 34));
  const fb: Box = { x: cx - FW / 2, y: 0, w: FW, h: 0, fact: true };
  const fg = el('g', { class: 'card-n fact' + (selDim ? ' quiet' : '') }, nodes);
  const bgR = el('rect', { class: 'bg', rx: 8 }, fg);
  let yy = 8;
  for (const [cls, t, , dy] of fLines) { yy += dy; el('text', { class: cls, x: 17, y: yy }, fg, t); }
  yy += 16; fb.h = yy; fb.y = cy - fb.h / 2;
  bgR.setAttribute('width', String(FW)); bgR.setAttribute('height', String(fb.h));
  fg.setAttribute('transform', `translate(${fb.x},${fb.y})`);
  starBoxes.push(fb);
  onClick(fg, () => go({ fact: state.fact, sa: s.subjectArea.name }));

  // header partner on the left, solid (stated key)
  if (keys.partner) {
    const p = keys.partner; const pt = o.get('physicalTable', p.i);
    const pb: Box = { x: 16, y: cy - 44, w: 206, h: 88 };
    const g = el('g', { class: 'card-n', transform: `translate(${pb.x},${pb.y})` }, nodes);
    el('rect', { class: 'bg', width: pb.w, height: pb.h, rx: 8 }, g);
    el('text', { class: 'kicker', x: 14, y: 22 }, g, 'Header');
    el('text', { class: 't2', x: 14, y: 42, style: 'fill:var(--ink)' }, g, fit(p.name, '400 10.5px JetBrains Mono', pb.w - 24));
    el('text', { class: 't3', x: 14, y: 61 }, g, `${pt.columns} columns · key: ${p.partnerCol}`);
    el('text', { class: 't3', x: 14, y: 77 }, g, `in ${pt.saCount} subject areas`);
    starBoxes.push(pb);
    const x1 = pb.x + pb.w, x2 = fb.x;
    el('line', { class: 'link-solid', x1, y1: cy, x2, y2: cy }, lines);
    el('circle', { cx: x1, cy, r: 3, fill: 'var(--ink-2)' }, lines); el('circle', { cx: x2, cy, r: 3, fill: 'var(--ink-2)' }, lines);
    const mid = (x1 + x2) / 2;
    el('text', { class: 'linklbl', x: mid, y: cy - 24, 'text-anchor': 'middle' }, lines, `header.${p.partnerCol}`);
    el('text', { class: 'linklbl', x: mid, y: cy - 9, 'text-anchor': 'middle' }, lines, `= line.${p.factCol}`);
    el('text', { class: 'linklbl2', x: mid, y: cy + 19, 'text-anchor': 'middle' }, lines, 'stated in the');
    el('text', { class: 'linklbl2', x: mid, y: cy + 33, 'text-anchor': 'middle' }, lines, 'entity key list');
  }

  // dimensions on an ellipse, dashed (co-occurrence)
  const roleMap = rolesInSa(s.subjectArea.i);
  const angles = [-140, -100, -60, -20, 20, 60, 100, 140];
  const RX = 380, RY = 282; const DW = 226;
  s.dims.forEach((d, k) => {
    const a = (angles[k] * Math.PI) / 180;
    const dx = cx + RX * Math.cos(a), dy = cy + RY * Math.sin(a);
    const label = prettyTable(o, d.name, conceptKeyMap());
    const roles = (roleMap.get(d.i) ?? []).filter((r) => r.toLowerCase() !== label.toLowerCase());
    const roleLines = roles.length ? wrap(roles.join(' · '), F_ROLE, DW - 28).slice(0, 3) : [];
    const hgt = 72 + (roleLines.length ? 12 + roleLines.length * 15 : 0);
    const b: Box = { x: Math.max(8, Math.min(W - DW - 8, dx - DW / 2)), y: Math.max(52, Math.min(H - 96 - hgt, dy - hgt / 2)), w: DW, h: hgt };
    const g = el('g', { class: 'card-n dim' + (selDim === d ? ' sel' : ''), transform: `translate(${b.x},${b.y})` }, nodes);
    el('rect', { class: 'bg', width: DW, height: hgt, rx: 8 }, g);
    el('text', { class: 't1', x: 14, y: 22 }, g, fit(label, '600 13px Inter', DW - 26));
    el('text', { class: 't2', x: 14, y: 39 }, g, fit(d.name, '400 10.5px JetBrains Mono', DW - 26));
    el('text', { class: 't3', x: 14, y: 58 }, g, `${d.feeds} fields here · in ${d.saCount} of ${M.nSa} areas`);
    if (roleLines.length) {
      el('rect', { class: 'rolebox', x: 10, y: 66, width: DW - 20, height: 8 + roleLines.length * 15, rx: 4 }, g);
      el('text', { class: 'kicker', x: 16, y: 63, style: 'font-size:10px' }, g, '');
      roleLines.forEach((ln, j) => el('text', { class: 'role', x: 16, y: 80 + j * 15 }, g, (j === 0 ? 'as ' : '') + ln));
    }
    el('title', {}, g, `${label}: ${d.feeds} presentation fields in ${s.subjectArea.label} come from it. Drawn dashed: it appears with this fact in the subject area, the join is not stated.`);
    onClick(g, () => go({ fact: state.fact, sa: s.subjectArea.name, dim: d.name }));
    starBoxes.push(b);
    const [p1, p2] = clipLine({ x: cx, y: cy }, { x: b.x + b.w / 2, y: b.y + b.h / 2 }, fb, b);
    el('line', { class: 'link-dash' + (selDim === d ? ' sel' : ''), x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }, lines);
  });

  // bundle tag: shared by nearly every area + the ones not drawn; universal dims that play roles here get one line
  const uni = s.universal;
  const uniRoles = uni.map((d) => ({ d, label: prettyTable(o, d.name, conceptKeyMap()), roles: (roleMap.get(d.i) ?? []) }))
    .map((x) => ({ ...x, roles: x.roles.filter((r) => r.toLowerCase() !== x.label.toLowerCase()) })).filter((x) => x.roles.length >= 2);
  const bw = 720, bh = uniRoles.length ? 74 : 56; const bx = cx - bw / 2, by = H - bh - 10;
  const bg = el('g', { class: 'bundle' }, nodes);
  el('rect', { x: bx, y: by, width: bw, height: bh, rx: 24 }, bg);
  const pct = Math.ceil(UNIVERSAL_SHARE * M.nSa);
  el('text', { class: 'b1', x: cx, y: by + 23, 'text-anchor': 'middle' }, bg,
    `+ ${uni.length} more shared by nearly every area (${pct}+ of ${M.nSa})${s.notDrawn ? `  ·  and ${s.notDrawn} more not drawn` : ''}`);
  el('text', { class: 'b2', x: cx, y: by + 41, 'text-anchor': 'middle' }, bg,
    fit(uni.map((d) => prettyTable(o, d.name, conceptKeyMap())).join(', '), '400 11px Inter', bw - 48));
  if (uniRoles.length) {
    const x = uniRoles[0];
    el('text', { class: 'b2', x: cx, y: by + 59, 'text-anchor': 'middle', style: 'fill:var(--ink-2)' }, bg,
      fit(`${x.label} plays ${x.roles.length} roles here: ${x.roles.join(' · ')}`, '400 11px Inter', bw - 48));
  }
  starBoxes.push({ x: bx, y: by, w: bw, h: bh });
  onClick(bg, () => go({ fact: state.fact, sa: s.subjectArea.name, star: 'rest' }));

  el('text', { x: 20, y: 34, style: 'fill:var(--pencil);font:400 11.5px Inter' }, world, '');
  renderMini();
  fitView(60, 20);
  setCrumb();
  if (selDim) starDimCard(s, selDim); else factCard(s, keys);
}

let _ck: Map<string, string> | undefined;
function conceptKeyMap() {
  if (_ck) return _ck; _ck = new Map();
  for (let i = 0; i < M.o.count('concept'); i++) { const n = M.o.get('concept', i).name; _ck.set(n.replace(/[^a-z0-9]/gi, '').toLowerCase(), n); }
  return _ck;
}
function rolesInSa(sai: number): Map<number, string[]> {
  const o = M.o; const out = new Map<number, string[]>();
  for (const pt of o.neighbors({ type: 'subjectArea', i: sai }, 'contains')) {
    const c = o.get('concept', o.get('presentationTable', pt.ref.i).concept); const t = c.topPhysical[0];
    if (t === undefined) continue;
    (out.get(t) ?? out.set(t, []).get(t)!).push(c.name);
  }
  return out;
}
function clipLine(a: { x: number; y: number }, b: { x: number; y: number }, ra: Box, rb: Box) {
  const clip = (from: { x: number; y: number }, to: { x: number; y: number }, r: Box) => {
    const dx = to.x - from.x, dy = to.y - from.y; let t = 1;
    const hw = r.w / 2 + 6, hh = r.h / 2 + 6; const cxr = r.x + r.w / 2, cyr = r.y + r.h / 2;
    // from is the centre of r: find exit
    if (dx) t = Math.min(t, Math.abs(hw / dx)); if (dy) t = Math.min(t, Math.abs(hh / dy));
    return { x: cxr + dx * t, y: cyr + dy * t };
  };
  return [clip(a, b, ra), clip({ x: rb.x + rb.w / 2, y: rb.y + rb.h / 2 }, { x: a.x, y: a.y }, rb)];
}

function factCard(s: StarData, keys: KeyInfo) {
  const o = M.o; const fi = s.fact!.i; const fact = o.get('physicalTable', fi);
  const cols = o.neighbors({ type: 'physicalTable', i: fi }, 'contains').map((n) => o.get('physicalColumn', n.ref.i).name)
    .sort((a, b) => (keys.keyCols.has(b.toLowerCase()) ? 1 : 0) - (keys.keyCols.has(a.toLowerCase()) ? 1 : 0) || a.localeCompare(b));
  let twin: number | undefined; for (let i = 0; i < o.count('physicalTable'); i++) if (o.get('physicalTable', i).baseTable === fi) { twin = i; break; }
  const rest = state.star === 'rest';
  const allDims = (() => { const bm = o.busMatrix; const r = bm.rows.indexOf(s.subjectArea.i); return r < 0 ? [] : bm.cells[r].length; })();
  const drawnSet = new Set(s.dims.map((d) => d.i)); const uniSet = new Set(s.universal.map((d) => d.i));
  const notDrawn = (() => { const bm = o.busMatrix; const r = bm.rows.indexOf(s.subjectArea.i);
    return bm.cells[r].map((ci) => M.dims[ci]).filter((d) => !drawnSet.has(d.i) && !uniSet.has(d.i) && d.i !== fi); })();
  card.innerHTML = `
    <div class="kick">Level 2 · Inside a fact</div>
    <h2>${esc(prettyTable(o, s.fact!.name, new Map()))}</h2>
    <div class="tname">${esc(s.fact!.name)}</div>
    <p style="margin-top:10px">Seen from the <b style="color:var(--ink)">${esc(s.subjectArea.label)}</b> subject area. The ${s.dims.length} dimensions drawn feed the most fields there.</p>
    <div class="stat">
      <div><b>${fact.columns}</b><span>columns</span></div>
      <div><b>${fact.saCount}</b><span>subject areas use it</span></div>
      <div><b>${s.dims.length + s.notDrawn}</b><span>dimensions beside it</span></div>
      <div><b>${s.universal.length}</b><span>shared by nearly all</span></div>
    </div>
    ${twin !== undefined ? `<p class="note">Its secured twin <span class="mono" style="color:var(--ink-2)">${esc(o.get('physicalTable', twin).name)}</span> has ${o.get('physicalTable', twin).columns} columns.</p>` : ''}
    ${rest ? `<h3>Not drawn (${notDrawn.length})</h3><ul class="list scroll">${notDrawn.map((d) => `<li><span class="mono">${esc(d.label)}</span><em>${d.saCount} areas</em></li>`).join('')}</ul>
    <h3>Shared by nearly every area (${s.universal.length})</h3><div class="chips">${s.universal.map((d) => `<span class="chip">${esc(prettyTable(o, d.name, conceptKeyMap()))}</span>`).join('')}</div>` : ''}
    <h3>Level 3 · Columns (${cols.length})</h3>
    <ul class="list cols scroll">${cols.map((c) => `<li>${esc(c)}${keys.keyCols.has(c.toLowerCase()) ? '<em>key</em>' : ''}</li>`).join('')}</ul>
    ${keys.grain?.unresolved.length ? `<p class="note">The key list also names <span class="mono">${keys.grain.unresolved.join(', ')}</span>, which is not among this table's lineage columns.</p>` : ''}
    <p class="note">Solid line: the header key is stated in the entity key list. Dashed lines: the dimension and the fact appear in the same subject area; the join itself is not stated.</p>
    ${allDims ? '' : ''}`;
  wireCard();
}

function starDimCard(s: StarData, d: StarDim) {
  const o = M.o; const md = M.dimByTable.get(d.i);
  const label = prettyTable(o, d.name, conceptKeyMap());
  const roles = (rolesInSa(s.subjectArea.i).get(d.i) ?? []).filter((r) => r.toLowerCase() !== label.toLowerCase());
  card.innerHTML = `
    <button class="link back" id="bk">← ${esc(s.fact!.name)}</button>
    <div class="kick">Dimension beside this fact</div>
    <h2>${esc(label)}</h2>
    <div class="tname">${esc(d.name)}</div>
    <div class="big"><b>${d.feeds}</b><span>fields in ${esc(s.subjectArea.label)} come from it</span></div>
    ${roles.length ? `<h3>Roles here (inferred)</h3><div class="chips">${roles.map((r) => `<span class="chip">${esc(r)}</span>`).join('')}</div>` : ''}
    <h3>Reach</h3>
    <p>Used in ${d.saCount} of ${M.nSa} subject areas${md ? `, alongside ${md.facts.size} fact tables` : ''}.</p>
    <button class="go" data-dim="${esc(d.name)}">See its reach on the map<small>Lights every subject area that uses it</small></button>
    <p class="note">Drawn dashed: ${esc(label)} and this fact appear in the same subject area. The data does not state the join column.</p>`;
  wireCard();
  card.querySelector<HTMLElement>('#bk')!.onclick = () => go({ fact: state.fact, sa: s.subjectArea.name });
}

// ------------------------------------------------------------------ boot
(async () => {
  await Promise.all([document.fonts.load('400 12px Inter'), document.fonts.load('500 12px Inter'), document.fonts.load('600 12px Inter'), document.fonts.load('400 12px "JetBrains Mono"')]).catch(() => undefined);
  const o = await loadOntology({ baseUrl: '/ontology/' });
  M = buildModel(o); L = layoutMap(M);
  state = readUrl();
  addEventListener('popstate', () => { state = readUrl(); render(); });
  addEventListener('resize', () => (state.fact ? fitView(60, 20) : fitView(16, 16)));
  await render();
  (window as unknown as { __ready: boolean }).__ready = true;
})().catch((e) => { console.error(e); card.innerHTML = `<p>Could not load: ${esc(String(e))}</p>`; });
