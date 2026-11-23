// The Index: ranked search over the ontology, ported from lab/paper-lineage and lab/explorer-combo.
// Build in two steps: buildSearchIndex(m) from core.json (areas, report folders, tables, NetSuite records), then
// extendSearchIndex(index, cm) once columns.json loads (warehouse columns, report column names, NetSuite fields).
// Every NetSuite record and field indexed is one Oracle's files state.
//
// Query syntax: free text plus typed filters, e.g.  grain:line type:fact order   area:"Order to Cash" is:table
//   is:     area | folder | table | column | report | record | field
//   type:   fact | dimension | hierarchy | calculated | enhanced | global | prediction | security
//   grain:  line | document | book (record, header: document)
//   area:   functional area name (substring)       in: subject area label (substring)
//   shared: yes | no (read in two or more subject areas)

import { primaryGrain } from './grain';
import { fieldLabel } from './model';
import type { ColumnModel, CoreModel, Grain, TableRole } from './types';

export type ItemKind = 'area' | 'folder' | 'table' | 'column' | 'report' | 'record' | 'field';

export interface SearchItem {
  kind: ItemKind;
  /** the name shown and matched */
  label: string;
  /** normalised label: lower-case letters and digits */
  norm: string;
  /** normalised core noun of a table name (DW_NS_ and role suffix removed) */
  core?: string;
  words: string[];
  /** subject areas the item reaches */
  reach: number;
  sas: number[];
  fas: number[];
  role?: TableRole;
  grain?: Grain;
  secured?: boolean;
  /** physicalTable (table, column; for a report name the table of the column most of its report columns read) */
  table?: number;
  /** physicalColumn */
  col?: number;
  field?: number;
  rec?: number;
  sa?: number;
}

export interface SearchIndex {
  items: SearchItem[];
  /** true once extendSearchIndex has run */
  extended: boolean;
  m: CoreModel;
}

export interface Chip { k: FilterKey; v: string }
export type FilterKey = 'is' | 'type' | 'grain' | 'area' | 'in' | 'shared';
export const FILTER_KEYS: FilterKey[] = ['is', 'type', 'grain', 'area', 'in', 'shared'];
export interface ParsedQuery { text: string; chips: Chip[] }

export interface SearchResult extends ParsedQuery {
  results: SearchItem[];
  total: number;
}

const KIND_W: Record<ItemKind, number> = { area: 18, table: 17, folder: 15, record: 14, field: 9, report: 7, column: 5 };
const IS_ALIAS: Record<string, ItemKind> = {
  area: 'area', areas: 'area', subject: 'area', subjectarea: 'area', sa: 'area',
  folder: 'folder', folders: 'folder', reporttable: 'folder', concept: 'folder',
  table: 'table', tables: 'table', column: 'column', columns: 'column', col: 'column',
  report: 'report', reports: 'report', reportcolumn: 'report',
  record: 'record', records: 'record', field: 'field', fields: 'field', netsuite: 'field',
};
const GRAIN_WORD: Record<Grain, string> = { line: 'line', document: 'document', book: 'book', other: 'keyed' };

export const normText = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export const wordsOf = (s: string): string[] => s.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

const nounOf = (name: string) => {
  let n = name.replace(/^DW_NS_/i, '');
  for (let i = 0; i < 3; i++) n = n.replace(/_(SEC|F|D|DH|G|EF|CF|SNAPSHOT|LINES|INSIGHTS)$/i, '');
  return n;
};

const fasOf = (m: CoreModel, sas: Iterable<number>) => {
  const s = new Set<number>();
  for (const a of sas) if (m.subjectAreas[a].fa >= 0) s.add(m.subjectAreas[a].fa);
  return [...s].sort((a, b) => a - b);
};

function item(it: Omit<SearchItem, 'norm' | 'words'>): SearchItem {
  return { ...it, norm: normText(it.label), words: wordsOf(it.label) };
}

/** Step one: core.json only. */
export function buildSearchIndex(m: CoreModel): SearchIndex {
  const items: SearchItem[] = [];
  for (const s of m.subjectAreas) items.push(item({ kind: 'area', label: s.label, reach: s.presentationColumns, sas: [s.i], fas: fasOf(m, [s.i]), sa: s.i }));

  const folders = new Map<string, Set<number>>();
  m.ptName.forEach((n, pt) => { (folders.get(n) ?? folders.set(n, new Set()).get(n)!).add(m.ptSa[pt]); });
  for (const [n, sas] of folders) { const s = [...sas].sort((a, b) => a - b); items.push(item({ kind: 'folder', label: n, reach: s.length, sas: s, fas: fasOf(m, s) })); }

  // Before columns load, a table's subject areas are the bus-matrix rows that list it (as a fact or a dimension).
  const listed: number[][] = m.tables.map(() => []);
  m.bus.rows.forEach((sa, r) => {
    for (const t of m.factsOfSa[sa]) listed[t].push(sa);
    for (const col of m.bus.cells[r]) listed[m.bus.columns[col]].push(sa);
  });
  for (const t of m.tables) {
    if (!t.columns) continue;
    const sas = [...new Set(listed[t.i])].sort((a, b) => a - b);
    items.push(item({
      kind: 'table', label: t.name, core: normText(nounOf(t.name)), reach: t.saCount, sas, fas: fasOf(m, sas),
      role: t.role, grain: primaryGrain(m, t.i)?.grain, secured: t.isSecured, table: t.i,
    }));
  }

  const REC = m.core.nodes.netsuiteRecord!.cols;
  m.recordKey.forEach((k, r) => {
    if (REC.explicit && !REC.explicit[r]) return;
    items.push(item({ kind: 'record', label: String(k), reach: Number(REC.saReachExplicit?.[r] ?? REC.saReach?.[r] ?? 0), sas: [], fas: [], rec: r }));
  });
  return { items, extended: false, m };
}

/** Step two: add column-level items and fill subject areas of tables and records. Idempotent. */
export function extendSearchIndex(index: SearchIndex, cm: ColumnModel): SearchIndex {
  if (index.extended) return index;
  const m = index.m;
  for (const it of index.items) {
    if (it.kind === 'table' && it.table !== undefined) { it.sas = cm.tableSas[it.table]; it.fas = fasOf(m, it.sas); it.reach = it.sas.length; }
    if (it.kind === 'record' && it.rec !== undefined) {
      const s = new Set<number>();
      for (const f of cm.recordFields[it.rec]) for (const a of cm.fieldSas[f]) s.add(a);
      it.sas = [...s].sort((a, b) => a - b); it.fas = fasOf(m, it.sas); it.reach = it.sas.length;
    }
  }
  for (let c = 0; c < cm.pcName.length; c++) {
    const t = cm.pcTable[c];
    if (t < 0) continue;
    const ti = m.tables[t];
    index.items.push(item({ kind: 'column', label: cm.pcName[c], reach: cm.colSas[c].length, sas: cm.colSas[c], fas: fasOf(m, cm.colSas[c]), role: ti.role, grain: primaryGrain(m, t)?.grain, secured: ti.isSecured, table: t, col: c }));
  }
  const byName = new Map<string, { sas: Set<number>; phys: Map<number, number> }>();
  for (let p = 0; p < cm.prcName.length; p++) {
    const n = cm.prcName[p];
    let e = byName.get(n);
    if (!e) byName.set(n, (e = { sas: new Set(), phys: new Map() }));
    e.sas.add(cm.prcSa[p]);
    for (const c of cm.presPhys[p]) e.phys.set(c, (e.phys.get(c) ?? 0) + 1);
  }
  for (const [n, e] of byName) {
    const best = [...e.phys].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
    const sas = [...e.sas].sort((a, b) => a - b);
    const t = best !== undefined && cm.pcTable[best] >= 0 ? cm.pcTable[best] : undefined;
    index.items.push(item({ kind: 'report', label: n, reach: sas.length, sas, fas: fasOf(m, sas), col: best, table: t }));
  }
  for (let f = 0; f < cm.nfName.length; f++) {
    if (!cm.fieldCols[f].length) continue;
    index.items.push(item({ kind: 'field', label: fieldLabel(cm, f), reach: cm.fieldSas[f].length, sas: cm.fieldSas[f], fas: fasOf(m, cm.fieldSas[f]), field: f, rec: cm.nfRecord[f] }));
  }
  index.extended = true;
  return index;
}

// ------------------------------------------------------------------ query chips

/** Split typed filters (key:value or key:"quoted value") from free text. Unknown keys stay in the text. */
export function parseQuery(q: string): ParsedQuery {
  const chips: Chip[] = [];
  const text = q.replace(/\b(\w+):("([^"]*)"|\S+)/g, (whole, k: string, raw: string, quoted?: string) => {
    const key = k.toLowerCase() as FilterKey;
    if (!FILTER_KEYS.includes(key)) return whole;
    chips.push({ k: key, v: quoted ?? raw });
    return ' ';
  }).replace(/\s+/g, ' ').trim();
  return { text, chips };
}

/** One chip as typed: area:"Order to Cash". */
export const chipText = (c: Chip): string => `${c.k}:${/\s/.test(c.v) ? `"${c.v}"` : c.v}`;

/** Chips first, then the free text. parseQuery(serializeQuery(p)) equals p. */
export const serializeQuery = (p: ParsedQuery): string => [...p.chips.map(chipText), p.text].filter(Boolean).join(' ');

function passes(m: CoreModel, it: SearchItem, c: Chip): boolean {
  const v = c.v.toLowerCase();
  switch (c.k) {
    case 'is': return it.kind === (IS_ALIAS[normText(v)] ?? v);
    case 'type': return !!it.role && it.role.startsWith(v.replace(/s$/, ''));
    case 'grain': return !!it.grain && (it.grain === v || GRAIN_WORD[it.grain].startsWith(v) || ((v === 'header' || v === 'record') && it.grain === 'document'));
    case 'area': return it.fas.some((f) => m.functionalAreas[f].name.toLowerCase().includes(v));
    case 'in': return it.sas.some((s) => m.subjectAreas[s].label.toLowerCase().includes(v));
    case 'shared': return v === 'yes' || v === 'true' ? it.reach >= 2 && it.kind !== 'area' : it.reach < 2;
  }
  return true;
}

function matchScore(it: SearchItem, qn: string, qw: string[]): number {
  if (!qn) return 1;
  if (it.norm === qn || it.core === qn) return 100;
  if (it.norm.startsWith(qn) || (it.core && it.core.startsWith(qn))) return 74;
  // every query word is a whole word of the name ("order" in DW_NS_SALES_ORDER_LINES_F): above a bare prefix of a
  // run-together column name (ORDERPRIORITY) once the kind weight is added
  if (qw.length && qw.every((w) => it.words.includes(w))) return it.norm.includes(qn) ? 66 : 54;
  if (qw.length && it.words.some((w) => w.startsWith(qw[0])) && qw.every((w) => it.norm.includes(w))) return it.norm.includes(qn) ? 58 : 46;
  if (it.norm.includes(qn)) return 38;
  if (qw.length > 1 && qw.every((w) => it.norm.includes(w))) return 24;
  return 0;
}

/** Score of one item for a query, 0 when it does not match. Exact name, then prefix, then contains; kind and reach break ties. */
export function scoreItem(it: SearchItem, qn: string, qw: string[]): number {
  const s = matchScore(it, qn, qw);
  if (!s) return 0;
  return s + KIND_W[it.kind] + Math.min(12, Math.log2(1 + it.reach) * 1.8) - (it.secured ? 4 : 0) - (!it.reach && it.kind !== 'record' ? 10 : 0);
}

/** Ranked search. An empty query (no text, no chips) returns no results. */
export function search(index: SearchIndex, query: string | ParsedQuery, opts: { limit?: number } = {}): SearchResult {
  const { text, chips } = typeof query === 'string' ? parseQuery(query) : query;
  if (!text && !chips.length) return { text, chips, results: [], total: 0 };
  const qn = normText(text), qw = wordsOf(text);
  const out: { it: SearchItem; s: number }[] = [];
  for (const it of index.items) {
    if (!chips.every((c) => passes(index.m, it, c))) continue;
    const s = scoreItem(it, qn, qw);
    if (s) out.push({ it, s });
  }
  out.sort((a, b) => b.s - a.s || b.it.reach - a.it.reach || a.it.label.localeCompare(b.it.label));
  const lim = opts.limit ?? out.length;
  return { text, chips, results: out.slice(0, lim).map((r) => r.it), total: out.length };
}
