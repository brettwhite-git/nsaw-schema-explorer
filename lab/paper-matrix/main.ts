// Lab "paper-matrix": mock A's bus matrix console, set in the Paper ledger theme.
// URL state (reproducible screenshots):
//   ?                                     home, the bus matrix
//   ?row=Sales Order                      one subject area picked (its facts and their grain)
//   ?a=Sales Order&b=Customer Invoice     compare two subject areas
//   ?dim=DW_NS_CUSTOMER_D                 one dimension column picked
//   ?open=0,2                             long-tail bands expanded (0 = 21-72 areas, 1 = 6-20, 2 = 5 or fewer)
// Data: public/ontology/*.json through ontology/load.ts. Every number on the page is computed from it.

import { loadOntology, type Ontology } from '../../ontology/load';

const ERRS: string[] = [];
(window as any).__errs = ERRS;
addEventListener('error', (e) => ERRS.push(String(e.message)));
addEventListener('unhandledrejection', (e) => ERRS.push(String((e as PromiseRejectionEvent).reason)));

// ------------------------------------------------------------------ data
const o: Ontology = await loadOntology({ baseUrl: '/ontology/' });
const colsJson = (await (await fetch('/ontology/' + o.core.meta.files.columns)).json()) as { nodes: Record<string, { cols: Record<string, number[]> }>; edges: { type: string; from: string; n: number; pairs: number[] }[] };
const core = o.core;
const bm = core.busMatrix;
const C = core.meta.counts;
const T = core.nodes.physicalTable!.cols as Record<string, any[]>;
const SA = core.nodes.subjectArea!.cols as Record<string, any[]>;
const FA = core.nodes.functionalArea!.cols as Record<string, any[]>;
const ENT = core.nodes.entity!.cols as Record<string, any[]>;
const PT = core.nodes.presentationTable!.cols as Record<string, any[]>;
const nT = core.nodes.physicalTable!.n;

const tIdx = new Map<string, number>();
for (let i = 0; i < nT; i++) tIdx.set(String(T.name[i]).toUpperCase(), i);
const saFa: number[] = [];
{
  const g = core.edges.find((e) => e.type === 'inFunctionalArea')!;
  for (let k = 0; k < g.n; k++) saFa[g.pairs[2 * k]] = g.pairs[2 * k + 1];
}
const nRows = bm.rows.length;
const nCols = bm.columns.length;
const rowSets = bm.cells.map((c) => new Set(c));
const isFact = (t: number) => T.role[t] === 'fact' || T.role[t] === 'enhanced';
const saLabel = (r: number) => String(SA.label[bm.rows[r]]);
const faOfRow = (r: number) => saFa[bm.rows[r]];
// a _SEC table is folded into the table of the same name without the suffix (Oracle's naming)
const baseOf = (t: number) => (T.isSecured[t] ? tIdx.get(String(T.name[t]).toUpperCase().replace(/_SEC$/, '')) ?? t : t);
const twinOf = (t: number) => tIdx.get(String(T.name[t]).toUpperCase() + '_SEC');
const reach = (c: number) => bm.columnSaCount[c];

// ------------------------------------------------------------------ display names (spelled from report folder names in the semantic model)
const VOCAB = new Set<string>();
const folderNames = new Map<string, string>();
for (let i = 0; i < PT.name.length; i++) {
  const n = String(PT.name[i]).trim();
  const k = n.replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (!folderNames.has(k)) folderNames.set(k, n);
  for (const w of n.toLowerCase().split(/[^a-z]+/)) if (w.length > 1) VOCAB.add(w);
}
// table-name words help split run-together names (UNITSTYPEUOM -> Units Type UOM)
for (const w of ['uom', 'units', 'costing', 'method', 'subtype', 'payment', 'instrument', 'merchandise', 'hierarchy', 'node', 'version', 'ship']) VOCAB.add(w);
const ACRONYM = new Set(['uom']);
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
function prettyTable(name: string): string {
  const c = name.replace(/^DW_NS_/i, '').replace(/_SEC$/, '').replace(/_(D|F|DH|EF|CF|G)$/i, '');
  const hit = folderNames.get(c.replace(/_/g, '').toLowerCase());
  if (hit) return hit;
  return c.toLowerCase().split('_').flatMap((w) => segment(w)).map((w) => (ACRONYM.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}
const colName = (c: number) => prettyTable(String(T.name[bm.columns[c]]));
const colTable = (c: number) => String(T.name[bm.columns[c]]);

// report folders that read from a table: presentation tables with a column that maps (mapsTo, stated) to one of its columns
const PC = colsJson.nodes.presentationColumn.cols;
const PH = colsJson.nodes.physicalColumn.cols;
const foldersOf = new Map<number, Map<string, Set<number>>>();
{
  const g = colsJson.edges.find((e) => e.type === 'mapsTo' && e.from === 'presentationColumn')!;
  for (let k = 0; k < g.n; k++) {
    const t = PH.table[g.pairs[2 * k + 1]] as number;
    if (t < 0) continue;
    const pt = PC.pt[g.pairs[2 * k]] as number;
    const name = String(PT.name[pt]).trim();
    const m = foldersOf.get(t) ?? foldersOf.set(t, new Map()).get(t)!;
    (m.get(name) ?? m.set(name, new Set()).get(name)!).add(PT.sa[pt] as number);
  }
}

// ------------------------------------------------------------------ grain (Oracle's entity key list, as in explorer-combo)
type Grain = 'line' | 'document' | 'book' | 'other';
interface GrainEntry { entity: string; cols: string[]; missing: string[]; grain: Grain }
const grainOf = new Map<number, GrainEntry[]>();
for (let e = 0; e < ENT.name.length; e++) {
  const keys = ENT.keys[e] as { k: string; t: string; c: string; ti: number; ci: number }[];
  const byT = new Map<number, typeof keys>();
  for (const k of keys) if (k.ti >= 0) (byT.get(k.ti) ?? byT.set(k.ti, []).get(k.ti)!).push(k);
  const idTables = [...byT].filter(([, ks]) => ks.some((k) => k.c.toLowerCase() === 'id')).map(([t]) => t);
  for (const [t, ks] of byT) {
    const cols = [...new Set(ks.map((k) => k.c.toLowerCase()))].sort();
    if (cols.length === 1 && cols[0] === 'transaction' && idTables.length) continue; // a header link, not a grain
    const grain: Grain = cols.includes('accountingbook') ? 'book' : cols.join('+') === 'id+transaction' ? 'line' : cols.join('+') === 'id' ? 'document' : 'other';
    const missing = [...new Set(ks.filter((k) => k.ci < 0).map((k) => k.c.toLowerCase()))];
    (grainOf.get(t) ?? grainOf.set(t, []).get(t)!).push({ entity: String(ENT.name[e]), cols, missing, grain });
  }
}
const GRAIN_ORDER: Grain[] = ['line', 'document', 'book', 'other'];
const grainsFor = (t: number) => (grainOf.get(t) ?? grainOf.get(baseOf(t)) ?? []).slice()
  .sort((a, b) => a.missing.length - b.missing.length || GRAIN_ORDER.indexOf(a.grain) - GRAIN_ORDER.indexOf(b.grain));
const nounOf = (name: string) => {
  let n = name.replace(/^DW_NS_/i, '');
  for (let i = 0; i < 3; i++) n = n.replace(/_(SEC|F|D|DH|G|EF|CF|SNAPSHOT|LINES|INSIGHTS)$/i, '');
  return n.replace(/_/g, ' ').toLowerCase();
};
const grainPhrase = (t: number, g: GrainEntry) => {
  const noun = nounOf(String(T.name[t]));
  return g.grain === 'line' ? `One row per ${noun} line` : g.grain === 'document' ? `One row per ${noun}` : g.grain === 'book' ? `One row per ${noun} line in each accounting book` : `One row per ${g.cols.join(' + ')}`;
};
const KEY_ORDER = ['accountingbook', 'id', 'transaction'];
const keyOrder = (cols: string[]) => [...cols].sort((a, b) => (KEY_ORDER.indexOf(a) + 1 || 99) - (KEY_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b));

// facts in use (secured twins folded into their base) and how many have a grain in the key list
const grainStats = (() => {
  let tot = 0, has = 0;
  for (let i = 0; i < nT; i++) {
    if (!isFact(i) || T.isSecured[i]) continue;
    const tw = twinOf(i);
    if (!T.lineageRows[i] && !T.saCount[i] && !(tw !== undefined && T.saCount[tw])) continue;
    tot++; if (grainsFor(i).length) has++;
  }
  return { tot, has };
})();

// ------------------------------------------------------------------ columns: named head + long-tail bands
const NAMED = (() => { // the most shared columns, cut where reach drops below the 29th column's reach
  const cut = reach(Math.min(28, nCols - 1));
  let n = 0; while (n < nCols && reach(n) >= cut) n++;
  return n;
})();
interface Band { cols: number[]; lo: number; hi: number; label: string }
const BANDS: Band[] = (() => {
  const tail = [...Array(nCols).keys()].slice(NAMED);
  const defs = [{ lo: 21, hi: Infinity }, { lo: 6, hi: 20 }, { lo: 0, hi: 5 }];
  return defs.map((d) => {
    const cols = tail.filter((c) => reach(c) >= d.lo && reach(c) <= d.hi);
    const lo = Math.min(...cols.map(reach)), hi = Math.max(...cols.map(reach));
    const label = d.lo === 0 ? `listed under ${hi} or fewer areas` : `listed under ${lo} to ${hi} areas`;
    return { cols, lo, hi, label };
  }).filter((b) => b.cols.length);
})();
const bandOfCol = (c: number) => BANDS.findIndex((b) => b.cols.includes(c));

// ------------------------------------------------------------------ state
const findRow = (s: string | null): number | null => {
  if (!s) return null;
  const l = s.toLowerCase();
  for (let r = 0; r < nRows; r++) if (saLabel(r).toLowerCase() === l || String(SA.name[bm.rows[r]]).toLowerCase() === l) return r;
  return null;
};
const findCol = (s: string | null): number | null => {
  if (!s) return null;
  const l = s.toUpperCase().replace(/^DW_NS_/, '').replace(/_D$/, '');
  const k = bm.columns.findIndex((t) => String(T.name[t]).toUpperCase().replace(/^DW_NS_/, '').replace(/_D$/, '') === l);
  return k < 0 ? null : k;
};
interface State { a: number | null; b: number | null; dim: number | null; open: Set<number>; hoverRow: number | null; hoverCol: number | null }
function readState(): State {
  const p = new URLSearchParams(location.search);
  let a = findRow(p.get('a')) ?? findRow(p.get('row'));
  let b = findRow(p.get('b'));
  if (a === null && b !== null) { a = b; b = null; }
  const dim = a === null ? findCol(p.get('dim')) : null;
  const open = new Set((p.get('open') ?? '').split(',').filter((x) => x !== '').map(Number).filter((n) => n >= 0 && n < BANDS.length));
  if (dim !== null && bandOfCol(dim) >= 0) open.add(bandOfCol(dim));
  return { a, b, dim, open, hoverRow: null, hoverCol: null };
}
let state = readState();
function syncUrl() {
  const p = new URLSearchParams();
  if (state.a !== null && state.b !== null) { p.set('a', saLabel(state.a)); p.set('b', saLabel(state.b)); }
  else if (state.a !== null) p.set('row', saLabel(state.a));
  else if (state.dim !== null) p.set('dim', colTable(state.dim));
  if (state.open.size) p.set('open', [...state.open].sort().join(','));
  const s = p.toString();
  history.replaceState(null, '', s ? '?' + s : location.pathname);
}

// ------------------------------------------------------------------ helpers
const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const fmt = (n: number) => n.toLocaleString('en-US');
const solid = (w = 22) => `<svg class="mark" width="${w}" height="8" aria-hidden="true"><line x1="1" y1="4" x2="${w - 1}" y2="4"/></svg>`;
const accentMark = (w = 22) => `<svg class="mark hot" width="${w}" height="8" aria-hidden="true"><line x1="1" y1="4" x2="${w - 1}" y2="4"/></svg>`;
const sharedCols = (a: number, b: number) => bm.cells[a].filter((c) => rowSets[b].has(c));
const byReach = (x: number, y: number) => reach(y) - reach(x) || x - y;
const plural = (n: number, one: string, many = one + 's') => `${fmt(n)} ${n === 1 ? one : many}`;
const app = document.getElementById('app')!;
const ctx2d = document.createElement('canvas').getContext('2d')!;
function fitText(s: string, w: number, font: string) {
  ctx2d.font = font;
  if (ctx2d.measureText(s).width <= w) return s;
  let t = s;
  while (t.length > 1 && ctx2d.measureText(t + '…').width > w) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}

// ------------------------------------------------------------------ shell
function shell() {
  app.innerHTML = `
  <header class="top">
    <div class="top-in">
      <div class="brand"><svg class="logo" width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="2.6" class="logo-dot"/><path d="M9 9 2.5 3.5M9 9l6.5-5.5M9 9 2.5 14.5M9 9l6.5 5.5" class="logo-ray"/></svg><b>NSAW Schema Explorer</b><small>25R4</small></div>
      <div class="search" id="search">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>
        <input id="q" autocomplete="off" spellcheck="false" placeholder="Search subject areas and dimensions" />
        <kbd>⌘K</kbd>
        <div class="drop" id="drop" hidden></div>
      </div>
      <div class="legend" aria-label="How marks are drawn">
        <span>${solid(20)}stated in Oracle’s files</span><span>${accentMark(20)}selected</span>
      </div>
    </div>
    <nav class="crumbs-row"><div class="crumbs" id="crumbs"></div></nav>
  </header>
  <main class="page">
    <section class="intro">
      <div class="intro-main">
        <h1>The bus matrix</h1>
        <p class="lede">Each row is a subject area and each column a dimension table that Oracle’s lineage lists under two or more of them. Read across a row to see what an area can be sliced by. Read down a column to see how far a dimension reaches.</p>
      </div>
      <aside class="intro-note">
        <p>${solid(24)}<span>A mark means Oracle’s lineage lists this dimension table under this subject area. Every mark on the page comes from that file.</span></p>
      </aside>
      <div class="stats">
        <div class="stat"><b>${fmt(C.subjectAreas)}</b><span>subject areas in ${C.functionalAreas} functional areas</span></div>
        <div class="stat"><b>${fmt(C.physicalTablesInLineage)}</b><span>warehouse tables in the lineage</span></div>
        <div class="stat"><b>${fmt(C.busMatrixColumns)}</b><span>dimensions shared by two or more areas</span></div>
        <div class="stat"><b>${fmt(grainStats.has)}</b><span>of ${grainStats.tot} facts with a grain in Oracle’s key list</span></div>
        <div class="stat"><b>${fmt(C.netsuiteRecords)}</b><span>NetSuite records named in Oracle’s lineage</span></div>
      </div>
    </section>
    <section class="board">
      <div class="mx" id="mx"></div>
      <aside class="side" id="side"></aside>
    </section>
    <p class="foot">Columns are ordered by reach, the number of subject areas whose lineage lists them. The ${C.busMatrixColumns - NAMED} least shared sit in bands at the right edge; open a band to see its columns.</p>
  </main>
  <div class="tip" id="tip" hidden></div>`;
  wireSearch();
  render();
}

function renderCrumbs() {
  const el = document.getElementById('crumbs')!;
  const { a, b, dim } = state;
  let tail = '';
  if (a !== null && b !== null) tail = `<i>/</i><span class="here">Compare ${esc(saLabel(a))} and ${esc(saLabel(b))}</span>`;
  else if (a !== null) tail = `<i>/</i><span>${esc(FA.name[faOfRow(a)])}</span><i>/</i><span class="here">${esc(saLabel(a))}</span>`;
  else if (dim !== null) tail = `<i>/</i><span>Dimension</span><i>/</i><span class="here">${esc(colName(dim))}</span>`;
  el.innerHTML = `<a data-home ${tail ? '' : 'class="here"'}>Warehouse bus matrix</a>${tail}${tail ? '<span class="esc">Esc clears the selection</span>' : ''}`;
  el.querySelector('[data-home]')?.addEventListener('click', () => clearSel());
}
function clearSel() { state.a = state.b = state.dim = null; syncUrl(); render(); }

function render() { renderCrumbs(); renderMatrix(); renderSide(); }

// ------------------------------------------------------------------ search
function wireSearch() {
  const q = document.getElementById('q') as HTMLInputElement;
  const drop = document.getElementById('drop')!;
  let hits: { kind: 'area' | 'dim'; i: number; label: string; ctx: string }[] = [];
  const run = () => {
    const s = q.value.trim().toLowerCase();
    if (!s) { drop.hidden = true; return; }
    hits = [];
    for (let r = 0; r < nRows; r++) if (saLabel(r).toLowerCase().includes(s)) hits.push({ kind: 'area', i: r, label: saLabel(r), ctx: FA.name[faOfRow(r)] });
    for (let c = 0; c < nCols; c++) if (colName(c).toLowerCase().includes(s) || colTable(c).toLowerCase().includes(s)) hits.push({ kind: 'dim', i: c, label: colName(c), ctx: `${colTable(c)} · ${reach(c)} of ${C.subjectAreas} areas` });
    hits = hits.slice(0, 9);
    drop.hidden = false;
    drop.innerHTML = hits.length ? `<ul>${hits.map((h, k) => `<li class="res" data-k="${k}"><span class="kind">${h.kind === 'area' ? 'Subject area' : 'Dimension'}</span><span class="nm">${esc(h.label)}</span><span class="ctx">${esc(h.ctx)}</span></li>`).join('')}</ul>` : `<div class="dd-hint">Nothing matches “${esc(q.value)}”.</div>`;
    drop.querySelectorAll<HTMLElement>('.res').forEach((n) => n.addEventListener('mousedown', (e) => { e.preventDefault(); pick(hits[+n.dataset.k!]); }));
  };
  const pick = (h?: (typeof hits)[number]) => {
    if (!h) return;
    if (h.kind === 'area') { state.a = h.i; state.b = null; state.dim = null; }
    else { state.dim = h.i; state.a = state.b = null; const bd = bandOfCol(h.i); if (bd >= 0) state.open.add(bd); }
    q.value = ''; drop.hidden = true; q.blur(); syncUrl(); render();
  };
  q.addEventListener('input', run);
  q.addEventListener('blur', () => { drop.hidden = true; });
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') pick(hits[0]); if (e.key === 'Escape') { q.value = ''; drop.hidden = true; q.blur(); } });
}
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); (document.getElementById('q') as HTMLInputElement)?.focus(); }
  else if (e.key === 'Escape' && document.activeElement?.tagName !== 'INPUT') clearSel();
});

// ------------------------------------------------------------------ matrix geometry
const LABEL_W = 204, ROW_H = 19, FA_H = 38, LBL_H = 140, BAR_H = 24, BAR_GAP = 10, BAND_W = 52;
const HEAD_H = LBL_H + BAR_H + BAR_GAP;
type Slot = { kind: 'col'; c: number; x: number; w: number; label: boolean } | { kind: 'band'; b: number; x: number; w: number };
let geo: { slots: Slot[]; colX: Map<number, Slot>; rows: { r: number; y: number }[]; rowY: Map<number, number>; width: number; height: number } | null = null;

function layout(avail: number) {
  const openCols = [...state.open].reduce((n, b) => n + BANDS[b].cols.length, 0);
  const closed = BANDS.length - state.open.size;
  const room = avail - LABEL_W - closed * BAND_W - 8;
  // named columns keep a comfortable width; opened bands share what is left
  const cw = Math.max(18, Math.min(26, Math.floor((room - openCols * 18) / NAMED)));
  const ecw = openCols ? Math.max(7, Math.min(cw, Math.floor((room - NAMED * cw) / openCols))) : cw;
  const slots: Slot[] = [];
  let x = LABEL_W;
  for (let c = 0; c < NAMED; c++) { slots.push({ kind: 'col', c, x, w: cw, label: true }); x += cw; }
  BANDS.forEach((bd, b) => {
    if (state.open.has(b)) {
      x += 6;
      for (const c of bd.cols) { slots.push({ kind: 'col', c, x, w: ecw, label: ecw >= 15 }); x += ecw; }
    } else { x += 6; slots.push({ kind: 'band', b, x, w: BAND_W }); x += BAND_W; }
  });
  return { slots, width: x + 4 };
}

function renderMatrix() {
  const mx = document.getElementById('mx');
  if (!mx) return;
  const { slots, width } = layout(mx.clientWidth);
  const colX = new Map<number, Slot>();
  for (const s of slots) if (s.kind === 'col') colX.set(s.c, s);
  const lay: { r: number; y: number }[] = [];
  const faY: { f: number; y: number; n: number }[] = [];
  let y = 0, lastFa = -1;
  for (let r = 0; r < nRows; r++) {
    const f = faOfRow(r);
    if (f !== lastFa) { faY.push({ f, y, n: 0 }); y += FA_H; lastFa = f; }
    faY[faY.length - 1].n++;
    lay.push({ r, y }); y += ROW_H;
  }
  const height = y + 10;
  geo = { slots, colX, rows: lay, rowY: new Map(lay.map((x) => [x.r, x.y])), width, height };

  const { a, b, dim } = state;
  const cmp = a !== null && b !== null;
  const shared = cmp ? new Set(sharedCols(a!, b!)) : new Set<number>();
  // in a comparison the differences carry the accent: dimensions only one of the two areas lists
  const diff = cmp ? new Set([...bm.cells[a!], ...bm.cells[b!]].filter((c) => !shared.has(c))) : new Set<number>();
  const hotCol = (c: number) => (cmp ? diff.has(c) : dim === c);
  const fadeCol = (c: number) => (cmp ? !diff.has(c) && !shared.has(c) : dim !== null && dim !== c);
  const usesDim = (r: number) => dim === null || rowSets[r].has(dim);

  // ---------------- band toggles (readable text for the long tail)
  const toggles = `<div class="bands"><span class="bands-k">The long tail</span>${BANDS.map((bd, k) => {
    const nDiff = cmp ? bd.cols.filter((c) => diff.has(c)).length : 0;
    return `<button class="band-t ${state.open.has(k) ? 'on' : ''}" data-band="${k}"><b>${bd.cols.length} more</b> ${esc(bd.label)}${nDiff ? ` <em>${nDiff} in one area only</em>` : ''}<span class="chev">${state.open.has(k) ? 'hide' : 'show'}</span></button>`;
  }).join('')}</div>`;

  // ---------------- header
  let hh = `<svg id="hsvg" width="${width}" height="${HEAD_H}">`;
  hh += `<rect id="hcolh" x="-50" y="0" width="10" height="${HEAD_H}" class="hl"/>`;
  hh += `<text class="axis-t" x="0" y="${LBL_H + 15}">Reach</text>`;
  hh += `<text class="axis-n" x="${LABEL_W - 10}" y="${LBL_H + 4}" text-anchor="end">${C.subjectAreas}</text>`;
  hh += `<text class="axis-n" x="${LABEL_W - 10}" y="${LBL_H + BAR_H + 3}" text-anchor="end">0</text>`;
  hh += `<text class="axis-t" x="0" y="${LBL_H - 30}">Subject areas</text><text class="axis-s" x="0" y="${LBL_H - 12}">by functional area</text>`;
  hh += `<text class="axis-s" x="${LABEL_W - 10}" y="${LBL_H - 12}" text-anchor="end">dims listed</text>`;
  hh += `<line class="base" x1="${LABEL_W}" x2="${width}" y1="${LBL_H + BAR_H + 0.5}" y2="${LBL_H + BAR_H + 0.5}"/>`;
  for (const s of slots) {
    if (s.kind === 'band') {
      const bd = BANDS[s.b];
      const nDiff = cmp ? bd.cols.filter((c) => diff.has(c)).length : 0;
      const dimHere = dim !== null && bd.cols.includes(dim);
      hh += `<g class="bandh ${fadeCol(-1) && !nDiff && !dimHere ? 'fade' : ''}" data-band="${s.b}">`;
      hh += `<rect x="${s.x}" y="0" width="${s.w}" height="${HEAD_H}" class="hit"/>`;
      hh += `<text class="bl" transform="translate(${s.x + s.w / 2 + 2},${LBL_H - 6}) rotate(45)" text-anchor="end">${bd.cols.length} more</text>`;
      hh += `<text class="brange" x="${s.x + s.w / 2}" y="${LBL_H + BAR_H - 7}" text-anchor="middle">${bd.lo}–${bd.hi}</text>`;
      hh += `</g>`;
      continue;
    }
    const c = s.c;
    const n = reach(c);
    const bh = Math.max(1, (n / C.subjectAreas) * BAR_H);
    const cls = hotCol(c) ? 'hot' : fadeCol(c) ? 'fade' : '';
    hh += `<rect class="bar ${cls}" data-c="${c}" x="${s.x + s.w / 2 - Math.min(3, s.w / 2 - 1)}" y="${LBL_H + BAR_H - bh}" width="${Math.min(6, s.w - 2)}" height="${bh}"/>`;
    if (s.label || c === dim) {
      const name = colName(c);
      hh += `<text class="cl ${cls}" data-c="${c}" transform="translate(${s.x + s.w / 2 + 3},${LBL_H - 6}) rotate(45)" text-anchor="end">${esc(name)}</text>`;
    }
  }
  // brackets over opened bands
  BANDS.forEach((bd, k) => {
    if (!state.open.has(k)) return;
    const xs = bd.cols.map((c) => colX.get(c)! as Extract<Slot, { kind: 'col' }>);
    const x0 = xs[0].x, x1 = xs[xs.length - 1].x + xs[xs.length - 1].w;
    if (!xs[0].label) {
      hh += `<path class="brk" d="M${x0 + 0.5} 26 V20 H${x1 - 0.5} V26"/>`;
      hh += `<text class="bl" x="${x0}" y="13">${bd.cols.length} ${esc(bd.label)}</text>`;
    }
  });
  hh += `</svg>`;

  // ---------------- body
  let bb = `<svg id="bsvg" width="${width}" height="${height}">`;
  bb += `<rect id="hrow" x="0" y="-9999" width="${width}" height="${ROW_H}" class="hl"/>`;
  bb += `<rect id="hcol" x="-50" y="0" width="10" height="${height}" class="hl"/>`;
  if (!cmp) for (const s of slots) if (s.kind === 'col' && hotCol(s.c)) bb += `<rect x="${s.x}" y="0" width="${s.w}" height="${height}" class="hotcol"/>`;
  for (const s of slots) if (s.kind === 'band') bb += `<rect x="${s.x}" y="0" width="${s.w}" height="${height}" class="bandcol"/>`;
  for (const g of faY) {
    bb += `<line class="fa-rule" x1="0" x2="${width}" y1="${g.y + 0.5}" y2="${g.y + 0.5}"/>`;
    bb += `<text class="fa" x="0" y="${g.y + 25}">${esc(FA.name[g.f])}<tspan class="fan" dx="10">${g.n} areas</tspan></text>`;
  }
  for (const { r, y } of lay) {
    const sel = r === a || r === b;
    if (sel) bb += `<rect x="0" y="${y}" width="${width}" height="${ROW_H}" class="selrow"/>`;
  }
  bb += `<g class="cells">`;
  for (const { r, y } of lay) {
    const isAB = r === a || r === b;
    const rowFaded = dim !== null && !usesDim(r);
    for (const c of bm.cells[r]) {
      const s = colX.get(c);
      if (!s) continue;
      let cls = 'c';
      if (cmp) cls += isAB ? (shared.has(c) ? ' both' : ' hot') : ' fade';
      else if (dim !== null) cls += c === dim ? ' hot' : ' fade';
      else if (isAB) cls += ' sel';
      if (rowFaded && !cls.includes('fade')) cls += ' fade';
      const sz = Math.min(8, s.w - 4);
      bb += `<rect class="${cls}" x="${s.x + s.w / 2 - sz / 2}" y="${y + ROW_H / 2 - sz / 2}" width="${sz}" height="${sz}"/>`;
    }
    // collapsed bands: a short ink bar per row, as long as the share of the band's columns the area uses
    for (const s of slots) {
      if (s.kind !== 'band') continue;
      const bd = BANDS[s.b];
      const used = bd.cols.filter((c) => rowSets[r].has(c));
      if (!used.length) continue;
      const nSh = cmp && isAB ? used.filter((c) => diff.has(c)).length : 0;
      const full = s.w - 26;
      const w = Math.max(2, (used.length / bd.cols.length) * full);
      const fade = (cmp && !isAB) || rowFaded || (dim !== null);
      bb += `<rect class="bandbar ${fade ? 'fade' : ''} ${isAB && !cmp ? 'sel' : ''} ${isAB && cmp ? 'both' : ''}" x="${s.x + 4}" y="${y + ROW_H / 2 - 2.5}" width="${w}" height="5"/>`;
      if (nSh) bb += `<rect class="bandbar hot" x="${s.x + 4}" y="${y + ROW_H / 2 - 2.5}" width="${Math.max(2, (nSh / bd.cols.length) * full)}" height="5"/>`;
      bb += `<text class="bandn ${fade ? 'fade' : ''}" x="${s.x + s.w - 3}" y="${y + ROW_H / 2 + 4}" text-anchor="end">${used.length}</text>`;
    }
  }
  bb += `</g>`;
  for (const { r, y } of lay) {
    const label = fitText(saLabel(r), LABEL_W - (r === a || r === b ? 58 : 42), r === a || r === b ? '600 13px "Source Sans 3"' : '400 13px "Source Sans 3"');
    const mark = cmp ? (r === a ? 'A' : r === b ? 'B' : '') : '';
    const cls = r === a || r === b ? 'sel' : (cmp || (dim !== null && !usesDim(r))) ? 'fade' : '';
    if (mark) bb += `<text class="abm" x="0" y="${y + 14}">${mark}</text>`;
    bb += `<text class="rl ${cls}" data-r="${r}" x="${mark ? 16 : 0}" y="${y + 14}">${esc(label)}</text>`;
    bb += `<text class="rn ${cls === 'fade' ? 'fade' : ''}" x="${LABEL_W - 10}" y="${y + 14}" text-anchor="end">${bm.cells[r].length}</text>`;
  }
  bb += `</svg>`;

  mx.innerHTML = `${toggles}<div class="mx-head">${hh}</div><div class="mx-body">${bb}</div>`;
  mx.querySelectorAll<HTMLElement>('[data-band]').forEach((n) => n.addEventListener('click', () => {
    const k = +n.dataset.band!;
    state.open.has(k) ? state.open.delete(k) : state.open.add(k);
    if (state.dim !== null && bandOfCol(state.dim) === k && !state.open.has(k)) state.dim = null;
    syncUrl(); render();
  }));
  wireMatrix();
}

function wireMatrix() {
  const bs = document.getElementById('bsvg')!;
  const hs = document.getElementById('hsvg')!;
  const tip = document.getElementById('tip')!;
  const hit = (ev: MouseEvent, svg: Element) => {
    const rect = svg.getBoundingClientRect();
    const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    let col: number | null = null, row: number | null = null, band: number | null = null;
    if (geo) for (const s of geo.slots) if (x >= s.x && x < s.x + s.w) { if (s.kind === 'col') col = s.c; else band = s.b; break; }
    if (svg === bs && geo) for (const it of geo.rows) if (y >= it.y && y < it.y + ROW_H) { row = it.r; break; }
    return { row, col, band };
  };
  bs.addEventListener('mousemove', (ev) => {
    const { row, col, band } = hit(ev, bs);
    setHover(row, col);
    if (row !== null && (col !== null || band !== null)) {
      tip.hidden = false;
      if (col !== null) tip.innerHTML = `<div class="t1">${esc(saLabel(row))}</div><div class="t2">${esc(colName(col))} <span class="mono">${esc(colTable(col))}</span></div><div class="t3">${rowSets[row].has(col) ? 'The lineage lists this dimension under this area' : 'The lineage does not list this dimension under this area'} · reach ${reach(col)} of ${C.subjectAreas}</div>`;
      else { const bd = BANDS[band!]; const used = bd.cols.filter((c) => rowSets[row].has(c)); tip.innerHTML = `<div class="t1">${esc(saLabel(row))}</div><div class="t3">Lists ${used.length} of the ${bd.cols.length} dimensions ${esc(bd.label)}${used.length ? ':' : '.'}</div>${used.length ? `<div class="t2">${used.slice(0, 8).map((c) => esc(colName(c))).join(', ')}${used.length > 8 ? '…' : ''}</div>` : ''}`; }
      placeTip(tip, ev);
    } else tip.hidden = true;
  });
  bs.addEventListener('mouseleave', () => { setHover(null, null); tip.hidden = true; });
  bs.addEventListener('click', (ev) => { const { row } = hit(ev, bs); if (row !== null) pickRow(row); });
  hs.addEventListener('mousemove', (ev) => {
    const { col } = hit(ev, hs);
    setHover(null, col);
    if (col !== null) { tip.hidden = false; tip.innerHTML = `<div class="t1">${esc(colName(col))}</div><div class="t2 mono">${esc(colTable(col))}</div><div class="t3">Listed under ${reach(col)} of ${C.subjectAreas} subject areas</div>`; placeTip(tip, ev); }
    else tip.hidden = true;
  });
  hs.addEventListener('mouseleave', () => { setHover(null, null); tip.hidden = true; });
  hs.addEventListener('click', (ev) => {
    const { col } = hit(ev, hs);
    if (col === null) return;
    state.a = state.b = null; state.dim = state.dim === col ? null : col; syncUrl(); render();
  });
}
function pickRow(r: number) {
  state.dim = null;
  if (state.a === null) state.a = r;
  else if (state.b === null) { if (r === state.a) state.a = null; else state.b = r; }
  else if (r === state.a) { state.a = state.b; state.b = null; }
  else if (r === state.b) state.b = null;
  else state.b = r;
  syncUrl(); render();
}
function placeTip(tip: HTMLElement, ev: MouseEvent) {
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let x = ev.clientX + 16, y = ev.clientY + 16;
  if (x + w > innerWidth - 8) x = ev.clientX - w - 16;
  if (y + h > innerHeight - 8) y = ev.clientY - h - 16;
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}
function setHover(r: number | null, c: number | null) {
  if (!geo) return;
  const changed = r !== state.hoverRow;
  state.hoverRow = r; state.hoverCol = c;
  const yv = r !== null ? geo.rowY.get(r) : undefined;
  document.getElementById('hrow')?.setAttribute('y', String(yv ?? -9999));
  const s = c !== null ? geo.colX.get(c) : undefined;
  for (const id of ['hcol', 'hcolh']) { const e = document.getElementById(id); e?.setAttribute('x', String(s ? s.x : -50)); e?.setAttribute('width', String(s ? s.w : 10)); }
  document.querySelectorAll('.rl.on, .cl.on').forEach((e) => e.classList.remove('on'));
  if (r !== null) document.querySelector(`.rl[data-r="${r}"]`)?.classList.add('on');
  if (c !== null) document.querySelectorAll(`.cl[data-c="${c}"]`).forEach((e) => e.classList.add('on'));
  if (changed && state.a === null && state.dim === null) renderSide();
}

// ------------------------------------------------------------------ side column
function factsOf(r: number) {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const t of bm.facts[r]) { const b = baseOf(t); if (!seen.has(b)) { seen.add(b); out.push(b); } }
  return out.sort((x, y) => Number(!grainsFor(x).length) - Number(!grainsFor(y).length) || String(T.name[x]).localeCompare(String(T.name[y])));
}
function factBlock(t: number) {
  const g = grainsFor(t)[0];
  const tw = twinOf(t);
  return `<div class="fact">
    <div class="f-name mono">${esc(T.name[t])}${tw !== undefined ? '<span class="twin">and its _SEC twin</span>' : ''}</div>
    ${g ? `<div class="f-grain">${esc(grainPhrase(t, g))}.</div>
    <div class="f-key">${solid(16)}key ${keyOrder(g.cols).map((c) => `<span class="ktag">${esc(c)}</span>`).join('<span class="plus">+</span>')}</div>`
      : `<div class="f-grain none">Its grain is not in Oracle’s key list.</div>`}
  </div>`;
}
function rowHtml(r: number, picked: boolean) {
  const sa = bm.rows[r];
  const facts = factsOf(r);
  const withGrain = facts.filter((t) => grainsFor(t).length).length;
  return `
    <div class="eyebrow">${esc(FA.name[faOfRow(r)])}</div>
    <h2>${esc(saLabel(r))}</h2>
    <div class="sub mono">${esc(SA.name[sa])}</div>
    <div class="kv">
      <span>Shared dimensions listed</span><b>${bm.cells[r].length}</b>
      <span>Fact tables</span><b>${SA.facts[sa]}</b>
      <span>Dimension tables</span><b>${SA.dimensions[sa]}</b>
      <span>Presentation columns</span><b>${fmt(SA.presentationColumns[sa])}</b>
    </div>
    <h3>Its facts and their grain</h3>
    <p class="note">${facts.length ? `${withGrain} of ${facts.length} have a grain stated in Oracle’s entity key list.` : 'No fact tables appear in its lineage.'}</p>
    ${facts.map(factBlock).join('')}
    <p class="hint">${picked ? 'Click a second row to compare the two areas.' : 'Click the row to pick it.'}</p>`;
}
function listCols(cols: number[], hot = false) {
  return `<ul class="dl ${hot ? 'hot' : ''}">${cols.map((c) => `<li data-col="${c}" title="${esc(colTable(c))}"><span>${esc(colName(c))}</span><span class="n">${reach(c)}</span></li>`).join('')}</ul>`;
}
function compareHtml(a: number, b: number) {
  const sh = sharedCols(a, b).sort(byReach);
  const onlyA = bm.cells[a].filter((c) => !rowSets[b].has(c)).sort(byReach);
  const onlyB = bm.cells[b].filter((c) => !rowSets[a].has(c)).sort(byReach);
  const nDiff = onlyA.length + onlyB.length;
  const lead = nDiff
    ? `Oracle’s lineage lists ${plural(nDiff, 'dimension')} under only one of the two. The other ${fmt(sh.length)} are listed under both.`
    : `Oracle’s lineage lists the same ${fmt(sh.length)} dimensions under both areas.`;
  return `
    <div class="eyebrow">Comparing two subject areas</div>
    <h2 class="pair"><span><i>A</i>${esc(saLabel(a))}</span><span><i>B</i>${esc(saLabel(b))}</span></h2>
    <div class="trio">
      <div class="hot"><b>${onlyA.length}</b><span>only in A</span></div>
      <div class="hot"><b>${onlyB.length}</b><span>only in B</span></div>
      <div class="quiet"><b>${sh.length}</b><span>in both</span></div>
    </div>
    <p class="lead-s">${lead}</p>
    <h3>Only in ${esc(saLabel(a))} <span class="n">reach</span></h3>
    ${onlyA.length ? listCols(onlyA, true) : '<p class="note">None. Every dimension listed under A is also listed under B.</p>'}
    <h3>Only in ${esc(saLabel(b))} <span class="n">reach</span></h3>
    ${onlyB.length ? listCols(onlyB, true) : '<p class="note">None. Every dimension listed under B is also listed under A.</p>'}
    <h3>In both</h3>
    <details class="shared"><summary>${plural(sh.length, 'dimension')} listed under both areas</summary>
      <p class="quiet-l">${sh.map((c) => `<span data-col="${c}">${esc(colName(c))}</span>`).join(', ')}</p>
    </details>`;
}
function dimHtml(c: number) {
  const t = bm.columns[c];
  const n = reach(c);
  const perFa = FA.name.map((_: string, f: number) => {
    let tot = 0, has = 0;
    for (let r = 0; r < nRows; r++) if (faOfRow(r) === f) { tot++; if (rowSets[r].has(c)) has++; }
    return { f, tot, has };
  });
  const pretty = colName(c);
  // report folders whose columns map to this table's columns (mapsTo), with the number of areas that have each folder
  const folders = [...(foldersOf.get(t) ?? new Map<string, Set<number>>())]
    .map(([name, sas]) => ({ name, areas: sas.size }))
    .sort((x, y) => y.areas - x.areas || x.name.localeCompare(y.name));
  const ROLE_SHOW = 14;
  // facts the lineage lists in the same subject areas as this dimension
  const factAreas = new Map<number, number>();
  for (let r = 0; r < nRows; r++) {
    if (!rowSets[r].has(c)) continue;
    for (const f of new Set(bm.facts[r].map(baseOf))) factAreas.set(f, (factAreas.get(f) ?? 0) + 1);
  }
  const facts = [...factAreas].map(([f, w]) => ({ f, w })).sort((x, y) => y.w - x.w || String(T.name[x.f]).localeCompare(String(T.name[y.f])));
  const maxW = Math.max(1, ...facts.map((x) => x.w));
  const SHOW = 10;
  return `
    <div class="eyebrow">Dimension, ${ordinal(c + 1)} most shared of ${nCols}</div>
    <h2>${esc(pretty)}</h2>
    <div class="sub mono">${esc(T.name[t])}</div>
    ${bm.columnDerived[c] ? '<p class="note">Generated by NSAW, with no NetSuite record behind it.</p>' : ''}
    <div class="big"><b class="hot">${n}</b><span>of ${C.subjectAreas} subject areas list it</span></div>
    <div class="meter"><i style="width:${(n / C.subjectAreas) * 100}%"></i></div>
    <h3>Reach by functional area</h3>
    <ul class="fa-l">${perFa.map((p) => `<li><span>${esc(FA.name[p.f])}</span><span class="m"><i style="width:${(p.has / p.tot) * 100}%"></i></span><span class="n">${p.has} of ${p.tot}</span></li>`).join('')}</ul>
    <h3>Report folders that read from this table <span class="n">areas</span></h3>
    ${folders.length ? `<p class="roles">${folders.slice(0, ROLE_SHOW).map((x) => `<span><em>${esc(x.name)}</em> <span class="n">${x.areas}</span></span>`).join('')}</p>
      <p class="note">${solid(18)}Presentation folders with a column that the lineage maps to a column of ${esc(T.name[t])}${folders.length > ROLE_SHOW ? `, ${folders.length} in all` : ''}.</p>`
      : `<p class="note">No presentation column in the lineage maps to this table.</p>`}
    <h3>Facts in the same subject areas <span class="n">areas</span></h3>
    <p class="note">${solid(18)}The lineage lists ${plural(facts.length, 'fact table')} in the subject areas that list this dimension.</p>
    <ul class="fx">${facts.slice(0, SHOW).map((x) => `<li><span class="mono">${esc(String(T.name[x.f]).replace(/^DW_NS_/, ''))}</span><span class="m"><i style="width:${(x.w / maxW) * 100}%"></i></span><span class="n">${x.w}</span></li>`).join('')}</ul>
    ${facts.length > SHOW ? `<p class="note">And ${facts.length - SHOW} more.</p>` : ''}`;
}
const ordinal = (n: number) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
function defaultHtml() {
  const top = [...Array(6).keys()];
  return `
    <div class="eyebrow">Reading the matrix</div>
    <h2>Rows, columns and marks</h2>
    <ol class="howto">
      <li>Hover a row to see its facts and the grain of each.</li>
      <li>Click two rows to see the dimensions only one of them lists.</li>
      <li>Click a column name to see where a dimension reaches and which report folders read from it.</li>
    </ol>
    <h3>Widest reach</h3>
    <ul class="dl">${top.map((c) => `<li data-col="${c}" title="${esc(colTable(c))}"><span>${esc(colName(c))}</span><span class="n">${reach(c)}</span></li>`).join('')}</ul>
    <p class="note">${top.length} dimensions reach ${reach(top.length - 1)} or more of the ${C.subjectAreas} subject areas. ${BANDS[BANDS.length - 1].cols.length} reach five or fewer.</p>
    <h3>Try</h3>
    <a class="try" data-try="cmp"><span>Sales Order and Customer Invoice</span><small>Compare two Order to Cash areas</small></a>
    <a class="try" data-try="dim"><span>Employee</span><small>One dimension, many report folders</small></a>`;
}
function renderSide() {
  const el = document.getElementById('side');
  if (!el) return;
  const { a, b, dim, hoverRow } = state;
  let h = '';
  if (a !== null && b !== null) h = compareHtml(a, b);
  else if (a !== null) h = rowHtml(a, true);
  else if (dim !== null) h = dimHtml(dim);
  else if (hoverRow !== null) h = rowHtml(hoverRow, false);
  else h = defaultHtml();
  el.innerHTML = h;
  el.querySelectorAll<HTMLElement>('[data-col]').forEach((n) => n.addEventListener('click', () => {
    const c = +n.dataset.col!; state.a = state.b = null; state.dim = c; const bd = bandOfCol(c); if (bd >= 0) state.open.add(bd); syncUrl(); render();
  }));
  el.querySelector('[data-try="cmp"]')?.addEventListener('click', () => { state.dim = null; state.a = findRow('Sales Order'); state.b = findRow('Customer Invoice'); syncUrl(); render(); });
  el.querySelector('[data-try="dim"]')?.addEventListener('click', () => { state.a = state.b = null; state.dim = findCol('EMPLOYEE'); syncUrl(); render(); });
}

// ------------------------------------------------------------------ boot
shell();
addEventListener('resize', () => renderMatrix());
(window as any).onresize = () => renderMatrix();
await document.fonts.ready;
renderMatrix();
document.body.dataset.ready = '1';
