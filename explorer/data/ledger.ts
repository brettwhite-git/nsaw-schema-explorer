// The table ledger: one row per warehouse column, with the NetSuite fields Oracle's lineage states it is loaded from
// (sourcedFrom) and the report columns that read it (mapsTo), by name. Keys come from the Entity Key List only.

import { grainOf, headerOf, keyOrder } from './grain';
import { fieldKey, fieldLabel } from './model';
import type { ColumnModel, CoreModel } from './types';

export interface LedgerSource {
  /** netsuiteField index */
  field: number;
  /** "transactionline.item", lower-case, for links (findField) */
  key: string;
  /** "transactionline.item" as the workbook spells it */
  label: string;
  /** record key, e.g. "transactionline" */
  record: string;
}

export interface ReportName {
  name: string;
  /** subject areas with a report column of this name reading the column */
  areas: number;
  /** report columns of this name reading the column */
  columns: number;
}

export interface LedgerRow {
  /** physicalColumn index */
  col: number;
  name: string;
  sources: LedgerSource[];
  /** report column names, most areas first */
  reports: ReportName[];
  /** report columns reading this column */
  reportColumns: number;
  /** subject areas reading this column */
  areas: number;
  /** named in a key-list entry for this table */
  isKey: boolean;
  /** the column that holds the header's id (headerOf) */
  toHeader: boolean;
}

export interface LedgerSummary {
  columns: number;
  withSource: number;
  reachingReport: number;
  /** report columns reading any column of the table */
  reportColumns: number;
  /** subject areas reading any column of the table */
  subjectAreas: number;
}

export interface Ledger {
  table: number;
  rows: LedgerRow[];
  /** distinct source fields in row order */
  fields: number[];
  summary: LedgerSummary;
}

/** Key columns first (in key order), then the rest by name. */
export function ledgerRows(m: CoreModel, cm: ColumnModel, t: number): Ledger {
  const grains = grainOf(m, t);
  const hdr = headerOf(m, t);
  const keyCols = new Set<string>(grains.flatMap((g) => g.cols));
  if (hdr) keyCols.add(hdr.col.toLowerCase());
  const lead = keyOrder([...new Set([...(grains[0]?.cols ?? []), ...(hdr ? [hdr.col.toLowerCase()] : [])])]);
  const rank = (n: string) => lead.indexOf(n.toLowerCase()) + 1 || 999;
  const cols = (cm.tableCols[t] ?? []).slice()
    .sort((a, b) => rank(cm.pcName[a]) - rank(cm.pcName[b]) || cm.pcName[a].localeCompare(cm.pcName[b]));

  const fields: number[] = [];
  const seenField = new Set<number>();
  const allSas = new Set<number>();
  let reportColumns = 0, withSource = 0, reachingReport = 0;

  const rows = cols.map((c): LedgerRow => {
    const name = cm.pcName[c];
    const sources = cm.colSrc[c].map((f) => {
      if (!seenField.has(f)) { seenField.add(f); fields.push(f); }
      return { field: f, key: fieldKey(cm, f), label: fieldLabel(cm, f), record: m.recordKey[cm.nfRecord[f]] };
    });
    const by = new Map<string, { sas: Set<number>; n: number }>();
    for (const p of cm.physPres[c]) {
      const n = cm.prcName[p];
      let e = by.get(n);
      if (!e) by.set(n, (e = { sas: new Set(), n: 0 }));
      e.sas.add(cm.prcSa[p]);
      e.n++;
      allSas.add(cm.prcSa[p]);
    }
    const reports = [...by].map(([n, e]) => ({ name: n, areas: e.sas.size, columns: e.n }))
      .sort((a, b) => b.areas - a.areas || a.name.localeCompare(b.name));
    if (sources.length) withSource++;
    if (cm.physPres[c].length) reachingReport++;
    reportColumns += cm.physPres[c].length;
    return {
      col: c, name, sources, reports, reportColumns: cm.physPres[c].length, areas: cm.colSas[c].length,
      isKey: keyCols.has(name.toLowerCase()),
      toHeader: !!hdr && name.toLowerCase() === hdr.col.toLowerCase(),
    };
  });

  return { table: t, rows, fields, summary: { columns: rows.length, withSource, reachingReport, reportColumns, subjectAreas: allSas.size } };
}
