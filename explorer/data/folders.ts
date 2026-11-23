// Report folders (presentation tables, by name) that read a warehouse table: a folder reads the table when one of
// its presentation columns maps (mapsTo, stated) to one of the table's columns.

import type { ColumnModel, CoreModel } from './types';

export interface FolderCount {
  /** presentation table name, trimmed, e.g. "Created By User" */
  name: string;
  /** subject areas that have a folder of this name reading the table */
  areas: number;
  /** presentation columns in those folders that map to the table */
  columns: number;
}

/**
 * Folders whose columns map to this table, most areas first, then by name. With `within`, only folders in those
 * subject areas count. Empty when no presentation column maps to the table.
 */
export function reportFoldersReading(m: CoreModel, cm: ColumnModel, t: number, within?: Iterable<number>): FolderCount[] {
  const only = within ? new Set(within) : null;
  const by = new Map<string, { sas: Set<number>; cols: number }>();
  for (const c of cm.tableCols[t] ?? []) for (const p of cm.physPres[c]) {
    const sa = cm.prcSa[p];
    if (only && !only.has(sa)) continue;
    const name = m.ptName[cm.prcPt[p]];
    let e = by.get(name);
    if (!e) by.set(name, (e = { sas: new Set(), cols: 0 }));
    e.sas.add(sa);
    e.cols++;
  }
  return [...by].map(([name, e]) => ({ name, areas: e.sas.size, columns: e.cols }))
    .sort((a, b) => b.areas - a.areas || a.name.localeCompare(b.name));
}
