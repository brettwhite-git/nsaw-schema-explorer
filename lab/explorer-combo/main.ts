// Lab "explorer-combo": one fact page that combines the three earlier mocks, in three themes.
//   A (bus matrix console)  -> grain headline, header partner, dimensions in the same subject areas, subject areas
//   B (lineage ledger)      -> ⌘K search with typed filters, the ledger with its wires, the column drawer
// Stated only: the data build drops every inferred relationship (see core.meta.statedOnlyNote), and this page
// draws nothing the files do not state. No star, no dashed joins, no name-guessed sources.
// URL state:  ?theme=paper|swiss|craft   ?t=DW_NS_SALES_ORDER_LINES_F   ?col=TRANSACTION (col=none clears)
// Data: public/ontology/*.json through ontology/load.ts. Nothing here is typed in by hand.

import { loadOntology } from '../../ontology/load';
import type { DetailJson, EdgeGroupJson } from '../../ontology/types';
import { nameOverlap } from '../../figures/sewn-star-data';

const ERRS: string[] = [];
(window as any).__errs = ERRS;
addEventListener('error', (e) => ERRS.push(String(e.message)));
addEventListener('unhandledrejection', (e) => ERRS.push(String((e as PromiseRejectionEvent).reason)));

// ------------------------------------------------------------------ theme + craft module
type Theme = 'paper' | 'swiss' | 'craft';
const THEMES: { id: Theme; label: string }[] = [{ id: 'paper', label: 'Paper' }, { id: 'swiss', label: 'Swiss' }, { id: 'craft', label: 'Craft' }];
const readTheme = (): Theme => { const t = new URLSearchParams(location.search).get('theme'); return t === 'swiss' || t === 'craft' ? t : 'paper'; };
let theme: Theme = readTheme();
document.documentElement.dataset.theme = theme;

/** The sibling's hand-made accents. Contract used here: glyph(kind, size?, color?) -> SVGSVGElement, and the CSS classes
 *  .stitch (inferred SVG paths) and .ink-rule (dividers). No watercolour plate (dropped by the user). Missing module = plain night-ocean. */
interface Craft {
  glyph?: (kind: string, size?: number, color?: string) => SVGSVGElement;
}
const CRAFT_URL = new URL('./craft/index.ts', import.meta.url).href;
let craft: Craft | null = null;
let craftTried = false;
async function loadCraft(): Promise<Craft | null> {
  if (craftTried) return craft;
  craftTried = true;
  try {
    // HEAD first so a missing module does not surface as a failed module load
    const head = await fetch(CRAFT_URL, { method: 'HEAD' }).catch(() => null);
    if (!head || !head.ok || /text\/html/.test(head.headers.get('content-type') ?? '')) return null;
    craft = (await import(/* @vite-ignore */ CRAFT_URL)) as Craft; // the module imports its own craft.css

  } catch { craft = null; }
  return craft;
}
const craftOn = () => theme === 'craft' && !!craft;

// ------------------------------------------------------------------ load
let colsJson: DetailJson | undefined;
const fetchJson = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  const j = await r.json();
  if (url.includes('columns')) colsJson = j;
  return j;
};
const o = await loadOntology({ baseUrl: '/ontology/', fetchJson });
await o.ensure('columns');
const core = o.core;
const bm = core.busMatrix;
const cj = colsJson!;
const S = cj.strings!;

const PT = core.nodes.physicalTable!.cols as Record<string, any[]>;
const SA = core.nodes.subjectArea!.cols as Record<string, any[]>;
const FA = core.nodes.functionalArea!.cols as Record<string, any[]>;
const PRT = core.nodes.presentationTable!.cols as Record<string, any[]>;
const REC = core.nodes.netsuiteRecord!.cols as Record<string, any[]>;
const ENT = core.nodes.entity!.cols as Record<string, any[]>;
const PC = cj.nodes!.physicalColumn!.cols as Record<string, any[]>;
const NF = cj.nodes!.netsuiteField!.cols as Record<string, any[]>;
const PRC = cj.nodes!.presentationColumn!.cols as Record<string, any[]>;

const nPT = PT.name.length, nPC = PC.table.length, nNF = NF.record.length, nPRC = PRC.pt.length, nSA = SA.name.length;
const nSaAll = core.meta.counts.subjectAreas;
const pcName = (c: number) => S[PC.name[c]] as string;
const nfName = (f: number) => S[NF.name[f]] as string;
const prcName = (p: number) => S[PRC.name[p]] as string;
const fieldKey = (f: number) => `${REC.key[NF.record[f]]}.${nfName(f).toLowerCase()}`;
const fieldLabel = (f: number) => `${REC.key[NF.record[f]]}.${nfName(f)}`;
const saOfPres = (p: number) => PRT.sa[PRC.pt[p]] as number;
const saLabel = (s: number) => SA.label[s] as string;

const group = (groups: EdgeGroupJson[], type: string, from: string, to: string) => groups.find((g) => g.type === type && g.from === from && g.to === to)!;
const isInferred = (g: EdgeGroupJson, k: number) => (g.provenance === 'mixed' ? core.meta.provenanceCodes[g.prov![k]] !== 'explicit' : g.provenance !== 'explicit');

const saFa = new Int16Array(nSA).fill(-1);
{ const g = group(core.edges, 'inFunctionalArea', 'subjectArea', 'functionalArea'); for (let k = 0; k < g.n; k++) saFa[g.pairs[2 * k]] = g.pairs[2 * k + 1]; }
const colSrc: [number, boolean][][] = Array.from({ length: nPC }, () => []);
const fieldCols: [number, boolean][][] = Array.from({ length: nNF }, () => []);
{ const g = group(cj.edges, 'sourcedFrom', 'physicalColumn', 'netsuiteField');
  for (let k = 0; k < g.n; k++) { const c = g.pairs[2 * k], f = g.pairs[2 * k + 1], inf = isInferred(g, k); colSrc[c].push([f, inf]); fieldCols[f].push([c, inf]); } }
const physPres: number[][] = Array.from({ length: nPC }, () => []);
const presPhys: number[][] = Array.from({ length: nPRC }, () => []);
{ const g = group(cj.edges, 'mapsTo', 'presentationColumn', 'physicalColumn');
  for (let k = 0; k < g.n; k++) { const p = g.pairs[2 * k], c = g.pairs[2 * k + 1]; physPres[c].push(p); presPhys[p].push(c); } }
const tableCols: number[][] = Array.from({ length: nPT }, () => []);
for (let c = 0; c < nPC; c++) if (PC.table[c] >= 0) tableCols[PC.table[c]].push(c);
const tableByName = new Map<string, number>(); for (let t = 0; t < nPT; t++) tableByName.set(String(PT.name[t]).toUpperCase(), t);
/** Oracle names a secured table by adding _SEC to the base table's name. The page links the two by name only and
 *  copies nothing across (no sources, no keys). */
const secName = (t: number) => { const n = String(PT.name[t]).toUpperCase(); return n.endsWith('_SEC') ? tableByName.get(n.slice(0, -4)) : tableByName.get(n + '_SEC'); };
const colSAs = (c: number) => { const s = new Set<number>(); for (const p of physPres[c]) s.add(saOfPres(p)); return s; };
const tableSAsOf = (t: number) => { const s = new Set<number>(); for (const c of tableCols[t]) for (const p of physPres[c]) s.add(saOfPres(p)); return s; };

// ------------------------------------------------------------------ grain + header partner (Entity Key List)
interface GrainEntry { entity: string; cols: string[]; missing: string[] }
interface HeaderLink { table: number; col: string; entity: string; key: string; also: number[] }
const grainOf = new Map<number, GrainEntry[]>();
const headerOf = new Map<number, HeaderLink>();
for (let e = 0; e < ENT.name.length; e++) {
  const keys = ENT.keys[e] as { k: string; t: string; c: string; ti: number; ci: number }[];
  const byT = new Map<number, typeof keys>();
  for (const k of keys) if (k.ti >= 0) (byT.get(k.ti) ?? byT.set(k.ti, []).get(k.ti)!).push(k);
  const idTables = [...byT].filter(([, ks]) => ks.some((k) => k.c.toLowerCase() === 'id')).map(([t]) => t);
  for (const [t, ks] of byT) {
    const cols = [...new Set(ks.map((k) => k.c.toLowerCase()))].sort();
    if (cols.length === 1 && cols[0] === 'transaction' && idTables.length) {
      const hs = idTables.filter((x) => x !== t).sort((a, b) => Number(/SNAPSHOT/.test(PT.name[a])) - Number(/SNAPSHOT/.test(PT.name[b])));
      if (hs.length) headerOf.set(t, { table: hs[0], col: ks[0].c, entity: String(ENT.name[e]), key: ks[0].k, also: hs.slice(1) });
      continue;
    }
    const missing = [...new Set(ks.filter((k) => k.ci < 0).map((k) => k.c.toLowerCase()))];
    (grainOf.get(t) ?? grainOf.set(t, []).get(t)!).push({ entity: String(ENT.name[e]), cols, missing });
  }
}
/** The key list only: lead with the entry whose keys are all columns of the table, then the one with fewer keys. */
const grainsFor = (t: number) => (grainOf.get(t) ?? []).slice()
  .sort((a, b) => a.missing.length - b.missing.length || a.cols.length - b.cols.length || a.entity.localeCompare(b.entity));
/** The grain sentence uses the entity name exactly as the key list states it. */
const grainPhrase = (g?: GrainEntry) => (g ? `One row per ${g.entity.toLowerCase()}` : '');
const NO_KEY = "No key for this table in Oracle's key list.";
const KEY_ORDER = ['accountingbook', 'id', 'transaction'];
const keyOrder = (cols: string[]) => [...cols].sort((a, b) => (KEY_ORDER.indexOf(a) + 1 || 99) - (KEY_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b));

/** Report folders (presentation tables, by name) whose columns map to table t, within the given subject areas. */
function foldersReading(t: number, within: Set<number>): string[] {
  const n = new Map<string, Set<number>>();
  for (const c of tableCols[t]) for (const p of physPres[c]) {
    const s = saOfPres(p); if (!within.has(s)) continue;
    const name = String(PRT.name[PRC.pt[p]]);
    (n.get(name) ?? n.set(name, new Set()).get(name)!).add(s);
  }
  return [...n].sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0])).map(([k]) => k);
}

// ------------------------------------------------------------------ search (B), built on first use
type Kind = 'area' | 'table' | 'column' | 'report' | 'record' | 'field';
const KIND_LABEL: Record<Kind, string> = { area: 'Subject area', table: 'Warehouse table', column: 'Warehouse column', report: 'Report column', record: 'NetSuite record', field: 'NetSuite field' };
const KIND_W: Record<Kind, number> = { area: 18, table: 17, record: 14, field: 9, report: 7, column: 5 };
const IS_ALIAS: Record<string, Kind> = { area: 'area', subject: 'area', sa: 'area', table: 'table', column: 'column', col: 'column', report: 'report', record: 'record', field: 'field', netsuite: 'field' };
interface Item { kind: Kind; label: string; ctx: string; norm: string; core?: string; words: string[]; reach: number; sas: Set<number>; fas: Set<number>; role?: string; prov?: 'stated'; secured?: boolean; table?: number; col?: number; field?: number; rec?: number; name?: string; sa?: number }
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const wordsOf = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const fasOf = (sas: Iterable<number>) => { const s = new Set<number>(); for (const a of sas) if (saFa[a] >= 0) s.add(saFa[a]); return s; };
let items: Item[] | null = null;
function buildIndex(): Item[] {
  const out: Item[] = [];
  const push = (it: Omit<Item, 'norm' | 'words'>) => out.push({ ...it, norm: norm(it.label), words: wordsOf(it.label) } as Item);
  for (let s = 0; s < nSA; s++) push({ kind: 'area', label: saLabel(s), ctx: saFa[s] >= 0 ? String(FA.name[saFa[s]]) : '', reach: SA.presentationColumns[s], sas: new Set([s]), fas: fasOf([s]), sa: s });
  for (let t = 0; t < nPT; t++) {
    if (!tableCols[t].length) continue;
    const name = String(PT.name[t]); const sas = tableSAsOf(t);
    push({ kind: 'table', label: name, ctx: grainPhrase(grainsFor(t)[0]) || `${tableCols[t].length} column${tableCols[t].length === 1 ? "" : "s"}`, core: norm(name.replace(/^DW_NS_/i, '').replace(/_(SEC|F|D|DH|G|EF|CF)$/i, '')), reach: sas.size, sas, fas: fasOf(sas), role: PT.role[t], secured: !!PT.isSecured[t], table: t });
  }
  for (let c = 0; c < nPC; c++) {
    const t = PC.table[c]; if (t < 0) continue;
    const sas = colSAs(c);
    const prov = colSrc[c].length ? 'stated' as const : undefined;
    push({ kind: 'column', label: pcName(c), ctx: String(PT.name[t]), reach: sas.size, sas, fas: fasOf(sas), role: PT.role[t], prov, secured: !!PT.isSecured[t], table: t, col: c });
  }
  const byName = new Map<string, { sas: Set<number>; phys: Map<number, number> }>();
  for (let p = 0; p < nPRC; p++) {
    const n = prcName(p); let e = byName.get(n);
    if (!e) byName.set(n, (e = { sas: new Set(), phys: new Map() }));
    e.sas.add(saOfPres(p)); for (const c of presPhys[p]) e.phys.set(c, (e.phys.get(c) ?? 0) + 1);
  }
  for (const [n, e] of byName) {
    const best = [...e.phys].sort((a, b) => b[1] - a[1])[0]?.[0];
    push({ kind: 'report', label: n, ctx: best !== undefined ? `reads ${PT.name[PC.table[best]]}.${pcName(best)}` : '', reach: e.sas.size, sas: e.sas, fas: fasOf(e.sas), name: n, col: best, table: best !== undefined ? PC.table[best] : undefined });
  }
  const fieldSAs: Set<number>[] = Array.from({ length: nNF }, () => new Set<number>());
  for (let f = 0; f < nNF; f++) for (const [c] of fieldCols[f]) for (const p of physPres[c]) fieldSAs[f].add(saOfPres(p));
  const recFields: number[][] = REC.key.map(() => []);
  for (let f = 0; f < nNF; f++) recFields[NF.record[f]].push(f);
  REC.key.forEach((k: string, r: number) => {
    const sas = new Set<number>(); for (const f of recFields[r]) for (const s of fieldSAs[f]) sas.add(s);
    push({ kind: 'record', label: k, ctx: `${REC.fieldCount[r]} fields`, reach: sas.size, sas, fas: fasOf(sas), prov: 'stated', rec: r });
  });
  for (let f = 0; f < nNF; f++) {
    if (!fieldCols[f].length) continue;
    push({ kind: 'field', label: fieldLabel(f), ctx: `feeds ${fieldCols[f].length} warehouse column${fieldCols[f].length === 1 ? '' : 's'}`, reach: fieldSAs[f].size, sas: fieldSAs[f], fas: fasOf(fieldSAs[f]), prov: 'stated', field: f });
  }
  return out;
}
interface Chip { k: string; v: string }
const FILTER_KEYS = ['is', 'type', 'area', 'in', 'source'];
function parseQuery(q: string): { text: string; chips: Chip[] } {
  const chips: Chip[] = [];
  const text = q.replace(/\b(\w+):("([^"]*)"|\S+)/g, (m, k: string, raw: string, quoted?: string) => {
    if (!FILTER_KEYS.includes(k.toLowerCase())) return m;
    chips.push({ k: k.toLowerCase(), v: quoted ?? raw }); return ' ';
  }).replace(/\s+/g, ' ').trim();
  return { text, chips };
}
function passes(it: Item, c: Chip): boolean {
  const v = c.v.toLowerCase();
  switch (c.k) {
    case 'is': return it.kind === (IS_ALIAS[norm(v)] ?? v);
    case 'type': return !!it.role && it.role.startsWith(v.replace(/s$/, ''));
    case 'area': { for (const f of it.fas) if (String(FA.name[f]).toLowerCase().includes(v)) return true; return false; }
    case 'in': { for (const s of it.sas) if (saLabel(s).toLowerCase().includes(v)) return true; return false; }
    case 'source': return !!it.prov && it.prov === v;
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
  items ??= buildIndex();
  const { text, chips } = parseQuery(q);
  if (!text && !chips.length) return { text, chips, results: [] as Item[], total: 0 };
  const qn = norm(text), qw = wordsOf(text);
  const out: { it: Item; s: number }[] = [];
  for (const it of items) {
    if (!chips.every((c) => passes(it, c))) continue;
    const m = matchScore(it, qn, qw); if (!m) continue;
    out.push({ it, s: m + KIND_W[it.kind] + Math.min(12, Math.log2(1 + it.reach) * 1.8) - (it.secured ? 4 : 0) - (!it.reach && it.kind !== 'record' ? 10 : 0) });
  }
  out.sort((a, b) => b.s - a.s || b.it.reach - a.it.reach || a.it.label.localeCompare(b.it.label));
  return { text, chips, results: out.slice(0, 9).map((r) => r.it), total: out.length };
}

// ------------------------------------------------------------------ helpers
const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
const fmt = (n: number) => n.toLocaleString('en-US');
const plural = (n: number, one: string, many = one + 's') => `${fmt(n)} ${n === 1 ? one : many}`;
const solid = (w = 22) => `<svg class="mark" width="${w}" height="8" aria-hidden="true"><line x1="1" y1="4" x2="${w - 1}" y2="4"/></svg>`;
const accentMark = (w = 22) => `<svg class="mark hot" width="${w}" height="8" aria-hidden="true"><line x1="1" y1="4" x2="${w - 1}" y2="4"/></svg>`;
const glyphSlot = (kind: string, size = 16) => `<span class="gslot" data-glyph="${kind}" data-size="${size}"></span>`;
const ICON: Record<Kind, string> = {
  area: '<rect x="2.5" y="2.5" width="11" height="11" rx="1"/><path d="M2.5 6.5h11M6.5 6.5v7"/>',
  table: '<ellipse cx="8" cy="4" rx="5" ry="1.8"/><path d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4M3 8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8"/>',
  column: '<rect x="5.5" y="2.5" width="5" height="11" rx="1"/><path d="M5.5 6h5M5.5 9.5h5"/>',
  report: '<path d="M3 13V3M3 13h10"/><path d="M6 10.5V8M9 10.5V5.5M12 10.5V7"/>',
  record: '<path d="M4 2.5h5.5L12 5v8.5H4z"/><path d="M9.5 2.5V5H12"/>',
  field: '<path d="M4 2.5h5.5L12 5v8.5H4z"/><circle cx="8" cy="9.3" r="1.6"/>',
};
const icon = (k: Kind) => `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;
const mctx = document.createElement('canvas').getContext('2d')!;
const textW = (s: string, font: string) => { mctx.font = font; return mctx.measureText(s).width; };
function fit(s: string, font: string, max: number): string {
  if (textW(s, font) <= max) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (textW(s.slice(0, mid) + '…', font) <= max) lo = mid; else hi = mid - 1; }
  return s.slice(0, lo) + '…';
}
const cssVar = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

// ------------------------------------------------------------------ the page model for one table
interface DimRow { d: number; w: number; folders: string[] }
interface Model {
  t: number; name: string; secured: boolean; other?: number; grains: GrainEntry[]; hdr?: HeaderLink;
  cols: number[]; keyCols: Set<string>; sas: Set<number>; nStated: number; nPres: number;
  fa: string; saLbl: string; saRows: { s: number; here: boolean; other: boolean }[]; dims: DimRow[]; recs: string[];
}
function model(t: number): Model {
  const name = String(PT.name[t]);
  const secured = !!PT.isSecured[t];
  const other = secName(t);
  const grains = grainsFor(t);
  const keyCols = new Set(grains[0]?.cols ?? []);
  const ko = keyOrder([...keyCols]);
  const cols = tableCols[t].slice().sort((a, b) =>
    (ko.indexOf(pcName(a).toLowerCase()) + 1 || 99) - (ko.indexOf(pcName(b).toLowerCase()) + 1 || 99) || pcName(a).localeCompare(pcName(b)));
  const hdr = headerOf.get(t);
  const sas = tableSAsOf(t);
  const nStated = cols.filter((c) => colSrc[c].length).length;
  const nPres = cols.reduce((a, c) => a + physPres[c].length, 0);
  // subject areas where the lineage lists this table (or its _SEC namesake) as a fact table
  const saRows: Model['saRows'] = []; const rowsIx: number[] = [];
  bm.rows.forEach((s, r) => {
    const here = bm.facts[r].includes(t), oth = other !== undefined && bm.facts[r].includes(other);
    if (here || oth) { saRows.push({ s, here, other: oth }); rowsIx.push(r); }
  });
  const core0 = name.replace(/^DW_NS_/i, '').replace(/_SEC$/i, '');
  const pick = saRows.slice().sort((a, b) => nameOverlap(saLabel(b.s), core0) - nameOverlap(saLabel(a.s), core0))[0];
  const fa = pick ? String(FA.name[saFa[pick.s]]) : '';
  // dimension tables the lineage lists under the same subject areas (bus matrix cells), counted per area
  const cnt = new Map<number, number>();
  for (const r of rowsIx) for (const j of bm.cells[r]) { const d = bm.columns[j]; if (d !== t && d !== other) cnt.set(d, (cnt.get(d) ?? 0) + 1); }
  const inSas = new Set(saRows.map((x) => x.s));
  const dims = [...cnt].map(([d, w]) => ({ d, w, folders: [] as string[] }))
    .sort((x, y) => y.w - x.w || PT.saCount[y.d] - PT.saCount[x.d] || String(PT.name[x.d]).localeCompare(String(PT.name[y.d])));
  for (const r of dims) r.folders = foldersReading(r.d, inSas);
  const recs = o.neighbors({ type: 'physicalTable', i: t }, 'loadedFrom', 'out').map((n) => String(REC.name[n.ref.i]));
  return { t, name, secured, other, grains, hdr, cols, keyCols, sas, nStated, nPres, fa, saLbl: pick ? saLabel(pick.s) : '', saRows, dims, recs };
}

// ------------------------------------------------------------------ state
interface State { t: number; col?: number; showAllDims: boolean }
const DEFAULT_TABLE = 'DW_NS_SALES_ORDER_LINES_F';
function readState(): State {
  const p = new URLSearchParams(location.search);
  const t = tableByName.get((p.get('t') ?? DEFAULT_TABLE).toUpperCase()) ?? tableByName.get(DEFAULT_TABLE)!;
  const cp = p.get('col');
  const want = cp === null ? (t === tableByName.get(DEFAULT_TABLE) ? 'TRANSACTION' : '') : cp;
  const col = want && want !== 'none' ? tableCols[t].find((c) => pcName(c).toLowerCase() === want.toLowerCase()) : undefined;
  return { t, col, showAllDims: p.get('dims') === 'all' };
}
let state = readState();
function setParams(ch: Record<string, string | null>, push = false) {
  const p = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(ch)) v === null ? p.delete(k) : p.set(k, v);
  history[push ? 'pushState' : 'replaceState'](null, '', `?${p.toString()}`);
  state = readState(); theme = readTheme(); document.documentElement.dataset.theme = theme;
  void render();
}
addEventListener('popstate', () => { state = readState(); theme = readTheme(); document.documentElement.dataset.theme = theme; void render(); });
const tableHref = (t: number) => { const p = new URLSearchParams(location.search); p.set('t', String(PT.name[t])); p.delete('col'); p.delete('dims'); return `?${p.toString()}`; };
const tableLink = (t: number) => `<a class="mono tlink" data-t="${esc(PT.name[t])}" href="${esc(tableHref(t))}">${esc(PT.name[t])}</a>`;

// ------------------------------------------------------------------ render
const app = document.getElementById('app')!;
let M: Model = model(state.t);

function topBar(m: Model) {
  return `<header class="top">
    <div class="top-in">
      <div class="brand"><svg class="logo" width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="2.6" class="logo-dot"/><path d="M9 9 2.5 3.5M9 9l6.5-5.5M9 9 2.5 14.5M9 9l6.5 5.5" class="logo-ray"/></svg><b>NSAW Schema Explorer</b><small>25R4</small></div>
      <div class="search" id="search">
        <svg class="glass" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>
        <input id="q" autocomplete="off" spellcheck="false" placeholder="Search tables, columns, NetSuite fields" />
        <kbd>⌘K</kbd>
        <div class="drop" id="drop" hidden></div>
      </div>
      <div class="legend" aria-label="How lines are drawn">
        <span>${solid(20)}stated in Oracle's files</span><span>${accentMark(20)}selected</span>
      </div>
      <div class="themes" role="group" aria-label="Theme">${THEMES.map((x) => `<button data-theme-btn="${x.id}" class="${x.id === theme ? 'on' : ''}">${x.label}</button>`).join('')}</div>
    </div>
    <nav class="crumbs-row"><div class="crumbs">
      <span>${esc(m.fa || 'Warehouse')}</span><i>/</i><span>${esc(m.saLbl || 'Subject area')}</span><i>/</i><span class="here">${PT.role[m.t] === 'fact' || PT.role[m.t] === 'enhanced' ? 'Fact table' : 'Table'}</span>
    </div></nav>
  </header>`;
}

function headline(m: Model) {
  const g0 = m.grains[0];
  const others = m.grains.slice(1);
  const tags = (cols: string[], hot: boolean) => keyOrder(cols).map((c, i) => `${i ? '<span class="plus">+</span>' : ''}<span class="ktag${hot ? ' hot' : ''}">${esc(c)}</span>`).join('');
  const second = others.map((g) => {
    const miss = g.missing.length ? ` ${g.missing.map((x) => `<span class="mono">${esc(x.toUpperCase())}</span>`).join(', ')} is not a column in this table.` : '';
    return `<p class="also"><span class="also-k">Also in the key list</span> <i>${esc(g.entity)}</i> keys it by ${tags(g.cols, false)}.${miss}</p>`;
  }).join('');
  const secNote = m.other !== undefined
    ? (m.secured
      ? `<p class="also"><span class="also-k">Secured table</span> Oracle names secured tables with a <span class="mono">_SEC</span> suffix. The table without the suffix is ${tableLink(m.other)}. Its keys and sources stay on its own page.</p>`
      : `<p class="also"><span class="also-k">Secured copy</span> Oracle's files also list ${tableLink(m.other)}, the same name with the <span class="mono">_SEC</span> suffix.</p>`)
    : '';
  return `<section class="head">
    <div class="head-main">
      <div class="eyebrow">${glyphSlot('fact', 18)}<span class="tag solid">${esc(PT.role[m.t] === 'enhanced' ? 'enhanced fact' : PT.role[m.t])}</span><h1 class="tname">${esc(m.name)}</h1></div>
      <p class="grain${g0 ? '' : ' nokey'}">${g0 ? esc(grainPhrase(g0)) + '.' : esc(NO_KEY)}</p>
      ${g0 ? `<div class="keyline"><span class="k-lbl">Key</span>${tags(g0.cols, true)}<span class="src">${solid(18)}stated in Oracle's Entity Key List as&nbsp;<i>${esc(g0.entity)}</i></span></div>` : ''}
      ${second}${secNote}
    </div>
    <aside class="head-aside" id="aside">
      <div class="reading">
        <div class="r-h">Reading the lines</div>
        <p>${solid(26)}<span><b>Stated.</b> One of Oracle's files names it: the lineage, the Entity Key List or the lineage workbook.</span></p>
        <p>${accentMark(26)}<span><b>Selected.</b> One column's path from NetSuite to the reports.</span></p>
        <p class="quiet"><span></span><span>Everything else is left out. A blank means the files say nothing about it.</span></p>
      </div></aside>
    <div class="stats">
      <div class="stat"><b>${m.cols.length}</b><span>columns</span></div>
      <div class="stat"><b>${m.nStated}</b><span>with a NetSuite source in the lineage</span></div>
      <div class="stat"><b>${m.sas.size}</b><span>subject areas read it</span></div>
      <div class="stat"><b>${fmt(m.nPres)}</b><span>report columns read it</span></div>
      ${m.other !== undefined ? `<div class="stat twin"><b>${PT.columns[m.other]}</b><span>columns in ${tableLink(m.other)}</span></div>` : `<div class="stat"><b>${m.recs.length}</b><span>NetSuite records it is loaded from</span></div>`}
    </div>
  </section>`;
}

/** The header partner, drawn wide: the key list gives one key to id in the header and to the link column here. */
function headerFigure(m: Model) {
  const h = m.hdr;
  if (!h) {
    return `<div class="sec-h">${glyphSlot('header')}<h2>Header</h2></div>
      <p class="sec-p">Oracle's key list names no header table for ${esc(m.name)}.${m.secured && m.other !== undefined ? ` The header of ${tableLink(m.other)} is on that table's page.` : ''}</p>
`;
  }
  const ht = h.table; const hg = grainsFor(ht)[0];
  const MONO = cssVar('--mono') || 'JetBrains Mono';
  const W = 860, BW = 300, BH = 92, y = 34;
  const x2 = W - BW - 1;
  const t = (x: number, yy: number, cls: string, txt: string, anchor = 'start') => `<text class="${cls}" x="${x}" y="${yy}"${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}>${esc(txt)}</text>`;
  const box = (x: number, cls: string, kick: string, name: string, l1: string, l2: string) => `<g class="${cls}">
    <rect class="box${cls === 'this' ? ' this' : ''}" x="${x}" y="${y}" width="${BW}" height="${BH}"/>
    ${t(x + 16, y + 22, 't-kick', kick)}${t(x + 16, y + 44, 't-mono', fit(name, `500 12.5px ${MONO}`, BW - 30))}
    ${t(x + 16, y + 64, 't-ui', l1)}${t(x + 16, y + 81, 't-ui', l2)}</g>`;
  const cy = y + BH / 2, xa = 1 + BW, mid = (xa + x2) / 2;
  const svg = `<svg class="hdr-svg wide" viewBox="0 0 ${W} ${y + BH + 8}" width="100%" role="img" aria-label="${esc(String(PT.name[ht]))} id joins ${esc(m.name)} ${esc(h.col)}">
    ${box(1, 'hdrb', 'Header', String(PT.name[ht]), hg ? `key ${keyOrder(hg.cols).join(' + ')}` : 'no entry of its own in the key list', `${PT.columns[ht]} columns · ${tableSAsOf(ht).size} subject areas`)}
    ${box(x2, 'this', 'This table', m.name, `key ${keyOrder([...m.keyCols]).join(' + ') || 'not in the key list'}`, `${m.cols.length} columns · ${m.sas.size} subject areas`)}
    <line class="ln" x1="${xa}" y1="${cy}" x2="${x2}" y2="${cy}"/>
    <line class="ln" x1="${xa + 9}" y1="${cy - 7}" x2="${xa + 9}" y2="${cy + 7}"/>
    <path class="ln" d="M${x2 - 12} ${cy - 7} L${x2} ${cy} L${x2 - 12} ${cy + 7}" fill="none"/>
    ${t(mid, cy - 12, 't-key', `id = ${h.col.toLowerCase()}`, 'middle')}
    ${t(mid, cy + 22, 't-small', h.key, 'middle')}
    ${t(xa + 16, cy - 12, 't-small', '1')}${t(x2 - 18, cy - 12, 't-small', 'many', 'end')}
  </svg>`;
  return `<div class="sec-h">${glyphSlot('header')}<h2>Header partner</h2><span class="prov">${solid(18)}stated in the key list</span></div>
    <p class="sec-p">Oracle's Entity Key List gives one key, <span class="mono">${esc(h.key)}</span> in <i>${esc(h.entity)}</i>, to <span class="mono">id</span> in the header and to <span class="mono">${esc(h.col.toLowerCase())}</span> in this table.</p>
    ${svg}
    ${h.also.length ? `<p class="sec-p small">The same key is also listed for ${h.also.map((x) => `<span class="mono">${esc(PT.name[x])}</span>`).join(', ')}.</p>` : ''}`;
}

/** Every Entity Key List entry that names a column of this table, as the list states it. */
const keyEntries = new Map<number, { entity: string; cols: string[] }[]>();
for (let e = 0; e < ENT.name.length; e++) {
  const by = new Map<number, Set<string>>();
  for (const k of ENT.keys[e] as { c: string; ti: number }[]) if (k.ti >= 0) (by.get(k.ti) ?? by.set(k.ti, new Set()).get(k.ti)!).add(k.c.toLowerCase());
  for (const [t, cs] of by) (keyEntries.get(t) ?? keyEntries.set(t, []).get(t)!).push({ entity: String(ENT.name[e]), cols: keyOrder([...cs]) });
}
function keysCard(m: Model) {
  const ks = (keyEntries.get(m.t) ?? []).slice().sort((x, y) => x.entity.localeCompare(y.entity));
  return `<div class="panel keys">
    <div class="sec-h">${glyphSlot('key')}<h2>In Oracle's key list</h2><span class="count num">${ks.length}</span></div>
    ${ks.length ? `<div class="rows">${ks.map((k) => `<div class="row"><i>${esc(k.entity)}</i><span class="mono">${esc(k.cols.join(' + '))}</span></div>`).join('')}</div>` : `<p class="sec-p">${esc(NO_KEY)}</p>`}
  </div>`;
}
function recsCard(m: Model) {
  return `<div class="panel recs">
    <div class="sec-h">${glyphSlot('netsuite')}<h2>Loaded from NetSuite</h2></div>
    ${m.recs.length ? `<div class="rows">${m.recs.map((r) => `<div class="row"><span class="mono">${esc(r)}</span><span class="prov">${solid(18)}stated</span></div>`).join('')}</div>` : `<p class="sec-p">The lineage names no NetSuite record for this table.</p>`}
    <p class="sec-p small">${m.nStated === m.cols.length ? `All ${m.cols.length} columns name their NetSuite field in the lineage.` : `${m.nStated} of ${m.cols.length} columns name their NetSuite field in the lineage.`}</p>
  </div>`;
}

// ---------- ledger (B)
interface LedgerData { fields: number[]; fieldIx: Map<number, number>; right: { col: number; name?: string; sas: Set<number>; more: string[] }[]; colRight: Map<number, number[]>; colNames: Map<number, { name: string; sas: Set<number> }[]>; nameIx: Map<string, number> }
function ledgerData(m: Model): LedgerData {
  const cols = m.cols;
  const fields: number[] = []; const fieldIx = new Map<number, number>();
  for (const c of cols) for (const [f] of colSrc[c]) if (!fieldIx.has(f)) { fieldIx.set(f, fields.length); fields.push(f); }
  const colNames = new Map<number, { name: string; sas: Set<number> }[]>();
  for (const c of cols) {
    const mm = new Map<string, { name: string; sas: Set<number> }>();
    for (const p of physPres[c]) { const n = prcName(p); (mm.get(n) ?? mm.set(n, { name: n, sas: new Set() }).get(n)!).sas.add(saOfPres(p)); }
    colNames.set(c, [...mm.values()].sort((a, b) => b.sas.size - a.sas.size || a.name.localeCompare(b.name)));
  }
  const right: LedgerData['right'] = []; const nameIx = new Map<string, number>();
  for (const c of cols) {
    const first = colNames.get(c)!.find((e) => !nameIx.has(e.name));
    if (first) nameIx.set(first.name, right.length);
    right.push({ col: c, name: first?.name, sas: new Set(), more: [] });
  }
  for (const c of cols) for (const e of colNames.get(c)!) { const ix = nameIx.get(e.name); if (ix !== undefined) e.sas.forEach((x) => right[ix].sas.add(x)); }
  const own = new Map(cols.map((c, i) => [c, i]));
  const colRight = new Map<number, number[]>();
  for (const c of cols) {
    const mine: number[] = []; const row = right[own.get(c)!]; let cross = 0;
    for (const e of colNames.get(c)!) {
      const ix = nameIx.get(e.name);
      if (ix === undefined) row.more.push(e.name);
      else if (ix === own.get(c)) mine.push(ix);
      else if (cross < 1 && (!row.name || Math.abs(ix - own.get(c)!) <= 6)) { mine.push(ix); cross++; }
      else row.more.push(e.name);
    }
    if (row.more.length && !mine.includes(own.get(c)!)) mine.push(own.get(c)!);
    colRight.set(c, mine);
  }
  return { fields, fieldIx, right, colRight, colNames, nameIx };
}
function ledger(m: Model, L: LedgerData) {
  const sel = state.col;
  const hotFields = new Set<number>(), hotNames = new Set<string>();
  if (sel !== undefined) { colSrc[sel].forEach(([f]) => hotFields.add(f)); L.colNames.get(sel)!.forEach((e) => hotNames.add(e.name)); }
  const any = sel !== undefined;
  const hc = (hot: boolean) => (hot ? ' hot' : any ? ' cool' : '');
  const left = L.fields.length ? L.fields.map((f) =>
    `<div class="cell${hc(hotFields.has(f))}"><span class="lab mono"><span class="rec">${esc(REC.key[NF.record[f]])}.</span>${esc(nfName(f))}</span></div>`).join('')
    : `<div class="cell none"><span class="lab">No column of this table has a NetSuite source in Oracle's lineage.</span></div>`;
  const mid = m.cols.map((c) => {
    const isKey = m.keyCols.has(pcName(c).toLowerCase());
    const isLink = m.hdr && pcName(c).toLowerCase() === m.hdr.col.toLowerCase();
    const aside = !colSrc[c].length && L.fields.length ? '<span class="aside">no NetSuite source in Oracle\'s lineage</span>' : '';
    return `<div class="cell${hc(c === sel)}" data-c="${esc(pcName(c))}"><span class="lab mono">${esc(pcName(c))}</span>${isKey ? '<span class="badge key">key</span>' : ''}${isLink ? '<span class="badge link">to header</span>' : ''}${aside}</div>`;
  }).join('');
  const right = L.right.map((r) => {
    const more = r.more.length ? `<span class="badge more">+ ${r.more.length} more</span>` : '';
    if (!r.name) return `<div class="cell${r.more.length ? '' : ' spacer'}${hc(r.col === sel && !!r.more.length)}">${r.more.length ? `<span class="lab">${more}</span>` : physPres[r.col].length ? '' : '<span class="aside">no report column</span>'}</div>`;
    return `<div class="cell${hc(hotNames.has(r.name))}"><span class="lab">${esc(r.name)}</span>${more}<span class="aside num">${plural(r.sas.size, 'area')}</span></div>`;
  }).join('');
  return `<div class="ledger">
    <div class="lhead"><div>NetSuite source field</div><div></div><div>Warehouse column</div><div></div><div>Report column, by name</div></div>
    <div class="lbody"><div class="lcol" id="L">${left}</div><div class="gut" id="G1"></div><div class="lcol" id="Mc">${mid}</div><div class="gut" id="G2"></div><div class="lcol" id="R">${right}</div></div>
  </div>`;
}
function drawer(m: Model) {
  const c = state.col;
  if (c === undefined) {
    return `<div class="sec-h">${glyphSlot('report')}<h2>Pick a column</h2></div><p class="sec-p">Click a warehouse column to light its path from NetSuite to the reports. The address bar keeps the choice, so the link opens this exact view.</p>`;
  }
  const src = colSrc[c];
  const byS = new Map<number, Set<string>>();
  for (const p of physPres[c]) { const a = saOfPres(p); (byS.get(a) ?? byS.set(a, new Set()).get(a)!).add(prcName(p)); }
  const arr = [...byS].sort((a, b) => saLabel(a[0]).localeCompare(saLabel(b[0])));
  const names = new Set(physPres[c].map(prcName));
  return `<div class="sec-h">${glyphSlot('report')}<h2>Selected column</h2></div>
    <div class="d-name mono">${esc(pcName(c))}</div>
    ${src.length ? src.map(([f]) => `<div class="d-line"><span class="faint">from</span><span class="mono">${esc(fieldLabel(f))}</span><span class="prov">${solid(18)}stated</span></div>`).join('') : `<div class="d-line faint">No NetSuite source in Oracle's lineage.</div>`}
    <p class="d-sum">${plural(physPres[c].length, 'report column')} ${names.size === 1 ? `named <b>${esc([...names][0])}</b>` : `under ${plural(names.size, 'name')}`}, in ${plural(byS.size, 'subject area')}.</p>
    <div class="d-list">${arr.map(([a, ns]) => `<div class="d-sa"><span>${esc(saLabel(a))}</span>${names.size > 1 ? `<small>${esc([...ns].join(' · '))}</small>` : ''}</div>`).join('')}</div>`;
}

// ---------- dimensions + subject areas (A)
function dimsAndAreas(m: Model) {
  const nRows = m.saRows.length || 1;
  const shown = state.showAllDims ? m.dims : m.dims.slice(0, 16);
  const short = (d: number) => String(PT.name[d]).replace(/^DW_NS_/, '').replace(/_D$/, '');
  const dimRows = shown.map((d, i) => `<div class="drow">
      <span class="rk num">${i + 1}</span>
      <span class="mono dn" title="${esc(PT.name[d.d])}">${esc(short(d.d))}</span>
      <span class="fold" title="${esc(d.folders.join(' · '))}">${d.folders.length ? esc(d.folders.slice(0, 3).join(' · ')) + (d.folders.length > 3 ? ` <small>+${d.folders.length - 3}</small>` : '') : '<small>no report folder in these areas</small>'}</span>
      <span class="cnt"><i style="width:${(d.w / nRows) * 100}%"></i></span>
      <span class="w num">${d.w} of ${nRows}</span>
    </div>`).join('');
  const groups = (FA.name as string[]).map((fname, f) => {
    const its = m.saRows.filter((x) => saFa[x.s] === f).sort((a, b) => saLabel(a.s).localeCompare(saLabel(b.s)));
    if (!its.length) return '';
    const tag = (x: Model['saRows'][number]) => m.other === undefined ? '' : x.here && x.other ? 'both tables' : x.here ? 'this table' : `${m.secured ? 'base' : '_SEC'} table only`;
    return `<div class="sa-g"><div class="sa-k">${esc(fname)}<span class="num">${its.length}</span></div>${its.map((x) =>
      `<div class="sa-r"><span>${esc(saLabel(x.s))}</span><span class="t">${tag(x)}</span></div>`).join('')}</div>`;
  }).join('');
  return `<section class="band3">
    <div class="panel dims">
      <div class="sec-h">${glyphSlot('dimension')}<h2>Dimension tables in the same subject areas</h2><span class="count num">${m.dims.length}</span></div>
      <p class="sec-p">The lineage lists these dimension tables under the ${plural(nRows, 'subject area')} where ${m.other !== undefined ? 'this table or its <span class="mono">_SEC</span> namesake' : 'this table'} is a fact table. They are ranked by how many of those areas list them. Next to each are the report folders that read from it there.</p>
      <div class="drow hd"><span></span><span>Dimension table</span><span>Report folders that read from this table</span><span>Subject areas</span><span></span></div>
      ${dimRows || '<p class="sec-p">The lineage lists no dimension tables in these subject areas.</p>'}
      ${m.dims.length > 16 ? `<button class="more-btn" id="alldims">${state.showAllDims ? 'Show the top 16' : `Show all ${m.dims.length}`}</button>` : ''}
    </div>
    <div class="panel areas">
      <div class="sec-h">${glyphSlot('subjectArea')}<h2>Subject areas</h2><span class="count num">${m.saRows.length}</span></div>
      <p class="sec-p">Where the lineage lists ${m.other !== undefined ? 'this table or its <span class="mono">_SEC</span> namesake' : 'this table'} as a fact table, grouped by functional area.</p>
      ${groups || '<p class="sec-p">The lineage lists it as a fact table in no subject area.</p>'}
    </div>
  </section>`;
}

async function render() {
  M = M.t === state.t ? M : model(state.t);
  if (theme === 'craft') await loadCraft();
  const m = M;
  const L = ledgerData(m);
  document.title = `${m.name} · Fact page`;
  const rule = `<div class="rule${craftOn() ? ' ink-rule' : ''}" role="presentation"></div>`;
  app.innerHTML = `<div class="shell">
    ${topBar(m)}
    <main class="page">
      ${headline(m)}
      ${rule}
      <section class="band2">
        <div class="panel hdrp">${headerFigure(m)}</div>
        <div class="side">${recsCard(m)}${keysCard(m)}</div>
      </section>
      ${rule}
      <section class="band-ledger">
        <div class="panel ledp">
          <div class="sec-h">${glyphSlot('lines')}<h2>Column ledger</h2><span class="prov">${solid(18)}stated</span><span class="prov">${accentMark(18)}selected</span></div>
          <p class="sec-p">Every column of this table, from the NetSuite field the lineage names to the report columns that read it. ${m.nStated === m.cols.length ? `All ${m.cols.length} columns have a NetSuite source in the lineage.` : `${m.nStated} of ${m.cols.length} columns have a NetSuite source in the lineage.`}</p>
          ${ledger(m, L)}
        </div>
        <aside class="panel drawer">${drawer(m)}</aside>
      </section>
      ${rule}
      ${dimsAndAreas(m)}
      <footer class="foot">Built from the NSAW 25R4 lineage (${fmt(core.meta.ingest.csvRows)} rows), Oracle's Entity Key List and the 4.0 lineage workbook. The page shows only what they state.</footer>
    </main>
  </div>`;
  wire(m, L);
  await afterPaint(m, L);
}

function drawWires(gut: HTMLElement, wires: { a: HTMLElement; b: HTMLElement; inf: boolean; hot: boolean; cool: boolean }[]) {
  const g = gut.getBoundingClientRect(); const w = g.width;
  const ordered = wires.slice().sort((x, y) => +x.hot - +y.hot);
  const parts = ordered.map((wi) => {
    const ra = wi.a.getBoundingClientRect(), rb = wi.b.getBoundingClientRect();
    const y1 = ra.top + ra.height / 2 - g.top, y2 = rb.top + rb.height / 2 - g.top, mx = w / 2;
    const cls = ['w', wi.inf ? 'inf' : '', wi.hot ? 'hot' : '', wi.cool && !wi.hot ? 'cool' : '', wi.inf && craftOn() ? 'stitch' : ''].join(' ');
    return `<path class="${cls}" d="M0,${y1.toFixed(1)} C${mx},${y1.toFixed(1)} ${mx},${y2.toFixed(1)} ${w},${y2.toFixed(1)}"/>` + (wi.hot ? `<circle class="hotdot" cx="${w - 2}" cy="${y2.toFixed(1)}" r="2.2"/><circle class="hotdot" cx="2" cy="${y1.toFixed(1)}" r="2.2"/>` : '');
  });
  gut.innerHTML = `<svg class="wires" width="${w}" height="${g.height}">${parts.join('')}</svg>`;
}
function drawLedger(m: Model, L: LedgerData) {
  const Le = document.getElementById('L'), Me = document.getElementById('Mc'), Re = document.getElementById('R');
  if (!Le || !Me || !Re) return;
  const sel = state.col; const any = sel !== undefined;
  const w1: Parameters<typeof drawWires>[1] = [], w2: Parameters<typeof drawWires>[1] = [];
  m.cols.forEach((c, mi) => {
    const mEl = Me.children[mi] as HTMLElement;
    for (const [f, inf] of colSrc[c]) w1.push({ a: Le.children[L.fieldIx.get(f)!] as HTMLElement, b: mEl, inf, hot: c === sel, cool: any });
    for (const ri of L.colRight.get(c)!) w2.push({ a: mEl, b: Re.children[ri] as HTMLElement, inf: false, hot: c === sel, cool: any });
  });
  drawWires(document.getElementById('G1')!, w1); drawWires(document.getElementById('G2')!, w2);
}

function wire(m: Model, L: LedgerData) {
  app.querySelectorAll<HTMLElement>('[data-theme-btn]').forEach((b) => b.addEventListener('click', () => setParams({ theme: b.dataset.themeBtn! })));
  app.querySelectorAll<HTMLElement>('#Mc [data-c]').forEach((el) => el.addEventListener('click', () => {
    const v = el.dataset.c!; setParams({ col: state.col !== undefined && pcName(state.col) === v ? 'none' : v });
  }));
  document.getElementById('alldims')?.addEventListener('click', () => setParams({ dims: state.showAllDims ? null : 'all' }));
  // search
  const input = document.getElementById('q') as HTMLInputElement; const drop = document.getElementById('drop')!;
  let shown: Item[] = []; let selIdx = 0;
  const open = (it: Item) => {
    if (it.kind === 'table' && it.table !== undefined) return setParams({ t: String(PT.name[it.table]), col: null }, true);
    if (it.kind === 'column' && it.table !== undefined) return setParams({ t: String(PT.name[it.table]), col: pcName(it.col!) }, true);
    if (it.kind === 'report' && it.table !== undefined) return setParams({ t: String(PT.name[it.table]), col: pcName(it.col!) }, true);
    const q = it.kind === 'field' ? `trace=${encodeURIComponent(fieldKey(it.field!))}` : `q=${encodeURIComponent(it.label)}`;
    location.href = `/lab/explorer-b/?${q}`;
  };
  const paint = () => {
    const r = search(input.value);
    shown = r.results; if (selIdx >= shown.length) selIdx = 0;
    if (!input.value.trim()) {
      drop.innerHTML = `<div class="dd-hint">Type a name, or narrow with a typed filter:</div><div class="dd-chips">${['is:table', 'type:fact', 'in:"Sales Order"', 'area:"Order to Cash"', 'source:stated'].map((f) => `<button data-add='${esc(f)}'>${esc(f)}</button>`).join('')}</div>`;
    } else {
      drop.innerHTML = `${r.chips.length ? `<div class="dd-chips on">${r.chips.map((c) => `<span class="chip"><b>${esc(c.k)}</b>${esc(c.v)}</span>`).join('')}</div>` : ''}
        ${shown.length ? `<ul>${shown.map((it, i) => `<li class="res${i === selIdx ? ' sel' : ''}" data-i="${i}"><span class="kind">${icon(it.kind)}${KIND_LABEL[it.kind]}</span><span class="nm"><span class="${['table', 'column', 'field', 'record'].includes(it.kind) ? 'mono' : ''}">${esc(it.label)}</span><small>${esc(it.ctx)}</small></span><span class="reach">${it.reach ? plural(it.reach, 'area') : ''}</span></li>`).join('')}</ul>
        <div class="dd-foot">${fmt(r.total)} matches, ranked: exact names first, then tables and subject areas above columns.</div>` : `<div class="dd-hint">Nothing matches. Remove a filter or try a shorter word.</div>`}`;
    }
    drop.hidden = false;
    drop.querySelectorAll<HTMLElement>('.res').forEach((el) => el.addEventListener('mousedown', (e) => { e.preventDefault(); open(shown[+el.dataset.i!]); }));
    drop.querySelectorAll<HTMLElement>('[data-add]').forEach((b) => b.addEventListener('mousedown', (e) => { e.preventDefault(); input.value = (b.dataset.add! + ' ' + input.value).trim() + ' '; paint(); }));
  };
  let tm: number | undefined;
  input.addEventListener('focus', paint);
  input.addEventListener('input', () => { clearTimeout(tm); tm = window.setTimeout(paint, 80); });
  input.addEventListener('blur', () => { drop.hidden = true; });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); selIdx = Math.max(0, Math.min(shown.length - 1, selIdx + (e.key === 'ArrowDown' ? 1 : -1))); drop.querySelectorAll('.res').forEach((el, i) => el.classList.toggle('sel', i === selIdx)); }
    else if (e.key === 'Enter' && shown[selIdx]) open(shown[selIdx]);
    else if (e.key === 'Escape') { input.value = ''; input.blur(); }
  });
  window.onkeydown = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.focus(); } };
  window.onresize = () => drawLedger(m, L);
}

async function afterPaint(m: Model, L: LedgerData) {
  drawLedger(m, L);
  if (craftOn()) {
    const c = craft!;
    if (c.glyph) app.querySelectorAll<HTMLElement>('.gslot[data-glyph]').forEach((slot) => {
      try { slot.replaceChildren(c.glyph!(slot.dataset.glyph!, Number(slot.dataset.size) || 16, 'currentColor')); slot.classList.add('on'); } catch { /* leave the slot empty */ }
    });
  }
  drawLedger(m, L); // glyphs can shift rows by a pixel
  document.body.dataset.ready = '1';
}

// ------------------------------------------------------------------ boot
const fontsFor = ['400 13px "Source Serif 4"', '400 13px "Source Sans 3"', '600 13px "Inter Tight"', '400 13px Inter', '600 13px Inter', '400 12px "JetBrains Mono"', '500 12px "JetBrains Mono"'];
await Promise.all(fontsFor.map((f) => document.fonts.load(f))).catch(() => undefined);
await render();
