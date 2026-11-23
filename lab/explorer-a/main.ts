// Mock A, "Bus matrix console". Vanilla TS + DOM/SVG over the real ontology JSON.
// States are driven by URL params so screenshots are reproducible:
//   ?                       home (bus matrix)
//   ?a=Sales Order&b=Customer Invoice   compare two subject areas (labels or full names)
//   ?row=Sales Order | ?col=CUSTOMER     pseudo-hover a row or a column
//   ?q=item                 filter rows/columns
//   ?view=fact&t=DW_NS_SALES_ORDER_LINES_F   fact page

import { loadOntology, type Ontology } from '../../ontology/load';

(window as any).__errs = [];
window.addEventListener('error', (e) => (window as any).__errs.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => (window as any).__errs.push(String((e as any).reason)));

// ------------------------------------------------------------------ data
const o: Ontology = await loadOntology({ baseUrl: '/ontology/' });
await o.ensure('usedwith');
const core = o.core;
const bm = core.busMatrix;
const C = core.meta.counts;
const T = core.nodes.physicalTable!.cols as Record<string, any[]>;
const SA = core.nodes.subjectArea!.cols as Record<string, any[]>;
const FA = core.nodes.functionalArea!.cols as Record<string, any[]>;
const ENT = core.nodes.entity!.cols as Record<string, any[]>;
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
const rowOfSa = new Map<number, number>();
bm.rows.forEach((sa, r) => rowOfSa.set(sa, r));
const rowSets = bm.cells.map((c) => new Set(c));
const isFact = (t: number) => T.role[t] === 'fact' || T.role[t] === 'enhanced';
const dimShort = (t: number) => String(T.name[t]).replace(/^DW_NS_/, '').replace(/_D$/, '');
const saLabel = (r: number) => String(SA.label[bm.rows[r]]);
const shortLabel = (r: number) => saLabel(r).replace(/^Order to Cash - /, 'O2C · ').replace(/^Procure to Pay - /, 'P2P · ');
const faOfRow = (r: number) => saFa[bm.rows[r]];
const baseOf = (t: number) => (T.isSecured[t] && T.baseTable[t] >= 0 ? T.baseTable[t] : t);
const twinOf = (t: number) => tIdx.get(String(T.name[t]).toUpperCase() + '_SEC');

// Grain from Oracle's entity key list: the entity whose keys all sit on this table (most keys wins),
// else an entity that keys this table by `id` alone.
interface Grain { cols: string[]; entity: string; others: { entity: string; cols: string[] }[] }
interface Link { other: number; otherCols: string[]; hereCols: string[]; entity: string; key: string }
const entOn = new Map<number, { e: number; all: boolean; cols: string[] }[]>();
const links = new Map<number, { headers: Link[]; children: Link[] }>();
for (let e = 0; e < core.nodes.entity!.n; e++) {
  const keys = ENT.keys[e] as { k: string; t: string; c: string }[];
  const byTable = new Map<number, Set<string>>();
  const keyName = new Map<number, string>();
  for (const k of keys) {
    const ti = tIdx.get(k.t.toUpperCase());
    if (ti === undefined) continue;
    (byTable.get(ti) ?? byTable.set(ti, new Set()).get(ti)!).add(k.c.toLowerCase());
    keyName.set(ti, k.k);
  }
  for (const [ti, cols] of byTable) (entOn.get(ti) ?? entOn.set(ti, []).get(ti)!).push({ e, all: byTable.size === 1, cols: [...cols].sort() });
  const tables = [...byTable.keys()];
  for (const a of tables) for (const b of tables) {
    if (a === b) continue;
    const ca = [...byTable.get(a)!], cb = [...byTable.get(b)!];
    if (cb.length === 1 && cb[0] === 'id' && !(ca.length === 1 && ca[0] === 'id')) {
      const L = links.get(a) ?? links.set(a, { headers: [], children: [] }).get(a)!;
      L.headers.push({ other: b, otherCols: cb, hereCols: ca, entity: ENT.name[e], key: keyName.get(b)! });
      const M = links.get(b) ?? links.set(b, { headers: [], children: [] }).get(b)!;
      M.children.push({ other: a, otherCols: ca, hereCols: cb, entity: ENT.name[e], key: keyName.get(b)! });
    }
  }
}
function grainOf(t0: number): Grain | null {
  const t = baseOf(t0);
  const es = entOn.get(t) ?? [];
  const full = es.filter((x) => x.all).sort((a, b) => b.cols.length - a.cols.length);
  const g = full[0] ?? es.find((x) => x.cols.length === 1 && x.cols[0] === 'id');
  if (!g) return null;
  const others = full.filter((x) => x !== g).map((x) => ({ entity: ENT.name[x.e], cols: x.cols }));
  return { cols: g.cols, entity: ENT.name[g.e], others };
}
const docNoun = (t: number) =>
  String(T.name[baseOf(t)]).replace(/^DW_NS_/, '').replace(/_(F|EF)$/, '').replace(/_LINES?$/, '').replace(/_SNAPSHOT$/, ' snapshot')
    .replace(/_/g, ' ').toLowerCase();
function grainSentence(t: number, g: Grain): string {
  const sig = g.cols.join('+');
  const noun = docNoun(t);
  if (sig === 'id') return `One row per ${noun}`;
  if (sig === 'accountingbook+id+transaction') return `One row per ${noun} line in each accounting book`;
  if (sig === 'id+transaction') return `One row per ${noun} line`;
  return `One row per combination of ${g.cols.join(', ')}`;
}
const keyOrder = (cols: string[]) => {
  const pref = ['accountingbook', 'id', 'transaction'];
  return [...cols].sort((a, b) => (pref.indexOf(a) + 1 || 99) - (pref.indexOf(b) + 1 || 99) || a.localeCompare(b));
};

// grain coverage across fact bases (fact tables in use, secured twins folded into their base)
const grainStats = (() => {
  let tot = 0, has = 0;
  for (let i = 0; i < nT; i++) {
    if (!isFact(i) || T.isSecured[i]) continue;
    const tw = twinOf(i);
    if (!T.lineageRows[i] && !T.saCount[i] && !(tw !== undefined && T.saCount[tw])) continue;
    tot++; if (grainOf(i)) has++;
  }
  return { tot, has };
})();

// ------------------------------------------------------------------ state
type View = 'matrix' | 'fact';
const params = new URLSearchParams(location.search);
const findRow = (s: string | null): number | null => {
  if (!s) return null;
  const l = s.toLowerCase();
  for (let r = 0; r < nRows; r++) if (saLabel(r).toLowerCase() === l || String(SA.name[bm.rows[r]]).toLowerCase() === l) return r;
  return null;
};
const findCol = (s: string | null): number | null => {
  if (!s) return null;
  const l = s.toUpperCase().replace(/^DW_NS_/, '').replace(/_D$/, '');
  const k = bm.columns.findIndex((t) => dimShort(t).toUpperCase() === l);
  return k < 0 ? null : k;
};
const DEFAULT_FACT = tIdx.get('DW_NS_SALES_ORDER_LINES_F')!;
const state = {
  view: (params.get('view') === 'fact' ? 'fact' : 'matrix') as View,
  a: findRow(params.get('a')),
  b: findRow(params.get('b')),
  q: params.get('q') ?? '',
  hoverRow: findRow(params.get('row')),
  hoverCol: findCol(params.get('col')),
  fact: tIdx.get(String(params.get('t') ?? '').toUpperCase()) ?? DEFAULT_FACT,
};
function syncUrl() {
  const p = new URLSearchParams();
  if (state.view === 'fact') { p.set('view', 'fact'); p.set('t', String(T.name[state.fact])); }
  else {
    if (state.a !== null) p.set('a', saLabel(state.a));
    if (state.b !== null) p.set('b', saLabel(state.b));
    if (state.q) p.set('q', state.q);
  }
  const s = p.toString();
  history.replaceState(null, '', s ? '?' + s : location.pathname);
}

// ------------------------------------------------------------------ helpers
const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const fmt = (n: number) => n.toLocaleString('en-US');
const solidMark = (w = 22) => `<svg width="${w}" height="8"><line x1="1" y1="4" x2="${w - 1}" y2="4" stroke="currentColor" stroke-width="1.5"/></svg>`;
const dashMark = (w = 22) => `<svg width="${w}" height="8"><line x1="1" y1="4" x2="${w - 1}" y2="4" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 3"/></svg>`;
const sharedCols = (a: number, b: number) => bm.cells[a].filter((c) => rowSets[b].has(c));
const app = document.getElementById('app')!;

// ------------------------------------------------------------------ shell
function shell() {
  const factName = String(T.name[state.fact]);
  app.innerHTML = `
  <header class="top">
    <div class="brand"><span class="brand-mark">${'<i></i>'.repeat(9)}</span>NSAW Schema Explorer <small>25R4</small></div>
    <nav class="tabs">
      <button class="tab ${state.view === 'matrix' ? 'on' : ''}" data-view="matrix">Bus matrix</button>
      <button class="tab ${state.view === 'fact' ? 'on' : ''}" data-view="fact">Fact <span class="mono">${esc(factName.replace(/^DW_NS_/, ''))}</span></button>
    </nav>
    <div class="search">
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="var(--pencil)" stroke-width="1.4"><circle cx="5.5" cy="5.5" r="4.2"/><line x1="8.7" y1="8.7" x2="12" y2="12"/></svg>
      <input id="q" placeholder="Filter subject areas or dimensions" value="${esc(state.q)}" autocomplete="off" spellcheck="false" />
      <kbd>/</kbd>
    </div>
    <div class="legend">
      <span>${solidMark()} stated in data</span>
      <span>${dashMark()} inferred</span>
    </div>
  </header>
  <section class="summary">
    <div class="stat"><b>${fmt(C.subjectAreas)}</b><span>subject areas · ${C.functionalAreas} functional areas</span></div>
    <div class="stat"><b>${fmt(C.physicalTablesInLineage)}</b><span>warehouse tables in use</span></div>
    <div class="stat"><b>${fmt(C.busMatrixColumns)}</b><span>shared dimensions</span></div>
    <div class="stat"><b>${fmt(C.netsuiteRecords)}</b><span>NetSuite records · ${C.explicitNetsuiteRecords} stated</span></div>
    <div class="stat"><b>${grainStats.has}<span style="font-size:14px;color:var(--pencil)"> / ${grainStats.tot}</span></b><span>facts with a stated grain</span></div>
    <div class="note" ${state.view === 'fact' ? 'hidden' : ''}>A filled cell means the subject area's lineage uses that dimension. Joins from a fact to its dimensions are inferred from that.</div>
  </section>
  <div class="body" id="body"></div>
  <div class="tip" id="tip" hidden></div>`;
  app.querySelectorAll<HTMLButtonElement>('.tab').forEach((b) => b.addEventListener('click', () => go(b.dataset.view as View)));
  const q = app.querySelector<HTMLInputElement>('#q')!;
  q.addEventListener('input', () => {
    state.q = q.value.trim();
    if (state.view !== 'matrix') { state.view = 'matrix'; shell(); app.querySelector<HTMLInputElement>('#q')!.focus(); return; }
    syncUrl(); renderMatrix();
  });
  renderBody();
}
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); app.querySelector<HTMLInputElement>('#q')?.focus(); }
  if (e.key === 'Escape') { state.a = state.b = null; syncUrl(); if (state.view === 'matrix') { renderCompareBar(); renderMatrix(); } }
});
function go(v: View, fact?: number) {
  state.view = v;
  if (fact !== undefined) state.fact = fact;
  syncUrl(); shell();
}
function renderBody() {
  const body = document.getElementById('body')!;
  if (state.view === 'fact') { body.innerHTML = `<div class="fp" id="fp"></div>`; renderFact(); return; }
  body.innerHTML = `
    <div class="main">
      <div class="cmp" id="cmp"></div>
      <div class="mx" id="mx"></div>
    </div>
    <aside class="inspector" id="insp"></aside>`;
  renderCompareBar();
  renderMatrix();
}

// ------------------------------------------------------------------ compare bar
function saOptions(sel: number | null) {
  let h = `<option value="">Choose a subject area</option>`;
  for (let f = 0; f < FA.name.length; f++) {
    h += `<optgroup label="${esc(FA.name[f])}">`;
    for (let r = 0; r < nRows; r++) if (faOfRow(r) === f) h += `<option value="${r}" ${sel === r ? 'selected' : ''}>${esc(saLabel(r))}</option>`;
    h += `</optgroup>`;
  }
  return h;
}
function renderCompareBar() {
  const el = document.getElementById('cmp')!;
  const { a, b } = state;
  let result = '';
  if (a !== null && b !== null) {
    const n = sharedCols(a, b).length;
    result = `<span class="result">share <b>${n}</b> dimension${n === 1 ? '' : 's'}</span><button class="btn" id="clr">Clear</button>`;
  } else if (a !== null) result = `<span class="sub">Pick a second subject area, or click its row.</span><button class="btn" id="clr">Clear</button>`;
  el.innerHTML = `
    <label>Compare</label>
    <span class="pick ${a !== null ? 'set' : ''}"><i>A</i><select id="pa">${saOptions(a)}</select></span>
    <span class="sub">and</span>
    <span class="pick ${b !== null ? 'set' : ''}"><i>B</i><select id="pb">${saOptions(b)}</select></span>
    ${result}
    <span class="hint">Click a row to pick it · Esc clears</span>`;
  const pa = el.querySelector<HTMLSelectElement>('#pa')!, pb = el.querySelector<HTMLSelectElement>('#pb')!;
  pa.addEventListener('change', () => { state.a = pa.value === '' ? null : +pa.value; afterPick(); });
  pb.addEventListener('change', () => { state.b = pb.value === '' ? null : +pb.value; afterPick(); });
  el.querySelector('#clr')?.addEventListener('click', () => { state.a = state.b = null; afterPick(); });
}
function afterPick() {
  if (state.a === null && state.b !== null) { state.a = state.b; state.b = null; }
  if (state.a !== null && state.a === state.b) state.b = null;
  syncUrl(); renderCompareBar(); renderMatrix();
}
function pickRow(r: number) {
  if (state.a === null) state.a = r;
  else if (r === state.a) { state.a = state.b; state.b = null; }
  else if (r === state.b) state.b = null;
  else state.b = r;
  afterPick();
}

// ------------------------------------------------------------------ matrix
const LABEL_W = 196, ROW_H = 14, FA_H = 26, BAR_H = 28, BAR_Y = 10, LBL_H = 132, HEAD_GAP = 8;
const HEAD_H = BAR_Y + BAR_H + HEAD_GAP + LBL_H + 6;
const MAX_CH = 18;
let geo: { cw: number; cols: number[]; colX: Map<number, number>; rows: { r: number; y: number }[]; rowY: Map<number, number>; height: number; width: number } | null = null;

function matches(s: string, q: string) { return s.toLowerCase().includes(q.toLowerCase()); }
function filtered() {
  const q = state.q;
  let rows = [...Array(nRows).keys()];
  let cols = [...Array(nCols).keys()];
  if (q) {
    const rr = rows.filter((r) => matches(saLabel(r), q) || matches(FA.name[faOfRow(r)], q));
    const cc = cols.filter((c) => matches(dimShort(bm.columns[c]), q));
    if (rr.length) rows = rr;
    if (cc.length) cols = cc;
    if (!rr.length && cc.length) rows = rows.filter((r) => cc.some((c) => rowSets[r].has(c)));
  }
  return { rows, cols };
}

function renderMatrix() {
  const mx = document.getElementById('mx');
  if (!mx) return;
  const { rows, cols } = filtered();
  const avail = mx.clientWidth - 12;
  const cw = Math.max(9, Math.min(22, Math.floor((avail - LABEL_W) / Math.max(cols.length, 1))));
  const colX = new Map<number, number>();
  cols.forEach((c, k) => colX.set(c, LABEL_W + k * cw));
  const width = LABEL_W + cols.length * cw;
  const lay: { r: number; y: number }[] = [];
  const faY: { f: number; y: number; n: number }[] = [];
  let y = 0, lastFa = -1;
  for (const r of rows) {
    const f = faOfRow(r);
    if (f !== lastFa) { faY.push({ f, y, n: 0 }); y += FA_H; lastFa = f; }
    faY[faY.length - 1].n++;
    lay.push({ r, y }); y += ROW_H;
  }
  const height = y + 8;
  const rowY = new Map(lay.map((x) => [x.r, x.y]));
  geo = { cw, cols, colX, rows: lay, rowY, height, width };

  const { a, b } = state;
  const cmp = a !== null && b !== null;
  const shared = cmp ? new Set(sharedCols(a!, b!)) : new Set<number>();

  // header
  let hh = `<svg id="hsvg" width="${width}" height="${HEAD_H}">`;
  hh += `<rect id="hcolh" x="-50" y="0" width="${cw}" height="${HEAD_H}" fill="var(--row-hi)"/>`;
  hh += `<text class="axis" x="8" y="${BAR_Y + 12}">Reach, subject areas</text>`;
  hh += `<line x1="${LABEL_W - 6}" x2="${LABEL_W - 2}" y1="${BAR_Y}" y2="${BAR_Y}" stroke="var(--pencil)"/><text class="axis" x="${LABEL_W - 9}" y="${BAR_Y + 4}" text-anchor="end">${C.subjectAreas}</text>`;
  hh += `<line x1="${LABEL_W - 6}" x2="${LABEL_W - 2}" y1="${BAR_Y + BAR_H}" y2="${BAR_Y + BAR_H}" stroke="var(--pencil)"/><text class="axis" x="${LABEL_W - 9}" y="${BAR_Y + BAR_H + 4}" text-anchor="end">0</text>`;
  hh += `<text class="axis" x="8" y="${HEAD_H - 26}">Subject areas, by functional area</text>`;
  hh += `<text class="axis" x="8" y="${HEAD_H - 10}">Dimensions, most shared first →</text>`;
  for (const c of cols) {
    const x = colX.get(c)!;
    const n = bm.columnSaCount[c];
    const bh = Math.max(1, (n / C.subjectAreas) * BAR_H);
    const cls = cmp ? (shared.has(c) ? 'shared' : 'dim') : '';
    hh += `<rect class="bar ${cls}" data-c="${c}" x="${x + 1}" y="${BAR_Y + BAR_H - bh}" width="${cw - 2}" height="${bh}"/>`;
    let name = dimShort(bm.columns[c]);
    if (name.length > MAX_CH) name = name.slice(0, MAX_CH - 1) + '…';
    const der = bm.columnDerived[c] ? '°' : '';
    const tx = x + cw / 2 + 3.6, ty = HEAD_H - 4;
    hh += `<text class="cl ${cls}" data-c="${c}" transform="translate(${tx},${ty}) rotate(-90)"><tspan class="n">${n} </tspan>${esc(name)}${der}</text>`;
  }
  hh += `</svg>`;

  // body
  let bh = `<svg id="bsvg" width="${width}" height="${height}">`;
  bh += `<rect id="hrow" x="0" y="-50" width="${width}" height="${ROW_H}" fill="var(--row-hi)"/>`;
  bh += `<rect id="hcol" x="-50" y="0" width="${cw}" height="${height}" fill="var(--row-hi)"/>`;
  if (cmp) for (const c of shared) if (colX.has(c)) bh += `<rect x="${colX.get(c)}" y="0" width="${cw}" height="${height}" fill="var(--accent-soft)"/>`;
  for (let k = 10; k < cols.length; k += 10) bh += `<line x1="${LABEL_W + k * cw}" x2="${LABEL_W + k * cw}" y1="0" y2="${height}" stroke="var(--faint)"/>`;
  for (const g of faY) {
    bh += `<line x1="0" x2="${width}" y1="${g.y + 0.5}" y2="${g.y + 0.5}" stroke="var(--hair)"/>`;
    bh += `<text class="fa" x="8" y="${g.y + 17}">${esc(FA.name[g.f])}</text>`;
    bh += `<text class="fan" x="${LABEL_W - 8}" y="${g.y + 17}" text-anchor="end">${g.n}</text>`;
  }
  bh += `<g class="cells ${cmp ? 'cmp' : ''}">`;
  for (const { r, y } of lay) {
    const isAB = r === a || r === b;
    for (const c of bm.cells[r]) {
      const x = colX.get(c);
      if (x === undefined) continue;
      let cls = 'c';
      if (cmp) {
        if (shared.has(c)) cls += isAB ? ' acc' : ' sh';
        else if (isAB) cls += ' solo';
      } else if (isAB) cls += ' acc';
      if (cls.includes('solo')) bh += `<rect class="${cls}" x="${x + 1.5}" y="${y + 2.5}" width="${cw - 3}" height="${ROW_H - 5}"/>`;
      else bh += `<rect class="${cls}" x="${x + 1}" y="${y + 2}" width="${cw - 2}" height="${ROW_H - 4}"/>`;
    }
  }
  bh += `</g>`;
  for (const { r, y } of lay) {
    let label = shortLabel(r);
    if (label.length > 25) label = label.slice(0, 24) + '…';
    const cls = r === a ? 'cmpA' : r === b ? 'cmpB' : cmp ? 'dim' : '';
    const mark = r === a ? 'A' : r === b ? 'B' : '';
    if (mark) bh += `<rect x="0" y="${y + 1}" width="2" height="${ROW_H - 2}" fill="var(--accent)"/>`;
    bh += `<text class="rl ${cls}" data-r="${r}" x="${mark ? 22 : 8}" y="${y + 11}">${esc(label)}</text>`;
    if (mark) bh += `<text class="rl ${cls}" x="8" y="${y + 11}" style="font-family:var(--mono);font-size:10.5px">${mark}</text>`;
    bh += `<text class="rn" x="${LABEL_W - 8}" y="${y + 11}" text-anchor="end">${bm.cells[r].length}</text>`;
  }
  bh += `</svg>`;

  mx.innerHTML = `<div class="mx-head">${hh}</div>${bh}`;
  wireMatrix();
  applyHover();
  renderInspector();
}

function wireMatrix() {
  const bs = document.getElementById('bsvg')!;
  const hs = document.getElementById('hsvg')!;
  const tip = document.getElementById('tip')!;
  const hit = (ev: MouseEvent, svg: Element) => {
    const rect = svg.getBoundingClientRect();
    const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    let col: number | null = null, row: number | null = null;
    if (x >= LABEL_W && geo) { const k = Math.floor((x - LABEL_W) / geo.cw); col = geo.cols[k] ?? null; }
    if (svg === bs && geo) for (const it of geo.rows) if (y >= it.y && y < it.y + ROW_H) { row = it.r; break; }
    return { row, col };
  };
  bs.addEventListener('mousemove', (ev) => {
    const { row, col } = hit(ev, bs);
    state.hoverRow = row; state.hoverCol = col;
    applyHover();
    if (row !== null && col !== null) {
      const has = rowSets[row].has(col);
      tip.hidden = false;
      tip.innerHTML = `<div>${esc(saLabel(row))}</div><div class="mono">${esc(String(T.name[bm.columns[col]]))}</div><div class="sub">${has ? 'Used by this subject area' : 'Not used here'} · reach ${bm.columnSaCount[col]} of ${C.subjectAreas}</div>`;
      placeTip(tip, ev);
    } else tip.hidden = true;
  });
  bs.addEventListener('mouseleave', () => { state.hoverRow = state.hoverCol = null; tip.hidden = true; applyHover(); });
  bs.addEventListener('click', (ev) => { const { row } = hit(ev, bs); if (row !== null) pickRow(row); });
  hs.addEventListener('mousemove', (ev) => {
    const { col } = hit(ev, hs);
    state.hoverRow = null; state.hoverCol = col; applyHover();
    if (col !== null) {
      tip.hidden = false;
      tip.innerHTML = `<div class="mono">${esc(String(T.name[bm.columns[col]]))}</div><div class="sub">Used by ${bm.columnSaCount[col]} of ${C.subjectAreas} subject areas</div>`;
      placeTip(tip, ev);
    } else tip.hidden = true;
  });
  hs.addEventListener('mouseleave', () => { state.hoverCol = null; tip.hidden = true; applyHover(); });
}
function placeTip(tip: HTMLElement, ev: MouseEvent) {
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let x = ev.clientX + 14, y = ev.clientY + 14;
  if (x + w > innerWidth - 8) x = ev.clientX - w - 14;
  if (y + h > innerHeight - 8) y = ev.clientY - h - 14;
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}
let lastHover = '';
function applyHover() {
  if (!geo) return;
  const { hoverRow: r, hoverCol: c } = state;
  const hrow = document.getElementById('hrow'), hcol = document.getElementById('hcol'), hcolh = document.getElementById('hcolh');
  const y = r !== null ? geo.rowY.get(r) : undefined;
  hrow?.setAttribute('y', String(y ?? -50));
  const x = c !== null ? geo.colX.get(c) : undefined;
  hcol?.setAttribute('x', String(x ?? -50));
  hcolh?.setAttribute('x', String(x ?? -50));
  document.querySelectorAll('.rl.on, .cl.on, .bar.on').forEach((e) => e.classList.remove('on'));
  if (r !== null) document.querySelector(`.rl[data-r="${r}"]`)?.classList.add('on');
  if (c !== null) document.querySelectorAll(`[data-c="${c}"]`).forEach((e) => e.classList.add('on'));
  const key = `${r}|${c}`;
  if (key !== lastHover) { lastHover = key; renderInspector(); }
}

// ------------------------------------------------------------------ inspector
function factList(r: number) {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const t of bm.facts[r]) { const b = baseOf(t); if (!seen.has(b)) { seen.add(b); out.push(b); } }
  return out.sort((x, y) => String(T.name[x]).localeCompare(String(T.name[y])));
}
function grainChips(t: number) {
  const g = grainOf(t);
  if (!g) return `<span class="tag">grain not in the key list</span>`;
  return `<span class="chips">${keyOrder(g.cols).map((c, i) => (i ? '<span class="plus">+</span>' : '') + `<span class="chip">${esc(c)}</span>`).join('')}</span>`;
}
function factBlock(t: number) {
  const twin = twinOf(t);
  return `<div class="fact link" data-fact="${t}">
    <div class="mono">${esc(T.name[t])}</div>
    <div class="g">${grainChips(t)}${twin !== undefined ? '<span class="tag">+ _SEC twin</span>' : ''}</div>
  </div>`;
}
function renderInspector() {
  const el = document.getElementById('insp');
  if (!el) return;
  const { a, b, hoverRow, hoverCol } = state;
  let h = '';
  if (a !== null && b !== null) h = compareHtml(a, b);
  else if (hoverCol !== null && hoverRow === null) h = colHtml(hoverCol);
  else if (hoverRow !== null) h = rowHtml(hoverRow);
  else if (a !== null) h = rowHtml(a);
  else h = defaultHtml();
  el.innerHTML = h;
  el.querySelectorAll<HTMLElement>('[data-fact]').forEach((n) => n.addEventListener('click', () => go('fact', +n.dataset.fact!)));
  el.querySelectorAll<HTMLElement>('[data-col]').forEach((n) => {
    n.addEventListener('mouseenter', () => { state.hoverCol = +n.dataset.col!; const k = lastHover; applyHover(); lastHover = k; });
  });
}
function rowHtml(r: number) {
  const sa = bm.rows[r];
  const facts = factList(r);
  const dims = [...bm.cells[r]].sort((x, y) => bm.columnSaCount[y] - bm.columnSaCount[x]);
  const rare = dims.filter((c) => bm.columnSaCount[c] <= 20);
  return `
    <div class="k">${esc(FA.name[faOfRow(r)])}</div>
    <div class="h2">${esc(saLabel(r))}</div>
    <div class="sub mono" style="font-size:11.5px">${esc(SA.name[sa])}</div>
    <div class="kv">
      <span>Shared dimensions used</span><b>${dims.length}</b>
      <span>Fact tables</span><b>${SA.facts[sa]}</b>
      <span>Dimension tables</span><b>${SA.dimensions[sa]}</b>
      <span>Presentation tables</span><b>${SA.presentationTables[sa]}</b>
      <span>Presentation columns</span><b>${fmt(SA.presentationColumns[sa])}</b>
    </div>
    <div class="k">Facts in this area · grain from the key list</div>
    <div>${facts.length ? facts.map(factBlock).join('') : '<div class="sub">No fact tables in its lineage.</div>'}</div>
    ${rare.length ? `<div class="k">Its least shared dimensions</div><div class="list">${rare.slice(-8).reverse().map((c) =>
      `<div class="li"><span class="mono">${esc(dimShort(bm.columns[c]))}</span><span class="n">${bm.columnSaCount[c]}</span></div>`).join('')}</div>` : ''}
    <p class="p" style="margin-top:14px;font-size:12px">Click the row to pick it for a comparison.</p>`;
}
function colHtml(c: number) {
  const t = bm.columns[c];
  const n = bm.columnSaCount[c];
  const perFa = FA.name.map((_: string, f: number) => {
    let tot = 0, has = 0;
    for (let r = 0; r < nRows; r++) if (faOfRow(r) === f) { tot++; if (rowSets[r].has(c)) has++; }
    return { f, tot, has };
  });
  return `
    <div class="k">Dimension · rank ${c + 1} of ${nCols}</div>
    <div class="h2 mono" style="font-size:13.5px;word-break:break-all">${esc(T.name[t])}</div>
    ${bm.columnDerived[c] ? '<div class="sub" style="margin-top:2px">Generated by NSAW (calendar), with no NetSuite record behind it.</div>' : ''}
    <div style="margin-top:14px" class="big">${n}<span style="font-size:14px;color:var(--pencil)"> of ${C.subjectAreas}</span></div>
    <div class="sub">subject areas use it</div>
    <div class="meter" style="margin-top:8px"><i style="width:${(n / C.subjectAreas) * 100}%"></i></div>
    <div class="k">Reach by functional area</div>
    <div class="list">${perFa.map((p) => `<div class="li" style="grid-template-columns:1fr 60px 40px"><span>${esc(FA.name[p.f])}</span>
      <div class="meter"><i style="width:${(p.has / p.tot) * 100}%"></i></div><span class="n" style="text-align:right">${p.has}/${p.tot}</span></div>`).join('')}</div>
    <div class="kv" style="margin-top:14px">
      <span>Columns</span><b>${T.columns[t]}</b>
      <span>Presentation tables using it</span><b>${T.presentationTables[t]}</b>
    </div>`;
}
function compareHtml(a: number, b: number) {
  const sh = sharedCols(a, b).sort((x, y) => bm.columnSaCount[y] - bm.columnSaCount[x]);
  const onlyA = bm.cells[a].length - sh.length, onlyB = bm.cells[b].length - sh.length;
  const fa = factList(a), fb = factList(b);
  return `
    <div class="k">Comparing</div>
    <div style="display:grid;grid-template-columns:16px 1fr;row-gap:3px;align-items:baseline">
      <span class="mono" style="color:var(--accent);font-size:11px">A</span><span class="h2" style="font-size:14px">${esc(saLabel(a))}</span>
      <span class="mono" style="color:var(--accent);font-size:11px">B</span><span class="h2" style="font-size:14px">${esc(saLabel(b))}</span>
    </div>
    <div style="margin-top:14px" class="big acc">${sh.length}</div>
    <div class="sub">shared dimensions, the columns you can put both facts side by side on</div>
    <div class="split">
      <div><b>${onlyA}</b><span>only in A</span></div>
      <div><b>${onlyB}</b><span>only in B</span></div>
    </div>
    <div class="k">Shared, most common first</div>
    <div class="list">${sh.map((c) => `<div class="li" data-col="${c}"><span class="mono">${esc(dimShort(bm.columns[c]))}</span><span class="n">${bm.columnSaCount[c]}</span></div>`).join('')}</div>
    <div class="callout">${dashMark(18)} Both areas carry these dimensions in their lineage. Each fact's join column to them is inferred from that, and the data does not state it.</div>
    <div class="k">Facts in A</div>${fa.map(factBlock).join('') || '<div class="sub">None</div>'}
    <div class="k">Facts in B</div>${fb.map(factBlock).join('') || '<div class="sub">None</div>'}`;
}
function defaultHtml() {
  const top = [...Array(nCols).keys()].slice(0, 8);
  const tail = bm.columnSaCount.filter((n) => n <= 5).length;
  return `
    <div class="k">Reading the matrix</div>
    <p class="p" style="margin-top:0">Each row is a subject area and each column a dimension table that two or more of them share. A filled cell means the area's lineage uses that dimension.</p>
    <ol class="howto">
      <li>Hover a row to see its facts and their grain.</li>
      <li>Hover a column to see how far it reaches.</li>
      <li>Click two rows to find the dimensions they share.</li>
    </ol>
    <div class="k">Widest reach</div>
    <div class="list">${top.map((c) => `<div><div class="li" style="padding-bottom:0"><span class="mono">${esc(dimShort(bm.columns[c]))}</span><span class="n">${bm.columnSaCount[c]}</span></div><div class="meter"><i style="width:${(bm.columnSaCount[c] / C.subjectAreas) * 100}%"></i></div></div>`).join('')}</div>
    <p class="p" style="font-size:12px;margin-top:12px">${tail} of the ${nCols} columns reach five or fewer subject areas. They sit at the right edge.</p>
    <div class="k">Try</div>
    <div class="fact link" id="try1"><div>Sales Order and Customer Invoice</div><div class="g">Compare two Order to Cash areas</div></div>
    <div class="fact link" data-fact="${DEFAULT_FACT}"><div class="mono">DW_NS_SALES_ORDER_LINES_F</div><div class="g">Open a fact page</div></div>`;
}
document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest('#try1');
  if (t) { state.a = findRow('Sales Order'); state.b = findRow('Customer Invoice'); afterPick(); }
});

// ------------------------------------------------------------------ fact page
async function renderFact() {
  const el = document.getElementById('fp')!;
  const t = state.fact;
  const g = grainOf(t);
  const L = links.get(t) ?? { headers: [], children: [] };
  const headers = [...L.headers].sort((x, y) => Number(/SNAPSHOT/.test(T.name[x.other])) - Number(/SNAPSHOT/.test(T.name[y.other])));
  const header = headers[0];
  const twin = twinOf(t);
  const fa = (() => { for (let r = 0; r < nRows; r++) if (bm.facts[r].includes(t)) return FA.name[faOfRow(r)]; return ''; })();

  // subject areas: base and secured twin
  const saRows: { r: number; base: boolean; sec: boolean }[] = [];
  for (let r = 0; r < nRows; r++) {
    const base = bm.facts[r].includes(t), sec = twin !== undefined && bm.facts[r].includes(twin);
    if (base || sec) saRows.push({ r, base, sec });
  }
  const nBase = saRows.filter((s) => s.base).length;
  // dimensions seen with it (usedWith, co-occurrence weight)
  const dims = o.neighbors({ type: 'physicalTable', i: t }, 'usedWith', 'out')
    .map((n) => ({ d: n.ref.i, w: n.weight ?? 0 }))
    .sort((x, y) => y.w - x.w || T.saCount[y.d] - T.saCount[x.d] || String(T.name[x.d]).localeCompare(String(T.name[y.d])));
  const maxW = Math.max(1, ...dims.map((d) => d.w));
  // NetSuite records it loads from
  const recs = o.neighbors({ type: 'physicalTable', i: t }, 'loadedFrom', 'out');
  const recName = (i: number) => String((core.nodes.netsuiteRecord!.cols as any).name[i]);

  const grainHtml = g ? `
      <div class="grain">${esc(grainSentence(t, g))}</div>
      <div class="keyline">
        <span style="color:var(--pencil)">key</span>
        <span class="chips">${keyOrder(g.cols).map((c, i) => (i ? '<span class="plus">+</span>' : '') + `<span class="chip">${esc(c)}</span>`).join('')}</span>
        <span class="prov" style="margin-left:10px">${solidMark()} Stated in Oracle's entity key list as <b style="color:var(--ink);font-weight:500">${esc(g.entity)}</b></span>
      </div>
      ${g.others.length ? `<div class="also">Also keyed as ${g.others.map((x) => `${esc(x.entity)} by ${x.cols.map(esc).join(' + ')}`).join('; ')}.</div>` : ''}`
    : `<div class="grain">Its grain is not in the key list</div><div class="keyline">${dashMark()} The entity key list names no key for this table.</div>`;

  el.innerHTML = `
    <div class="crumb"><a data-go="matrix">Bus matrix</a><span>/</span><span>${esc(fa || 'Fact')}</span><span>/</span><span>Fact table</span></div>
    <div class="fp-head">
      <div>
        <div class="fp-title"><h1>${esc(T.name[t])}</h1><span class="tag">fact</span>${twin !== undefined ? `<span class="tag">secured twin ${esc(String(T.name[twin]).replace(/^DW_NS_/, ''))}</span>` : ''}</div>
        ${grainHtml}
      </div>
      <div class="fp-stats">
        <div><b>${T.columns[t]}</b><span>columns</span></div>
        <div><b>${T.mappedColumns[t]}</b><span>mapped to the semantic model</span></div>
        <div><b>${nBase}</b><span>subject areas</span></div>
        <div><b>${T.presentationTables[t]}</b><span>presentation tables</span></div>
      </div>
    </div>
    <div class="fp-grid">
      <div>
        <div class="sec-h"><h3>Header</h3><span class="prov">${solidMark(18)} stated</span></div>
        <p class="sec-p">${header ? `Each line points to one ${esc(docNoun(header.other))} header through a shared key.` : 'The key list names no header table for it.'}</p>
        ${header ? headerCard(t, header, headers.slice(1)) : ''}
        <div class="card">
          <div class="sec-h"><h3>Loaded from NetSuite</h3></div>
          <div class="list" style="margin-top:6px">${recs.map((n) => `<div class="li"><span class="mono">${esc(recName(n.ref.i))}</span><span class="prov">${n.provenance === 'explicit' ? solidMark(18) + ' stated' : dashMark(18) + ' inferred'}</span></div>`).join('')}</div>
        </div>
        <div class="card" id="colcard">
          <div class="sec-h"><h3>Columns</h3><span class="sub" style="font-size:12px">loading…</span></div>
        </div>
      </div>
      <div>
        <div class="sec-h"><h3>Dimensions seen with it</h3><span class="prov">${dashMark(18)} inferred</span></div>
        <p class="sec-p">${dims.length} dimensions appear in the same subject areas as this fact, ranked by how many of its ${nBase} areas they share. The join columns are not in the data.</p>
        <div class="dimrow hd"><span></span><span>Dimension</span><span>Shared subject areas</span><span></span><span>Reach of ${C.subjectAreas}</span></div>
        <div class="dims-scroll">${dims.map((d, i) => `
          <div class="dimrow">
            <span class="r">${i + 1}</span>
            <span class="mono" title="${esc(T.name[d.d])}">${esc(dimShort(d.d))}</span>
            <div><div class="co" style="width:${(d.w / maxW) * 100}%"></div></div>
            <span class="w">${d.w}/${nBase}</span>
            <div style="display:grid;grid-template-columns:1fr 26px;gap:6px;align-items:center"><div class="reach"><i style="width:${(T.saCount[d.d] / C.subjectAreas) * 100}%"></i></div><span class="r">${T.saCount[d.d]}</span></div>
          </div>`).join('')}</div>
      </div>
      <div>
        <div class="sec-h"><h3>Subject areas</h3><span class="sub" style="font-size:12px">${saRows.length}</span></div>
        <p class="sec-p">Where this fact or its secured twin appears in the lineage.</p>
        ${FA.name.map((fname: string, f: number) => {
          const items = saRows.filter((s) => faOfRow(s.r) === f);
          if (!items.length) return '';
          return `<div class="sa-group"><div class="k">${esc(fname)}</div>${items.map((s) =>
            `<div class="sa" data-sa="${s.r}"><span>${esc(saLabel(s.r))}</span><span class="t">${s.base && s.sec ? 'base + _SEC' : s.base ? 'base' : '_SEC only'}</span></div>`).join('')}</div>`;
        }).join('')}
      </div>
    </div>`;
  el.querySelector('[data-go]')?.addEventListener('click', () => go('matrix'));
  el.querySelectorAll<HTMLElement>('[data-sa]').forEach((n) => n.addEventListener('click', () => { state.a = +n.dataset.sa!; state.b = null; go('matrix'); }));
  el.querySelectorAll<HTMLElement>('[data-fact]').forEach((n) => n.addEventListener('click', () => go('fact', +n.dataset.fact!)));

  await o.ensure('columns');
  renderColumns(t);
}

function headerCard(t: number, h: Link, more: Link[]) {
  const hg = grainOf(h.other);
  const W = 370, bw = 368, bx = 1;
  const hName = String(T.name[h.other]), lName = String(T.name[t]);
  const svg = `<svg width="${W}" height="176" style="display:block;margin:2px auto 0">
    <rect x="${bx}" y="4" width="${bw}" height="46" rx="5" fill="none" stroke="var(--edge)"/>
    <text x="${bx + 12}" y="23" style="font:500 12px var(--mono);fill:var(--ink)">${esc(hName)}</text>
    <text x="${bx + 12}" y="40" style="font:11.5px var(--ui);fill:var(--ink-2)">${hg ? esc(grainSentence(h.other, hg)) : 'grain not stated'} · key <tspan style="font-family:var(--mono)">${h.otherCols.join(' + ')}</tspan></text>
    <line x1="${W / 2}" y1="50" x2="${W / 2}" y2="122" stroke="var(--ink)" stroke-width="1.5"/>
    <line x1="${W / 2 - 6}" y1="56" x2="${W / 2 + 6}" y2="56" stroke="var(--ink)" stroke-width="1.5"/>
    <path d="M${W / 2 - 8} 122 L${W / 2} 112 L${W / 2 + 8} 122" fill="none" stroke="var(--ink)" stroke-width="1.5"/>
    <text x="${W / 2 + 14}" y="76" style="font:11.5px var(--mono);fill:var(--accent)">${esc(h.otherCols[0])} = ${esc(h.hereCols.join(' + '))}</text>
    <text x="${W / 2 + 14}" y="93" style="font:11px var(--ui);fill:var(--ink-2)">one header, many lines</text>
    <text x="${W / 2 - 14}" y="76" text-anchor="end" style="font:11px var(--ui);fill:var(--pencil)">1</text>
    <text x="${W / 2 - 14}" y="116" text-anchor="end" style="font:11px var(--ui);fill:var(--pencil)">many</text>
    <rect x="${bx}" y="122" width="${bw}" height="46" rx="5" fill="none" stroke="var(--accent)"/>
    <text x="${bx + 12}" y="141" style="font:500 12px var(--mono);fill:var(--ink)">${esc(lName)}</text>
    <text x="${bx + 12}" y="158" style="font:11.5px var(--ui);fill:var(--ink-2)">this table · key <tspan style="font-family:var(--mono)">${keyOrder(grainOf(t)?.cols ?? []).join(' + ')}</tspan></text>
  </svg>`;
  return `<div class="card">
    ${svg}
    <p class="sec-p" style="margin:10px 0 0">${solidMark(18)} Both columns carry the key <span class="mono" style="font-size:11.5px;color:var(--ink)">${esc(h.key)}</span> in the entity <b style="font-weight:500;color:var(--ink)">${esc(h.entity)}</b>.</p>
    ${more.length ? `<p class="sec-p" style="margin:6px 0 0">The same key also reaches ${more.map((m) => `<span class="mono" style="font-size:11.5px">${esc(T.name[m.other])}</span>`).join(', ')}.</p>` : ''}
    <p class="sec-p" style="margin:8px 0 0"><span class="open" data-fact="${h.other}">Open the header fact →</span></p>
  </div>`;
}

function renderColumns(t: number) {
  const card = document.getElementById('colcard');
  if (!card) return;
  const NR = core.nodes.netsuiteRecord!.cols as any;
  const cols = o.neighbors({ type: 'physicalTable', i: t }, 'contains', 'out').map((n) => n.ref.i);
  let stated = 0, inferred = 0, none = 0;
  const rows = cols.map((ci) => {
    const c = o.get('physicalColumn', ci);
    const src = o.neighbors({ type: 'physicalColumn', i: ci }, 'sourcedFrom', 'out');
    const keyed = o.neighbors({ type: 'physicalColumn', i: ci }, 'keyedBy', 'in').length > 0;
    const s = src.find((x) => x.provenance === 'explicit') ?? src[0];
    let field = '';
    if (s) { const f = o.get('netsuiteField', s.ref.i); field = `${NR.name[f.record]}.${f.name}`; }
    if (!s) none++; else if (s.provenance === 'explicit') stated++; else inferred++;
    return { name: c.name, keyed, s, field };
  }).sort((x, y) => Number(y.keyed) - Number(x.keyed) || x.name.localeCompare(y.name));
  card.innerHTML = `
    <div class="sec-h"><h3>Columns</h3><span class="sub" style="font-size:12px">${cols.length}</span></div>
    <p class="sec-p">${(() => { const names = new Set(rows.map((r) => r.name.toLowerCase())); const miss = (grainOf(t)?.cols ?? []).filter((k) => !names.has(k)); return miss.length ? `The key list names <span class="mono" style="color:var(--ink)">${miss.map(esc).join(', ')}</span>, which is not among the lineage columns. ` : ''; })()}${stated} trace to a NetSuite field stated in the lineage, ${inferred} by a naming rule${none ? `, ${none} with no source` : ''}.</p>
    ${rows.map((r) => `<div class="colrow">
      <span class="mono">${esc(r.name)}${r.keyed ? '<span class="keytag">key</span>' : ''}</span>
      <span style="color:var(--ink-2)">${r.s ? (r.s.provenance === 'explicit' ? solidMark(30) : dashMark(30)) : ''}</span>
      <span class="mono src" title="${esc(r.field)}">${r.s ? esc(r.field) : '<span class="none">no NetSuite source</span>'}</span>
    </div>`).join('')}`;
}

// ------------------------------------------------------------------ boot
shell();
addEventListener('resize', () => { if (state.view === 'matrix') renderMatrix(); });
await document.fonts.ready;
if (state.view === 'matrix') renderMatrix();
document.body.dataset.ready = '1';
document.title = 'Bus Matrix Console';
