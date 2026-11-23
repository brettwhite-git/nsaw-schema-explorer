// Impact trace: everything downstream of one NetSuite field, as Oracle's lineage states it.
// field -> warehouse columns (sourcedFrom) -> report columns (mapsTo) -> subject areas -> functional areas.

import { fieldKey, fieldLabel, findField } from './model';
import type { ReportName } from './ledger';
import type { ColumnModel, CoreModel, TableRole } from './types';

/** Reading order of table roles in a trace: facts first. */
export const ROLE_ORDER: TableRole[] = ['fact', 'enhanced', 'calculated', 'dimension', 'hierarchy', 'global', 'prediction', 'security', 'unknown'];

export interface TraceColumn {
  /** physicalColumn index */
  col: number;
  table: number;
  tableName: string;
  column: string;
  reportColumns: number;
  areas: number;
}

export interface TraceRoleGroup {
  role: TableRole;
  columns: TraceColumn[];
}

export interface TraceArea {
  sa: number;
  label: string;
  /** report columns in this area reading the field's columns */
  reportColumns: number;
  /** the field's warehouse columns this area reads */
  columns: number[];
}

export interface TraceFaGroup {
  /** functional area index, -1 for areas with none */
  fa: number;
  name: string;
  areas: TraceArea[];
}

export interface Trace {
  field: number;
  key: string;
  label: string;
  record: string;
  groups: TraceRoleGroup[];
  /** report column names, most areas first */
  reportNames: ReportName[];
  /** bundles for the fan-out, in functional-area order, areas by label */
  functionalAreas: TraceFaGroup[];
  totals: {
    warehouseColumns: number;
    reportColumns: number;
    subjectAreas: number;
    functionalAreas: number;
    /** functional areas in the model */
    functionalAreasAll: number;
  };
}

/** Trace a field by "record.field" (case-insensitive) or by index. Null when the field is not found. */
export function traceField(m: CoreModel, cm: ColumnModel, field: string | number): Trace | null {
  const f = typeof field === 'number' ? field : findField(cm, field);
  if (f === undefined || f < 0 || f >= cm.nfName.length) return null;
  const tOf = (c: number) => cm.pcTable[c];
  const roleOf = (c: number) => (tOf(c) >= 0 ? m.tables[tOf(c)].role : 'unknown');

  const links = cm.fieldCols[f].slice().sort((a, b) =>
    ROLE_ORDER.indexOf(roleOf(a)) - ROLE_ORDER.indexOf(roleOf(b))
    || cm.physPres[b].length - cm.physPres[a].length
    || (tOf(a) >= 0 && tOf(b) >= 0 ? m.tables[tOf(a)].name.localeCompare(m.tables[tOf(b)].name) : 0)
    || cm.pcName[a].localeCompare(cm.pcName[b]));

  const groups: TraceRoleGroup[] = [];
  const pres = new Set<number>();
  const saCols = new Map<number, Set<number>>();
  const saPres = new Map<number, number>();
  for (const c of links) {
    const role = roleOf(c);
    let g = groups[groups.length - 1];
    if (!g || g.role !== role) groups.push((g = { role, columns: [] }));
    const t = tOf(c);
    g.columns.push({ col: c, table: t, tableName: t >= 0 ? m.tables[t].name : '', column: cm.pcName[c], reportColumns: cm.physPres[c].length, areas: cm.colSas[c].length });
    for (const p of cm.physPres[c]) {
      if (pres.has(p)) continue;
      pres.add(p);
      const sa = cm.prcSa[p];
      saPres.set(sa, (saPres.get(sa) ?? 0) + 1);
    }
    for (const sa of cm.colSas[c]) (saCols.get(sa) ?? saCols.set(sa, new Set()).get(sa)!).add(c);
  }

  const names = new Map<string, { sas: Set<number>; n: number }>();
  for (const p of pres) {
    const n = cm.prcName[p];
    let e = names.get(n);
    if (!e) names.set(n, (e = { sas: new Set(), n: 0 }));
    e.sas.add(cm.prcSa[p]);
    e.n++;
  }
  const reportNames = [...names].map(([name, e]) => ({ name, areas: e.sas.size, columns: e.n }))
    .sort((a, b) => b.areas - a.areas || a.name.localeCompare(b.name));

  const byFa = new Map<number, TraceArea[]>();
  for (const [sa, cs] of saCols) {
    const fa = m.subjectAreas[sa].fa;
    (byFa.get(fa) ?? byFa.set(fa, []).get(fa)!).push({ sa, label: m.subjectAreas[sa].label, reportColumns: saPres.get(sa) ?? 0, columns: [...cs] });
  }
  const functionalAreas = [...byFa].sort((a, b) => (a[0] < 0 ? 1 : b[0] < 0 ? -1 : a[0] - b[0]))
    .map(([fa, areas]) => ({ fa, name: fa >= 0 ? m.functionalAreas[fa].name : '', areas: areas.sort((x, y) => x.label.localeCompare(y.label)) }));

  return {
    field: f, key: fieldKey(cm, f), label: fieldLabel(cm, f), record: m.recordKey[cm.nfRecord[f]],
    groups, reportNames, functionalAreas,
    totals: {
      warehouseColumns: links.length, reportColumns: pres.size, subjectAreas: saCols.size,
      functionalAreas: functionalAreas.filter((g) => g.fa >= 0).length, functionalAreasAll: m.functionalAreas.length,
    },
  };
}
