// Lab B: "Lineage ledger". Search-first, keyboard-first explorer over the real ontology.
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
const CON = core.nodes.concept!.cols;
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
const presTable = (p: number) => CON.name[PRT.concept[PRC.pt[p]]] as string;

const group = (groups: EdgeGroupJson[], type: string, from: string, to: string) =>
  groups.find((g) => g.type === type && g.from === from && g.to === to)!;
const isInferred = (g: EdgeGroupJson, k: number) =>
  g.provenance === 'mixed' ? core.meta.provenanceCodes[g.prov![k]] !== 'explicit' : g.provenance !== 'explicit';

// sa -> functional area
const saFa = new Int16Array(nSA).fill(-1);
{ const g = group(core.edges, 'inFunctionalArea', 'subjectArea', 'functionalArea'); for (let k = 0; k < g.n; k++) saFa[g.pairs[2 * k]] = g.pairs[2 * k + 1]; }

// column -> NetSuite field (sourcedFrom) and back
const colSrc: [number, boolean][][] = Array.from({ length: nPC }, () => []);
const fieldCols: [number, boolean][][] = Array.from({ length: nNF }, () => []);
{ const g = group(cj.edges, 'sourcedFrom', 'physicalColumn', 'netsuiteField');
  for (let k = 0; k < g.n; k++) { const c = g.pairs[2 * k], f = g.pairs[2 * k + 1], inf = isInferred(g, k); colSrc[c].push([f, inf]); fieldCols[f].push([c, inf]); } }
// presentation column -> physical column (mapsTo, explicit)
const physPres: number[][] = Array.from({ length: nPC }, () => []);
const presPhys: number[][] = Array.from({ length: nPRC }, () => []);
{ const g = group(cj.edges, 'mapsTo', 'presentationColumn', 'physicalColumn');
  for (let k = 0; k < g.n; k++) { const p = g.pairs[2 * k], c = g.pairs[2 * k + 1]; physPres[c].push(p); presPhys[p].push(c); } }

const tableCols: number[][] = Array.from({ length: nPT }, () => []);
for (let c = 0; c < nPC; c++) if (PC.table[c] >= 0) tableCols[PC.table[c]].push(c);
const tableByName = new Map<string, number>(); for (let t = 0; t < nPT; t++) tableByName.set(String(PT.name[t]).toUpperCase(), t);
const secTwin = new Map<number, number>(); for (let t = 0; t < nPT; t++) if (PT.isSecured[t] && PT.baseTable[t] >= 0) secTwin.set(PT.baseTable[t], t);
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
const baseOf = (t: number) => (PT.isSecured[t] && PT.baseTable[t] >= 0 ? PT.baseTable[t] as number : t);
const grainsFor = (t: number) => (grainOf.get(t) ?? grainOf.get(baseOf(t)) ?? []).slice().sort((a, b) => GRAIN_ORDER.indexOf(a.grain) - GRAIN_ORDER.indexOf(b.grain));
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
  const colHasEx = (c: number) => colSrc[c].some(([, inf]) => !inf);
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
  reach: number; sas: Set<number>; fas: Set<number>; role?: string; grain?: Grain; prov?: 'stated' | 'guess'; secured?: boolean;
  table?: number; col?: number; field?: number; rec?: number; name?: string; sa?: number;
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const wordsOf = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const items: Item[] = [];
const push = (it: Omit<Item, 'norm' | 'words'>) => items.push({ ...it, norm: norm(it.label), words: wordsOf(it.label) } as Item);

for (let s = 0; s < nSA; s++) push({ kind: 'area', label: saLabel(s), ctx: saFa[s] >= 0 ? String(FA.name[saFa[s]]) : '', reach: SA.presentationColumns[s], sas: new Set([s]), fas: fasOf([s]), sa: s });
{
  const conSas: Set<number>[] = CON.name.map(() => new Set<number>());
  for (let i = 0; i < PRT.sa.length; i++) conSas[PRT.concept[i]].add(PRT.sa[i]);
  CON.name.forEach((n: string, i: number) => push({ kind: 'concept', label: n, ctx: '', reach: conSas[i].size, sas: conSas[i], fas: fasOf(conSas[i]) }));
}
for (let t = 0; t < nPT; t++) {
  if (!tableCols[t].length) continue;
  const name = String(PT.name[t]);
  push({ kind: 'table', label: name, ctx: '', core: norm(nounOf(name)), reach: tableSAs[t].size, sas: tableSAs[t], fas: fasOf(tableSAs[t]), role: PT.role[t], grain: primaryGrain(t), secured: !!PT.isSecured[t], table: t });
}
const fieldSAs: Set<number>[] = Array.from({ length: nNF }, () => new Set<number>());
for (let f = 0; f < nNF; f++) for (const [c] of fieldCols[f]) for (const p of physPres[c]) fieldSAs[f].add(saOfPres(p));
for (let c = 0; c < nPC; c++) {
  const t = PC.table[c]; if (t < 0) continue;
  const sas = colSAs(c);
  const prov = colSrc[c].length ? (colSrc[c].some(([, i]) => !i) ? 'stated' : 'guess') : undefined;
  push({ kind: 'column', label: pcName(c), ctx: String(PT.name[t]), reach: sas.size, sas, fas: fasOf(sas), role: PT.role[t], grain: primaryGrain(t), prov, secured: !!PT.isSecured[t], table: t, col: c });
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
  push({ kind: 'record', label: k, ctx: `${REC.fieldCount[r]} fields${REC.explicit[r] ? '' : ' · name guessed'}`, reach: sas.size, sas, fas: fasOf(sas), prov: REC.explicit[r] ? 'stated' : 'guess', rec: r });
});
for (let f = 0; f < nNF; f++) {
  if (!fieldCols[f].length) continue;
  push({ kind: 'field', label: fieldLabel(f), ctx: `feeds ${fieldCols[f].length} warehouse column${fieldCols[f].length === 1 ? '' : 's'}`, reach: fieldSAs[f].size, sas: fieldSAs[f], fas: fasOf(fieldSAs[f]), prov: NF.explicit[f] ? 'stated' : 'guess', field: f });
}

// ------------------------------------------------------------------ query parsing
interface Chip { k: string; v: string }
const FILTER_KEYS = ['is', 'type', 'grain', 'area', 'in', 'shared', 'source'];
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
    case 'source': return !!it.prov && (it.prov === v || (v === 'guessed' && it.prov === 'guess') || (v === 'explicit' && it.prov === 'stated'));
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
const ICON: Record<Kind, string> = {
  area: '<rect x="2.5" y="2.5" width="11" height="11" rx="2"/><path d="M2.5 6.5h11M6.5 6.5v7"/>',
  concept: '<rect x="2.5" y="3" width="11" height="10" rx="1.5"/><path d="M2.5 6.5h11M2.5 9.8h11"/>',
  table: '<ellipse cx="8" cy="4" rx="5" ry="1.8"/><path d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4M3 8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8"/>',
  column: '<rect x="5.5" y="2.5" width="5" height="11" rx="1"/><path d="M5.5 6h5M5.5 9.5h5"/>',
  report: '<path d="M3 13V3M3 13h10"/><path d="M6 10.5V8M9 10.5V5.5M12 10.5V7"/>',
  record: '<path d="M4 2.5h5.5L12 5v8.5H4z"/><path d="M9.5 2.5V5H12"/>',
  field: '<path d="M4 2.5h5.5L12 5v8.5H4z"/><circle cx="8" cy="9.3" r="1.6"/>',
};
const icon = (k: Kind) => `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;
const ROLE_LABEL: Record<string, string> = { fact: 'fact', dimension: 'dimension', hierarchy: 'hierarchy', calculated: 'calculated', enhanced: 'enhanced fact', global: 'global', prediction: 'prediction', unknown: 'other' };

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
const BRAND = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="3.5" cy="4" r="1.8"/><circle cx="9" cy="9" r="1.8"/><circle cx="14.5" cy="5" r="1.8"/><circle cx="14.5" cy="14" r="1.8"/><path d="M5.2 4.8 7.4 8M10.7 8.3l2.2-2.4M10.6 10l2.4 3" /></svg>`;

function shell(crumbs: string, body: string, opts: { mini?: boolean } = {}) {
  app.innerHTML = `<div class="shell">
    <header class="top">
      <div class="brand" data-go="home">${BRAND}Lineage ledger<small>NSAW 25R4</small></div>
      <div class="crumbs">${crumbs}</div>
      <div class="spacer"></div>
      <div class="legend"><span><i></i>stated in data</span><span><i class="dash"></i>name guess</span><span><i class="acc"></i>selected path</span></div>
      ${opts.mini ? `<div class="mini" data-go="search"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg><span>Search tables, columns, fields</span><kbd>⌘K</kbd></div>` : ''}
    </header>
    <main id="main">${body}</main>
    <footer class="status"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>⌘K</kbd> search</span><span><kbd>esc</kbd> back</span>
      <span class="right">${fmt(core.meta.ingest.csvRows)} lineage rows · ${fmt(core.meta.counts.explicitSourceEdges)} stated and ${fmt(core.meta.counts.inferredSourceEdges)} guessed NetSuite links</span></footer>
  </div><div class="toast" id="toast"></div>`;
  app.querySelectorAll<HTMLElement>('[data-go]').forEach((el) => el.addEventListener('click', () => {
    if (el.dataset.go === 'home') nav({});
    else nav({ q: lastQuery });
  }));
}
function toast(msg: string) { const t = document.getElementById('toast')!; t.textContent = msg; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 1400); }
function copyLink() { navigator.clipboard?.writeText(location.href).catch(() => {}); toast('Link copied. It opens this exact view.'); }

// ------------------------------------------------------------------ HOME
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

function renderHome(s: State) {
  const q = s.q ?? '';
  lastQuery = q;
  const { text, chips, results } = search(q);
  const counts = new Map<Kind, number>(); for (const r of results) counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
  const shown = (kindTab === 'all' ? results : results.filter((r) => r.kind === kindTab)).slice(0, 60);
  if (selIdx >= shown.length) selIdx = 0;
  const hasQuery = !!(text || chips.length);

  const bus = core.busMatrix;
  const shared = bus.columns.slice(0, 7).map((t, i) => ({ t, n: bus.columnSaCount[i], derived: bus.columnDerived[i] }));
  const dims = shared.map((d) => `<div class="dimrow" data-table="${esc(PT.name[d.t])}"><span class="mono">${esc(PT.name[d.t])}</span><span class="meter"><b style="width:${(d.n / nSA) * 100}%"></b></span><span class="n">${d.n}</span></div>`).join('');

  const rows = shown.map((it, i) => {
    const badges: string[] = [];
    if (it.role && it.kind === 'table') badges.push(`<span class="badge solid">${esc(ROLE_LABEL[it.role] ?? it.role)}</span>`);
    if (it.grain && it.kind === 'table') badges.push(`<span class="badge">${grainLabel(it.grain, it.table!)}</span>`);
    if (it.secured && it.kind === 'table') badges.push(`<span class="badge">secured</span>`);
    if (it.prov === 'guess' && (it.kind === 'field' || it.kind === 'column' || it.kind === 'record')) badges.push(`<span class="badge guess">name guess</span>`);
    if (it.prov === 'stated' && it.kind === 'column') badges.push(`<span class="badge">stated source</span>`);
    let ctx = it.ctx;
    if (it.kind === 'table') ctx = grainsFor(it.table!).length ? grainSentence(it.table!).replace(/\.$/, '') : `${plural(tableCols[it.table!].length, 'column')}`;
    if (it.kind === 'concept') ctx = 'presentation table';
    const reach = it.kind === 'area' ? `${fmt(it.reach)} report cols` : it.reach ? plural(it.reach, 'subject area') : '<span class="faint">no subject area</span>';
    const mono = it.kind === 'table' || it.kind === 'column' || it.kind === 'field' || it.kind === 'record';
    return `<li class="res${i === selIdx ? ' sel' : ''}" data-i="${i}">
      <span class="kind">${icon(it.kind)}${KIND_LABEL[it.kind]}</span>
      <span class="name"><span class="t ${mono ? 'mono' : ''}">${highlight(it.label, text)}</span><span class="ctx ${it.kind === 'column' ? 'mono' : ''}">${esc(ctx)}</span></span>
      <span class="badges">${badges.join('')}</span>
      <span class="reach">${reach}</span></li>`;
  }).join('');

  const tabs = (['all', 'table', 'column', 'report', 'field', 'record', 'concept', 'area'] as const)
    .filter((k) => k === 'all' || counts.get(k))
    .map((k) => `<button data-tab="${k}" class="${kindTab === k ? 'on' : ''}">${k === 'all' ? 'All' : KIND_TAB[k]}<b>${fmt(k === 'all' ? results.length : counts.get(k)!)}</b></button>`).join('');

  const body = `<div class="home">
    <div class="bar-wrap">
      <p class="hello">Search <b>${fmt(items.filter((i) => i.kind === 'table').length)}</b> warehouse tables, <b>${fmt(items.filter((i) => i.kind === 'column').length)}</b> columns, <b>${fmt(new Set(PRC.name).size)}</b> report column names and <b>${fmt(items.filter((i) => i.kind === 'field').length)}</b> NetSuite fields. Add typed filters to narrow it down.</p>
      <div class="bar" id="bar">
        <svg class="glass" width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>
        ${chips.map((c, i) => `<span class="chip"><span class="k">${esc(c.k)}</span><span class="v">${esc(c.v)}</span><button class="x" data-rm="${i}" title="Remove filter">×</button></span>`).join('')}
        <input id="q" autocomplete="off" spellcheck="false" placeholder="${chips.length ? 'Add words or filters' : 'Try customer, sales order, tranid…'}" value="${esc(text)}">
        <kbd>⌘K</kbd>
      </div>
      <div class="suggest">Filters
        ${['grain:line', 'area:"Order to Cash"', 'shared:yes', 'type:fact', 'type:dimension', 'source:guess', 'is:field'].map((f) => `<button data-add='${esc(f)}'>${esc(f)}</button>`).join('')}
      </div>
    </div>
    <section>
      ${hasQuery ? `<div class="tabs">${tabs}</div>
        <p class="summary">${results.length ? `${plural(results.length, 'match', 'matches')}, ranked: exact names first, then tables and subject areas above columns.` : ''}</p>
        ${shown.length ? `<ul class="results" id="results">${rows}</ul>` : `<div class="empty">Nothing matches. Remove a filter or try a shorter word.</div>`}`
      : `<div class="empty"><p style="margin:0 0 12px;color:var(--ink)">Start with a word, a table name or a NetSuite field.</p>
          <ul class="results" style="margin:0 -12px 22px">
            <li class="res" data-table="DW_NS_SALES_ORDER_LINES_F"><span class="kind">${icon('table')}Ledger</span><span class="name"><span class="t mono">DW_NS_SALES_ORDER_LINES_F</span><span class="ctx">Follow one order line from NetSuite to reports</span></span><span class="badges"></span><span class="reach">${plural(tableSAs[tableByName.get('DW_NS_SALES_ORDER_LINES_F')!].size, 'subject area')}</span></li>
            <li class="res" data-trace="customer.companyname"><span class="kind">${icon('field')}Impact trace</span><span class="name"><span class="t mono">customer.companyname</span><span class="ctx">Everything downstream of one NetSuite field</span></span><span class="badges"></span><span class="reach">${plural(fieldSAs[fieldByKey.get('customer.companyname')!].size, 'subject area')}</span></li>
            <li class="res" data-trace="transactions.tranid"><span class="kind">${icon('field')}Impact trace</span><span class="name"><span class="t mono">transactions.tranid</span><span class="ctx">The document number, across every transaction table</span></span><span class="badges"></span><span class="reach">${plural(fieldSAs[fieldByKey.get('transactions.tranid')!].size, 'subject area')}</span></li>
          </ul>
          <div class="suggest" style="margin:0">Examples ${['customer', 'sales order', 'tranid', 'type:dimension shared:yes', 'grain:line area:"Order to Cash"'].map((x) => `<button data-q='${esc(x)}'>${esc(x)}</button>`).join('')}</div></div>`}
    </section>
    <aside class="side">
      <div class="panel"><h3>Most shared dimensions</h3><p class="note">Subject areas that list each one, out of ${nSA}. Listed together, not a checked join.</p>${dims}</div>
      <div class="panel"><h3>What the data states</h3><p class="note">Counted from the ontology on load.</p><div class="facts">
        <div class="fact"><b>${pct(facts.presEx, nPRC)}</b><span>of report columns trace to a NetSuite field the data names</span></div>
        <div class="fact"><b>${pct(facts.dwEx, facts.dwAll)}</b><span>of warehouse columns have a stated NetSuite source</span></div>
        <div class="fact"><b>${fmt(facts.fbGrain)}</b><span>of ${facts.fb} fact tables in the lineage have a key in the Entity Key List</span></div>
        <div class="fact"><b>${fmt(facts.presMulti)}</b><span>report columns map to more than one warehouse column</span></div></div></div>
      <div class="panel"><h3>Typed filters</h3><p class="note">Type them or click one.</p><div class="filters">
        <code data-add="grain:line">grain:line</code><span>line, document, book</span>
        <code data-add="type:fact">type:fact</code><span>fact, dimension, hierarchy</span>
        <code data-add='area:"Order to Cash"'>area:</code><span>functional area</span>
        <code data-add='in:"Sales Orders"'>in:</code><span>subject area name</span>
        <code data-add="shared:yes">shared:yes</code><span>in two or more subject areas</span>
        <code data-add="source:guess">source:</code><span>stated or guess</span>
        <code data-add="is:table">is:</code><span>table, column, report, field</span></div></div>
    </aside></div>`;
  shell(hasQuery ? `<span class="sep">/</span><span class="here">Search</span>` : '', body);

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
      document.querySelectorAll('.res').forEach((el, i) => el.classList.toggle('sel', i === selIdx));
      document.querySelector('.res.sel')?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && shown[selIdx]) openItem(shown[selIdx]);
    else if (e.key === 'Backspace' && !input.value && chips.length) setQ(buildQuery(chips.slice(0, -1), ''));
    else if (e.key === 'Escape') setQ('');
  });
  app.querySelectorAll<HTMLElement>('[data-rm]').forEach((b) => b.addEventListener('click', () => setQ(buildQuery(chips.filter((_, i) => i !== +b.dataset.rm!), text))));
  app.querySelectorAll<HTMLElement>('[data-add]').forEach((b) => b.addEventListener('click', () => {
    const add = parseQuery(b.dataset.add!).chips[0];
    setQ(buildQuery([...chips.filter((c) => c.k !== add.k), add], text));
  }));
  app.querySelectorAll<HTMLElement>('[data-q]').forEach((b) => b.addEventListener('click', () => setQ(b.dataset.q!)));
  app.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => { kindTab = b.dataset.tab as Kind; selIdx = 0; render(); }));
  app.querySelectorAll<HTMLElement>('.res').forEach((el) => {
    el.addEventListener('click', () => openItem(shown[+el.dataset.i!]));
    el.addEventListener('mousemove', () => { if (selIdx !== +el.dataset.i!) { selIdx = +el.dataset.i!; document.querySelectorAll('.res').forEach((x, i) => x.classList.toggle('sel', i === selIdx)); } });
  });
  app.querySelectorAll<HTMLElement>('[data-table]').forEach((el) => el.addEventListener('click', () => nav({ table: el.dataset.table! })));
  app.querySelectorAll<HTMLElement>('[data-trace]').forEach((el) => el.addEventListener('click', () => nav({ trace: el.dataset.trace! })));
}

// ------------------------------------------------------------------ wires (DAG as list)
interface Wire { a: HTMLElement; b: HTMLElement; inf: boolean; hot: boolean; cool: boolean }
function drawComb(gut: HTMLElement, src: HTMLElement, wires: Wire[]) {
  const g = gut.getBoundingClientRect(), w = g.width, rs = src.getBoundingClientRect();
  const x1 = rs.right - g.left, yc = rs.top + rs.height / 2 - g.top, sx = Math.round(w * 0.42);
  const ys = wires.map((wi) => { const r = wi.b.getBoundingClientRect(); return r.top + r.height / 2 - g.top; });
  const any = wires.some((wi) => wi.cool);
  const lo = Math.min(yc, ...ys), hi = Math.max(yc, ...ys);
  const parts = [`<path class="${any ? 'cool' : 'hot'}" d="M${x1.toFixed(1)},${yc.toFixed(1)} H${sx} M${sx},${lo.toFixed(1)} V${hi.toFixed(1)}"/>`];
  const hy = ys.filter((_, i) => wires[i].hot);
  if (any && hy.length) parts.push(`<path class="hot" d="M${x1.toFixed(1)},${yc.toFixed(1)} H${sx} M${sx},${Math.min(yc, ...hy).toFixed(1)} V${Math.max(yc, ...hy).toFixed(1)}"/>`);
  const order = wires.map((wi, i) => i).sort((a, b) => +wires[a].hot - +wires[b].hot);
  for (const i of order) {
    const wi = wires[i], y = ys[i], r = Math.min(7, Math.abs(y - yc));
    const d = Math.abs(y - yc) < 1 ? `M${sx},${y.toFixed(1)} H${w}` : `M${sx},${(y - Math.sign(y - yc) * r).toFixed(1)} Q${sx},${y.toFixed(1)} ${sx + r},${y.toFixed(1)} H${w}`;
    parts.push(`<path class="${[wi.inf ? 'inf' : '', wi.hot ? 'hot' : '', wi.cool && !wi.hot ? 'cool' : ''].join(' ')}" d="${d}"/>`);
    if (wi.hot) parts.push(`<circle class="hot" cx="${w - 1.5}" cy="${y.toFixed(1)}" r="2"/>`);
  }
  parts.push(`<circle class="${any ? '' : 'hot'}" cx="${sx}" cy="${yc.toFixed(1)}" r="2.6"/>`);
  gut.innerHTML = `<svg class="wires">${parts.join('')}</svg>`;
}
function drawWires(gut: HTMLElement, wires: Wire[], anchorA?: 'right') {
  const g = gut.getBoundingClientRect();
  const w = g.width;
  const parts: string[] = []; const dots: string[] = [];
  const ordered = wires.slice().sort((x, y) => +x.hot - +y.hot);
  for (const wi of ordered) {
    const ra = wi.a.getBoundingClientRect(), rb = wi.b.getBoundingClientRect();
    const y1 = ra.top + ra.height / 2 - g.top, y2 = rb.top + rb.height / 2 - g.top;
    const x1 = anchorA === 'right' ? ra.right - g.left : 0;
    const cls = [wi.inf ? 'inf' : '', wi.hot ? 'hot' : '', wi.cool && !wi.hot ? 'cool' : ''].join(' ');
    const mx = (x1 + w) / 2;
    parts.push(`<path class="${cls}" d="M${x1.toFixed(1)},${y1.toFixed(1)} C${mx.toFixed(1)},${y1.toFixed(1)} ${mx.toFixed(1)},${y2.toFixed(1)} ${w.toFixed(1)},${y2.toFixed(1)}"/>`);
    if (wi.hot) dots.push(`<circle class="hot" cx="${w - 1.5}" cy="${y2.toFixed(1)}" r="2"/>`);
  }
  gut.innerHTML = `<svg class="wires">${parts.join('')}${dots.join('')}</svg>`;
}

// ------------------------------------------------------------------ LEDGER (table page)
function renderLedger(s: State) {
  const t = tableByName.get((s.table ?? '').toUpperCase());
  if (t === undefined) { shell('', `<div class="page"><p class="lede">No warehouse table is called <span class="mono">${esc(s.table)}</span>.</p></div>`, { mini: true }); return; }
  const name = String(PT.name[t]);
  const grains = grainsFor(t);
  const keyCols = new Set(grains[0]?.cols ?? []);
  const cols = tableCols[t].slice().sort((a, b) => (+keyCols.has(pcName(b).toLowerCase()) - +keyCols.has(pcName(a).toLowerCase())));

  // left: NetSuite fields; right: report column names (grouped across subject areas)
  const fields: number[] = []; const fieldIx = new Map<number, number>();
  for (const c of cols) for (const [f] of colSrc[c]) if (!fieldIx.has(f)) { fieldIx.set(f, fields.length); fields.push(f); }
  // one report row per warehouse row (so most lines run straight); a name already placed higher up gets a cross line instead
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
    // the column's own row, plus at most one cross line to a name placed elsewhere; the rest folds into "+ N more"
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
  // names hidden behind "+ more" still belong to their column
  const nameCols = new Map<string, Set<number>>();
  for (const c of cols) for (const e of colNames.get(c)!) (nameCols.get(e.name) ?? nameCols.set(e.name, new Set()).get(e.name)!).add(c);

  // selection
  const selCol = s.col ? cols.find((c) => pcName(c).toLowerCase() === s.col.toLowerCase()) : undefined;
  const selField = s.src ? fieldByKey.get(s.src.toLowerCase()) : undefined;
  const selName = s.rc;
  let hotCols = new Set<number>(), hotFields = new Set<number>(), hotNames = new Set<string>();
  const any = selCol !== undefined || selField !== undefined || !!selName;
  if (selCol !== undefined) { hotCols.add(selCol); colSrc[selCol].forEach(([f]) => hotFields.add(f)); colNames.get(selCol)!.forEach((e) => hotNames.add(e.name)); }
  if (selField !== undefined) { hotFields.add(selField); for (const c of cols) if (colSrc[c].some(([f]) => f === selField)) { hotCols.add(c); colNames.get(c)!.forEach((e) => hotNames.add(e.name)); } }
  if (selName) { hotNames.add(selName); for (const c of nameCols.get(selName) ?? []) { hotCols.add(c); colSrc[c].forEach(([f]) => hotFields.add(f)); } }
  const hc = (hot: boolean) => (hot ? ' hot' : any ? ' cool' : '');

  // header text
  const nStated = cols.filter((c) => colSrc[c].some(([, i]) => !i)).length;
  const nGuess = cols.filter((c) => colSrc[c].length && colSrc[c].every(([, i]) => i)).length;
  const nReport = cols.filter((c) => physPres[c].length).length;
  const nPres = cols.reduce((a, c) => a + physPres[c].length, 0);
  const twin = PT.isSecured[t] ? (PT.baseTable[t] >= 0 ? PT.baseTable[t] as number : undefined) : secTwin.get(t);
  const hdr = headerOf.get(t) ?? headerOf.get(baseOf(t));
  const sameFlavour = (x: number) => (PT.isSecured[t] ? secTwin.get(x) ?? x : x);
  const lines = linesOf.get(t) ?? linesOf.get(baseOf(t));
  const g0 = grains[0];
  const keySentence = g0 ? `Key${g0.cols.length > 1 ? 's' : ''} ${g0.cols.map((c) => `<span class="mono">${esc(c.toUpperCase())}</span>`).join(' + ')}, from the Entity Key List entry <i>${esc(g0.entity)}</i>${PT.isSecured[t] && !grainOf.has(t) ? ', listed for the unsecured table' : ''}.` : '';
  const extra = grains.slice(1).map((g) => ` A second entry, <i>${esc(g.entity)}</i>, keys it by ${g.cols.map((c) => `<span class="mono">${esc(c.toUpperCase())}</span>`).join(' + ')}${g.missing.length ? `; ${g.missing.map((m) => `<span class="mono">${esc(m.toUpperCase())}</span>`).join(', ')} is not a column here` : ''}.`).join('');
  const partner = hdr ? `The header partner is <a data-table="${esc(PT.name[sameFlavour(hdr.table)])}" class="mono">${esc(PT.name[sameFlavour(hdr.table)])}</a>: <span class="mono">${esc(hdr.col.toUpperCase())}</span> here holds the header's <span class="mono">ID</span> (Entity Key List, <i>${esc(hdr.entity)}</i>).`
    : lines?.length ? `Its lines live in ${lines.slice(0, 2).map((l) => `<a data-table="${esc(PT.name[sameFlavour(l)])}" class="mono">${esc(PT.name[sameFlavour(l)])}</a>`).join(' and ')}, which point back through <span class="mono">TRANSACTION</span>.` : '';

  // cells
  const leftCells = fields.map((f) => {
    const guess = cols.some((c) => colSrc[c].some(([ff, inf]) => ff === f && inf));
    const rec = REC.key[NF.record[f]];
    return `<div class="cell${hc(hotFields.has(f))}" data-f="${f}"><span class="lab mono"><span class="rec">${esc(rec)}.</span>${esc(nfName(f))}</span>${guess ? '<span class="badge guess aside">guess</span>' : ''}</div>`;
  }).join('');
  const midCells = cols.map((c) => {
    const isKey = keyCols.has(pcName(c).toLowerCase());
    const isLink = hdr && pcName(c).toLowerCase() === hdr.col.toLowerCase();
    const tag = isKey ? '<span class="badge key">key</span>' : '';
    const asideTxt = !physPres[c].length ? '<span class="aside">no report column</span>' : !colSrc[c].length ? '<span class="aside">no NetSuite source</span>' : isLink && !isKey ? '<span class="aside">links header</span>' : '';
    return `<div class="cell${hc(hotCols.has(c))}" data-c="${c}"><span class="lab mono">${esc(pcName(c))}</span>${tag}${asideTxt}</div>`;
  }).join('');
  const rightCells = right.map((r) => {
    const more = r.more.length ? `<span class="badge more-n" data-more="${r.col}" title="${esc(r.more.join(', '))}">+ ${r.more.length} more</span>` : '';
    if (!r.name) return `<div class="cell${r.more.length ? ' more' : ' spacer'}${hc(hotCols.has(r.col) && !!r.more.length)}" data-more="${r.col}">${r.more.length ? `<span class="lab">${more}</span>` : ''}</div>`;
    return `<div class="cell${hc(hotNames.has(r.name) || (hotCols.has(r.col) && !!r.more.length && hotNames.has(r.name)))}" data-rc="${esc(r.name)}"><span class="lab">${esc(r.name)}</span>${more}<span class="aside">${plural(r.sas.size, 'area')}</span></div>`;
  }).join('');

  // drawer
  let drawer = '';
  const saList = (pres: number[], limit = 9) => {
    const m = new Map<number, Set<string>>();
    for (const p of pres) { const a = saOfPres(p); (m.get(a) ?? m.set(a, new Set()).get(a)!).add(prcName(p)); }
    const arr = [...m].sort((a, b) => saLabel(a[0]).localeCompare(saLabel(b[0])));
    return `<div class="salist">${arr.slice(0, limit).map(([a, ns]) => `<div class="sa2"><div>${esc(saLabel(a))}</div><div class="c">${esc([...ns].slice(0, 3).join(' · '))}${ns.size > 3 ? ` · +${ns.size - 3} more` : ''}</div></div>`).join('')}${arr.length > limit ? `<div class="sa faint"><span>and ${arr.length - limit} more subject areas</span></div>` : ''}</div>`;
  };
  if (selCol !== undefined) {
    const src = colSrc[selCol];
    drawer = `<section><h4>Warehouse column</h4><div class="big">${esc(pcName(selCol))}</div>
      ${src.length ? src.map(([f, inf]) => `<div class="line"><span class="faint">from</span><span class="mono">${esc(fieldLabel(f))}</span><span class="badge ${inf ? 'guess' : ''}">${inf ? 'name guess' : 'stated'}</span></div>`).join('') : '<div class="line faint">No NetSuite source in the data.</div>'}
      ${src.length && src.every(([, i]) => i) ? '<p>The data gives no source for this column. The field name is guessed from the column name and may not exist in NetSuite.</p>' : ''}
      ${src.length ? `<button class="btn" data-trace="${esc(fieldKey(src[0][0]))}">Trace ${esc(fieldLabel(src[0][0]))} everywhere</button>` : ''}</section>
      <section><h4>Report columns</h4><div class="line">${plural(physPres[selCol].length, 'report column')} in ${plural(colSAs(selCol).size, 'subject area')}</div>${physPres[selCol].length ? saList(physPres[selCol]) : ''}</section>`;
  } else if (selField !== undefined) {
    const cs = cols.filter((c) => colSrc[c].some(([f]) => f === selField));
    drawer = `<section><h4>NetSuite field</h4><div class="big">${esc(fieldLabel(selField))}</div>
      <div class="line">Feeds ${cs.map((c) => `<span class="mono">${esc(pcName(c))}</span>`).join(', ')} in this table.</div>
      <div class="line faint">Across the warehouse: ${plural(fieldCols[selField].length, 'column')}, ${plural(fieldSAs[selField].size, 'subject area')}.</div>
      <button class="btn" data-trace="${esc(fieldKey(selField))}">Trace downstream</button></section>`;
  } else if (selName) {
    const pres: number[] = []; for (const c of nameCols.get(selName) ?? []) for (const p of physPres[c]) if (prcName(p) === selName) pres.push(p);
    drawer = `<section><h4>Report column</h4><div class="big" style="font-family:var(--ui)">${esc(selName)}</div>
      <div class="line">Reads ${[...(nameCols.get(selName) ?? [])].map((c) => `<span class="mono">${esc(pcName(c))}</span>`).join(', ')} here.</div>${saList(pres)}</section>`;
  } else {
    const sas = [...tableSAs[t]].map((a) => ({ a, n: 0 }));
    const cnt = new Map<number, number>(); for (const c of cols) for (const p of physPres[c]) cnt.set(saOfPres(p), (cnt.get(saOfPres(p)) ?? 0) + 1);
    sas.forEach((x) => (x.n = cnt.get(x.a) ?? 0)); sas.sort((a, b) => b.n - a.n);
    drawer = `<section><h4>Reaches</h4><div class="line">${plural(sas.length, 'subject area')} through ${plural(nPres, 'report column')}</div>
      <div class="salist">${sas.slice(0, 16).map((x) => `<div class="sa"><span>${esc(saLabel(x.a))}</span><span class="c num">${x.n}</span></div>`).join('')}</div></section>
      <section><h4>Pick a row</h4><p>Click any field, column or report column to light its path. The link updates so you can share it.</p></section>`;
  }

  const body = `<div class="page">
    <div class="head"><div>
      <div class="eyebrow">${icon('table')} Warehouse table <span class="badge solid">${esc(ROLE_LABEL[PT.role[t]] ?? PT.role[t])}</span>${g0 ? `<span class="badge">grain: ${grainLabel(g0.grain, t)}</span>` : ''}${PT.isSecured[t] ? '<span class="badge">secured</span>' : ''}</div>
      <h1 class="title">${esc(name)}</h1>
      <p class="lede">${grainSentence(t)} ${keySentence}${extra}</p>
      <p class="sub">${partner}${twin !== undefined ? ` ${PT.isSecured[t] ? 'This is the secured twin of' : 'Its secured twin is'} <a data-table="${esc(PT.name[twin])}" class="mono">${esc(PT.name[twin])}</a> (matched by name).` : ''}</p>
    </div><div class="actions">${twin !== undefined ? `<button class="btn" data-table="${esc(PT.name[twin])}">Open ${PT.isSecured[t] ? 'base table' : 'secured twin'}</button>` : ''}<button class="btn" id="copy">Copy link</button></div></div>
    <div class="stats">
      <div class="stat"><b>${cols.length}</b><span>columns</span></div>
      <div class="stat"><b>${nStated}</b><span>stated NetSuite source</span></div>
      <div class="stat"><b>${nGuess}</b><span>source is a name guess</span></div>
      <div class="stat"><b>${nReport}</b><span>reach a report column</span></div>
      <div class="stat"><b>${fmt(nPres)}</b><span>report columns</span></div>
      <div class="stat"><b>${tableSAs[t].size}</b><span>subject areas</span></div>
    </div>
    <div class="ledger-wrap">
      <div class="ledger" style="--cols: minmax(0,1.18fr) 52px minmax(0,0.92fr) 52px minmax(0,1.2fr)">
        <div class="lhead"><div>NetSuite source field</div><div class="gut"></div><div>Warehouse column</div><div class="gut"></div><div>Report column, by name</div></div>
        <div class="lbody" id="lbody">
          <div class="lcol" id="L">${leftCells || '<div class="cell none spacer"><span class="lab">No NetSuite source in the data</span></div>'}</div>
          <div class="gut" id="G1"></div>
          <div class="lcol" id="M">${midCells}</div>
          <div class="gut" id="G2"></div>
          <div class="lcol" id="R">${rightCells || '<div class="cell none spacer"><span class="lab">No report column reads this table</span></div>'}</div>
        </div>
      </div>
      <aside class="drawer">${drawer}</aside>
    </div>
    <p class="foot">Report columns come from the semantic model lineage and are stated. NetSuite links are stated where a source file names the field; dashed links are field names guessed from the column name. Joins between facts and dimensions are not drawn, because the files only say which tables appear together.</p>
  </div>`;
  shell(`<span class="sep">/</span><a class="link" data-go2="search">Search</a><span class="sep">/</span><span class="here mono">${esc(name)}</span>`, body, { mini: true });

  const L = document.getElementById('L')!, M = document.getElementById('M')!, Rr = document.getElementById('R')!;
  const draw = () => {
    const w1: Wire[] = [], w2: Wire[] = [];
    cols.forEach((c, mi) => {
      const mEl = M.children[mi] as HTMLElement;
      for (const [f, inf] of colSrc[c]) w1.push({ a: L.children[fieldIx.get(f)!] as HTMLElement, b: mEl, inf, hot: hotFields.has(f) && hotCols.has(c), cool: any });
      for (const ri of colRight.get(c)!) {
        const r = right[ri]; const hot = hotCols.has(c) && (!r.name || hotNames.has(r.name) || r.col === c);
        w2.push({ a: mEl, b: Rr.children[ri] as HTMLElement, inf: false, hot, cool: any });
      }
      if (hotCols.has(c)) for (const e of colNames.get(c)!) {
        const ix = nameIx.get(e.name);
        if (ix !== undefined && !colRight.get(c)!.includes(ix) && hotNames.has(e.name)) w2.push({ a: mEl, b: Rr.children[ix] as HTMLElement, inf: false, hot: true, cool: any });
      }
    });
    drawWires(document.getElementById('G1')!, w1); drawWires(document.getElementById('G2')!, w2);
  };
  draw(); window.onresize = draw; document.fonts?.ready.then(draw);
  if (firstPaint && any) { const h = M.querySelector<HTMLElement>('.cell.hot'); const main = document.getElementById('main')!; if (h && h.getBoundingClientRect().bottom > innerHeight - 60) { main.scrollTop += h.getBoundingClientRect().top - innerHeight / 2; draw(); } }

  const keep = { table: name };
  const toggle = (k: 'col' | 'src' | 'rc', v: string) => nav(s[k] === v ? keep : { ...keep, [k]: v }, true);
  L.querySelectorAll<HTMLElement>('[data-f]').forEach((el) => el.addEventListener('click', () => toggle('src', fieldKey(+el.dataset.f!))));
  M.querySelectorAll<HTMLElement>('[data-c]').forEach((el) => el.addEventListener('click', () => toggle('col', pcName(+el.dataset.c!))));
  Rr.querySelectorAll<HTMLElement>('[data-rc]').forEach((el) => el.addEventListener('click', () => toggle('rc', el.dataset.rc!)));
  Rr.querySelectorAll<HTMLElement>('[data-more]').forEach((el) => el.addEventListener('click', (e) => { e.stopPropagation(); toggle('col', pcName(+el.dataset.more!)); }));
  wireCommon();
}

// ------------------------------------------------------------------ TRACE (impact)
const SAMPLE_TRACES = ['customer.companyname', 'transactions.tranid', 'transactions.entity', 'currency.name', 'transactionline.memo'];
function renderTrace(s: State) {
  const f = fieldByKey.get((s.trace ?? '').toLowerCase());
  if (f === undefined) { shell('', `<div class="page"><p class="lede">No NetSuite field is called <span class="mono">${esc(s.trace)}</span>.</p></div>`, { mini: true }); return; }
  const links = fieldCols[f].slice();
  const colPres = (c: number) => physPres[c];
  const presAll = new Set<number>(); const saAll = new Map<number, Set<number>>(); // sa -> cols
  for (const [c] of links) for (const p of colPres(c)) { presAll.add(p); const a = saOfPres(p); (saAll.get(a) ?? saAll.set(a, new Set()).get(a)!).add(c); }
  const stated = links.filter(([, i]) => !i).length, guessed = links.length - stated;
  const roleOrder = ['fact', 'enhanced', 'calculated', 'dimension', 'hierarchy', 'global', 'prediction', 'unknown'];
  links.sort((a, b) => roleOrder.indexOf(PT.role[PC.table[a[0]]]) - roleOrder.indexOf(PT.role[PC.table[b[0]]]) || +a[1] - +b[1] || colPres(b[0]).length - colPres(a[0]).length || String(PT.name[PC.table[a[0]]]).localeCompare(String(PT.name[PC.table[b[0]]])));
  const fasUsed = fasOf(saAll.keys());

  // selection
  const at = s.at ? links.find(([c]) => `${PT.name[PC.table[c]]}.${pcName(c)}`.toLowerCase() === s.at.toLowerCase())?.[0] : undefined;
  const selSa = s.sa ? [...saAll.keys()].find((a) => saLabel(a).toLowerCase() === s.sa.toLowerCase()) : undefined;
  const hotCols = new Set<number>(); const hotSas = new Set<number>();
  if (at !== undefined) { hotCols.add(at); for (const p of colPres(at)) hotSas.add(saOfPres(p)); }
  if (selSa !== undefined) { hotSas.add(selSa); for (const c of saAll.get(selSa)!) hotCols.add(c); }
  const any = at !== undefined || selSa !== undefined;

  // middle: grouped by role
  let lastRole = ''; const midOrder: number[] = [];
  const mid = links.map(([c, inf]) => {
    const t = PC.table[c]; const role = PT.role[t];
    const head = role !== lastRole ? `<div class="grp">${esc(ROLE_LABEL[role] ?? role)} tables</div>` : ''; lastRole = role;
    midOrder.push(c);
    const n = colPres(c).length;
    return `${head}<div class="cell${hotCols.has(c) ? ' hot' : any ? ' cool' : ''}" data-c="${c}"><span class="lab mono"><span class="rec">${esc(PT.name[t])}.</span>${esc(pcName(c))}</span>${inf ? '<span class="badge guess">guess</span>' : ''}<span class="aside">${n ? plural(n, 'report col') : 'no report column'}</span></div>`;
  }).join('');
  // right: subject areas grouped by functional area
  const saSorted = [...saAll.keys()].sort((a, b) => (saFa[a] - saFa[b]) || saLabel(a).localeCompare(saLabel(b)));
  let lastFa = -2; const saCount = new Map<number, number>();
  for (const p of presAll) saCount.set(saOfPres(p), (saCount.get(saOfPres(p)) ?? 0) + 1);
  const right = saSorted.map((a) => {
    const head = saFa[a] !== lastFa ? `<div class="grp">${esc(saFa[a] >= 0 ? FA.name[saFa[a]] : 'Other')}</div>` : ''; lastFa = saFa[a];
    return `${head}<div class="cell${hotSas.has(a) ? ' hot' : any ? ' cool' : ''}" data-sa="${a}"><span class="lab">${esc(saLabel(a))}</span><span class="aside">${saCount.get(a)}</span></div>`;
  }).join('');

  // drawer: report column names
  let drawer: string;
  const namesOf = (pres: Iterable<number>) => { const m = new Map<string, Set<number>>(); for (const p of pres) { const n = prcName(p); (m.get(n) ?? m.set(n, new Set()).get(n)!).add(saOfPres(p)); } return [...m].sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0])); };
  if (at !== undefined) {
    const ns = namesOf(colPres(at));
    drawer = `<section><h4>Warehouse column</h4><div class="big">${esc(PT.name[PC.table[at]])}.${esc(pcName(at))}</div>
      <div class="line">${plural(colPres(at).length, 'report column')} in ${plural(colSAs(at).size, 'subject area')}</div>
      <div class="salist">${ns.slice(0, 16).map(([n, a]) => `<div class="sa"><span>${esc(n)}</span><span class="c">${plural(a.size, 'area')}</span></div>`).join('')}</div>
      <button class="btn" data-table="${esc(PT.name[PC.table[at]])}" data-col="${esc(pcName(at))}">Open in the table ledger</button></section>`;
  } else if (selSa !== undefined) {
    const pres = [...presAll].filter((p) => saOfPres(p) === selSa);
    drawer = `<section><h4>Subject area</h4><div class="big" style="font-family:var(--ui)">${esc(saLabel(selSa))}</div>
      <div class="line">${plural(pres.length, 'report column')} from ${plural(saAll.get(selSa)!.size, 'warehouse column')}</div>
      <div class="salist">${pres.slice(0, 18).map((p) => `<div class="sa"><span>${esc(prcName(p))}</span><span class="c">${esc(presTable(p))}</span></div>`).join('')}</div></section>`;
  } else {
    const ns = namesOf(presAll);
    drawer = `<section><h4>Report columns, by name</h4><div class="line">${plural(ns.length, 'distinct name')}</div>
      <div class="salist">${ns.slice(0, 18).map(([n, a]) => `<div class="sa"><span>${esc(n)}</span><span class="c">${plural(a.size, 'area')}</span></div>`).join('')}${ns.length > 18 ? `<div class="sa faint"><span>and ${ns.length - 18} more</span></div>` : ''}</div></section>
      <section><h4>Pick a row</h4><p>Click a warehouse column or a subject area to light its path.</p></section>`;
  }

  const sentence = presAll.size
    ? `<span class="mono">${esc(fieldLabel(f))}</span> feeds <b>${fmt(links.length)}</b> warehouse column${links.length === 1 ? '' : 's'}, <b>${fmt(presAll.size)}</b> report column${presAll.size === 1 ? '' : 's'} in <b>${fmt(saAll.size)}</b> subject area${saAll.size === 1 ? '' : 's'}.`
    : `<span class="mono">${esc(fieldLabel(f))}</span> feeds <b>${fmt(links.length)}</b> warehouse column${links.length === 1 ? '' : 's'}. No report column reads ${links.length === 1 ? 'it' : 'them'}.`;
  const provLine = guessed === 0 ? (stated === 1 ? 'The one link from NetSuite is stated in the data.' : `All ${fmt(stated)} links from NetSuite are stated in the data.`) : stated === 0 ? `All ${plural(guessed, 'link')} are name guesses, so treat this trace as a lead to check.` : `${plural(stated, 'link')} stated in the data, ${plural(guessed, 'name guess', 'name guesses')} (dashed).`;
  const body = `<div class="page">
    <div class="head"><div>
      <div class="eyebrow">${icon('field')} Impact trace <span class="badge ${NF.explicit[f] ? 'solid' : 'guess'}">${NF.explicit[f] ? 'field named in data' : 'field name guessed'}</span></div>
      <p class="count-sent">${sentence}</p>
      <p class="sub">${provLine}${saAll.size ? ` The subject areas span ${fasUsed.size} of ${FA.name.length} functional areas.` : ''}</p>
    </div><div class="actions"><button class="btn" data-go2="fields">Trace another field</button><button class="btn" id="copy">Copy link</button></div></div>
    <div class="trace-pick">Try ${SAMPLE_TRACES.filter((k) => fieldByKey.has(k)).map((k) => `<button data-trace="${k}" class="${k === fieldKey(f) ? 'on' : ''}">${k}</button>`).join('')}</div>
    <div class="ledger-wrap">
      <div class="ledger trace${any ? ' picked' : ''}" style="--cols: 236px 56px minmax(0,1.3fr) 128px minmax(0,1fr)">
        <div class="lhead"><div>NetSuite field</div><div class="gut"></div><div>Warehouse columns (${links.length})</div><div class="gut"></div><div>Subject areas (${saAll.size})</div></div>
        <div class="lbody">
          <div class="lcol" id="L"><div class="srcnode" id="src"><div class="mono">${esc(fieldLabel(f))}</div><p>NetSuite record <span class="mono">${esc(REC.key[NF.record[f]])}</span></p><p>${plural(stated, 'stated link')}${guessed ? `, ${plural(guessed, 'guess', 'guesses')}` : ''}</p></div></div>
          <div class="gut" id="G1"></div>
          <div class="lcol" id="M">${mid}</div>
          <div class="gut" id="G2"></div>
          <div class="lcol" id="R">${right || '<div class="cell none spacer"><span class="lab">No subject area</span></div>'}</div>
        </div>
      </div>
      <aside class="drawer">${drawer}</aside>
    </div>
  </div>`;
  shell(`<span class="sep">/</span><a class="link" data-go2="search">Search</a><span class="sep">/</span><span class="here">Trace <span class="mono">${esc(fieldLabel(f))}</span></span>`, body, { mini: true });

  const M = document.getElementById('M')!, Rr = document.getElementById('R')!, src = document.getElementById('src')!;
  const midEl = new Map<number, HTMLElement>(); M.querySelectorAll<HTMLElement>('[data-c]').forEach((el) => midEl.set(+el.dataset.c!, el));
  const saEl = new Map<number, HTMLElement>(); Rr.querySelectorAll<HTMLElement>('[data-sa]').forEach((el) => saEl.set(+el.dataset.sa!, el));
  const draw = () => {
    const w1: Wire[] = links.map(([c, inf]) => ({ a: src, b: midEl.get(c)!, inf, hot: !any || hotCols.has(c), cool: any }));
    const w2: Wire[] = [];
    for (const [a, cs] of saAll) for (const c of cs) w2.push({ a: midEl.get(c)!, b: saEl.get(a)!, inf: false, hot: any && hotCols.has(c) && hotSas.has(a), cool: any });
    drawComb(document.getElementById('G1')!, src, w1); drawWires(document.getElementById('G2')!, w2);
  };
  draw(); window.onresize = draw; document.fonts?.ready.then(draw);
  const keep = { trace: fieldKey(f) };
  M.querySelectorAll<HTMLElement>('[data-c]').forEach((el) => el.addEventListener('click', () => { const c = +el.dataset.c!; const v = `${PT.name[PC.table[c]]}.${pcName(c)}`; nav(s.at === v ? keep : { ...keep, at: v }, true); }));
  Rr.querySelectorAll<HTMLElement>('[data-sa]').forEach((el) => el.addEventListener('click', () => { const v = saLabel(+el.dataset.sa!); nav(s.sa === v ? keep : { ...keep, sa: v }, true); }));
  wireCommon();
}

function wireCommon() {
  document.getElementById('copy')?.addEventListener('click', copyLink);
  app.querySelectorAll<HTMLElement>('[data-table]').forEach((el) => el.addEventListener('click', () => nav(el.dataset.col ? { table: el.dataset.table!, col: el.dataset.col } : { table: el.dataset.table! })));
  app.querySelectorAll<HTMLElement>('[data-trace]').forEach((el) => el.addEventListener('click', () => nav({ trace: el.dataset.trace! })));
  app.querySelectorAll<HTMLElement>('[data-go2]').forEach((el) => el.addEventListener('click', () => nav({ q: el.dataset.go2 === 'fields' ? 'is:field ' : lastQuery })));
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
    e.preventDefault(); const s = state(); if (s.table || s.trace) nav({ q: lastQuery });
  }
});

let firstPaint = true;
function render() {
  const s = state();
  const y = document.getElementById('main')?.scrollTop ?? 0;
  const samePage = (render as any).last === (s.table ?? s.trace ?? '#home');
  if (s.trace) renderTrace(s);
  else if (s.table) renderLedger(s);
  else renderHome(s);
  if (samePage && (s.table || s.trace)) document.getElementById('main')!.scrollTop = y;
  (render as any).last = s.table ?? s.trace ?? '#home';
  firstPaint = false;
  document.title = s.trace ? `Trace ${s.trace} · Lineage ledger` : s.table ? `${s.table} · Lineage ledger` : 'Lineage ledger (lab B)';
}
render();
