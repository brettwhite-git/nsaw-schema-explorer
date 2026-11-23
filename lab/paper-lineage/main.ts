// Paper lineage: the lineage ledger (mock B) set in the Paper ledger theme. Data and search are copied from lab/explorer-b.
// States live in the URL:  ?q=…   ?table=NAME[&col=COL|&src=rec.field|&rc=Report name]   ?trace=rec.field[&at=TABLE.COL|&sa=Label]
import { loadOntology } from '../../ontology/load';
import type { DetailJson, EdgeGroupJson } from '../../ontology/types';

// ------------------------------------------------------------------ load
let colsJson: DetailJson | undefined;
const fetchJson = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  const j = await r.json();
  if (url.includes('columns')) colsJson = j;
  return j;
};
const onto = await loadOntology({ baseUrl: '/ontology/', fetchJson });
await onto.ensure('columns');
const core = onto.core;
const cj = colsJson!;
const S = cj.strings!;

const PT = core.nodes.physicalTable!.cols;
const SA = core.nodes.subjectArea!.cols;
const FA = core.nodes.functionalArea!.cols;
const PRT = core.nodes.presentationTable!.cols;
const REC = core.nodes.netsuiteRecord!.cols;
const ENT = core.nodes.entity!.cols;
const PC = cj.nodes!.physicalColumn!.cols;
const NF = cj.nodes!.netsuiteField!.cols;
const PRC = cj.nodes!.presentationColumn!.cols;

const nPT = PT.name.length, nPC = PC.table.length, nNF = NF.record.length, nPRC = PRC.pt.length, nSA = SA.name.length;
const pcName = (c: number) => S[PC.name[c]] as string;
const nfName = (f: number) => S[NF.name[f]] as string;
const prcName = (p: number) => S[PRC.name[p]] as string;
const fieldKey = (f: number) => `${REC.key[NF.record[f]]}.${nfName(f).toLowerCase()}`;
const fieldLabel = (f: number) => `${REC.key[NF.record[f]]}.${nfName(f)}`;
const saOfPres = (p: number) => PRT.sa[PRC.pt[p]] as number;
const saLabel = (s: number) => SA.label[s] as string;
const presTable = (p: number) => String(PRT.name[PRC.pt[p]]).trim();

const group = (groups: EdgeGroupJson[], type: string, from: string, to: string) =>
  groups.find((g) => g.type === type && g.from === from && g.to === to)!;

// sa -> functional area
const saFa = new Int16Array(nSA).fill(-1);
{ const g = group(core.edges, 'inFunctionalArea', 'subjectArea', 'functionalArea'); for (let k = 0; k < g.n; k++) saFa[g.pairs[2 * k]] = g.pairs[2 * k + 1]; }

// column -> NetSuite field (sourcedFrom, every link stated in Oracle's files) and back
const colSrc: number[][] = Array.from({ length: nPC }, () => []);
const fieldCols: number[][] = Array.from({ length: nNF }, () => []);
{ const g = group(cj.edges, 'sourcedFrom', 'physicalColumn', 'netsuiteField');
  for (let k = 0; k < g.n; k++) { const c = g.pairs[2 * k], f = g.pairs[2 * k + 1]; colSrc[c].push(f); fieldCols[f].push(c); } }
// presentation column -> physical column (mapsTo, explicit)
const physPres: number[][] = Array.from({ length: nPC }, () => []);
const presPhys: number[][] = Array.from({ length: nPRC }, () => []);
{ const g = group(cj.edges, 'mapsTo', 'presentationColumn', 'physicalColumn');
  for (let k = 0; k < g.n; k++) { const p = g.pairs[2 * k], c = g.pairs[2 * k + 1]; physPres[c].push(p); presPhys[p].push(c); } }

const tableCols: number[][] = Array.from({ length: nPT }, () => []);
for (let c = 0; c < nPC; c++) if (PC.table[c] >= 0) tableCols[PC.table[c]].push(c);
const tableByName = new Map<string, number>(); for (let t = 0; t < nPT; t++) tableByName.set(String(PT.name[t]).toUpperCase(), t);
// a _SEC table and the table of the same name without the suffix (Oracle's naming; the files state no other link)
const unsecuredOf = new Map<number, number>(); const secTwin = new Map<number, number>();
for (let t = 0; t < nPT; t++) if (PT.isSecured[t]) { const b = tableByName.get(String(PT.name[t]).toUpperCase().replace(/_SEC$/, '')); if (b !== undefined) { unsecuredOf.set(t, b); secTwin.set(b, t); } }
const fieldByKey = new Map<string, number>(); for (let f = 0; f < nNF; f++) fieldByKey.set(fieldKey(f), f);

const colSAs = (c: number) => { const s = new Set<number>(); for (const p of physPres[c]) s.add(saOfPres(p)); return s; };
const tableSAs: Set<number>[] = Array.from({ length: nPT }, (_, t) => { const s = new Set<number>(); for (const c of tableCols[t]) for (const p of physPres[c]) s.add(saOfPres(p)); return s; });
const fasOf = (sas: Iterable<number>) => { const s = new Set<number>(); for (const a of sas) if (saFa[a] >= 0) s.add(saFa[a]); return s; };

// ------------------------------------------------------------------ grain (Entity Key List) + header partner
type Grain = 'line' | 'document' | 'book' | 'other';
interface GrainEntry { entity: string; cols: string[]; missing: string[]; grain: Grain }
const grainOf = new Map<number, GrainEntry[]>();
const headerOf = new Map<number, { table: number; col: string; entity: string }>();
const linesOf = new Map<number, number[]>();
for (let e = 0; e < ENT.name.length; e++) {
  const keys = ENT.keys[e] as { k: string; t: string; c: string; ti: number; ci: number }[];
  const byT = new Map<number, typeof keys>();
  for (const k of keys) if (k.ti >= 0) (byT.get(k.ti) ?? byT.set(k.ti, []).get(k.ti)!).push(k);
  const idTables = [...byT].filter(([, ks]) => ks.some((k) => k.c.toLowerCase() === 'id')).map(([t]) => t);
  for (const [t, ks] of byT) {
    const cols = [...new Set(ks.map((k) => k.c.toLowerCase()))].sort();
    if (cols.length === 1 && cols[0] === 'transaction' && idTables.length) {
      const h = idTables.find((x) => x !== t);
      if (h !== undefined) { headerOf.set(t, { table: h, col: ks[0].c, entity: String(ENT.name[e]) }); (linesOf.get(h) ?? linesOf.set(h, []).get(h)!).push(t); }
      continue;
    }
    const grain: Grain = cols.includes('accountingbook') ? 'book' : cols.join('+') === 'id+transaction' ? 'line' : cols.join('+') === 'id' ? 'document' : 'other';
    const missing = [...new Set(ks.filter((k) => k.ci < 0).map((k) => k.c.toLowerCase()))];
    (grainOf.get(t) ?? grainOf.set(t, []).get(t)!).push({ entity: String(ENT.name[e]), cols, missing, grain });
  }
}
const GRAIN_ORDER: Grain[] = ['line', 'document', 'book', 'other'];
const baseOf = (t: number) => unsecuredOf.get(t) ?? t;
const grainsFor = (t: number) => (grainOf.get(t) ?? []).slice().sort((a, b) => GRAIN_ORDER.indexOf(a.grain) - GRAIN_ORDER.indexOf(b.grain));
const primaryGrain = (t: number): Grain | undefined => grainsFor(t)[0]?.grain;
const nounOf = (name: string) => {
  let n = name.replace(/^DW_NS_/i, '');
  for (let i = 0; i < 3; i++) n = n.replace(/_(SEC|F|D|DH|G|EF|CF|SNAPSHOT|LINES|INSIGHTS)$/i, '');
  return n.replace(/_/g, ' ').toLowerCase();
};
const grainSentence = (t: number) => {
  const g = grainsFor(t)[0]; const noun = nounOf(String(PT.name[t]));
  if (!g) return 'The Entity Key List gives no key for this table, so its grain is not stated.';
  const what = g.grain === 'line' ? `One row per ${noun} line.` : g.grain === 'document' ? `One row per ${noun}.` : g.grain === 'book' ? `One row per ${noun} line per accounting book.` : `One row per unique ${g.cols.map((c) => c.toUpperCase()).join(' + ')}.`;
  return what;
};
const GRAIN_LABEL: Record<Grain, string> = { line: 'line', document: 'document', book: 'book line', other: 'keyed' };
const grainLabel = (g: Grain, t: number) => (g === 'document' && PT.role[t] !== 'fact' && PT.role[t] !== 'enhanced' ? 'record' : GRAIN_LABEL[g]);

// ------------------------------------------------------------------ facts we can show (computed, not typed in)
const facts = (() => {
  let presEx = 0, presMulti = 0, dwEx = 0, dwAll = 0, fb = 0, fbGrain = 0;
  const colHasEx = (c: number) => colSrc[c].length > 0;
  for (let p = 0; p < nPRC; p++) { if (presPhys[p].some(colHasEx)) presEx++; if (presPhys[p].length > 1) presMulti++; }
  for (let c = 0; c < nPC; c++) if (PC.table[c] >= 0) { dwAll++; if (colHasEx(c)) dwEx++; }
  const bases = new Set<number>();
  for (let t = 0; t < nPT; t++) if (PT.role[t] === 'fact' && PT.lineageRows[t] > 0) bases.add(baseOf(t));
  for (const t of bases) { fb++; if (grainOf.has(t)) fbGrain++; }
  return { presEx, presMulti, dwEx, dwAll, fb, fbGrain };
})();

// ------------------------------------------------------------------ search index
type Kind = 'area' | 'concept' | 'table' | 'column' | 'report' | 'record' | 'field';
const KIND_LABEL: Record<Kind, string> = { area: 'Subject area', concept: 'Report table', table: 'Warehouse table', column: 'Warehouse col', report: 'Report column', record: 'NetSuite record', field: 'NetSuite field' };
const KIND_TAB: Record<Kind, string> = { table: 'Tables', column: 'Columns', report: 'Report cols', field: 'Fields', record: 'Records', concept: 'Report tables', area: 'Areas' };
const KIND_W: Record<Kind, number> = { area: 18, concept: 15, table: 17, record: 14, field: 9, report: 7, column: 5 };
const IS_ALIAS: Record<string, Kind> = { area: 'area', subject: 'area', sa: 'area', concept: 'concept', reporttable: 'concept', table: 'table', column: 'column', col: 'column', report: 'report', record: 'record', field: 'field', netsuite: 'field' };
interface Item {
  kind: Kind; label: string; ctx: string; norm: string; core?: string; words: string[];
  reach: number; sas: Set<number>; fas: Set<number>; role?: string; grain?: Grain; stated?: boolean; secured?: boolean;
  table?: number; col?: number; field?: number; rec?: number; name?: string; sa?: number;
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const wordsOf = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const items: Item[] = [];
const push = (it: Omit<Item, 'norm' | 'words'>) => items.push({ ...it, norm: norm(it.label), words: wordsOf(it.label) } as Item);

for (let s = 0; s < nSA; s++) push({ kind: 'area', label: saLabel(s), ctx: saFa[s] >= 0 ? String(FA.name[saFa[s]]) : '', reach: SA.presentationColumns[s], sas: new Set([s]), fas: fasOf([s]), sa: s });
{ // report tables: presentation table names in the semantic model, with the subject areas that have each
  const byName = new Map<string, Set<number>>();
  for (let i = 0; i < PRT.sa.length; i++) { const n = String(PRT.name[i]).trim(); (byName.get(n) ?? byName.set(n, new Set()).get(n)!).add(PRT.sa[i]); }
  for (const [n, sas] of byName) push({ kind: 'concept', label: n, ctx: '', reach: sas.size, sas, fas: fasOf(sas) });
}
for (let t = 0; t < nPT; t++) {
  if (!tableCols[t].length) continue;
  const name = String(PT.name[t]);
  push({ kind: 'table', label: name, ctx: '', core: norm(nounOf(name)), reach: tableSAs[t].size, sas: tableSAs[t], fas: fasOf(tableSAs[t]), role: PT.role[t], grain: primaryGrain(t), secured: !!PT.isSecured[t], table: t });
}
const fieldSAs: Set<number>[] = Array.from({ length: nNF }, () => new Set<number>());
for (let f = 0; f < nNF; f++) for (const c of fieldCols[f]) for (const p of physPres[c]) fieldSAs[f].add(saOfPres(p));
for (let c = 0; c < nPC; c++) {
  const t = PC.table[c]; if (t < 0) continue;
  const sas = colSAs(c);
  push({ kind: 'column', label: pcName(c), ctx: String(PT.name[t]), reach: sas.size, sas, fas: fasOf(sas), role: PT.role[t], grain: primaryGrain(t), stated: colSrc[c].length > 0, secured: !!PT.isSecured[t], table: t, col: c });
}
{
  const byName = new Map<string, { sas: Set<number>; tables: Map<string, number>; phys: Map<number, number> }>();
  for (let p = 0; p < nPRC; p++) {
    const n = prcName(p); let e = byName.get(n);
    if (!e) byName.set(n, (e = { sas: new Set(), tables: new Map(), phys: new Map() }));
    e.sas.add(saOfPres(p)); const tn = presTable(p); e.tables.set(tn, (e.tables.get(tn) ?? 0) + 1);
    for (const c of presPhys[p]) e.phys.set(c, (e.phys.get(c) ?? 0) + 1);
  }
  for (const [n, e] of byName) {
    const tops = [...e.tables].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([x]) => x);
    const best = [...e.phys].sort((a, b) => b[1] - a[1])[0]?.[0];
    push({ kind: 'report', label: n, ctx: tops.join(' · ') + (e.tables.size > 2 ? ` +${e.tables.size - 2}` : ''), reach: e.sas.size, sas: e.sas, fas: fasOf(e.sas), name: n, col: best, table: best !== undefined ? PC.table[best] : undefined });
  }
}
const recFields: number[][] = REC.key.map(() => []);
for (let f = 0; f < nNF; f++) recFields[NF.record[f]].push(f);
REC.key.forEach((k: string, r: number) => {
  const sas = new Set<number>(); for (const f of recFields[r]) for (const s of fieldSAs[f]) sas.add(s);
  if (!REC.explicit[r]) return; // only records Oracle's files name
  push({ kind: 'record', label: k, ctx: `${REC.fieldCount[r]} fields`, reach: sas.size, sas, fas: fasOf(sas), rec: r });
});
for (let f = 0; f < nNF; f++) {
  if (!fieldCols[f].length || !NF.explicit[f]) continue;
  push({ kind: 'field', label: fieldLabel(f), ctx: `feeds ${fieldCols[f].length} warehouse column${fieldCols[f].length === 1 ? '' : 's'}`, reach: fieldSAs[f].size, sas: fieldSAs[f], fas: fasOf(fieldSAs[f]), field: f });
}

// ------------------------------------------------------------------ query parsing
interface Chip { k: string; v: string }
const FILTER_KEYS = ['is', 'type', 'grain', 'area', 'in', 'shared'];
function parseQuery(q: string): { text: string; chips: Chip[] } {
  const chips: Chip[] = [];
  const text = q.replace(/\b(\w+):("([^"]*)"|\S+)/g, (m, k: string, raw: string, quoted?: string) => {
    if (!FILTER_KEYS.includes(k.toLowerCase())) return m;
    chips.push({ k: k.toLowerCase(), v: quoted ?? raw }); return ' ';
  }).replace(/\s+/g, ' ').trim();
  return { text, chips };
}
const chipToText = (c: Chip) => `${c.k}:${/\s/.test(c.v) ? `"${c.v}"` : c.v}`;
const buildQuery = (chips: Chip[], text: string) => [...chips.map(chipToText), text].filter(Boolean).join(' ');

function passes(it: Item, c: Chip): boolean {
  const v = c.v.toLowerCase();
  switch (c.k) {
    case 'is': return it.kind === (IS_ALIAS[norm(v)] ?? v);
    case 'type': return !!it.role && it.role.startsWith(v.replace(/s$/, ''));
    case 'grain': return !!it.grain && (it.grain === v || GRAIN_LABEL[it.grain].startsWith(v) || (v === 'header' && it.grain === 'document') || (v === 'record' && it.grain === 'document'));
    case 'area': { for (const f of it.fas) if (String(FA.name[f]).toLowerCase().includes(v)) return true; return false; }
    case 'in': { if (it.sas.size > 400) return true; for (const s of it.sas) if (saLabel(s).toLowerCase().includes(v)) return true; return false; }
    case 'shared': return (v === 'yes' || v === 'true') ? it.reach >= 2 && it.kind !== 'area' : it.reach < 2;
  }
  return true;
}
function matchScore(it: Item, qn: string, qw: string[]): number {
  if (!qn) return 1;
  if (it.norm === qn || it.core === qn) return 100;
  if (it.norm.startsWith(qn) || (it.core && it.core.startsWith(qn))) return 74;
  if (qw.length && it.words.some((w) => w.startsWith(qw[0])) && qw.every((w) => it.norm.includes(w))) return it.norm.includes(qn) ? 58 : 46;
  if (it.norm.includes(qn)) return 38;
  if (qw.length > 1 && qw.every((w) => it.norm.includes(w))) return 24;
  return 0;
}
function search(q: string) {
  const { text, chips } = parseQuery(q);
  const qn = norm(text), qw = wordsOf(text);
  const out: { it: Item; s: number }[] = [];
  for (const it of items) {
    if (!chips.every((c) => passes(it, c))) continue;
    const m = matchScore(it, qn, qw); if (!m) continue;
    const s = m + KIND_W[it.kind] + Math.min(12, Math.log2(1 + it.reach) * 1.8) - (it.secured ? 4 : 0) - (!it.reach && it.kind !== 'record' ? 10 : 0);
    out.push({ it, s });
  }
  out.sort((a, b) => b.s - a.s || b.it.reach - a.it.reach || a.it.label.localeCompare(b.it.label));
  return { text, chips, results: out.map((r) => r.it) };
}

// ------------------------------------------------------------------ helpers
const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
const fmt = (n: number) => n.toLocaleString('en-US');
const plural = (n: number, one: string, many = one + 's') => `${fmt(n)} ${n === 1 ? one : many}`;
const pct = (a: number, b: number) => `${Math.round((a / b) * 100)}%`;
function highlight(label: string, text: string) {
  const qw = wordsOf(text); if (!qw.length) return esc(label);
  const re = new RegExp(qw.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s_.\\-]*'), 'i');
  const m = label.match(re); if (!m || m.index === undefined) return esc(label);
  return esc(label.slice(0, m.index)) + '<mark>' + esc(m[0]) + '</mark>' + esc(label.slice(m.index + m[0].length));
}

// ================================================================== Paper rendering
const mk = (cls = '', w = 20) => `<svg class="mark ${cls}" width="${w}" height="8" viewBox="0 0 ${w} 8" aria-hidden="true"><line x1="0" y1="4" x2="${w}" y2="4"/></svg>`;
const KIND_WORD: Record<Kind, string> = { area: 'subject area', concept: 'report table', table: 'warehouse table', column: 'warehouse column', report: 'report column', record: 'NetSuite record', field: 'NetSuite field' };
const ROLE_LABEL: Record<string, string> = { fact: 'fact', dimension: 'dimension', hierarchy: 'hierarchy', calculated: 'calculated', enhanced: 'enhanced fact', global: 'global', prediction: 'prediction', unknown: 'other' };
const N_TABLES = items.filter((i) => i.kind === 'table').length;
const N_COLS = items.filter((i) => i.kind === 'column').length;
const N_REPORT = new Set(PRC.name).size;
const N_FIELDS = items.filter((i) => i.kind === 'field').length;
const GLASS = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>`;

// ------------------------------------------------------------------ routing
type State = Record<string, string>;
const state = (): State => Object.fromEntries(new URLSearchParams(location.search));
function nav(s: State, replace = false) {
  const qs = new URLSearchParams(Object.entries(s).filter(([, v]) => v !== '' && v !== undefined)).toString();
  history[replace ? 'replaceState' : 'pushState'](null, '', qs ? `?${qs}` : location.pathname);
  render();
}
addEventListener('popstate', () => render());
let lastQuery = '';
const app = document.getElementById('app')!;

function shell(crumbs: string, body: string) {
  app.innerHTML = `<header class="top"><div class="top-in">
      <a class="brand" data-go="home"><svg class="logo" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="2.6" class="logo-dot"/><path d="M9 9 2.5 3.5M9 9l6.5-5.5M9 9 2.5 14.5M9 9l6.5 5.5" class="logo-ray"/></svg><b>NSAW Schema Explorer</b><small>25R4</small></a>
      <button class="search" id="topsearch">${GLASS}<span>Search tables, columns, NetSuite fields</span><kbd>⌘K</kbd></button>
      <span></span>
      <div class="legend" aria-label="How lines are drawn"><span>${mk()}stated in Oracle’s files</span><span>${mk('hot')}selected</span></div>
    </div>
    <nav class="crumbs-row"><div class="crumbs">${crumbs}<span class="keys"><kbd>↑</kbd><kbd>↓</kbd> move <kbd>↵</kbd> open <kbd>⌘K</kbd> search <kbd>esc</kbd> back</span></div></nav>
  </header>
  <main class="page">${body}</main>
  <div class="toast" id="toast" role="status"></div>`;
  app.querySelector<HTMLElement>('[data-go="home"]')!.addEventListener('click', () => nav({}));
  document.getElementById('topsearch')!.addEventListener('click', () => {
    const q = document.getElementById('q') as HTMLInputElement | null;
    if (q) q.focus(); else nav({ q: lastQuery });
  });
}
function toast(msg: string) { const t = document.getElementById('toast')!; t.textContent = msg; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 1600); }
function copyLink() { navigator.clipboard?.writeText(location.href).catch(() => {}); toast('Link copied. It opens this exact view.'); }

// ------------------------------------------------------------------ SEARCH
let selIdx = 0;
let kindTab: Kind | 'all' = 'all';
function openItem(it: Item) {
  switch (it.kind) {
    case 'table': return nav({ table: String(PT.name[it.table!]) });
    case 'column': return nav({ table: String(PT.name[it.table!]), col: pcName(it.col!) });
    case 'report': return it.table !== undefined ? nav({ table: String(PT.name[it.table]), rc: it.name! }) : undefined;
    case 'field': return nav({ trace: fieldKey(it.field!) });
    case 'record': return nav({ q: `is:field ${REC.key[it.rec!]}.` });
    case 'area': return nav({ q: `in:"${saLabel(it.sa!)}" is:table` });
    case 'concept': return nav({ q: `is:report ${it.label}` });
  }
}

function sideColumn() {
  const bus = core.busMatrix;
  const dims = bus.columns.slice(0, 7).map((t, i) => {
    const n = bus.columnSaCount[i];
    return `<button class="dim" data-table="${esc(PT.name[t])}"><span class="mono">${esc(PT.name[t])}</span><span class="n">${n}</span></button>`;
  }).join('');
  return `<aside class="side">
    <section><h3>What the data states</h3><p class="note">Counted from the lineage files when the page loads.</p>
      <div class="facts">
        <div class="fact"><b>${pct(facts.dwEx, facts.dwAll)}</b><span>of warehouse columns have a NetSuite source stated in Oracle’s lineage (${fmt(facts.dwEx)} of ${fmt(facts.dwAll)})</span></div>
        <div class="fact"><b>${pct(facts.presEx, nPRC)}</b><span>of report columns reach a stated NetSuite field (${fmt(facts.presEx)} of ${fmt(nPRC)})</span></div>
        <div class="fact"><b>${fmt(facts.fbGrain)}</b><span>of the ${facts.fb} fact tables in the lineage have a stated grain in the Entity Key List</span></div>
        <div class="fact"><b>${fmt(facts.presMulti)}</b><span>report columns map to more than one warehouse column</span></div>
      </div></section>
    <section><h3>Most shared dimensions</h3><p class="note">How many of the ${nSA} subject areas Oracle’s lineage lists each one under.</p>${dims}</section>
  </aside>`;
}

function resultRow(it: Item, i: number, text: string) {
  const notes: string[] = [];
  if (it.kind === 'table' && it.role) notes.push(esc(ROLE_LABEL[it.role] ?? it.role));
  if (it.kind === 'table' && it.secured) notes.push('secured');
  if (it.stated && it.kind === 'column') notes.push('NetSuite source stated');
  let ctx = esc(it.ctx);
  if (it.kind === 'table') ctx = grainsFor(it.table!).length ? `<span class="gs">${esc(grainSentence(it.table!))}</span>` : `${plural(tableCols[it.table!].length, 'column')}; the Entity Key List gives no key`;
  if (it.kind === 'column') ctx = `in <span class="mono">${esc(it.ctx)}</span>`;
  if (it.kind === 'report') ctx = `in ${esc(it.ctx)}`;
  if (it.kind === 'concept') ctx = 'a report table in the semantic model';
  if (it.kind === 'area') ctx = it.ctx ? esc(it.ctx) : '';
  const reach = it.kind === 'area' ? `<b>${fmt(it.reach)}</b> report columns` : it.reach ? `<b>${fmt(it.reach)}</b> ${it.reach === 1 ? 'area' : 'areas'}` : '<span class="faint">no area</span>';
  const mono = it.kind === 'table' || it.kind === 'column' || it.kind === 'field' || it.kind === 'record';
  return `<li class="res${i === selIdx ? ' sel' : ''}" data-i="${i}">
    <span class="kind">${KIND_WORD[it.kind]}</span>
    <span class="nm"><span class="t ${mono ? 'mono' : it.kind === 'area' || it.kind === 'concept' ? 'serif' : ''}">${highlight(it.label, text)}</span><span class="ctx">${ctx}</span></span>
    <span class="notes">${notes.join('<i>·</i>')}</span>
    <span class="reach">${reach}</span></li>`;
}

function renderHome(s: State) {
  const q = s.q ?? '';
  lastQuery = q;
  const { text, chips, results } = search(q);
  const counts = new Map<Kind, number>(); for (const r of results) counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
  if (kindTab !== 'all' && !counts.get(kindTab)) kindTab = 'all';
  const shown = (kindTab === 'all' ? results : results.filter((r) => r.kind === kindTab)).slice(0, 40);
  if (selIdx >= shown.length) selIdx = 0;
  const hasQuery = !!(text || chips.length);

  const tabs = (['all', 'table', 'column', 'report', 'field', 'record', 'concept', 'area'] as const)
    .filter((k) => k === 'all' || counts.get(k))
    .map((k) => `<button data-tab="${k}" class="${kindTab === k ? 'on' : ''}">${k === 'all' ? 'All' : KIND_TAB[k]} <span>${fmt(k === 'all' ? results.length : counts.get(k)!)}</span></button>`).join('');

  const so = tableByName.get('DW_NS_SALES_ORDER_LINES_F')!;
  const starts = [
    { attr: `data-table="DW_NS_SALES_ORDER_LINES_F"`, kind: 'table ledger', t: 'DW_NS_SALES_ORDER_LINES_F', c: 'Follow one order line from the NetSuite field to the report column.', n: tableSAs[so].size },
    { attr: `data-trace="customer.companyname"`, kind: 'impact trace', t: 'customer.companyname', c: 'Everything downstream of one NetSuite field.', n: fieldSAs[fieldByKey.get('customer.companyname')!].size },
    { attr: `data-trace="transactions.tranid"`, kind: 'impact trace', t: 'transactions.tranid', c: 'The document number, across every transaction table.', n: fieldSAs[fieldByKey.get('transactions.tranid')!].size },
  ].map((x) => `<li class="res" ${x.attr}><span class="kind">${x.kind}</span><span class="nm"><span class="t mono">${x.t}</span><span class="ctx">${x.c}</span></span><span class="notes"></span><span class="reach"><b>${x.n}</b> areas</span></li>`).join('');

  const body = `<div class="grid home">
    <section class="main">
      <p class="lead">Search <b>${fmt(N_TABLES)}</b> warehouse tables, <b>${fmt(N_COLS)}</b> columns, <b>${fmt(N_REPORT)}</b> report column names and <b>${fmt(N_FIELDS)}</b> NetSuite fields.</p>
      <div class="bigbar" id="bar">${GLASS.replace('width="14" height="14"', 'width="20" height="20"')}
        ${chips.map((c, i) => `<span class="chip"><i>${esc(c.k)}</i><span class="mono">${esc(c.v)}</span><button class="x" data-rm="${i}" title="Remove filter" aria-label="Remove ${esc(c.k)} filter">×</button></span>`).join('')}
        <input id="q" autocomplete="off" spellcheck="false" aria-label="Search" placeholder="${chips.length ? 'Add words or filters' : 'customer, sales order, tranid…'}" value="${esc(text)}">
        <kbd>⌘K</kbd>
      </div>
      <div class="suggest"><i>Filters</i>
        ${['grain:line', 'area:"Order to Cash"', 'shared:yes', 'type:fact', 'type:dimension', 'is:field'].map((f) => `<button data-add='${esc(f)}' class="${chips.some((c) => chipToText(c) === f) ? 'on' : ''}">${esc(f)}</button>`).join('')}
      </div>
      ${hasQuery ? `<nav class="tabs">${tabs}</nav>
        <p class="summary">${results.length ? `${plural(results.length, 'entry', 'entries')}. Exact names come first, then tables and subject areas, then columns.` : ''}</p>
        ${shown.length ? `<ul class="results" id="results">${shown.map((it, i) => resultRow(it, i, text)).join('')}</ul>${results.length > shown.length && kindTab === 'all' ? `<p class="summary">Showing the first ${shown.length}. Pick a tab or add a filter to see the rest.</p>` : ''}`
          : `<p class="empty">Nothing matches. Remove a filter or try a shorter word.</p>`}`
      : `<h2 class="sec">Start here</h2>
        <ul class="results starts">${starts}</ul>
        <p class="examples"><i>Or try</i> ${['customer', 'sales order', 'tranid', 'type:dimension shared:yes', 'grain:line area:"Order to Cash"'].map((x) => `<button data-q='${esc(x)}'>${esc(x)}</button>`).join('')}</p>
        <h2 class="sec">How filters read</h2>
        <dl class="filters">
          <dt>grain:line</dt><dd>tables keyed per line; also <span class="mono">document</span> and <span class="mono">book</span></dd>
          <dt>type:fact</dt><dd>warehouse role: fact, dimension, hierarchy</dd>
          <dt>area:"Order to Cash"</dt><dd>reaches a subject area in that functional area</dd>
          <dt>shared:yes</dt><dd>read in two or more subject areas</dd>
          <dt>is:field</dt><dd>one kind only: table, column, report, field, record</dd>
        </dl>`}
    </section>
    ${sideColumn()}
  </div>`;
  shell(hasQuery ? `<a data-go2="home">Index</a><i>/</i><span class="here">Search</span>` : `<span class="here">Index</span>`, body);

  const input = document.getElementById('q') as HTMLInputElement;
  const setQ = (nq: string) => { selIdx = 0; nav({ q: nq }, true); requestAnimationFrame(() => { const i = document.getElementById('q') as HTMLInputElement; i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); };
  input.focus(); input.setSelectionRange(input.value.length, input.value.length);
  let t: number | undefined;
  input.addEventListener('input', () => {
    const v = input.value;
    const m = v.match(/^(.*?)(\b\w+:("[^"]*"|\S+))\s$/);
    if (m && FILTER_KEYS.includes(m[2].split(':')[0].toLowerCase())) return setQ(buildQuery(chips, v.trim()).replace(/\s+/g, ' '));
    clearTimeout(t); t = window.setTimeout(() => setQ(buildQuery(chips, v)), 90);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); selIdx = Math.max(0, Math.min(shown.length - 1, selIdx + (e.key === 'ArrowDown' ? 1 : -1)));
      document.querySelectorAll('#results .res').forEach((el, i) => el.classList.toggle('sel', i === selIdx));
      document.querySelector('#results .res.sel')?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && shown[selIdx]) openItem(shown[selIdx]);
    else if (e.key === 'Backspace' && !input.value && chips.length) setQ(buildQuery(chips.slice(0, -1), ''));
    else if (e.key === 'Escape') { e.stopPropagation(); setQ(''); }
  });
  app.querySelectorAll<HTMLElement>('[data-rm]').forEach((b) => b.addEventListener('click', () => setQ(buildQuery(chips.filter((_, i) => i !== +b.dataset.rm!), text))));
  app.querySelectorAll<HTMLElement>('[data-add]').forEach((b) => b.addEventListener('click', () => {
    const add = parseQuery(b.dataset.add!).chips[0];
    setQ(buildQuery([...chips.filter((c) => c.k !== add.k), add], text));
  }));
  app.querySelectorAll<HTMLElement>('[data-q]').forEach((b) => b.addEventListener('click', () => setQ(b.dataset.q!)));
  app.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => { kindTab = b.dataset.tab as Kind; selIdx = 0; render(); }));
  app.querySelectorAll<HTMLElement>('#results .res').forEach((el) => {
    el.addEventListener('click', () => openItem(shown[+el.dataset.i!]));
    el.addEventListener('mousemove', () => { if (selIdx !== +el.dataset.i!) { selIdx = +el.dataset.i!; document.querySelectorAll('#results .res').forEach((x, i) => x.classList.toggle('sel', i === selIdx)); } });
  });
  wireCommon();
}

// ------------------------------------------------------------------ wires
interface Wire { a: HTMLElement; b: HTMLElement; hot: boolean; cool: boolean }
const wcls = (hot: boolean, cool: boolean) => ['w', hot ? 'hot' : '', cool && !hot ? 'cool' : ''].join(' ');
function drawWires(gut: HTMLElement, wires: Wire[]) {
  const g = gut.getBoundingClientRect(), w = g.width;
  const parts: string[] = [], dots: string[] = [];
  for (const wi of wires.slice().sort((x, y) => +x.hot - +y.hot)) {
    const ra = wi.a.getBoundingClientRect(), rb = wi.b.getBoundingClientRect();
    const y1 = ra.top + ra.height / 2 - g.top, y2 = rb.top + rb.height / 2 - g.top, mx = w / 2;
    parts.push(`<path class="${wcls(wi.hot, wi.cool)}" d="M2,${y1.toFixed(1)} C${mx},${y1.toFixed(1)} ${mx},${y2.toFixed(1)} ${w - 2},${y2.toFixed(1)}"/>`);
    if (wi.hot) dots.push(`<circle class="hotdot" cx="2" cy="${y1.toFixed(1)}" r="2.2"/><circle class="hotdot" cx="${w - 2}" cy="${y2.toFixed(1)}" r="2.2"/>`);
  }
  gut.innerHTML = `<svg class="wires">${parts.join('')}${dots.join('')}</svg>`;
}
// one source fanning to many rows: a short stem, a spine, then a tick per row
function drawComb(gut: HTMLElement, src: HTMLElement, wires: Wire[]) {
  const g = gut.getBoundingClientRect(), w = g.width, rs = src.getBoundingClientRect();
  const yc = Math.min(rs.top + 22, rs.top + rs.height / 2) - g.top, sx = Math.round(w * 0.4);
  const ys = wires.map((wi) => { const r = wi.b.getBoundingClientRect(); return r.top + r.height / 2 - g.top; });
  const any = wires.some((wi) => wi.cool);
  const lo = Math.min(yc, ...ys), hi = Math.max(yc, ...ys);
  const parts = [`<path class="${wcls(false, any)}" d="M0,${yc.toFixed(1)} H${sx} M${sx},${lo.toFixed(1)} V${hi.toFixed(1)}"/>`];
  const hy = ys.filter((_, i) => wires[i].hot);
  if (any && hy.length) parts.push(`<path class="w hot" d="M0,${yc.toFixed(1)} H${sx} M${sx},${Math.min(yc, ...hy).toFixed(1)} V${Math.max(yc, ...hy).toFixed(1)}"/>`);
  wires.map((_, i) => i).sort((a, b) => +wires[a].hot - +wires[b].hot).forEach((i) => {
    const wi = wires[i], y = ys[i], r = Math.min(6, Math.abs(y - yc));
    const d = Math.abs(y - yc) < 1 ? `M${sx},${y.toFixed(1)} H${w - 2}` : `M${sx},${(y - Math.sign(y - yc) * r).toFixed(1)} Q${sx},${y.toFixed(1)} ${sx + r},${y.toFixed(1)} H${w - 2}`;
    parts.push(`<path class="${wcls(wi.hot && any, any)}" d="${d}"/>`);
  });
  parts.push(`<circle class="node" cx="${sx}" cy="${yc.toFixed(1)}" r="2.6"/>`);
  gut.innerHTML = `<svg class="wires">${parts.join('')}</svg>`;
}

// ------------------------------------------------------------------ LEDGER (table page)
function renderLedger(s: State) {
  const t = tableByName.get((s.table ?? '').toUpperCase());
  if (t === undefined) { shell(`<a data-go2="search">Search</a>`, `<div class="grid"><section class="main"><p class="lead">No warehouse table is called <span class="mono">${esc(s.table)}</span>.</p></section></div>`); wireCommon(); return; }
  const name = String(PT.name[t]);
  const grains = grainsFor(t);
  const keyCols = new Set(grains[0]?.cols ?? []);
  const cols = tableCols[t].slice().sort((a, b) => (+keyCols.has(pcName(b).toLowerCase()) - +keyCols.has(pcName(a).toLowerCase())));

  const fields: number[] = []; const fieldIx = new Map<number, number>();
  for (const c of cols) for (const f of colSrc[c]) if (!fieldIx.has(f)) { fieldIx.set(f, fields.length); fields.push(f); }
  const colNames = new Map<number, { name: string; sas: Set<number>; n: number }[]>();
  for (const c of cols) {
    const m = new Map<string, { name: string; sas: Set<number>; n: number }>();
    for (const p of physPres[c]) { const n = prcName(p); const e = m.get(n) ?? m.set(n, { name: n, sas: new Set(), n: 0 }).get(n)!; e.sas.add(saOfPres(p)); e.n++; }
    colNames.set(c, [...m.values()].sort((a, b) => b.sas.size - a.sas.size || a.name.localeCompare(b.name)));
  }
  type R = { col: number; name?: string; sas: Set<number>; more: string[] };
  const right: R[] = []; const nameIx = new Map<string, number>();
  for (const c of cols) {
    const first = colNames.get(c)!.find((e) => !nameIx.has(e.name));
    if (first) nameIx.set(first.name, right.length);
    right.push({ col: c, name: first?.name, sas: new Set(), more: [] });
  }
  for (const c of cols) for (const e of colNames.get(c)!) { const ix = nameIx.get(e.name); if (ix !== undefined) e.sas.forEach((x) => right[ix].sas.add(x)); }
  const ownRow = new Map(cols.map((c, i) => [c, i]));
  const colRight = new Map<number, number[]>();
  for (const c of cols) {
    const ns = colNames.get(c)!; const mine: number[] = []; const own = right[ownRow.get(c)!];
    let cross = 0;
    for (const e of ns) {
      const ix = nameIx.get(e.name);
      if (ix === undefined) own.more.push(e.name);
      else if (ix === ownRow.get(c)) mine.push(ix);
      else if (cross < 1 && !own.name) { mine.push(ix); cross++; }
      else if (cross < 1 && Math.abs(ix - ownRow.get(c)!) <= 6) { mine.push(ix); cross++; }
      else own.more.push(e.name);
    }
    if (own.more.length && !mine.includes(ownRow.get(c)!)) mine.push(ownRow.get(c)!);
    colRight.set(c, mine);
  }
  const nameCols = new Map<string, Set<number>>();
  for (const c of cols) for (const e of colNames.get(c)!) (nameCols.get(e.name) ?? nameCols.set(e.name, new Set()).get(e.name)!).add(c);

  const selCol = s.col ? cols.find((c) => pcName(c).toLowerCase() === s.col.toLowerCase()) : undefined;
  const selField = s.src ? fieldByKey.get(s.src.toLowerCase()) : undefined;
  const selName = s.rc;
  const hotCols = new Set<number>(), hotFields = new Set<number>(), hotNames = new Set<string>();
  const any = selCol !== undefined || selField !== undefined || !!selName;
  if (selCol !== undefined) { hotCols.add(selCol); colSrc[selCol].forEach((f) => hotFields.add(f)); colNames.get(selCol)!.forEach((e) => hotNames.add(e.name)); }
  if (selField !== undefined) { hotFields.add(selField); for (const c of cols) if (colSrc[c].includes(selField)) { hotCols.add(c); colNames.get(c)!.forEach((e) => hotNames.add(e.name)); } }
  if (selName) { hotNames.add(selName); for (const c of nameCols.get(selName) ?? []) { hotCols.add(c); colSrc[c].forEach((f) => hotFields.add(f)); } }
  const hc = (hot: boolean) => (hot ? ' hot' : any ? ' cool' : '');

  const nStated = cols.filter((c) => colSrc[c].length).length;
  const nBlank = cols.length - nStated;
  const nReport = cols.filter((c) => physPres[c].length).length;
  const nPres = cols.reduce((a, c) => a + physPres[c].length, 0);
  const twin = PT.isSecured[t] ? unsecuredOf.get(t) : secTwin.get(t);
  const hdr = headerOf.get(t);
  const sameFlavour = (x: number) => (PT.isSecured[t] ? secTwin.get(x) ?? x : x);
  const lines = linesOf.get(t);
  const g0 = grains[0];
  const ktags = (cs: string[], hot: boolean) => cs.map((c, i) => `${i ? '<span class="plus">+</span>' : ''}<span class="ktag${hot ? ' hot' : ''}">${esc(c)}</span>`).join('');
  const grainHead = g0 ? grainSentence(t) : 'No key for this table in Oracle’s key list.';
  const keyLine = g0 ? `<p class="keyline"><span class="k-lbl">Key</span>${ktags(g0.cols, true)}<span class="src">${mk('', 16)}stated in Oracle’s Entity Key List as <i>${esc(g0.entity)}</i></span></p>`
    : '';
  const also = grains.slice(1).map((g) => `<p class="also"><span class="also-k">Also in the key list</span> <i>${esc(g.entity)}</i> keys it by ${ktags(g.cols, false)}.${g.missing.length ? ` ${g.missing.map((m) => `<span class="mono">${esc(m.toUpperCase())}</span>`).join(', ')} is not a column in this table, so the page leads with the line entry.` : ''}</p>`).join('');
  const partner = hdr ? `Each row points to its header in <a data-table="${esc(PT.name[sameFlavour(hdr.table)])}" class="mono">${esc(PT.name[sameFlavour(hdr.table)])}</a>: <span class="mono">${esc(hdr.col.toUpperCase())}</span> here holds the header’s <span class="mono">ID</span>.`
    : lines?.length ? `Its lines live in ${lines.slice(0, 2).map((l) => `<a data-table="${esc(PT.name[sameFlavour(l)])}" class="mono">${esc(PT.name[sameFlavour(l)])}</a>`).join(' and ')}, which point back through <span class="mono">TRANSACTION</span>.` : '';
  const twinTxt = twin === undefined ? ''
    : PT.isSecured[t] ? ` The <span class="mono">_SEC</span> suffix is Oracle’s name for a secured table. The table of the same name without it is <a data-table="${esc(PT.name[twin])}" class="mono">${esc(PT.name[twin])}</a>.`
    : ` Oracle also ships a secured table of the same name, <a data-table="${esc(PT.name[twin])}" class="mono">${esc(PT.name[twin])}</a>.`;
  const secNote = PT.isSecured[t] && nBlank ? ` Oracle’s lineage names a NetSuite source for ${nStated ? `${nStated} of these ${cols.length} columns` : 'none of these columns'}.${twin !== undefined ? ` The sources it states for the unsecured table are on <a data-table="${esc(PT.name[twin])}">its own page</a> and are not copied here.` : ''}` : '';

  const leftCells = fields.map((f) => `<div class="cell${hc(hotFields.has(f))}" data-f="${f}"><span class="lab mono"><span class="rec">${esc(REC.key[NF.record[f]])}.</span>${esc(nfName(f))}</span></div>`).join('');
  const midCells = cols.map((c) => {
    const isKey = keyCols.has(pcName(c).toLowerCase());
    const isLink = hdr && pcName(c).toLowerCase() === hdr.col.toLowerCase();
    const tags = (isKey ? '<span class="badge key">key</span>' : '') + (isLink ? '<span class="badge">to header</span>' : '');
    const aside = !physPres[c].length ? '<span class="aside">no report column</span>' : !colSrc[c].length && nStated ? '<span class="aside" title="No NetSuite source in Oracle’s lineage">no NetSuite source</span>' : '';
    return `<div class="cell${hc(hotCols.has(c))}" data-c="${c}"><span class="lab mono">${esc(pcName(c))}</span>${tags}${aside}</div>`;
  }).join('');
  const rightCells = right.map((r) => {
    const more = r.more.length ? `<button class="more-n" data-more="${r.col}" title="${esc(r.more.join(', '))}">+ ${r.more.length} more</button>` : '';
    if (!r.name) return `<div class="cell${r.more.length ? '' : ' spacer'}${hc(hotCols.has(r.col) && !!r.more.length)}">${more}</div>`;
    return `<div class="cell${hc(hotNames.has(r.name))}" data-rc="${esc(r.name)}"><span class="lab">${esc(r.name)}</span>${more}<span class="aside">${plural(r.sas.size, 'area')}</span></div>`;
  }).join('');

  // side column
  const saRows = (pres: number[], limit = 12) => {
    const m = new Map<number, Set<string>>();
    for (const p of pres) { const a = saOfPres(p); (m.get(a) ?? m.set(a, new Set()).get(a)!).add(prcName(p)); }
    const arr = [...m].sort((a, b) => saLabel(a[0]).localeCompare(saLabel(b[0])));
    const one = new Set(pres.map(prcName)).size === 1;
    return `<div class="d-list">${arr.slice(0, limit).map(([a, ns]) => `<div class="d-sa"><span>${esc(saLabel(a))}</span>${one ? '' : `<small>${esc([...ns].slice(0, 2).join(' · '))}${ns.size > 2 ? ` · +${ns.size - 2}` : ''}</small>`}</div>`).join('')}${arr.length > limit ? `<div class="d-sa faint"><span>and ${arr.length - limit} more subject areas</span></div>` : ''}</div>`;
  };
  let drawer = '';
  if (selCol !== undefined) {
    const src = colSrc[selCol]; const pres = physPres[selCol]; const names = new Set(pres.map(prcName));
    drawer = `<h3>Selected column</h3><div class="d-name">${esc(pcName(selCol))}</div>
      ${src.length ? src.map((f) => `<div class="d-line"><span class="faint">from</span><span class="mono">${esc(fieldLabel(f))}</span><span class="prov">${mk('', 16)}stated</span></div>`).join('') : '<div class="d-line faint">No NetSuite source in Oracle’s lineage.</div>'}
      ${src.length ? `<button class="linkbtn" data-trace="${esc(fieldKey(src[0]))}">Trace <span class="mono">${esc(fieldLabel(src[0]))}</span> everywhere →</button>` : ''}
      <p class="d-sum">${pres.length ? `${plural(pres.length, 'report column')}${names.size === 1 ? ` named <b>${esc([...names][0])}</b>,` : ''} in ${plural(colSAs(selCol).size, 'subject area')}.` : 'No report column reads it.'}</p>
      ${pres.length ? saRows(pres) : ''}`;
  } else if (selField !== undefined) {
    const cs = cols.filter((c) => colSrc[c].includes(selField));
    drawer = `<h3>Selected field</h3><div class="d-name">${esc(fieldLabel(selField))}</div>
      <p class="d-sum">Feeds ${cs.map((c) => `<span class="mono">${esc(pcName(c))}</span>`).join(', ')} in this table. Across the warehouse it feeds ${plural(fieldCols[selField].length, 'column')} in ${plural(fieldSAs[selField].size, 'subject area')}.</p>
      <button class="linkbtn" data-trace="${esc(fieldKey(selField))}">Trace it downstream →</button>`;
  } else if (selName) {
    const pres: number[] = []; for (const c of nameCols.get(selName) ?? []) for (const p of physPres[c]) if (prcName(p) === selName) pres.push(p);
    drawer = `<h3>Selected report column</h3><div class="d-name serif">${esc(selName)}</div>
      <p class="d-sum">Reads ${[...(nameCols.get(selName) ?? [])].map((c) => `<span class="mono">${esc(pcName(c))}</span>`).join(', ')} here, in ${plural(new Set(pres.map(saOfPres)).size, 'subject area')}.</p>${saRows(pres)}`;
  } else {
    const cnt = new Map<number, number>(); for (const c of cols) for (const p of physPres[c]) cnt.set(saOfPres(p), (cnt.get(saOfPres(p)) ?? 0) + 1);
    const sas = [...tableSAs[t]].sort((a, b) => (cnt.get(b) ?? 0) - (cnt.get(a) ?? 0));
    drawer = `<h3>Where it is read</h3><p class="d-sum">${plural(sas.length, 'subject area')} through ${plural(nPres, 'report column')}. Pick any row in the ledger to light its path.</p>
      <div class="d-list">${sas.slice(0, 14).map((a) => `<div class="d-sa row"><span>${esc(saLabel(a))}</span><small>${cnt.get(a) ?? 0}</small></div>`).join('')}</div>`;
  }

  const body = `<div class="grid">
    <section class="head-main">
      <div class="eyebrow"><span class="tag">${esc(ROLE_LABEL[PT.role[t]] ?? PT.role[t])}${PT.isSecured[t] ? ', secured' : ''}</span><h2 class="tname">${esc(name)}</h2></div>
      <h1 class="grain">${esc(grainHead)}</h1>
      ${keyLine}${also}
      <p class="sub">${partner}${twinTxt}${secNote}</p>
    </section>
    <aside class="head-aside reading">
      <div class="r-h">Reading the lines</div>
      <p>${mk('', 22)}<span><b>Stated in Oracle’s files.</b> Every line on this page: the lineage or the Entity Key List names the link.</span></p>
      <p>${mk('hot', 22)}<span><b>Selected.</b> One path from NetSuite to the reports.</span></p>
      <div class="actions">${twin !== undefined ? `<button class="btn" data-table="${esc(PT.name[twin])}">Open ${esc(PT.name[twin])}</button>` : ''}<button class="btn" id="copy">Copy link</button></div>
    </aside>
    <div class="stats">
      <div class="stat"><b>${cols.length}</b><span>columns</span></div>
      <div class="stat"><b>${nStated}</b><span>with a stated NetSuite source</span></div>
      <div class="stat"><b>${nBlank}</b><span>with no NetSuite source in Oracle’s lineage</span></div>
      <div class="stat"><b>${nReport}</b><span>reach a report column</span></div>
      <div class="stat"><b>${fmt(nPres)}</b><span>report columns</span></div>
      <div class="stat"><b>${tableSAs[t].size}</b><span>subject areas read it</span></div>
    </div>
    <div class="rule"></div>
    <section class="ledp">
      <div class="sec-h"><h2>Column ledger</h2><span class="prov">${mk()}stated in Oracle’s files</span><span class="prov">${mk('hot')}selected</span></div>
      <p class="sec-p">Every column of this table, from the NetSuite field it is loaded from to the report columns that read it. ${nStated === cols.length ? `Oracle’s lineage names a NetSuite source for all ${cols.length} columns.` : nStated ? `Oracle’s lineage names a NetSuite source for ${nStated} of the ${cols.length} columns. The rest have no source in the lineage and stay blank on the left.` : `Oracle’s lineage names no NetSuite source for any of them, so the left side is empty.`}</p>
      <div class="ledger">
        <div class="lhead"><div>NetSuite source field</div><div></div><div>Warehouse column</div><div></div><div>Report column, by name</div></div>
        <div class="lbody">
          <div class="lcol" id="L">${leftCells || '<div class="cell spacer"><span class="lab faint">No NetSuite source in Oracle’s lineage</span></div>'}</div>
          <div class="gut" id="G1"></div>
          <div class="lcol" id="Mc">${midCells}</div>
          <div class="gut" id="G2"></div>
          <div class="lcol" id="R">${rightCells || '<div class="cell spacer"><span class="lab faint">No report column reads this table</span></div>'}</div>
        </div>
      </div>
    </section>
    <aside class="drawer">${drawer}</aside>
    <p class="foot">Built from the NSAW 25R4 lineage (${fmt(core.meta.ingest.csvRows)} rows) and Oracle’s Entity Key List. Every link drawn is stated in those files.</p>
  </div>`;
  shell(`<a data-go2="search">Search</a><i>/</i><span>Table ledger</span><i>/</i><span class="here mono">${esc(name)}</span>`, body);

  const L = document.getElementById('L')!, Mc = document.getElementById('Mc')!, Rr = document.getElementById('R')!;
  const draw = () => {
    const w1: Wire[] = [], w2: Wire[] = [];
    cols.forEach((c, mi) => {
      const mEl = Mc.children[mi] as HTMLElement;
      for (const f of colSrc[c]) w1.push({ a: L.children[fieldIx.get(f)!] as HTMLElement, b: mEl, hot: hotFields.has(f) && hotCols.has(c), cool: any });
      for (const ri of colRight.get(c)!) {
        const r = right[ri]; const hot = hotCols.has(c) && (!r.name || hotNames.has(r.name) || r.col === c);
        w2.push({ a: mEl, b: Rr.children[ri] as HTMLElement, hot, cool: any });
      }
    });
    drawWires(document.getElementById('G1')!, w1); drawWires(document.getElementById('G2')!, w2);
  };
  draw(); window.onresize = draw; document.fonts?.ready.then(draw);
  if (firstPaint && any) { const h = Mc.querySelector<HTMLElement>('.cell.hot'); if (h && h.getBoundingClientRect().bottom > innerHeight - 40) scrollTo(0, scrollY + h.getBoundingClientRect().top - innerHeight / 2); }

  const keep = { table: name };
  const toggle = (k: 'col' | 'src' | 'rc', v: string) => nav(s[k] === v ? keep : { ...keep, [k]: v }, true);
  L.querySelectorAll<HTMLElement>('[data-f]').forEach((el) => el.addEventListener('click', () => toggle('src', fieldKey(+el.dataset.f!))));
  Mc.querySelectorAll<HTMLElement>('[data-c]').forEach((el) => el.addEventListener('click', () => toggle('col', pcName(+el.dataset.c!))));
  Rr.querySelectorAll<HTMLElement>('[data-rc]').forEach((el) => el.addEventListener('click', () => toggle('rc', el.dataset.rc!)));
  Rr.querySelectorAll<HTMLElement>('[data-more]').forEach((el) => el.addEventListener('click', (e) => { e.stopPropagation(); toggle('col', pcName(+el.dataset.more!)); }));
  wireCommon();
}

// ------------------------------------------------------------------ TRACE (impact)
const SAMPLE_TRACES = ['customer.companyname', 'transactions.tranid', 'transactions.entity', 'currency.name', 'transactionline.memo'];
function renderTrace(s: State) {
  const f = fieldByKey.get((s.trace ?? '').toLowerCase());
  if (f === undefined) { shell(`<a data-go2="search">Search</a>`, `<div class="grid"><section class="main"><p class="lead">No NetSuite field is called <span class="mono">${esc(s.trace)}</span>.</p></section></div>`); wireCommon(); return; }
  const links = fieldCols[f].slice();
  const colPres = (c: number) => physPres[c];
  const presAll = new Set<number>(); const saAll = new Map<number, Set<number>>();
  for (const c of links) for (const p of colPres(c)) { presAll.add(p); const a = saOfPres(p); (saAll.get(a) ?? saAll.set(a, new Set()).get(a)!).add(c); }
  const roleOrder = ['fact', 'enhanced', 'calculated', 'dimension', 'hierarchy', 'global', 'prediction', 'unknown'];
  links.sort((a, b) => roleOrder.indexOf(PT.role[PC.table[a]]) - roleOrder.indexOf(PT.role[PC.table[b]]) || colPres(b).length - colPres(a).length || String(PT.name[PC.table[a]]).localeCompare(String(PT.name[PC.table[b]])));
  const fasUsed = fasOf(saAll.keys());

  const at = s.at ? links.find((c) => `${PT.name[PC.table[c]]}.${pcName(c)}`.toLowerCase() === s.at.toLowerCase()) : undefined;
  const selSa = s.sa ? [...saAll.keys()].find((a) => saLabel(a).toLowerCase() === s.sa.toLowerCase()) : undefined;
  const hotCols = new Set<number>(); const hotSas = new Set<number>();
  if (at !== undefined) { hotCols.add(at); for (const p of colPres(at)) hotSas.add(saOfPres(p)); }
  if (selSa !== undefined) { hotSas.add(selSa); for (const c of saAll.get(selSa)!) hotCols.add(c); }
  const any = at !== undefined || selSa !== undefined;
  const hc = (hot: boolean) => (hot ? ' hot' : any ? ' cool' : '');

  let lastRole = '';
  const mid = links.map((c) => {
    const t = PC.table[c]; const role = PT.role[t];
    const n = links.filter((x) => PT.role[PC.table[x]] === role).length;
    const head = role !== lastRole ? `<div class="grp"><span>${esc(ROLE_LABEL[role] ?? role)} tables</span><span>${plural(n, 'column')}</span></div>` : ''; lastRole = role;
    const k = colPres(c).length;
    return `${head}<div class="cell${hc(hotCols.has(c))}" data-c="${c}"><span class="lab mono">${esc(PT.name[t])}<span class="rec">.${esc(pcName(c))}</span></span><span class="n">${k || '<span class="faint">none</span>'}</span></div>`;
  }).join('');
  const faKey = (a: number) => saFa[a];
  const saSorted = [...saAll.keys()].sort((a, b) => (faKey(a) - faKey(b)) || saLabel(a).localeCompare(saLabel(b)));
  const saCount = new Map<number, number>(); for (const p of presAll) saCount.set(saOfPres(p), (saCount.get(saOfPres(p)) ?? 0) + 1);
  const faSize = new Map<number, number>(); for (const a of saSorted) faSize.set(faKey(a), (faSize.get(faKey(a)) ?? 0) + 1);
  let lastFa = -2;
  const rightHtml = saSorted.map((a) => {
    const head = faKey(a) !== lastFa ? `<div class="grp" data-fa="${faKey(a)}"><span>${esc(faKey(a) >= 0 ? FA.name[faKey(a)] : 'Other')}</span><span>${plural(faSize.get(faKey(a))!, 'area')}</span></div>` : ''; lastFa = faKey(a);
    return `${head}<div class="cell${hc(hotSas.has(a))}" data-sa="${a}" data-fa="${faKey(a)}"><span class="lab">${esc(saLabel(a))}</span><span class="n">${saCount.get(a)}</span></div>`;
  }).join('');

  const namesOf = (pres: Iterable<number>) => { const m = new Map<string, Set<number>>(); for (const p of pres) { const n = prcName(p); (m.get(n) ?? m.set(n, new Set()).get(n)!).add(saOfPres(p)); } return [...m].sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0])); };
  const nameRows = (ns: [string, Set<number>][], limit: number) => `<div class="d-list">${ns.slice(0, limit).map(([n, a]) => `<div class="d-sa row"><span>${esc(n)}</span><small>${a.size}</small></div>`).join('')}${ns.length > limit ? `<div class="d-sa faint"><span>and ${ns.length - limit} more names</span></div>` : ''}</div>`;
  let drawer: string;
  if (at !== undefined) {
    drawer = `<h3>Selected column</h3><div class="d-name">${esc(PT.name[PC.table[at]])}<br><span class="faint">.${esc(pcName(at))}</span></div>
      <p class="d-sum">${plural(colPres(at).length, 'report column')} in ${plural(colSAs(at).size, 'subject area')}. Names, with the number of subject areas using each:</p>
      ${nameRows(namesOf(colPres(at)), 16)}
      <button class="linkbtn" data-table="${esc(PT.name[PC.table[at]])}" data-col="${esc(pcName(at))}">Open it in the table ledger →</button>`;
  } else if (selSa !== undefined) {
    const pres = [...presAll].filter((p) => saOfPres(p) === selSa);
    drawer = `<h3>Selected subject area</h3><div class="d-name serif">${esc(saLabel(selSa))}</div>
      <p class="d-sum">${plural(pres.length, 'report column')} read ${plural(saAll.get(selSa)!.size, 'warehouse column')} fed by this field.</p>
      <div class="d-list">${pres.slice(0, 18).map((p) => `<div class="d-sa"><span>${esc(prcName(p))}</span><small>${esc(presTable(p))}</small></div>`).join('')}</div>`;
  } else {
    const ns = namesOf(presAll);
    drawer = `<h3>Report columns, by name</h3><p class="d-sum">${plural(presAll.size, 'report column')} under ${plural(ns.length, 'distinct name')}. The number is how many subject areas use each name.</p>
      ${nameRows(ns, 22)}<p class="d-sum faint">Pick a warehouse column or a subject area to light its path.</p>`;
  }

  const fl = esc(fieldLabel(f));
  const wc = plural(links.length, 'warehouse column');
  const sentence = presAll.size
    ? `<span class="mono">${fl}</span> feeds ${wc}, ${plural(presAll.size, 'report column')} in ${plural(saAll.size, 'subject area')}.`
    : `<span class="mono">${fl}</span> feeds ${wc}. No report column reads ${links.length === 1 ? 'it' : 'them'}.`;
  const provLine = links.length === 1 ? 'Oracle’s lineage states the one link from NetSuite.' : `Oracle’s lineage states all ${fmt(links.length)} links from NetSuite.`;
  const body = `<div class="grid">
    <section class="head-main">
      <div class="eyebrow"><span class="tag">impact trace</span><span class="prov">${mk('', 16)}field named in Oracle’s lineage</span></div>
      <h1 class="grain trace-h">${sentence}</h1>
      <p class="sub">${provLine}${saAll.size ? ` The subject areas fall in ${fasUsed.size} of ${FA.name.length} functional areas.` : ''}</p>
      <p class="tries"><i>Trace another</i>${SAMPLE_TRACES.filter((k) => fieldByKey.has(k)).map((k) => `<button data-trace="${k}" class="${k === fieldKey(f) ? 'on' : ''}">${k}</button>`).join('')}</p>
    </section>
    <aside class="head-aside reading">
      <div class="r-h">Reading the fan</div>
      <p>${mk('', 22)}<span>Each warehouse column the field feeds, then one bundle per functional area, splitting to its subject areas.</span></p>
      <p>${mk('hot', 22)}<span><b>Selected.</b> Click a column or a subject area.</span></p>
      <div class="actions"><button class="btn" id="copy">Copy link</button></div>
    </aside>
    <div class="rule"></div>
    <section class="ledp">
      <div class="ledger trace">
        <div class="lhead"><div>NetSuite field</div><div></div><div>Warehouse columns <span class="cnt">${links.length}</span><span class="r">report cols</span></div><div></div><div>Subject areas <span class="cnt">${saAll.size}</span><span class="r">report cols</span></div></div>
        <div class="lbody">
          <div class="lcol" id="L"><div class="srcnode" id="src"><div class="mono">${fl}</div><p>NetSuite record <span class="mono">${esc(REC.key[NF.record[f]])}</span></p><p>${plural(links.length, 'stated link')}</p></div></div>
          <div class="gut" id="G1"></div>
          <div class="lcol" id="Mc">${mid}</div>
          <div class="gut" id="G2"></div>
          <div class="lcol" id="R">${rightHtml || '<div class="cell spacer"><span class="lab faint">No subject area</span></div>'}</div>
        </div>
      </div>
    </section>
    <aside class="drawer">${drawer}</aside>
    <p class="foot">Every link on this page is stated in Oracle’s semantic model lineage: the NetSuite field each warehouse column is loaded from, and the report columns and subject areas that read it.</p>
  </div>`;
  shell(`<a data-go2="search">Search</a><i>/</i><span>Impact trace</span><i>/</i><span class="here mono">${fl}</span>`, body);

  const Mc = document.getElementById('Mc')!, Rr = document.getElementById('R')!, src = document.getElementById('src')!;
  const midEl = new Map<number, HTMLElement>(); Mc.querySelectorAll<HTMLElement>('[data-c]').forEach((el) => midEl.set(+el.dataset.c!, el));
  const saEl = new Map<number, HTMLElement>(); Rr.querySelectorAll<HTMLElement>('[data-sa]').forEach((el) => saEl.set(+el.dataset.sa!, el));
  // (column, functional area) pairs: one curve each into the area's bundle
  const pair = new Map<string, { c: number; fa: number; sas: number[] }>();
  for (const [a, cs] of saAll) for (const c of cs) { const k = `${c}|${faKey(a)}`; (pair.get(k) ?? pair.set(k, { c, fa: faKey(a), sas: [] }).get(k)!).sas.push(a); }
  const draw = () => {
    drawComb(document.getElementById('G1')!, src, links.map((c) => ({ a: src, b: midEl.get(c)!, hot: hotCols.has(c), cool: any })));
    const gut = document.getElementById('G2')!, g = gut.getBoundingClientRect(), w = g.width, sx = w - 18;
    const yOf = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2 - g.top; };
    const groups = new Map<number, number[]>(); for (const a of saSorted) (groups.get(faKey(a)) ?? groups.set(faKey(a), []).get(faKey(a))!).push(a);
    const entry = new Map<number, number>();
    const spines: string[] = [], curves: string[] = [], hotParts: string[] = [];
    for (const [fa, sas] of groups) {
      const ys = sas.map((a) => yOf(saEl.get(a)!)); const hi = Math.max(...ys);
      const head = Rr.querySelector<HTMLElement>(`.grp[data-fa="${fa}"]`)!;
      const hr = head.getBoundingClientRect(); const ey = hr.bottom - 9 - g.top; const lo = ey; entry.set(fa, ey);
      spines.push(`<path class="w spine${any ? ' cool' : ''}" d="M${sx},${lo.toFixed(1)} V${hi.toFixed(1)} M${sx},${ey.toFixed(1)} H${w}"/>`);
      sas.forEach((a, i) => { const y = ys[i]; const hot = hotSas.has(a) && any; (hot ? hotParts : spines).push(`<path class="w${hot ? ' hot' : any ? ' cool' : ''}" d="M${sx},${y.toFixed(1)} H${w - 2}"/>`); });
      spines.push(`<circle class="node" cx="${sx}" cy="${ey.toFixed(1)}" r="2.4"/>`);
    }
    for (const p of pair.values()) {
      const y1 = yOf(midEl.get(p.c)!), y2 = entry.get(p.fa)!;
      const hotSasHere = any ? p.sas.filter((a) => hotSas.has(a) && hotCols.has(p.c)) : [];
      const hot = hotSasHere.length > 0 && (at === undefined || p.c === at) && (selSa === undefined || p.sas.includes(selSa));
      const d = `M2,${y1.toFixed(1)} C${(sx * 0.55).toFixed(1)},${y1.toFixed(1)} ${(sx * 0.45).toFixed(1)},${y2.toFixed(1)} ${sx},${y2.toFixed(1)}`;
      if (hot) {
        hotParts.push(`<path class="w hot" d="${d}"/>`);
        const ys = hotSasHere.filter((a) => selSa === undefined || a === selSa).map((a) => yOf(saEl.get(a)!));
        if (ys.length) hotParts.push(`<path class="w hot" d="M${sx},${Math.min(y2, ...ys).toFixed(1)} V${Math.max(y2, ...ys).toFixed(1)}"/>`);
      } else curves.push(`<path class="w fan${pair.size <= 16 ? ' few' : ''}${any ? ' cool' : ''}" d="${d}"/>`);
    }
    gut.innerHTML = `<svg class="wires">${curves.join('')}${spines.join('')}${hotParts.join('')}</svg>`;
  };
  draw(); window.onresize = draw; document.fonts?.ready.then(draw);
  const keep = { trace: fieldKey(f) };
  Mc.querySelectorAll<HTMLElement>('[data-c]').forEach((el) => el.addEventListener('click', () => { const c = +el.dataset.c!; const v = `${PT.name[PC.table[c]]}.${pcName(c)}`; nav(s.at === v ? keep : { ...keep, at: v }, true); }));
  Rr.querySelectorAll<HTMLElement>('[data-sa]').forEach((el) => el.addEventListener('click', () => { const v = saLabel(+el.dataset.sa!); nav(s.sa === v ? keep : { ...keep, sa: v }, true); }));
  wireCommon();
}

function wireCommon() {
  document.getElementById('copy')?.addEventListener('click', copyLink);
  app.querySelectorAll<HTMLElement>('[data-table]').forEach((el) => el.addEventListener('click', () => nav(el.dataset.col ? { table: el.dataset.table!, col: el.dataset.col } : { table: el.dataset.table! })));
  app.querySelectorAll<HTMLElement>('[data-trace]').forEach((el) => el.addEventListener('click', () => nav({ trace: el.dataset.trace! })));
  app.querySelectorAll<HTMLElement>('[data-go2]').forEach((el) => el.addEventListener('click', () => nav(el.dataset.go2 === 'home' ? {} : { q: lastQuery })));
}

// ------------------------------------------------------------------ global keys + render
addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    const s = state();
    if (s.table || s.trace) nav({ q: lastQuery }); else (document.getElementById('q') as HTMLInputElement | null)?.focus();
  } else if (e.key === 'Escape') {
    const s = state();
    if (s.col || s.src || s.rc) nav({ table: s.table }, true);
    else if (s.at || s.sa) nav({ trace: s.trace }, true);
    else if (s.table || s.trace) nav({ q: lastQuery });
  } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
    e.preventDefault(); const s = state(); if (s.table || s.trace) nav({ q: lastQuery }); else (document.getElementById('q') as HTMLInputElement | null)?.focus();
  }
});

let firstPaint = true;
function render() {
  const s = state();
  const y = scrollY;
  const key = s.table ?? s.trace ?? '#home';
  const samePage = (render as any).last === key;
  if (s.trace) renderTrace(s);
  else if (s.table) renderLedger(s);
  else renderHome(s);
  if (samePage && (s.table || s.trace)) scrollTo(0, y); else if (!firstPaint) scrollTo(0, 0);
  (render as any).last = key;
  firstPaint = false;
  document.title = s.trace ? `Trace ${s.trace} · NSAW Schema Explorer` : s.table ? `${s.table} · NSAW Schema Explorer` : 'Index · NSAW Schema Explorer';
  document.body.dataset.ready = '1';
}
render();
