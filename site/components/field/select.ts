// Pure helpers for the impact trace page: resolve ?at= / ?sa=, the lit path, fan bundles, report names.
import { presTableName, type ColumnModel, type CoreModel, type Trace, type TableRole } from '../../../explorer/data';
import type { FanGroup, FanPair } from './FanWires';

export const ROLE_HEAD: Record<TableRole, string> = {
  fact: 'Fact tables',
  enhanced: 'Enhanced fact tables',
  calculated: 'Calculated tables',
  dimension: 'Dimension tables',
  hierarchy: 'Hierarchy tables',
  global: 'Global tables',
  prediction: 'Prediction tables',
  security: 'Secured tables',
  unknown: 'Other columns',
};

/** Fields offered under "Trace another" (only those present in the model are shown). */
export const SAMPLE_TRACES = ['customer.companyname', 'transactions.tranid', 'transactions.entity', 'currency.name', 'transactionline.memo'];

/** `TABLE.COLUMN` for a warehouse column (the ?at= value). */
export const atValue = (tableName: string, column: string): string => (tableName ? `${tableName}.${column}` : column);

export interface Selection {
  at?: number;
  sa?: number;
  any: boolean;
  hotCols: Set<number>;
  hotSas: Set<number>;
}

export function resolveSelection(m: CoreModel, cm: ColumnModel, t: Trace, at?: string, sa?: string): Selection {
  let atCol: number | undefined;
  if (at) {
    const want = at.toLowerCase();
    for (const g of t.groups) for (const c of g.columns) if (atValue(c.tableName, c.column).toLowerCase() === want) atCol = c.col;
  }
  let saIdx: number | undefined;
  if (sa && atCol === undefined) {
    const want = sa.toLowerCase();
    for (const g of t.functionalAreas) for (const a of g.areas) {
      if (m.subjectAreas[a.sa].slug === want || a.label.toLowerCase() === want) saIdx = a.sa;
    }
  }
  const hotCols = new Set<number>();
  const hotSas = new Set<number>();
  if (atCol !== undefined) { hotCols.add(atCol); for (const s of cm.colSas[atCol]) hotSas.add(s); }
  if (saIdx !== undefined) {
    hotSas.add(saIdx);
    for (const g of t.functionalAreas) for (const a of g.areas) if (a.sa === saIdx) a.columns.forEach((c) => hotCols.add(c));
  }
  return { at: atCol, sa: saIdx, any: atCol !== undefined || saIdx !== undefined, hotCols, hotSas };
}

/** One curve per (warehouse column, functional area); groups list the subject areas in display order. */
export function fanBundles(t: Trace): { pairs: FanPair[]; groups: FanGroup[] } {
  const pairs = new Map<string, FanPair>();
  const groups: FanGroup[] = [];
  for (const g of t.functionalAreas) {
    groups.push({ fa: g.fa, sas: g.areas.map((a) => a.sa) });
    for (const a of g.areas) for (const c of a.columns) {
      const k = `${c}|${g.fa}`;
      let p = pairs.get(k);
      if (!p) pairs.set(k, (p = { c, fa: g.fa, sas: [] }));
      p.sas.push(a.sa);
    }
  }
  return { pairs: [...pairs.values()], groups };
}

export interface NameRow { name: string; areas: number }

/** Report column names over a set of report columns, most subject areas first. */
export function namesOf(cm: ColumnModel, pres: Iterable<number>): NameRow[] {
  const by = new Map<string, Set<number>>();
  for (const p of pres) {
    const n = cm.prcName[p];
    let s = by.get(n);
    if (!s) by.set(n, (s = new Set()));
    s.add(cm.prcSa[p]);
  }
  return [...by].map(([name, s]) => ({ name, areas: s.size })).sort((a, b) => b.areas - a.areas || a.name.localeCompare(b.name));
}

export interface AreaRow { name: string; table: string }

/** Report columns in one subject area that read any of the given warehouse columns. */
export function areaReportColumns(cm: ColumnModel, sa: number, cols: number[]): AreaRow[] {
  const seen = new Set<number>();
  const out: AreaRow[] = [];
  for (const c of cols) for (const p of cm.physPres[c]) {
    if (cm.prcSa[p] !== sa || seen.has(p)) continue;
    seen.add(p);
    out.push({ name: cm.prcName[p], table: presTableName(cm, p) });
  }
  return out.sort((a, b) => a.table.localeCompare(b.table) || a.name.localeCompare(b.name));
}
