// Search helpers shared by the search page and the palette: one index per page load (core first, extended once
// columns.json is in), where each kind of item leads, the words shown beside it, and the side-column figures.
import { useEffect } from 'react';
import {
  buildSearchIndex, extendSearchIndex, fieldKey, fmt, grainSentence, plural, primaryGrain,
  type ColumnModel, type CoreModel, type ItemKind, type SearchIndex, type SearchItem,
} from '../../../explorer/data';
import { areaPath, fieldPath, searchPath, tablePath } from '../../routes';
import { loadColumns, useExplorer } from '../../useExplorer';

// ------------------------------------------------------------------ the index (module singleton)
let index: SearchIndex | null = null;

export interface SearchModel {
  index: SearchIndex | null;
  m: CoreModel | null;
  cm: ColumnModel | null;
  /** columns, report columns and NetSuite fields are indexed */
  extended: boolean;
  error: string | null;
}

/** The shared index. Core results come at once; `columns` asks for columns.json now instead of on idle. */
export function useSearchModel(opts: { columns?: boolean } = {}): SearchModel {
  const { core, columns, error } = useExplorer();
  const want = !!opts.columns;
  useEffect(() => { if (want) loadColumns().catch(() => {}); }, [want]);
  if (core && !index) index = buildSearchIndex(core);
  if (index && columns && !index.extended) extendSearchIndex(index, columns);
  return { index, m: core, cm: columns, extended: !!index?.extended, error };
}

// ------------------------------------------------------------------ words
export const KIND_WORD: Record<ItemKind, string> = {
  area: 'subject area', folder: 'report table', table: 'warehouse table', column: 'warehouse column',
  report: 'report column', record: 'NetSuite record', field: 'NetSuite field',
};
export const KIND_TAB: Record<ItemKind, string> = {
  area: 'Areas', folder: 'Report tables', table: 'Tables', column: 'Columns', report: 'Report cols', record: 'Records', field: 'Fields',
};
export const KIND_GROUP: Record<ItemKind, string> = {
  area: 'Subject areas', folder: 'Report tables', table: 'Warehouse tables', column: 'Warehouse columns',
  report: 'Report columns', record: 'NetSuite records', field: 'NetSuite fields',
};
export const TAB_ORDER: ItemKind[] = ['table', 'column', 'report', 'field', 'record', 'folder', 'area'];
const ROLE_LABEL: Record<string, string> = {
  fact: 'fact', dimension: 'dimension', hierarchy: 'hierarchy', calculated: 'calculated', enhanced: 'enhanced fact',
  global: 'global', prediction: 'prediction', security: 'security',
};

/** Names set in mono (warehouse and NetSuite identifiers); the rest in the serif. */
export const isMono = (k: ItemKind): boolean => k === 'table' || k === 'column' || k === 'field' || k === 'record';

/** The filters offered as toggles under the search field. */
export const FILTERS = ['grain:line', 'area:"Order to Cash"', 'shared:yes', 'type:fact', 'type:dimension', 'is:field'];

// ------------------------------------------------------------------ where an item leads
export function itemHref(m: CoreModel, cm: ColumnModel | null, it: SearchItem): string {
  const tname = (t: number) => m.tables[t].name;
  switch (it.kind) {
    case 'table': return tablePath(tname(it.table!));
    case 'column': return cm && it.col !== undefined ? tablePath(tname(it.table!), { col: cm.pcName[it.col] }) : tablePath(tname(it.table!));
    case 'report':
      if (it.table !== undefined) return tablePath(tname(it.table), { col: cm && it.col !== undefined ? cm.pcName[it.col] : null });
      return it.sas.length ? areaPath(m.subjectAreas[it.sas[0]].slug) : searchPath(`is:report ${it.label}`);
    case 'field': {
      if (!cm || it.field === undefined) return searchPath(it.label);
      const [rec, ...rest] = fieldKey(cm, it.field).split('.');
      return fieldPath(rec, rest.join('.'));
    }
    case 'record': return searchPath(`is:field ${m.recordKey[it.rec!]}.`);
    case 'area': return areaPath(m.subjectAreas[it.sa!].slug);
    case 'folder': return it.sas.length === 1 ? areaPath(m.subjectAreas[it.sas[0]].slug) : searchPath(`is:report ${it.label}`);
  }
}

/** The second line under a name: a grain sentence, the table a column lives in, a functional area. Null when the data says nothing. */
export function itemContext(m: CoreModel, cm: ColumnModel | null, it: SearchItem): { text: string; style?: 'grain' | 'mono'; lead?: string } | null {
  switch (it.kind) {
    case 'table': {
      const g = grainSentence(m, it.table!);
      if (g) return { text: g, style: 'grain' };
      const n = m.tables[it.table!].columns;
      return n ? { text: plural(n, 'column') } : null;
    }
    case 'column': return { lead: 'in ', text: m.tables[it.table!].name, style: 'mono' };
    case 'report': return it.table !== undefined ? { lead: 'reads ', text: m.tables[it.table].name + (cm && it.col !== undefined ? `.${cm.pcName[it.col]}` : ''), style: 'mono' } : null;
    case 'field': {
      if (!cm || it.field === undefined) return null;
      const n = cm.fieldCols[it.field].length;
      return n ? { text: `loads ${plural(n, 'warehouse column')}` } : null;
    }
    case 'record': {
      if (!cm || it.rec === undefined) return null;
      const n = cm.recordFields[it.rec].filter((f) => cm.fieldCols[f].length).length;
      return n ? { text: plural(n, 'field') } : null;
    }
    case 'area': {
      const fa = m.subjectAreas[it.sa!].fa;
      return fa >= 0 ? { text: m.functionalAreas[fa].name } : null;
    }
    case 'folder': {
      const names = it.fas.map((f) => m.functionalAreas[f].name);
      return names.length ? { text: names.slice(0, 3).join(' · ') + (names.length > 3 ? ` and ${names.length - 3} more` : '') } : null;
    }
  }
}

/** Short notes in the third column: the table's role, secured, a stated source. */
export function itemNotes(cm: ColumnModel | null, it: SearchItem): string[] {
  const out: string[] = [];
  if (it.kind === 'table' && it.role && ROLE_LABEL[it.role]) out.push(ROLE_LABEL[it.role]);
  if ((it.kind === 'table' || it.kind === 'column') && it.secured) out.push('secured');
  if (it.kind === 'column' && cm && it.col !== undefined && cm.colSrc[it.col].length) out.push('NetSuite source stated');
  return out;
}

/** The right-hand figure, like a page number: subject areas reached (report columns for an area). */
export function itemReach(it: SearchItem): { n: string; unit: string } | null {
  if (it.kind === 'area') return { n: fmt(it.reach), unit: it.reach === 1 ? 'report column' : 'report columns' };
  return it.reach ? { n: fmt(it.reach), unit: it.reach === 1 ? 'area' : 'areas' } : null;
}

// ------------------------------------------------------------------ highlight
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Split a label around the stretch the query words match, for a <mark>. */
export function highlightParts(label: string, text: string): [string, string, string] | null {
  const qw = text.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!qw.length) return null;
  const mt = label.match(new RegExp(qw.map(escRe).join('[\\s_.\\-]*'), 'i'));
  if (!mt || mt.index === undefined) return null;
  return [label.slice(0, mt.index), mt[0], label.slice(mt.index + mt[0].length)];
}

// ------------------------------------------------------------------ figures for the side column
export interface Figures {
  tables: number;
  columns: number | null;
  reportNames: number | null;
  fields: number | null;
  /** warehouse columns with a stated NetSuite source / all warehouse columns */
  stated: [number, number] | null;
  /** report columns reaching a stated NetSuite field / all report columns */
  reaching: [number, number] | null;
  /** fact tables (_SEC copies aside) with a grain in the Entity Key List / those fact tables */
  grained: [number, number];
  /** most shared dimensions: physicalTable and subject areas */
  shared: { t: number; n: number }[];
  areas: number;
}

const cache = new WeakMap<CoreModel, { cm: ColumnModel | null; f: Figures }>();
export function figures(m: CoreModel, cm: ColumnModel | null): Figures {
  const hit = cache.get(m);
  if (hit && hit.cm === cm) return hit.f;
  const facts = m.tables.filter((t) => t.columns > 0 && t.role === 'fact' && !t.isSecured);
  const order = m.bus.columns.map((t, i) => ({ t, n: m.bus.columnSaCount[i] })).sort((a, b) => b.n - a.n || m.tables[a.t].name.localeCompare(m.tables[b.t].name));
  const f: Figures = {
    tables: m.tables.filter((t) => t.columns > 0).length,
    columns: null, reportNames: null, fields: null, stated: null, reaching: null,
    grained: [facts.filter((t) => primaryGrain(m, t.i)).length, facts.length],
    shared: order.slice(0, 7),
    areas: m.subjectAreas.length,
  };
  if (cm) {
    let all = 0, src = 0;
    for (let c = 0; c < cm.pcName.length; c++) if (cm.pcTable[c] >= 0) { all++; if (cm.colSrc[c].length) src++; }
    let reach = 0;
    for (let p = 0; p < cm.prcName.length; p++) if (cm.presPhys[p].some((c) => cm.colSrc[c].length)) reach++;
    f.columns = all;
    f.stated = [src, all];
    f.reaching = [reach, cm.prcName.length];
    f.reportNames = new Set(cm.prcName).size;
    f.fields = cm.fieldCols.filter((x) => x.length).length;
  }
  cache.set(m, { cm, f });
  return f;
}

export const pct = ([a, b]: [number, number]): string => `${Math.round((a / Math.max(1, b)) * 100)}%`;
